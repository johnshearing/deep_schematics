"""The argv and the child environment are the security boundary, so they get their own tests.

Every assertion here corresponds to a measured finding in plan §1. If one of these ever
fails, the app is not merely buggy — it is unsafe to expose.
"""

from __future__ import annotations

import re

from app.claude_runner import build_argv, build_child_env
from app.config import Settings


def test_tools_are_limited_to_read_grep_glob(settings: Settings) -> None:
    argv = build_argv(settings, model="sonnet", session_id="sid", resume=False)
    assert argv[argv.index("--tools") + 1] == "Read,Grep,Glob"
    # Not "denied" — absent. The tools do not exist in the session, so there is no permission
    # decision for an injected instruction to win.
    for forbidden in ("Bash", "Write", "Edit", "WebFetch", "WebSearch", "Task", "NotebookEdit"):
        assert forbidden not in argv[argv.index("--tools") + 1]


def test_filesystem_scope_uses_the_form_that_actually_denies(settings: Settings) -> None:
    """`Read(*)` looks like it scopes and does not (plan §1.4): its refusal was model
    discretion, not a recorded denial. Only `./**` produced hard denials."""
    argv = build_argv(settings, model="opus", session_id="sid", resume=False)
    start = argv.index("--allowedTools")
    assert argv[start + 1 : start + 4] == ["Read(./**)", "Grep(./**)", "Glob(./**)"]
    assert "Read(*)" not in argv
    assert "Read" not in argv[start + 1 : start + 4]


def test_dangerous_and_silently_failing_flags_are_absent(settings: Settings) -> None:
    argv = build_argv(settings, model="opus", session_id="sid", resume=False)
    for flag in (
        "--bare",  # auth is API-key only in that mode; OAuth is never read
        "--add-dir",  # an unscoped extra directory reopens the §1.3 escape
        "--settings",  # invalid settings files are *silently ignored* in print mode
        "--dangerously-skip-permissions",
        "--allow-dangerously-skip-permissions",
        "--no-session-persistence",  # --resume needs the transcript on disk
    ):
        assert flag not in argv


def test_required_hardening_flags_are_present(settings: Settings) -> None:
    argv = build_argv(settings, model="opus", session_id="sid", resume=False)
    assert argv[argv.index("--permission-mode") + 1] == "dontAsk"
    # Without --safe-mode the child auto-loads this project's own memory index into a public
    # session, and no permission rule sees it because there is no tool call to deny.
    assert "--safe-mode" in argv
    assert "--strict-mcp-config" in argv  # else the lightrag MCP server boots every question
    assert "--disable-slash-commands" in argv  # the extraction skill is a *write* workflow
    assert "--exclude-dynamic-system-prompt-sections" in argv  # stable cache prefix
    assert argv[argv.index("--output-format") + 1] == "stream-json"
    assert "--include-partial-messages" in argv
    # The CLI refuses to start without this alongside stream-json in print mode.
    assert "--verbose" in argv


def test_budget_and_effort_track_the_model(settings: Settings) -> None:
    opus = build_argv(settings, model="opus", session_id="sid", resume=False)
    sonnet = build_argv(settings, model="sonnet", session_id="sid", resume=False)
    assert opus[opus.index("--effort") + 1] == "high"
    assert sonnet[sonnet.index("--effort") + 1] == "low"
    assert float(opus[opus.index("--max-budget-usd") + 1]) == settings.max_budget_usd


def test_session_id_on_first_turn_and_resume_after(settings: Settings) -> None:
    first = build_argv(settings, model="sonnet", session_id="abc", resume=False)
    assert first[first.index("--session-id") + 1] == "abc"
    assert "--resume" not in first

    later = build_argv(settings, model="sonnet", session_id="abc", resume=True)
    assert later[later.index("--resume") + 1] == "abc"
    assert "--session-id" not in later


def test_orientation_is_appended_not_replaced(settings: Settings) -> None:
    """`--system-prompt` would replace Claude Code's default — which is exactly the part
    that makes agentic file reading work."""
    argv = build_argv(settings, model="opus", session_id="sid", resume=False)
    assert "--system-prompt" not in argv
    prompt = argv[argv.index("--append-system-prompt") + 1]
    assert "EXTRACTION_NOTES.md" in prompt
    assert "Do NOT read `geometry.json`" in prompt
    assert "4 wires and 8 terminals" in prompt


def test_no_claude_variable_survives_into_the_child(settings: Settings) -> None:
    """The one that bites silently: an inherited CLAUDE_* can make the child think it is a
    nested session and override the --effort you passed."""
    env = build_child_env(settings)
    leaked = [k for k in env if re.match(r"^CLAUDE", k)]
    assert leaked == []
    assert env["TERM"] == "dumb"
    assert env["NO_COLOR"] == "1"
    assert set(env) <= set(settings.child_env_allowlist) | {"TERM", "NO_COLOR",
                                                            "ANTHROPIC_API_KEY"}


def test_child_home_can_be_overridden(settings: Settings) -> None:
    """Plan §3.1: a HOME with no `.claude.json` in it turns the §1.3 escape from 'mitigated
    by a permission rule' into 'structurally impossible'."""
    scoped = settings.model_copy(update={"child_home": "/home/schematicbot"})
    assert build_child_env(scoped)["HOME"] == "/home/schematicbot"
