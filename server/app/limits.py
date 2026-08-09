"""Cost control. Plan §3.2 — a v1 feature, not a later refinement.

At the measured ~$0.64 per Opus answer the arithmetic is unforgiving: 100 questions is $64,
and an unauthenticated public endpoint is a direct route to an unbounded bill. There are four
independent guards, deliberately layered so no single mistake removes them all:

1. per-IP rate limit                — stops one visitor monopolising the thing
2. global concurrency cap           — bounds the *rate* of spend at any instant
3. daily spend ceiling              — bounds the total, and *disables* the endpoint with a
                                      clear message rather than silently degrading
4. `--max-budget-usd` on the child  — the innermost guard, inside the model process itself

Only the fourth is enforced by something we do not control, which is precisely why it is not
the only one.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from slowapi import Limiter
from slowapi.util import get_remote_address

log = logging.getLogger(__name__)


def make_limiter() -> Limiter:
    """Per-IP limiter. Applied only to `/api/ask` — the one route that spends money.

    `get_remote_address` reads the socket peer, which behind a Cloudflare Tunnel is the
    tunnel itself — every visitor would share one bucket. When you go public, run uvicorn
    with `--proxy-headers --forwarded-allow-ips=127.0.0.1` so the peer is resolved from
    `X-Forwarded-For` before this sees it.
    """
    return Limiter(key_func=get_remote_address, headers_enabled=True)


@dataclass
class SpendSnapshot:
    day: str
    spent_usd: float
    ceiling_usd: float

    @property
    def remaining_usd(self) -> float:
        return max(0.0, self.ceiling_usd - self.spent_usd)

    @property
    def exhausted(self) -> bool:
        return self.spent_usd >= self.ceiling_usd


class SpendLedger:
    """Today's spend, persisted so a restart cannot reset the ceiling.

    A restart resetting the budget is the classic way a spend cap turns out not to be one —
    a crash loop would hand out a fresh allowance on every boot.
    """

    def __init__(self, path: Path, ceiling_usd: float) -> None:
        self._path = path
        self._ceiling = ceiling_usd
        self._lock = asyncio.Lock()
        self._day = _today()
        self._spent = 0.0
        self._load()

    def _load(self) -> None:
        try:
            data = json.loads(self._path.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if data.get("day") == self._day:
            self._spent = float(data.get("spent_usd") or 0.0)

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps({"day": self._day, "spent_usd": self._spent}), "utf-8")
            tmp.replace(self._path)
        except OSError as exc:
            log.warning("could not persist spend ledger: %s", exc)

    def _roll(self) -> None:
        today = _today()
        if today != self._day:
            self._day, self._spent = today, 0.0

    def snapshot(self) -> SpendSnapshot:
        self._roll()
        return SpendSnapshot(day=self._day, spent_usd=round(self._spent, 4),
                             ceiling_usd=self._ceiling)

    async def record(self, cost_usd: float) -> SpendSnapshot:
        async with self._lock:
            self._roll()
            self._spent += max(0.0, cost_usd)
            self._save()
            return self.snapshot()


class ConcurrencyGate:
    """Non-blocking global cap.

    Queueing would be worse than refusing: the visitor would stare at a spinner while their
    request sat behind two two-minute Opus answers. Refuse fast and say why.
    """

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._in_flight = 0

    @property
    def in_flight(self) -> int:
        return self._in_flight

    @property
    def limit(self) -> int:
        return self._limit

    def try_acquire(self) -> bool:
        # Single-threaded event loop: check-then-increment cannot be interleaved, so no lock.
        if self._in_flight >= self._limit:
            return False
        self._in_flight += 1
        return True

    def release(self) -> None:
        self._in_flight = max(0, self._in_flight - 1)


def _today() -> str:
    return date.fromtimestamp(time.time()).isoformat()
