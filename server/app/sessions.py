"""In-memory conversation sessions.

Deliberately not persisted. A session is one browser tab's conversation; losing it on restart
costs a visitor nothing but a re-ask, and persistence would mean storing visitor text. The
`claude` transcript on disk remains the audit record.

The session id doubles as the `--session-id` UUID handed to the CLI, so resume is
deterministic: we never have to wait for the `init` event to learn what to resume.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field


@dataclass
class Session:
    id: str
    model: str
    created_at: float
    last_used_at: float
    turns: int = 0
    cost_usd: float = 0.0
    #: False until a turn has completed successfully; the next turn passes `--resume` only
    #: once there is something on disk to resume.
    resumable: bool = False
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class SessionStore:
    """LRU with a TTL. Bounded so a flood of one-question visitors cannot grow it forever."""

    def __init__(self, max_sessions: int, ttl_s: float) -> None:
        self._sessions: OrderedDict[str, Session] = OrderedDict()
        self._max = max_sessions
        self._ttl = ttl_s

    def create(self, model: str) -> Session:
        self._evict()
        now = time.time()
        session = Session(id=str(uuid.uuid4()), model=model, created_at=now, last_used_at=now)
        self._sessions[session.id] = session
        while len(self._sessions) > self._max:
            self._sessions.popitem(last=False)
        return session

    def get(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if time.time() - session.last_used_at > self._ttl:
            del self._sessions[session_id]
            return None
        session.last_used_at = time.time()
        self._sessions.move_to_end(session_id)
        return session

    def get_or_create(self, session_id: str | None, model: str) -> tuple[Session, bool]:
        """Returns the session and whether it is new."""
        if session_id:
            existing = self.get(session_id)
            if existing is not None:
                return existing, False
        return self.create(model), True

    def _evict(self) -> None:
        cutoff = time.time() - self._ttl
        for sid in [s.id for s in self._sessions.values() if s.last_used_at < cutoff]:
            self._sessions.pop(sid, None)

    def __len__(self) -> int:
        return len(self._sessions)
