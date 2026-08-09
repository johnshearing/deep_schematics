from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

import pytest

from app.config import Settings
from app.drawing import load_circuit_logic

FAKE = Path(__file__).parent / "fake_claude.py"


@pytest.fixture(autouse=True)
def _clear_drawing_cache():
    load_circuit_logic.cache_clear()
    yield
    load_circuit_logic.cache_clear()


@pytest.fixture
def fake_claude(tmp_path: Path) -> Path:
    """A launcher script that runs `fake_claude.py` under this interpreter.

    Written as a shell shim rather than invoked directly, because the runner execs a single
    binary path — exactly as it will in production.
    """
    shim = tmp_path / "claude"
    shim.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{FAKE}" "$@"\n', encoding="utf-8")
    shim.chmod(shim.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return shim


@pytest.fixture
def drawing_dir(tmp_path: Path) -> Path:
    """A miniature `extracted_docs/`. Small, but the same shape as the real one."""
    d = tmp_path / "extracted_docs"
    d.mkdir()
    (d / "EXTRACTION_NOTES.md").write_text("# Notes\nNet 110 has 4 wires.\n", encoding="utf-8")
    (d / "circuit_logic.json").write_text(
        json.dumps(
            {
                "drawing": {
                    "drawing_number": "PS20115MLM4-2",
                    "revision": None,
                    "title": "MOD-LINX POWER SUPPLY ASSY",
                    "assembly": "Mod-Linx Power Supply Assembly",
                    "date": "2017-09-19",
                    "notes": ["Keep all DC wires 4\" minimum clearance from 115VAC wires."],
                    "references": ["MXCS-M9", "MXCS-M11"],
                },
                "components": [{"id": "CR1", "class": "relay"},
                               {"id": "CB1", "class": "circuit_breaker"}],
                "terminals": [{"id": "CR1:A1"}],
                "nets": [{"id": "110", "member_terminals": ["CR-SW:14", "CR-ON:A2"]}],
                "wires": [{"id": "W047", "net": "110"}],
                "cables": [],
                "subsystems": [{"id": "SUB-CONTROL", "description": "control",
                                "member_components": ["CR1"]}],
                "relationships": [{"type": "ON_NET", "src": "W047", "tgt": "110"}],
            }
        ),
        encoding="utf-8",
    )
    return d


@pytest.fixture
def settings(fake_claude: Path, drawing_dir: Path, tmp_path: Path) -> Settings:
    return Settings(
        drawing_dir=drawing_dir,
        claude_bin=str(fake_claude),
        state_dir=tmp_path / "state",
        log_dir=tmp_path / "state" / "turns",
        rate_limit_enabled=False,
        daily_spend_ceiling_usd=5.0,
        max_concurrent_turns=2,
        # The stub is switched by env var, and the allowlist would otherwise (correctly)
        # drop it — which is itself a small proof that the allowlist is doing its job.
        child_env_allowlist=["HOME", "PATH", "USER", "LANG", "TZ", "FAKE_MODE", "FAKE_DUMP"],
        _env_file=None,  # type: ignore[call-arg]
    )


@pytest.fixture
def fake_mode(monkeypatch):
    def _set(mode: str) -> None:
        monkeypatch.setenv("FAKE_MODE", mode)

    return _set


@pytest.fixture(autouse=True)
def _no_stray_claude_env(monkeypatch):
    """The suite must not depend on whether it was launched from inside Claude Code."""
    monkeypatch.setenv("CLAUDECODE", "1")
    monkeypatch.setenv("CLAUDE_CODE_SSE_PORT", "12345")
    monkeypatch.setenv("CLAUDE_EFFORT", "max")
    yield
    for key in ("CLAUDECODE", "CLAUDE_CODE_SSE_PORT", "CLAUDE_EFFORT"):
        os.environ.pop(key, None)
