#!/usr/bin/env python3
"""A stand-in for the `claude` binary, so the subprocess tests are free and offline.

It emits a canned `stream-json` transcript in the real shape: an `init`, some
`content_block_delta` text, a complete `assistant` message carrying a `tool_use` block, a
`tool_result`, and a `result`. Behaviour is switched by env var so one stub covers every case
the runner has to survive:

    FAKE_MODE=ok        normal transcript (default)
    FAKE_MODE=hang      print the init, then sleep forever — for cancellation and orphan tests
    FAKE_MODE=denial    include a permission_denials[] entry
    FAKE_MODE=crash     write to stderr and exit non-zero
    FAKE_MODE=bigline   emit a tool_result far larger than asyncio's 64 KiB line limit
    FAKE_MODE=noise     interleave non-JSON lines and unknown event types
    FAKE_MODE=budget    end with subtype=error_max_budget_usd and no answer text
    FAKE_MODE=auth      an auth failure: is_error with subtype still "success"
"""

from __future__ import annotations

import json
import os
import sys
import time


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main() -> int:
    mode = os.environ.get("FAKE_MODE", "ok")
    argv = sys.argv[1:]
    # Record how we were called, so a test can assert on the real argv and environment.
    dump = os.environ.get("FAKE_DUMP")
    if dump:
        with open(dump, "w", encoding="utf-8") as fh:
            json.dump(
                {"argv": argv, "env": dict(os.environ), "cwd": os.getcwd(),
                 "stdin": sys.stdin.read()},
                fh,
            )

    if mode == "crash":
        sys.stderr.write("fake_claude: something went wrong\n")
        return 3

    session_id = "11111111-2222-3333-4444-555555555555"
    if "--session-id" in argv:
        session_id = argv[argv.index("--session-id") + 1]
    elif "--resume" in argv:
        session_id = argv[argv.index("--resume") + 1]

    emit({"type": "system", "subtype": "init", "session_id": session_id,
          "model": "claude-sonnet-5", "tools": ["Read", "Grep", "Glob"]})

    if mode == "hang":
        while True:
            time.sleep(3600)

    if mode == "noise":
        sys.stdout.write("not json at all\n")
        sys.stdout.flush()
        emit({"type": "some_future_event", "payload": {"x": 1}})

    emit({"type": "assistant", "message": {"content": [
        {"type": "tool_use", "id": "tu_1", "name": "Read",
         "input": {"file_path": os.path.join(os.getcwd(), "EXTRACTION_NOTES.md")}},
    ]}})

    payload = "x" * (200 * 1024) if mode == "bigline" else "notes"
    emit({"type": "user", "message": {"content": [
        {"type": "tool_result", "tool_use_id": "tu_1", "content": payload},
    ]}})

    for piece in ["Net 110 has ", "**4 wires** ", "(W047, W058, W059, W060) ",
                  "and **8 terminals**."]:
        emit({"type": "stream_event", "event": {
            "type": "content_block_delta",
            "delta": {"type": "text_delta", "text": piece}}})

    denials = []
    if mode == "denial":
        denials = [{"tool_name": "Read", "tool_input": {"file_path": "/home/js/.claude.json"}}]

    if mode == "auth":
        # How a real auth failure arrives: subtype still says "success".
        emit({"type": "result", "subtype": "success", "is_error": True, "duration_ms": 51,
              "num_turns": 1, "total_cost_usd": 0.0, "session_id": session_id,
              "terminal_reason": "api_error", "permission_denials": [],
              "result": "Not logged in \u00b7 Please run /login"})
        return 0

    if mode == "budget":
        emit({"type": "result", "subtype": "error_max_budget_usd", "is_error": True,
              "duration_ms": 900, "num_turns": 1, "total_cost_usd": 0.0389,
              "session_id": session_id, "permission_denials": []})
        return 0

    emit({"type": "result", "subtype": "success", "is_error": False,
          "duration_ms": 1234, "num_turns": 1, "total_cost_usd": 0.0123,
          "session_id": session_id, "permission_denials": denials,
          "result": "Net 110 has 4 wires and 8 terminals."})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
