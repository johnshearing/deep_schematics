"""Settings, all `SWUI_`-prefixed, from the environment or `server/.env`.

Nothing about the drawing is hardcoded anywhere else: `drawing_dir` is the single knob that
points the whole app at a different extraction. That is what makes the multi-drawing work in
`webui_ideas.md` §5 an addition rather than a rewrite.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

#: List settings are comma-separated, not JSON. Without `NoDecode`, pydantic-settings tries to
#: `json.loads` a complex field straight from the source and raises before `_split_csv` — which
#: made both the documented `SWUI_ALLOWED_MODELS=opus,sonnet` form *and* an intentionally empty
#: `SWUI_ANONYMOUS_MODELS=` a startup crash rather than a setting.
CsvList = Annotated[list[str], NoDecode]

SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVER_DIR.parent
STATIC_DIR = Path(__file__).resolve().parent / "static"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SWUI_",
        env_file=SERVER_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- what we are answering questions about -----------------------------------------
    drawing_dir: Path = REPO_ROOT / "schematic_extraction/PS20115MLM4-2/extracted_docs"

    # --- how we spawn the model --------------------------------------------------------
    claude_bin: str = "claude"
    default_model: str = "sonnet"
    allowed_models: CsvList = ["opus", "sonnet"]
    #: Models a visitor may choose without the demo password. Plan §3.2 — Sonnet still gets
    #: the hard question right at a quarter of the cost, so it is the anonymous default.
    anonymous_models: CsvList = ["sonnet"]
    effort_by_model: dict[str, str] = {"opus": "high", "sonnet": "low"}
    max_budget_usd: float = 1.50
    #: Kill the child if it produces nothing at all for this long. Opus can think for ~30 s,
    #: so this is deliberately far above the measured ~2 min worst case for a whole answer.
    turn_timeout_s: float = 420.0

    # --- cost control (plan §3.2) ------------------------------------------------------
    daily_spend_ceiling_usd: float = 10.00
    rate_limit: str = "3/10 minutes"
    rate_limit_enabled: bool = True
    max_concurrent_turns: int = 2
    #: Per-session turn cap; a session is one browser tab's conversation.
    max_turns_per_session: int = 20
    max_sessions: int = 200
    session_ttl_s: float = 3600.0
    max_question_chars: int = 2000

    # --- abuse plan, built but disabled (plan §3.5) --------------------------------------
    demo_password: str = ""
    #: Separate, tighter bucket for `/api/unlock`. The demo password is short by design, so
    #: the only thing standing between it and an offline-speed guess is this limit.
    unlock_rate_limit: str = "5/minute"

    # --- serving -----------------------------------------------------------------------
    host: str = "127.0.0.1"
    port: int = 9700
    #: Vite dev server. Empty in production — the built assets are same-origin under /webui.
    dev_origins: CsvList = ["http://localhost:5173", "http://127.0.0.1:5173"]
    #: Where the daily spend ledger is persisted so a restart cannot reset the ceiling.
    state_dir: Path = SERVER_DIR / ".state"
    log_dir: Path = SERVER_DIR / ".state" / "turns"

    # --- child process environment (plan §2, "allowlist, never strip") ------------------
    child_env_allowlist: CsvList = ["HOME", "PATH", "USER", "LANG", "TZ"]
    #: Override to give the child a HOME with no `.claude.json` in it. The structural fix in
    #: plan §3.1: set this plus ANTHROPIC_API_KEY and §1.3 stops being reachable at all.
    child_home: str = ""
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")

    @field_validator("drawing_dir", "state_dir", "log_dir")
    @classmethod
    def _absolute(cls, v: Path) -> Path:
        return v if v.is_absolute() else (SERVER_DIR / v).resolve()

    @field_validator("allowed_models", "anonymous_models", "dev_origins", "child_env_allowlist",
                     mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    def effort_for(self, model: str) -> str:
        return self.effort_by_model.get(model, "medium")

    @property
    def password_required(self) -> bool:
        return bool(self.demo_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()
