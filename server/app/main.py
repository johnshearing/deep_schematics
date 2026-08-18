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
from fastapi.responses import (
    FileResponse,
    JSONResponse,
    RedirectResponse,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi.errors import RateLimitExceeded

from . import __version__
from .claude_runner import ClaudeRunner, TurnRegistry
from .config import STATIC_DIR, Settings, get_settings
from .drawing import (
    DrawingUnavailable,
    designator_index,
    drawing_summary,
    load_circuit_logic,
    source_document,
    tile_file,
    tile_manifest,
)
from .limits import ConcurrencyGate, SpendLedger, make_limiter
from .locations import (
    LocationsRefused,
    load_locations,
    locations_path,
    resolve_geometry,
    save_locations,
    skeleton,
)
from .prompts import PROMPT_VERSION
from .questions import starter_questions
from .sessions import SessionStore

log = logging.getLogger(__name__)

#: Plan §3.4, kept as one string so the header and `vite.config.ts`'s meta tag cannot drift.
CSP_BASE = (
    "default-src 'self'; img-src 'self' data:; connect-src 'self'; "
    "script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'"
)
#: No exceptions. There was one — `/api/source` answered with `frame-ancestors 'self'` so the
#: PDF could be shown in an iframe — and it went away with the iframe: the drawing is now
#: rendered from the tile PNGs by our own code, and the PDF is a plain link to a new browser
#: tab, which framing rules do not touch.
CSP = f"{CSP_BASE}; frame-ancestors 'none'"


class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    session_id: str | None = None
    model: str | None = None


class UnlockRequest(BaseModel):
    password: str = ""


class LocationsRequest(BaseModel):
    """The whole `locations.json`, as the editor holds it.

    `dict[str, Any]` rather than a modelled schema on purpose: `app/locations.py` is the one
    validator, it reports per field into a `problems` list the editor shows, and a pydantic model
    here would be a second one — rejecting the whole document with a 422 for a single bad
    coordinate, in different words, before the first ever ran.
    """

    document: dict[str, Any]


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
            # PUT is here for the Locate editor's one write. It is still only reachable when
            # `allow_edits` registered the route — CORS decides who may call an endpoint, not
            # whether it exists.
            allow_methods=["GET", "POST", "PUT"],
            allow_headers=["Content-Type", "X-Demo-Password", "X-Editor-Password"],
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Plan §3.4. The meta tag in `index.html` covers the built bundle wherever it is
        served from; this covers everything, including API responses."""
        path = request.url.path
        response = await call_next(request)
        response.headers.setdefault("Content-Security-Policy", CSP)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")

        # Cache policy for the built frontend. `StaticFiles` sends only an etag, which leaves
        # `index.html` to the browser's *heuristic* cache — and a stale index.html pins the old
        # hashed bundle name, so a visitor keeps running the previous build with the current
        # server. That combination shipped a UI whose password prompt did not exist yet.
        # Asset filenames are content-hashed by Vite, so they are safe to cache forever; the
        # HTML that names them must always be revalidated.
        if path.startswith("/webui/assets/"):
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        elif path.startswith("/webui"):
            response.headers.setdefault("Cache-Control", "no-cache")
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
            # Whether this server has a Locate tab at all. Published rather than inferred,
            # because with `allow_edits` false the routes do not exist and a client that
            # discovered the tab by probing would offer a screen that cannot save.
            "editing": {
                "enabled": settings.allow_edits,
                "password_required": settings.editor_password_required,
                "by": settings.editor_name or None,
            },
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

    @app.get("/api/designators")
    async def designators() -> dict[str, Any]:
        """Every citable identifier, with where it is on the sheet.

        Its own endpoint rather than another field on `/api/drawing`, for two reasons: it is
        ten times the size of everything else there, and it is the one thing whose absence has
        to degrade *quietly*. A client that cannot load this gets an answer whose citations are
        plain text — which is precisely what shipped before — instead of a broken front page.
        """
        try:
            return designator_index(settings.drawing_dir)
        except DrawingUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/source")
    async def source() -> FileResponse:
        """The original vector sheet — now the escape hatch rather than the viewer.

        The Drawing tab renders the 400 DPI tiles, which is what makes overlays and
        highlighting possible at all. Two things the tiles cannot do are print well and follow
        you to a second monitor, and for those this endpoint is a plain link to a new browser
        tab. It also out-zooms the rasters, being vector.
        """
        path = source_document(settings.drawing_dir)
        if path is None:
            raise HTTPException(404, "There is no source drawing beside this extraction.")
        return FileResponse(
            path,
            media_type="application/pdf",
            headers={
                # Quotes stripped because the filename comes off disk and lands in a header.
                "Content-Disposition": f'inline; filename="{path.name.replace(chr(34), "")}"',
                "Cache-Control": "public, max-age=3600",
            },
        )

    @app.get("/api/tiles/{name}")
    async def tile(name: str) -> FileResponse:
        """One tile of the rendered sheet.

        The grid and each tile's rectangle come down with `/api/drawing`; this serves the
        pixels. `tile_file` will only return a path the manifest itself lists, so the name in
        the URL cannot select anything else on disk.
        """
        path = tile_file(settings.drawing_dir, name)
        if path is None:
            raise HTTPException(404, "No such tile.")
        return FileResponse(
            path,
            media_type="image/png",
            # Content-hashed by nothing, so not immutable — but a re-extraction is a deploy,
            # and an hour of staleness on a 2 MB raster set is the right trade on a shop floor.
            headers={"Cache-Control": "public, max-age=3600"},
        )

    @app.get("/api/questions")
    async def questions() -> dict[str, Any]:
        return {"questions": starter_questions()}

    @app.post("/api/unlock")
    @limiter.limit(
        lambda: app.state.settings.unlock_rate_limit,
        exempt_when=lambda: not settings.rate_limit_enabled,
    )
    async def unlock(request: Request, body: UnlockRequest) -> JSONResponse:
        """Check the demo password up front, so a typo fails here instead of at question time.

        Without this the browser cannot tell a good password from a bad one until it spends a
        question and gets a 403 back. Rate-limited on its own bucket: this is the one endpoint
        where guessing is the attack, and `/api/ask`'s limit is scoped per-endpoint.

        Returns a `JSONResponse` rather than a dict because slowapi injects its `X-RateLimit-*`
        headers into the returned object and raises on anything that is not a `Response`.
        """
        settings_ = app.state.settings
        if not settings_.password_required:
            return JSONResponse({"unlocked": True, "password_required": False})
        if not _check_password(settings_, body.password):
            raise HTTPException(401, "That is not the demo password.")
        return JSONResponse({"unlocked": True, "password_required": True})

    # -- the Locate editor, only when this server was started to allow it -------------------
    #
    # Registered inside an `if`, which is the point: with `allow_edits` false there is no route
    # to guess a password against, no handler to find a bug in, and nothing to rate-limit. A
    # public demo is not a locked editor, it is a server with no editor in it.

    if settings.allow_edits:

        @app.post("/api/editor/unlock")
        @limiter.limit(
            lambda: app.state.settings.unlock_rate_limit,
            exempt_when=lambda: not settings.rate_limit_enabled,
        )
        async def editor_unlock(request: Request, body: UnlockRequest) -> JSONResponse:
            """Mirror of `/api/unlock`, on a *different* password and the same tight bucket.

            The client keeps what it is given in memory only and sends it back as
            `X-Editor-Password` — exactly how the demo password already works. That is the whole
            "scope": no server-side session, so nothing to expire, leak or forge, and closing the
            tab is a logout.
            """
            settings_ = app.state.settings
            if not settings_.editor_password_required:
                return JSONResponse({"unlocked": True, "password_required": False})
            if not _check_editor_password(settings_, body.password):
                raise HTTPException(401, "That is not the editor password.")
            return JSONResponse({"unlocked": True, "password_required": True})

        @app.get("/api/locations")
        async def get_locations(
            x_editor_password: Annotated[str | None, Header()] = None,
        ) -> dict[str, Any]:
            """The authored geometry file, verbatim, or an empty one shaped like it.

            Verbatim because the editor sends it straight back: anything this endpoint
            normalised away — a `by`, an `at`, a comment field a later version adds — would be
            silently deleted on the next save. An extraction nobody has placed anything on yet
            gets `skeleton()` rather than a 404, so the load path has one shape.
            """
            _require_editor(app.state.settings, x_editor_password)
            path = locations_path(settings.drawing_dir)
            try:
                document = json.loads(path.read_text("utf-8"))
                present = True
            except FileNotFoundError:
                document, present = skeleton(*_drawing_identity(settings)), False
            except (OSError, json.JSONDecodeError) as exc:
                raise HTTPException(500, f"locations.json could not be read: {exc}") from exc
            return {
                "present": present,
                "document": document,
                "report": _locations_report(settings),
            }

        @app.put("/api/locations")
        async def put_locations(
            body: LocationsRequest,
            x_editor_password: Annotated[str | None, Header()] = None,
        ) -> dict[str, Any]:
            """Replace the file. Whole, atomic, and the parse cache cleared behind it.

            Answers with the fresh `report`, so the editor is told what the *next* reader will
            refuse rather than what this handler happened to like. `stale` is the banner: the
            viewer is current the moment this returns, but `circuit_logic.json` — the artifact
            the model reads — is behind until someone re-runs `author_circuit_logic.py`. This
            server does not run Python on request, and should not start now.
            """
            _require_editor(app.state.settings, x_editor_password)
            number, page = _drawing_identity(settings)
            try:
                save_locations(
                    settings.drawing_dir,
                    body.document,
                    drawing_number=number,
                    page_size_pt=page,
                )
            except LocationsRefused as exc:
                raise HTTPException(409, str(exc)) from exc
            except OSError as exc:
                raise HTTPException(500, f"locations.json could not be written: {exc}") from exc
            return {
                "saved": True,
                "report": _locations_report(settings),
                "stale": "circuit_logic.json is behind locations.json — re-run "
                "`python author_circuit_logic.py` in the extraction directory.",
            }

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
            # With `anonymous_models` empty there is no fallback to name, and the old wording
            # trailed off into "you can use: ." — say what to do instead.
            detail = (
                f"{model} is available with the demo password. Without it you can use: "
                f"{', '.join(settings_.anonymous_models)}."
                if settings_.anonymous_models
                else "This demo needs a password. Use Unlock, at the top right."
            )
            raise HTTPException(403, detail)

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


def _drawing_identity(settings: Settings) -> tuple[str | None, list[float] | None]:
    """Which drawing this server is serving, and at what page size — the two facts a stored
    coordinate is only meaningful against. Both are best-effort: a drawing that has never been
    tiled has no page size, and that is a reason to skip the check rather than to refuse."""
    try:
        number = (load_circuit_logic(settings.drawing_dir).get("drawing") or {}).get(
            "drawing_number"
        )
    except DrawingUnavailable:
        number = None
    manifest = tile_manifest(settings.drawing_dir)
    return (number if isinstance(number, str) else None), (
        manifest["page_size_pt"] if manifest else None
    )


def _locations_report(settings: Settings) -> dict[str, Any]:
    """What `/api/designators` publishes under `locations`, without rebuilding 275 entries.

    Through the resolver rather than the raw parse, so the editor is told about the problems only
    the netlist can reveal — a point placed on a component that has since been renamed, a pin two
    sites both claim — and not merely about malformed JSON.
    """
    try:
        doc = load_circuit_logic(settings.drawing_dir)
    except DrawingUnavailable:
        stored = load_locations(settings.drawing_dir)
        return {"file": stored.present, **stored.counts(), "problems": list(stored.problems)}
    manifest = tile_manifest(settings.drawing_dir)
    geometry = resolve_geometry(
        settings.drawing_dir, doc, manifest["page_size_pt"] if manifest else None
    )
    return geometry.report()


def _require_editor(settings: Settings, supplied: str | None) -> None:
    if not settings.editor_password_required:
        return
    if not (supplied and _constant_eq(supplied, settings.editor_password)):
        raise HTTPException(401, "The editor is locked. Unlock it before saving.")


def _check_editor_password(settings: Settings, supplied: str | None) -> bool:
    if not settings.editor_password_required:
        return True
    return bool(supplied) and _constant_eq(supplied, settings.editor_password)


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
