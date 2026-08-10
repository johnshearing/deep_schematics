"""Settings parsing, specifically the list fields read from a `.env` file.

These go through `DotEnvSettingsSource`, which is a different code path from passing values to
`Settings(...)` in Python — and the one every real deployment uses.
"""

from __future__ import annotations

from pathlib import Path

from app.config import Settings


def _settings(env_text: str, tmp_path: Path) -> Settings:
    env = tmp_path / ".env"
    env.write_text(env_text, encoding="utf-8")
    return Settings(_env_file=env)  # type: ignore[call-arg]


def test_list_settings_are_comma_separated_in_a_dotenv(tmp_path: Path) -> None:
    """The form `.env.example` documents. pydantic-settings would rather have JSON, and used
    to raise `SettingsError` here before the fields were marked `NoDecode`."""
    s = _settings("SWUI_ALLOWED_MODELS=opus,sonnet\n", tmp_path)
    assert s.allowed_models == ["opus", "sonnet"]


def test_an_empty_list_setting_means_empty_not_a_crash(tmp_path: Path) -> None:
    """`SWUI_ANONYMOUS_MODELS=` is how the deployment says "every question needs the password".

    An empty value is not valid JSON, so this was a startup crash rather than a setting.
    """
    s = _settings("SWUI_ANONYMOUS_MODELS=\n", tmp_path)
    assert s.anonymous_models == []
    assert s.allowed_models == ["opus", "sonnet"]  # untouched fields keep their defaults


def test_password_required_follows_the_password(tmp_path: Path) -> None:
    assert _settings("SWUI_DEMO_PASSWORD=1234\n", tmp_path).password_required is True
    assert _settings("SWUI_DEMO_PASSWORD=\n", tmp_path).password_required is False


def test_host_and_port_come_from_the_env(tmp_path: Path) -> None:
    """`python -m app` binds these; a loopback default is unreachable from off the machine."""
    s = _settings("SWUI_HOST=0.0.0.0\nSWUI_PORT=9800\n", tmp_path)
    assert (s.host, s.port) == ("0.0.0.0", 9800)
