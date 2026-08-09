"""End-to-end runner tests against the stub binary — free, offline, and fast."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from app.claude_runner import ClaudeRunner, TurnRegistry
from app.config import Settings


async def collect(settings: Settings, question: str = "How many wires are in net 110?",
                  **kwargs) -> list[dict]:
    runner = ClaudeRunner(settings, TurnRegistry())
    return [
        e
        async for e in runner.run(
            question=question, model="sonnet", session_id="sid-1", resume=False, **kwargs
        )
    ]


async def test_happy_path_yields_text_tools_and_done(settings: Settings, fake_mode) -> None:
    fake_mode("ok")
    events = await collect(settings)
    kinds = [e["t"] for e in events]

    assert kinds[0] == "start"
    assert kinds[-1] == "done"
    assert "init" in kinds

    text = "".join(e["d"] for e in events if e["t"] == "text")
    assert text == "Net 110 has **4 wires** (W047, W058, W059, W060) and **8 terminals**."

    tools = [e for e in events if e["t"] == "tool"]
    assert tools[0]["name"] == "Read"
    # Relativised against the drawing dir, so the strip shows `EXTRACTION_NOTES.md` rather
    # than an absolute path that tells a visitor where the server keeps its files.
    assert tools[0]["detail"] == "EXTRACTION_NOTES.md"
    assert not os.path.isabs(tools[0]["detail"])

    done = events[-1]
    assert done["cost_usd"] == pytest.approx(0.0123)
    assert done["num_turns"] == 1
    assert done["is_error"] is False


async def test_text_comes_only_from_deltas_so_answers_do_not_render_twice(
    settings: Settings, fake_mode
) -> None:
    fake_mode("ok")
    events = await collect(settings)
    text = "".join(e["d"] for e in events if e["t"] == "text")
    assert text.count("Net 110 has") == 1


async def test_child_receives_the_question_on_stdin_in_the_drawing_dir(
    settings: Settings, fake_mode, monkeypatch, tmp_path: Path
) -> None:
    fake_mode("ok")
    dump = tmp_path / "call.json"
    monkeypatch.setenv("FAKE_DUMP", str(dump))
    await collect(settings, "what colour is wire 110?")

    call = json.loads(dump.read_text())
    assert call["stdin"] == "what colour is wire 110?"
    assert Path(call["cwd"]).resolve() == settings.drawing_dir.resolve()
    # The question is not on the command line: it stays out of the process table.
    assert "what colour is wire 110?" not in call["argv"]
    assert not [k for k in call["env"] if k.startswith("CLAUDE")]


async def test_oversized_tool_result_does_not_break_the_stream(
    settings: Settings, fake_mode
) -> None:
    """A single `tool_result` line carrying part of a 188 KB netlist blows through asyncio's
    default 64 KiB line limit. If this regresses, answers stop mid-sentence."""
    fake_mode("bigline")
    events = await collect(settings)
    assert events[-1]["t"] == "done"
    assert "".join(e["d"] for e in events if e["t"] == "text").startswith("Net 110")


async def test_junk_and_unknown_events_are_dropped_not_fatal(
    settings: Settings, fake_mode
) -> None:
    """A CLI upgrade that adds an event type must not break the UI."""
    fake_mode("noise")
    events = await collect(settings)
    assert events[-1]["t"] == "done"
    assert "some_future_event" not in {e["t"] for e in events}


async def test_permission_denials_are_surfaced_not_swallowed(
    settings: Settings, fake_mode
) -> None:
    fake_mode("denial")
    events = await collect(settings)
    denials = [e for e in events if e["t"] == "denial"]
    assert len(denials) == 1
    assert denials[0]["tool"] == "Read"
    assert events[-1]["denials"] == 1


async def test_child_crash_becomes_a_clean_error_event(settings: Settings, fake_mode) -> None:
    fake_mode("crash")
    events = await collect(settings)
    assert events[-1]["t"] == "error"
    assert events[-1]["code"] == "child_failed"
    assert "something went wrong" in events[-1]["message"]


async def test_missing_binary_is_reported_rather_than_raised(settings: Settings) -> None:
    broken = settings.model_copy(update={"claude_bin": "/nonexistent/claude"})
    events = await collect(broken)
    assert events[-1]["t"] == "error"
    assert events[-1]["code"] == "no_claude"


async def test_heartbeats_arrive_while_the_model_is_silent(
    settings: Settings, fake_mode, monkeypatch
) -> None:
    """A StreamingResponse generator only notices a dead socket when it next tries to yield,
    and a thinking Opus can go 30 s without emitting anything."""
    import app.claude_runner as runner_mod

    monkeypatch.setattr(runner_mod, "HEARTBEAT_S", 0.15)
    fake_mode("hang")
    registry = TurnRegistry()
    runner = ClaudeRunner(settings.model_copy(update={"turn_timeout_s": 1.0}), registry)

    seen: list[dict] = []
    async for event in runner.run(question="q", model="sonnet", session_id="s", resume=False):
        seen.append(event)

    assert sum(1 for e in seen if e["t"] == "heartbeat") >= 2
    assert seen[-1]["t"] == "error"
    assert seen[-1]["code"] == "timeout"


async def test_cancel_kills_the_whole_process_group(settings: Settings, fake_mode) -> None:
    """`proc.kill()` alone can orphan grandchildren, and an orphaned child keeps a paid
    request open with nobody reading it."""
    fake_mode("hang")
    registry = TurnRegistry()
    runner = ClaudeRunner(settings, registry)

    pid: int | None = None
    events: list[dict] = []
    async for event in runner.run(
        question="q", model="sonnet", session_id="s", resume=False, turn_id="turn-x"
    ):
        events.append(event)
        if event["t"] == "init":
            # The child is up. Stop it the way the Stop button does.
            turn = registry.get("turn-x")
            assert turn is not None and turn.proc is not None
            pid = turn.proc.pid
            await turn.cancel()

    assert pid is not None
    assert events[-1]["t"] == "done" and events[-1]["cancelled"] is True
    assert registry.get("turn-x") is None
    # Nothing left behind: the pid is reaped and no descendant survives.
    assert _pgid_is_empty(pid)


def _pgid_is_empty(pid: int) -> bool:
    out = subprocess.run(["ps", "-o", "pid=", "-g", str(pid)], capture_output=True, text=True)
    return not out.stdout.strip()


async def test_turn_is_archived_for_audit(settings: Settings, fake_mode) -> None:
    fake_mode("ok")
    await collect(settings, turn_id="turn-archive")
    archived = settings.log_dir / "turn-archive.jsonl"
    lines = [json.loads(line) for line in archived.read_text().splitlines()]
    assert lines[0]["type"] == "_meta"
    assert lines[0]["model"] == "sonnet"
    assert lines[0]["prompt_version"]
    assert any(line.get("type") == "result" for line in lines)


async def test_budget_stop_is_explained_rather_than_rendering_blank(
    settings: Settings, fake_mode
) -> None:
    """`--max-budget-usd` firing produces `is_error` with no answer text at all. Watched it
    happen in testing; without a message the visitor sees an empty bubble."""
    fake_mode("budget")
    events = await collect(settings)
    done = events[-1]
    assert done["t"] == "done"
    assert done["is_error"] is True
    assert "spend ceiling" in done["error"]


async def test_successful_turn_carries_no_error(settings: Settings, fake_mode) -> None:
    fake_mode("ok")
    assert (await collect(settings))[-1]["error"] is None


async def test_auth_failure_reports_the_clis_own_words(settings: Settings, fake_mode) -> None:
    """An auth failure arrives as `is_error` with `subtype: "success"` — the real message is
    only in `result`. An operator needs to read "Please run /login", not "unknown error"."""
    fake_mode("auth")
    done = (await collect(settings))[-1]
    assert done["is_error"] is True
    assert "Not logged in" in done["error"]
