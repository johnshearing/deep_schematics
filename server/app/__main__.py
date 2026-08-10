"""Entry point so the bind address comes from settings: `uv run python -m app`.

`uvicorn app.main:app --host ...` takes the bind address from the command line, which left
`host`/`port` in `config.py` defined but unreachable — and made the loopback default something
you had to remember to override on every launch. Running the server this way makes
`server/.env` the single place the bind address is set.

That distinction is load-bearing rather than cosmetic: `127.0.0.1` is a local-only app and
`0.0.0.0` is a public one, and under WSL2 the difference is invisible from the host until you
try to reach it from another device. See "Exposing this on a LAN under WSL2" in the README.
"""

from __future__ import annotations

import uvicorn

from .config import get_settings
from .main import app


def main() -> None:
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
