"""The Locate editor's write surface — the only part of this server that changes a file.

Two properties are worth more than the rest and are why this file exists separately from
`test_api.py`:

1. **With `allow_edits` off there is no editor at all.** Not a locked one — an absent one. A
   public demo should have nothing to guess a password against.
2. **A save must be visible to the very next read.** `load_locations` is `lru_cache`d, so the
   failure mode is not a crash but a point that appears to have been accepted and then comes back
   as the old value. That is the single most confusing bug this design can have.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

PASSWORD = "let-me-draw"

DOCUMENT: dict[str, Any] = {
    "drawing_number": "PS20115MLM4-2",
    "schema": 1,
    "page_size_pt": None,
    "components": {
        "CR1": {
            "sites": [
                {"id": "coil", "point": [110, 210], "terminals": ["A1"], "source": "human",
                 "by": "js", "at": "2026-08-16T12:00:00Z"}
            ]
        }
    },
    "terminals": {},
}


def editing(settings: Settings, **overrides: Any) -> Settings:
    return settings.model_copy(update={"allow_edits": True, "editor_password": PASSWORD,
                                       **overrides})


@pytest.fixture
def editor(settings: Settings):
    with TestClient(create_app(editing(settings))) as c:
        yield c


@pytest.fixture
def reader(settings: Settings):
    """The default server: edits not allowed, which is what a public demo runs."""
    with TestClient(create_app(settings)) as c:
        yield c


def put(client: TestClient, document: dict[str, Any], password: str | None = PASSWORD):
    headers = {"X-Editor-Password": password} if password is not None else {}
    return client.put("/api/locations", json={"document": document}, headers=headers)


def test_a_read_only_server_has_no_editor_to_attack(reader) -> None:
    """The routes are registered inside `if settings.allow_edits`, so this is 405/404 from the
    router rather than 401 from a handler — there is nothing there to be wrong about."""
    assert reader.get("/api/health").json()["editing"] == {
        "enabled": False, "password_required": False, "by": None,
    }
    assert reader.post("/api/editor/unlock", json={"password": PASSWORD}).status_code == 404
    assert reader.get("/api/locations").status_code == 404
    assert put(reader, DOCUMENT).status_code in (404, 405)


def test_health_says_the_editor_exists_and_wants_a_password(editor) -> None:
    """Published rather than probed: a client that discovered the tab by trying a route would
    offer a screen that cannot save."""
    assert editor.get("/api/health").json()["editing"] == {
        "enabled": True, "password_required": True, "by": None,
    }


def test_the_editor_password_is_not_the_demo_password(settings: Settings) -> None:
    """The whole reason for a second secret: permission to spend tokens and permission to change
    where the drawing says things are are different permissions."""
    both = editing(settings, demo_password="visitor")
    with TestClient(create_app(both)) as client:
        assert client.post("/api/unlock", json={"password": "visitor"}).status_code == 200
        assert client.post("/api/editor/unlock", json={"password": "visitor"}).status_code == 401
        assert client.post("/api/editor/unlock", json={"password": PASSWORD}).status_code == 200
        # And the demo password does not open the write route either.
        assert put(client, DOCUMENT, password="visitor").status_code == 401


def test_writing_without_the_password_is_refused_and_writes_nothing(
    editor, drawing_dir: Path
) -> None:
    assert put(editor, DOCUMENT, password=None).status_code == 401
    assert put(editor, DOCUMENT, password="wrong").status_code == 401
    assert not (drawing_dir / "locations.json").exists()


def test_a_saved_point_is_visible_to_the_very_next_read(editor, drawing_dir: Path) -> None:
    """The `lru_cache` trap, pinned. Without `load_locations.cache_clear()` inside the writer
    this passes its own 200 and then hands the old geometry back to `/api/designators`."""
    assert editor.get("/api/designators").json()["entries"][0]["placement"] == "seed"

    body = put(editor, DOCUMENT).json()
    assert body["saved"] is True
    assert body["report"]["confirmed_sites"] == 1
    assert "author_circuit_logic.py" in body["stale"]

    entries = {e["id"]: e for e in editor.get("/api/designators").json()["entries"]}
    assert entries["CR1"]["point"] == [110.0, 210.0]
    assert entries["CR1"]["placement"] == "confirmed"
    assert entries["CR1:A1"]["placement"] == "confirmed"


def test_the_file_on_disk_is_the_document_the_editor_sent(editor, drawing_dir: Path) -> None:
    """Verbatim, indented and newline-terminated. This is an authored file that lives in git
    beside `author_circuit_logic.py`: a one-point change should be a one-line diff, and fields
    this server does not model — `by`, `at` — must survive it."""
    put(editor, DOCUMENT)
    text = (drawing_dir / "locations.json").read_text("utf-8")
    assert text.endswith("}\n")
    assert "\n  " in text
    assert json.loads(text) == DOCUMENT
    assert json.loads(text)["components"]["CR1"]["sites"][0]["by"] == "js"


def test_get_returns_what_put_stored_so_the_round_trip_loses_nothing(editor) -> None:
    fresh = editor.get("/api/locations", headers={"X-Editor-Password": PASSWORD}).json()
    assert fresh["present"] is False
    assert fresh["document"]["schema"] == 1
    assert fresh["document"]["components"] == {}

    put(editor, DOCUMENT)
    again = editor.get("/api/locations", headers={"X-Editor-Password": PASSWORD}).json()
    assert again["present"] is True
    assert again["document"] == DOCUMENT
    assert again["report"]["confirmed_sites"] == 1


def test_a_payload_for_another_drawing_is_refused_whole(editor, drawing_dir: Path) -> None:
    """Points from one sheet are meaningless on another, and this is the mistake a librarian
    with two tabs open will actually make."""
    response = put(editor, {**DOCUMENT, "drawing_number": "SOMETHING-ELSE"})
    assert response.status_code == 409
    assert "SOMETHING-ELSE" in response.json()["detail"]
    assert not (drawing_dir / "locations.json").exists()


def test_an_unknown_schema_is_refused_rather_than_written(editor, drawing_dir: Path) -> None:
    assert put(editor, {**DOCUMENT, "schema": 99}).status_code == 409
    assert not (drawing_dir / "locations.json").exists()


def test_a_bad_coordinate_costs_that_coordinate_and_is_reported(editor) -> None:
    """The rule that decides how validation is split: one typo must cost that field, not the
    drawing — and what the server refused has to come back in words, because a coordinate a human
    typed and the server silently ignored is the worst outcome available here."""
    body = put(
        editor,
        {
            **DOCUMENT,
            "components": {
                "CR1": {
                    "sites": [
                        {"id": "coil", "point": [110, 210], "terminals": ["A1"],
                         "source": "human"},
                        {"id": "typo", "point": [110, "21O"], "source": "human"},
                    ]
                }
            },
        },
    ).json()

    assert body["saved"] is True
    assert body["report"]["confirmed_sites"] == 1
    assert any("no usable point" in p for p in body["report"]["problems"])


def test_an_unlocked_editor_needs_no_password(settings: Settings) -> None:
    """A librarian running this on their own laptop should not have to invent a secret to keep
    from themselves. `allow_edits` is still the switch that has to be thrown deliberately."""
    with TestClient(create_app(editing(settings, editor_password=""))) as client:
        assert client.get("/api/health").json()["editing"]["password_required"] is False
        assert put(client, DOCUMENT, password=None).status_code == 200


def test_the_editors_name_is_published_so_a_point_can_be_signed(settings: Settings) -> None:
    with TestClient(create_app(editing(settings, editor_name="js"))) as client:
        assert client.get("/api/health").json()["editing"]["by"] == "js"
