"""Spawn headless `claude`, parse its stream-json, and hand back a tidy event stream.

This module is the security boundary of the whole application, so the interesting parts are
the two things it *refuses* to do rather than the things it does. See plan §1–§2.

- The child gets `--tools "Read,Grep,Glob"`. Bash, Write, Edit, WebFetch, WebSearch and Task
  do not exist in the session, so no instruction injected through a question — or through a
  file the model reads — can reach them. This is a stronger guarantee than a permission rule,
  because there is no decision to get wrong.
- The child gets `--allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)"`. Unqualified `Read`
  demonstrably reaches `/home/js/.claude.json` (§1.3), and `Read(*)` *looks* like it scopes
  and does not — its apparent refusal was model discretion, not a control (§1.4). Only the
  `./**` form produced recorded denials.

The three subprocess details in `_pump_stdout`, `_drain_stderr` and `Turn.cancel` all present
as "answers randomly stop" if you get them wrong; see plan §5.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import signal
import tempfile
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import Settings
from .prompts import PROMPT_VERSION, orientation_prompt

log = logging.getLogger(__name__)

#: asyncio's StreamReader defaults to a 64 KiB line limit and raises on overrun. A single
#: `tool_result` line carrying part of a 188 KB netlist blows straight through that. We read
#: in chunks rather than by line (see `_pump_stdout`) so the limit is belt-and-braces.
STREAM_LIMIT = 16 * 1024 * 1024
#: A single line longer than this is a runaway, not a tool result. Drop it rather than grow.
MAX_LINE_BYTES = 8 * 1024 * 1024

HEARTBEAT_S = 10.0
TEXT_FLUSH_S = 0.05
TEXT_FLUSH_CHARS = 512
SIGKILL_GRACE_S = 3.0

_SENTINEL = object()


@dataclass
class TurnStats:
    """What a finished turn cost, for the ledger and for the per-answer footer."""

    cost_usd: float = 0.0
    duration_ms: int = 0
    num_turns: int = 0
    is_error: bool = False
    subtype: str | None = None
    #: The CLI's own message. On an auth failure this is where "Not logged in · Please run
    #: /login" lands — `subtype` unhelpfully still says "success".
    result_text: str | None = None
    claude_session_id: str | None = None
    denials: list[dict[str, Any]] = field(default_factory=list)


class Turn:
    """One in-flight question. Registered so the Stop button can reach it."""

    def __init__(self, turn_id: str, session_id: str) -> None:
        self.turn_id = turn_id
        self.session_id = session_id
        self.proc: asyncio.subprocess.Process | None = None
        self.cancelled = False
        self.stats = TurnStats()
        self.started_at = time.monotonic()

    async def cancel(self) -> None:
        """Kill the whole process group.

        `proc.kill()` alone signals the direct child and can orphan its grandchildren — the
        `claude` binary spawns helpers, and an orphaned one keeps a paid request open. So:
        SIGTERM the group, wait, then SIGKILL the group.
        """
        self.cancelled = True
        proc = self.proc
        if proc is None or proc.returncode is not None:
            return
        try:
            pgid = os.getpgid(proc.pid)
        except (ProcessLookupError, PermissionError):
            return
        with contextlib.suppress(ProcessLookupError, PermissionError):
            os.killpg(pgid, signal.SIGTERM)
        try:
            await asyncio.wait_for(proc.wait(), timeout=SIGKILL_GRACE_S)
        except TimeoutError:
            with contextlib.suppress(ProcessLookupError, PermissionError):
                os.killpg(pgid, signal.SIGKILL)


class TurnRegistry:
    """In-memory map of live turns. Nothing here survives a restart, by design."""

    def __init__(self) -> None:
        self._turns: dict[str, Turn] = {}

    def add(self, turn: Turn) -> None:
        self._turns[turn.turn_id] = turn

    def discard(self, turn_id: str) -> None:
        self._turns.pop(turn_id, None)

    def get(self, turn_id: str) -> Turn | None:
        return self._turns.get(turn_id)

    def __len__(self) -> int:
        return len(self._turns)


# ---------------------------------------------------------------------------------------
# argv and environment
# ---------------------------------------------------------------------------------------


def build_argv(
    settings: Settings,
    *,
    model: str,
    session_id: str,
    resume: bool,
) -> list[str]:
    """The verified invocation from plan §2. Every flag is load-bearing.

    Deliberately absent, each for a reason:

    - `--bare`: its own help text says auth is strictly `ANTHROPIC_API_KEY`/`apiKeyHelper`
      and "OAuth and keychain are never read" — it breaks subscription auth.
    - `--add-dir`: an unscoped extra directory reopens the §1.3 escape.
    - `--settings`: `-p`'s help says invalid settings files are *silently ignored* in print
      mode. A silently dropped permission policy is the worst available failure mode.
      Explicit flags fail loudly.
    - `--no-session-persistence`: `--resume` needs the transcript on disk, and it is an
      audit artifact worth keeping.
    """
    argv = [
        settings.claude_bin,
        "-p",
        "--output-format",
        "stream-json",
        # Not optional and not in plan §2: the CLI hard-errors with
        # "When using --print, --output-format=stream-json requires --verbose".
        # It does not make the child chattier — in stream-json mode it is what turns the
        # full event stream on.
        "--verbose",
        "--include-partial-messages",
        "--model",
        model,
        "--effort",
        settings.effort_for(model),
        "--tools",
        "Read,Grep,Glob",
        "--allowedTools",
        "Read(./**)",
        "Grep(./**)",
        "Glob(./**)",
        "--permission-mode",
        "dontAsk",
        # Measured on 2026-08-08, and not in plan §2 because the hole it closes was not known
        # then. Without it the child **auto-loads**
        # `~/.claude/projects/<git-root-slug>/memory/MEMORY.md` into its context — the
        # project's own private memory index, because the drawing directory sits inside this
        # git repo, so the child resolves the *same* slug this session uses.
        #
        # `--allowedTools "Read(./**)"` does not stop it. There is no tool call to deny: the
        # file is injected before the model runs, and `permission_denials[]` stays empty. A
        # visitor could then simply ask for it. Verified with a canary string: leaked without
        # this flag, absent with it.
        #
        # Safe mode also drops CLAUDE.md auto-discovery, skills, plugins, hooks, custom
        # agents and MCP servers — every remaining uncontrolled input to a public endpoint —
        # while leaving auth, model selection, built-in tools and permissions working.
        "--safe-mode",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--exclude-dynamic-system-prompt-sections",
        "--append-system-prompt",
        orientation_prompt(),
        "--max-budget-usd",
        f"{settings.max_budget_usd:.2f}",
    ]
    # The server allocates the UUID up front, so resume is deterministic and we never have to
    # wait for the init event to learn what to resume.
    argv += ["--resume", session_id] if resume else ["--session-id", session_id]
    return argv


def build_child_env(settings: Settings) -> dict[str, str]:
    """Allowlist, never strip (plan §2).

    This server will often be launched from inside a Claude Code session, which exports
    `CLAUDECODE`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_EFFORT` and friends. Inherited, the child
    may treat itself as a nested session, try to attach to the parent's SSE port, and
    **silently override the `--effort` flag you passed**. An allowlist cannot be defeated by
    a variable nobody thought to add to a denylist.
    """
    env: dict[str, str] = {}
    for key in settings.child_env_allowlist:
        value = os.environ.get(key)
        if value is not None:
            env[key] = value
    if settings.child_home:
        env["HOME"] = settings.child_home
    # Non-interactive terminal: no ANSI, no progress spinners in the captured stream.
    env["TERM"] = "dumb"
    env["NO_COLOR"] = "1"
    # Only ever set deliberately. Plan §3.1 wants this *instead of* the personal OAuth
    # subscription in production, paired with a dedicated unix user and its own HOME.
    if settings.anthropic_api_key:
        env["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
    assert not any(k.startswith("CLAUDE") for k in env), "child env leaked a CLAUDE* variable"
    return env


# ---------------------------------------------------------------------------------------
# stream-json → our envelope
# ---------------------------------------------------------------------------------------


def _rel(path: str, cwd: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(cwd))
    except (ValueError, OSError):
        return path


def _tool_detail(name: str, tool_input: dict[str, Any], cwd: Path) -> str:
    """A one-line summary for the tool-activity strip. It is the trust feature: it shows the
    reader the model consulted the netlist rather than its own memory."""
    if not isinstance(tool_input, dict):
        return ""
    if name == "Read":
        return _rel(str(tool_input.get("file_path", "")), cwd)
    if name == "Grep":
        pattern = str(tool_input.get("pattern", ""))
        where = tool_input.get("path") or tool_input.get("glob") or ""
        return f"{pattern}  {_rel(str(where), cwd)}".strip() if where else pattern
    if name == "Glob":
        return str(tool_input.get("pattern", ""))
    return ""


def translate(event: dict[str, Any], cwd: Path, stats: TurnStats) -> list[dict[str, Any]]:
    """Map one CLI stream-json object onto zero or more client events.

    Two rules keep the UI honest (plan §5):

    - Text comes **only** from `content_block_delta` deltas. Complete `assistant` messages
      carry the same text again; take both and every answer renders twice.
    - Tool calls come **only** from complete `assistant` messages, because a partial
      `input_json_delta` is not parseable until the block closes.

    Unrecognised event types are logged and dropped, so a CLI upgrade cannot break the UI.
    """
    etype = event.get("type")

    if etype == "system":
        if event.get("subtype") == "init":
            stats.claude_session_id = event.get("session_id")
            return [
                {
                    "t": "init",
                    "claude_session_id": event.get("session_id"),
                    "model": event.get("model"),
                    "tools": event.get("tools", []),
                }
            ]
        return []

    if etype == "stream_event":
        inner = event.get("event") or {}
        if inner.get("type") == "content_block_delta":
            delta = inner.get("delta") or {}
            if delta.get("type") == "text_delta":
                text = delta.get("text") or ""
                return [{"t": "text", "d": text}] if text else []
            if delta.get("type") == "thinking_delta":
                # Never forward reasoning text to a public endpoint; just say it is thinking,
                # so a 30 s silence looks like work rather than a hang.
                return [{"t": "status", "s": "thinking"}]
        return []

    if etype == "assistant":
        out: list[dict[str, Any]] = []
        for block in (event.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                name = str(block.get("name", "?"))
                out.append(
                    {
                        "t": "tool",
                        "id": block.get("id"),
                        "name": name,
                        "detail": _tool_detail(name, block.get("input") or {}, cwd),
                    }
                )
        return out

    if etype == "user":
        out = []
        for block in (event.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_result":
                out.append(
                    {
                        "t": "tool_result",
                        "id": block.get("tool_use_id"),
                        "ok": not block.get("is_error", False),
                    }
                )
        return out

    if etype == "result":
        stats.cost_usd = float(event.get("total_cost_usd") or 0.0)
        stats.duration_ms = int(event.get("duration_ms") or 0)
        stats.num_turns = int(event.get("num_turns") or 0)
        stats.is_error = bool(event.get("is_error"))
        stats.subtype = event.get("subtype")
        result_text = event.get("result")
        stats.result_text = result_text if isinstance(result_text, str) else None
        denials = event.get("permission_denials") or []
        stats.denials = [d for d in denials if isinstance(d, dict)]
        # Surface denials rather than swallowing them. One usually means the allowlist is too
        # tight — but it can also mean somebody just probed for /etc/passwd, and that is
        # exactly the event you want visible.
        return [
            {
                "t": "denial",
                "tool": d.get("tool_name"),
                "input": d.get("tool_input"),
            }
            for d in stats.denials
        ]

    if etype in {"stream_event_start", "thinking", "summary", "prompt_suggestion"}:
        return []

    log.debug("dropping unrecognised stream event type %r", etype)
    return []


# ---------------------------------------------------------------------------------------
# the runner
# ---------------------------------------------------------------------------------------


class ClaudeRunner:
    def __init__(self, settings: Settings, registry: TurnRegistry) -> None:
        self.settings = settings
        self.registry = registry

    async def run(
        self,
        *,
        question: str,
        model: str,
        session_id: str,
        resume: bool,
        turn_id: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield client events for one question. Always ends with `done` or `error`."""
        settings = self.settings
        cwd = settings.drawing_dir
        turn = Turn(turn_id or str(uuid.uuid4()), session_id)
        self.registry.add(turn)

        argv = build_argv(settings, model=model, session_id=session_id, resume=resume)
        env = build_child_env(settings)
        archive = _open_archive(settings, turn.turn_id, model, session_id)

        yield {"t": "start", "turn_id": turn.turn_id, "session_id": session_id, "model": model}

        queue: asyncio.Queue[Any] = asyncio.Queue()
        stderr_tail: deque[str] = deque(maxlen=200)
        pumps: list[asyncio.Task[None]] = []

        # The question is fed on stdin, so arbitrary visitor text never lands in the process
        # table or in a shell-quoting question. It goes via an anonymous temp file rather than
        # a pipe for a specific reason: with a stdin *pipe*, killing the child while that pipe
        # is open makes CPython call `pipe_connection_lost` twice, and the second call raises
        # `InvalidStateError` from a bare event-loop callback — noise in the log on exactly the
        # path (cancellation) where you least want it. No stdin transport, no such callback.
        # `TemporaryFile` is unlinked at creation, so nothing is ever visible on disk.
        stdin_file = tempfile.TemporaryFile()
        stdin_file.write(question.encode("utf-8"))
        stdin_file.seek(0)

        try:
            try:
                turn.proc = await asyncio.create_subprocess_exec(
                    *argv,
                    cwd=str(cwd),
                    env=env,
                    stdin=stdin_file,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    # Own process group, so cancel() can take the grandchildren with it.
                    start_new_session=True,
                    limit=STREAM_LIMIT,
                )
            except FileNotFoundError:
                yield _error(f"claude binary not found: {settings.claude_bin!r}", "no_claude")
                return

            proc = turn.proc
            assert proc.stdout and proc.stderr

            pumps = [
                asyncio.create_task(_pump_stdout(proc.stdout, queue, archive)),
                asyncio.create_task(_drain_stderr(proc.stderr, stderr_tail)),
            ]

            async for out in self._consume(queue, turn, cwd):
                yield out

            await asyncio.wait_for(proc.wait(), timeout=10)

            if turn.cancelled:
                yield {"t": "done", "cancelled": True, **_stats_payload(turn.stats)}
            elif proc.returncode not in (0, None) and turn.stats.num_turns == 0:
                tail = " ".join(stderr_tail).strip()[-600:]
                yield _error(
                    f"claude exited {proc.returncode}. {tail or 'no stderr'}", "child_failed"
                )
            else:
                yield {"t": "done", "cancelled": False, **_stats_payload(turn.stats)}

        except TimeoutError:
            await turn.cancel()
            yield _error(
                f"the model did not finish within {settings.turn_timeout_s:.0f}s", "timeout"
            )
        except asyncio.CancelledError:
            # The browser went away, or the Stop endpoint fired. Kill the child before the
            # generator unwinds — otherwise a paid request keeps running with nobody reading.
            await turn.cancel()
            raise
        finally:
            for task in pumps:
                task.cancel()
            for task in pumps:
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task
            if turn.proc is not None and turn.proc.returncode is None:
                await turn.cancel()
            if turn.proc is not None:
                # Nothing left unreaped, whatever path we took out of here.
                with contextlib.suppress(Exception):
                    await turn.proc.wait()
            self.registry.discard(turn.turn_id)
            with contextlib.suppress(Exception):
                stdin_file.close()
            if archive is not None:
                with contextlib.suppress(Exception):
                    archive.close()

    async def _consume(
        self, queue: asyncio.Queue[Any], turn: Turn, cwd: Path
    ) -> AsyncIterator[dict[str, Any]]:
        """Drain the parse queue, coalescing text and injecting heartbeats.

        Coalescing matters more than it looks: every store write on the client re-runs the
        markdown renderer over the whole growing answer, so a delta-per-token stream makes a
        long answer visibly stutter.

        Heartbeats matter for cancellation: a `StreamingResponse` generator only discovers a
        dead socket when it next tries to yield, and a thinking Opus can go 30 s without
        emitting anything.
        """
        deadline = turn.started_at + self.settings.turn_timeout_s
        pending: list[str] = []
        pending_chars = 0
        flush_at: float | None = None
        next_beat = time.monotonic() + HEARTBEAT_S

        while True:
            now = time.monotonic()
            if now > deadline:
                raise TimeoutError
            timeout = min(
                next_beat - now,
                (flush_at - now) if flush_at is not None else HEARTBEAT_S,
                deadline - now,
            )
            try:
                item = await asyncio.wait_for(queue.get(), timeout=max(timeout, 0.01))
            except TimeoutError:
                item = None

            now = time.monotonic()
            if item is None:
                if pending and flush_at is not None and now >= flush_at:
                    yield {"t": "text", "d": "".join(pending)}
                    pending, pending_chars, flush_at = [], 0, None
                if now >= next_beat:
                    yield {"t": "heartbeat"}
                    next_beat = now + HEARTBEAT_S
                continue

            if item is _SENTINEL:
                break

            for out in translate(item, cwd, turn.stats):
                if out["t"] == "text":
                    pending.append(out["d"])
                    pending_chars += len(out["d"])
                    if flush_at is None:
                        flush_at = now + TEXT_FLUSH_S
                    if pending_chars >= TEXT_FLUSH_CHARS:
                        yield {"t": "text", "d": "".join(pending)}
                        pending, pending_chars, flush_at = [], 0, None
                else:
                    if pending:
                        yield {"t": "text", "d": "".join(pending)}
                        pending, pending_chars, flush_at = [], 0, None
                    yield out
                    next_beat = time.monotonic() + HEARTBEAT_S

        if pending:
            yield {"t": "text", "d": "".join(pending)}


async def _pump_stdout(
    reader: asyncio.StreamReader, queue: asyncio.Queue[Any], archive: Any
) -> None:
    """Chunked reads split on newlines, rather than `readline()`.

    `readline()` raises `ValueError` when a line exceeds the StreamReader limit and leaves
    the buffer in a state that is awkward to recover from. Reading fixed chunks sidesteps the
    line limit entirely, which matters because a `tool_result` line can carry a large slice
    of a 188 KB netlist.
    """
    buf = bytearray()
    try:
        while True:
            chunk = await reader.read(65536)
            if not chunk:
                break
            buf.extend(chunk)
            while True:
                nl = buf.find(b"\n")
                if nl < 0:
                    break
                line = bytes(buf[:nl])
                del buf[: nl + 1]
                _emit_line(line, queue, archive)
            if len(buf) > MAX_LINE_BYTES:
                log.warning("dropping oversized partial line (%d bytes)", len(buf))
                buf.clear()
        if buf:
            _emit_line(bytes(buf), queue, archive)
    finally:
        queue.put_nowait(_SENTINEL)


def _emit_line(line: bytes, queue: asyncio.Queue[Any], archive: Any) -> None:
    if not line.strip():
        return
    if archive is not None:
        with contextlib.suppress(Exception):
            archive.write(line.decode("utf-8", "replace") + "\n")
    try:
        queue.put_nowait(json.loads(line))
    except (json.JSONDecodeError, UnicodeDecodeError):
        log.debug("non-JSON line from claude: %r", line[:200])


async def _drain_stderr(reader: asyncio.StreamReader, tail: deque[str]) -> None:
    """Always drain stderr. An unread full pipe deadlocks the child, and the symptom is an
    answer that stops mid-sentence for no visible reason."""
    while True:
        chunk = await reader.read(8192)
        if not chunk:
            return
        tail.append(chunk.decode("utf-8", "replace"))


def _stats_payload(stats: TurnStats) -> dict[str, Any]:
    return {
        "cost_usd": round(stats.cost_usd, 4),
        "duration_ms": stats.duration_ms,
        "num_turns": stats.num_turns,
        "is_error": stats.is_error,
        "denials": len(stats.denials),
        "error": _result_message(stats),
    }


#: A turn that ends `is_error` with no text renders as a blank answer unless we say why.
#: Watched `error_max_budget_usd` fire in testing: cost recorded, zero output, and without
#: this the visitor just sees an empty bubble and assumes the app is broken.
_RESULT_MESSAGES = {
    "error_max_budget_usd": (
        "This question hit the per-question spend ceiling and stopped part-way. Try asking "
        "something narrower — a single net or component rather than the whole drawing."
    ),
    "error_max_turns": (
        "The model used its whole tool budget before finishing. Try a narrower question."
    ),
    "error_during_execution": "The model stopped with an error part-way through the answer.",
}


def _result_message(stats: TurnStats) -> str | None:
    if not stats.is_error:
        return None
    known = _RESULT_MESSAGES.get(stats.subtype or "")
    if known:
        return known
    # Fall through to the CLI's own words. `subtype` is not reliable here — an auth failure
    # arrives as `subtype: "success"`, `is_error: true`, with the real message
    # ("Not logged in · Please run /login") only in `result`. Operators need to see that;
    # hiding it behind a generic string turns a one-line fix into a debugging session.
    if stats.result_text:
        return stats.result_text[:300]
    return "The model stopped with an error."


def _error(message: str, code: str) -> dict[str, Any]:
    return {"t": "error", "code": code, "message": message}


def _open_archive(settings: Settings, turn_id: str, model: str, session_id: str) -> Any:
    """Keep the raw transcript. `webui_ideas.md` §7: the same question can answer differently
    across runs, models and effort levels, and in a project built on an auditable chain that
    is a first-class concern rather than a curiosity."""
    try:
        settings.log_dir.mkdir(parents=True, exist_ok=True)
        handle = (settings.log_dir / f"{turn_id}.jsonl").open("w", encoding="utf-8")
        handle.write(
            json.dumps(
                {
                    "type": "_meta",
                    "turn_id": turn_id,
                    "session_id": session_id,
                    "model": model,
                    "effort": settings.effort_for(model),
                    "prompt_version": PROMPT_VERSION,
                    "drawing_dir": str(settings.drawing_dir),
                }
            )
            + "\n"
        )
        return handle
    except OSError as exc:
        log.warning("could not open turn archive: %s", exc)
        return None
