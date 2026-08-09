"""FastAPI app factory and the five v1 endpoints.

Transport is **NDJSON over POST** (plan §5), not SSE and not WebSocket:

- `EventSource` is GET-only, so a long question would not fit in the request — and its
  automatic reconnect would **silently re-issue a paid question**. That is disqualifying on
  its own.
- WebSocket is probably right eventually, but it costs connection-lifecycle and reconnect
  logic for no v1 benefit.

Cancellation is why the choice matters: `abort()` on the client tears down the request,
uvicorn reports a disconnect, and the generator's `finally` kills the child. But disconnect
detection alone is not enough — a `StreamingResponse` generator only notices a dead socket
when it next tries to yield — so there is also a heartbeat and an explicit cancel endpoint.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi.errors import RateLimitExceeded

from . import __version__
from .claude_runner import ClaudeRunner, TurnRegistry
from .config import STATIC_DIR, Settings, get_settings
from .drawing import DrawingUnavailable, drawing_summary
from .limits import ConcurrencyGate, SpendLedger, make_limiter
from .prompts import PROMPT_VERSION
from .questions import starter_questions
from .sessions import SessionStore

log = logging.getLogger(__name__)

class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    session_id: str | None = None
    model: str | None = None


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="Schematic WebUI",
        version=__version__,
        docs_url=None,  # nothing to gain on a public endpoint; the README is the contract
        redoc_url=None,
    )
    # Per-app, not module-global: the rate-limit buckets belong to this instance, so two
    # apps in one process (which is exactly what the test suite builds) cannot share state.
    limiter = make_limiter()
    app.state.settings = settings
    app.state.limiter = limiter
    app.state.sessions = SessionStore(settings.max_sessions, settings.session_ttl_s)
    app.state.turns = TurnRegistry()
    app.state.gate = ConcurrencyGate(settings.max_concurrent_turns)
    app.state.ledger = SpendLedger(settings.state_dir / "spend.json",
                                   settings.daily_spend_ceiling_usd)
    app.state.runner = ClaudeRunner(settings, app.state.turns)

    if settings.dev_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.dev_origins,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type", "X-Demo-Password"],
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Plan §3.4. The meta tag in `index.html` covers the built bundle wherever it is
        served from; this covers everything, including API responses."""
        response = await call_next(request)
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; connect-src 'self'; "
            "script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; "
            "form-action 'none'; frame-ancestors 'none'",
        )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "detail": (
                    f"Rate limit reached ({settings.rate_limit}). Each question costs real "
                    "money and takes up to two minutes, so this demo asks you to pace "
                    "yourself. Try the drawing panel meanwhile — it is free and instant."
                )
            },
        )

    # -- free endpoints -------------------------------------------------------------------

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        spend = app.state.ledger.snapshot()
        return {
            "ok": True,
            "version": __version__,
            "prompt_version": PROMPT_VERSION,
            "claude": await asyncio.to_thread(_claude_version, settings),
            "drawing_dir": str(settings.drawing_dir),
            "drawing_dir_present": (settings.drawing_dir / "circuit_logic.json").exists(),
            "models": settings.allowed_models,
            "default_model": settings.default_model,
            "anonymous_models": settings.anonymous_models,
            "password_required": settings.password_required,
            "spend": {
                "day": spend.day,
                "spent_usd": spend.spent_usd,
                "ceiling_usd": spend.ceiling_usd,
                "remaining_usd": round(spend.remaining_usd, 4),
                "exhausted": spend.exhausted,
            },
            "in_flight": app.state.gate.in_flight,
            "concurrency_limit": app.state.gate.limit,
            "sessions": len(app.state.sessions),
        }

    @app.get("/api/drawing")
    async def drawing() -> dict[str, Any]:
        try:
            return drawing_summary(settings.drawing_dir)
        except DrawingUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/questions")
    async def questions() -> dict[str, Any]:
        return {"questions": starter_questions()}

    # -- the one endpoint that spends money -----------------------------------------------

    @app.post("/api/ask")
    @limiter.limit(
        lambda: settings.rate_limit, exempt_when=lambda: not settings.rate_limit_enabled
    )
    async def ask(
        request: Request,
        body: AskRequest,
        x_demo_password: Annotated[str | None, Header()] = None,
    ) -> StreamingResponse:
        settings_ = app.state.settings

        question = body.question.strip()
        if not question:
            raise HTTPException(400, "Ask something.")
        if len(question) > settings_.max_question_chars:
            raise HTTPException(
                413, f"Question is longer than {settings_.max_question_chars} characters."
            )

        authed = _check_password(settings_, x_demo_password)
        model = body.model or settings_.default_model
        if model not in settings_.allowed_models:
            raise HTTPException(400, f"Unknown model {model!r}.")
        if settings_.password_required and not authed and model not in settings_.anonymous_models:
            raise HTTPException(
                403,
                f"{model} is available with the demo password. Without it you can use: "
                f"{', '.join(settings_.anonymous_models)}.",
            )

        spend = app.state.ledger.snapshot()
        if spend.exhausted:
            # Disable with a clear message rather than silently degrading (plan §3.2).
            raise HTTPException(
                503,
                f"The daily budget for this demo (${spend.ceiling_usd:.2f}) is spent. It "
                f"resets tomorrow. The drawing panel and the question list still work.",
            )

        session, is_new = app.state.sessions.get_or_create(body.session_id, model)
        if session.turns >= settings_.max_turns_per_session:
            raise HTTPException(
                429,
                f"This conversation has reached {settings_.max_turns_per_session} questions. "
                "Start a new one.",
            )
        if session.lock.locked():
            # Two concurrent asks on one session would interleave writes into the same
            # transcript, and `--resume` would then read a conversation that never happened.
            raise HTTPException(409, "That conversation is already answering a question.")
        # Fast path: `Lock.acquire()` on an uncontended lock returns without suspending, so
        # there is no window between the check above and this acquisition.
        await session.lock.acquire()

        if not app.state.gate.try_acquire():
            session.lock.release()
            raise HTTPException(
                503,
                f"All {app.state.gate.limit} answer slots are busy. Each takes up to two "
                "minutes — please try again shortly.",
            )

        turn_id = str(uuid.uuid4())
        stream = _stream_turn(
            app=app,
            session=session,
            question=question,
            model=model,
            resume=session.resumable and not is_new,
            turn_id=turn_id,
        )
        return StreamingResponse(
            stream,
            media_type="application/x-ndjson",
            headers={
                "Cache-Control": "no-store",
                "X-Accel-Buffering": "no",  # nginx et al: do not buffer a stream
                "X-Turn-Id": turn_id,
            },
        )

    @app.post("/api/turns/{turn_id}/cancel")
    async def cancel(turn_id: str) -> dict[str, Any]:
        turn = app.state.turns.get(turn_id)
        if turn is None:
            # Already finished, or never existed. Either way the caller wants it stopped and
            # it is stopped, so this is not an error.
            return {"cancelled": False, "reason": "not running"}
        await turn.cancel()
        return {"cancelled": True}

    # -- static ---------------------------------------------------------------------------

    if STATIC_DIR.is_dir():
        app.mount("/webui", StaticFiles(directory=STATIC_DIR, html=True), name="webui")

        @app.get("/")
        async def root() -> RedirectResponse:
            return RedirectResponse("/webui/")
    else:

        @app.get("/")
        async def root_dev() -> dict[str, str]:
            return {
                "detail": "No built frontend. Run `npm run dev` in webui/, or "
                "`npm run build` to serve it from here at /webui/."
            }

    return app


async def _stream_turn(
    *,
    app: FastAPI,
    session: Any,
    question: str,
    model: str,
    resume: bool,
    turn_id: str,
) -> AsyncIterator[bytes]:
    """Wrap the runner's events as NDJSON and keep the ledger honest.

    Cost is recorded from the `done` event whatever the outcome — a cancelled or errored turn
    has usually still spent something, and a budget that only counts successes is not a
    budget.
    """
    runner: ClaudeRunner = app.state.runner
    recorded = False
    try:
        async for event in runner.run(
            question=question,
            model=model,
            session_id=session.id,
            resume=resume,
            turn_id=turn_id,
        ):
            if event["t"] == "done" and not recorded:
                recorded = True
                session.turns += 1
                session.cost_usd += event.get("cost_usd", 0.0)
                session.resumable = True
                snapshot = await app.state.ledger.record(event.get("cost_usd", 0.0))
                event = {
                    **event,
                    "session_cost_usd": round(session.cost_usd, 4),
                    "daily_spend_usd": snapshot.spent_usd,
                    "daily_ceiling_usd": snapshot.ceiling_usd,
                }
            yield (json.dumps(event, separators=(",", ":")) + "\n").encode("utf-8")
    except asyncio.CancelledError:
        log.info("turn %s cancelled by client disconnect", turn_id)
        raise
    except Exception as exc:  # noqa: BLE001 - the stream must always terminate cleanly
        log.exception("turn %s failed", turn_id)
        payload = {"t": "error", "code": "server_error", "message": str(exc)}
        yield (json.dumps(payload) + "\n").encode("utf-8")
    finally:
        app.state.gate.release()
        if session.lock.locked():
            session.lock.release()


def _check_password(settings: Settings, supplied: str | None) -> bool:
    if not settings.password_required:
        return True
    return bool(supplied) and _constant_eq(supplied or "", settings.demo_password)


def _constant_eq(a: str, b: str) -> bool:
    import hmac

    return hmac.compare_digest(a.encode(), b.encode())


_claude_version_cache: dict[str, str] = {}


def _claude_version(settings: Settings) -> str:
    key = settings.claude_bin
    if key in _claude_version_cache:
        return _claude_version_cache[key]
    binary = shutil.which(settings.claude_bin) or settings.claude_bin
    try:
        out = subprocess.run(  # noqa: S603
            [binary, "--version"], capture_output=True, text=True, timeout=15, check=False
        )
        version = (out.stdout or out.stderr).strip().splitlines()[0] if out.stdout or out.stderr \
            else "unknown"
    except (OSError, subprocess.SubprocessError, IndexError):
        version = "not found"
    _claude_version_cache[key] = version
    return version


app = create_app()
