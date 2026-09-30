"""The pronunciation lists: read by anyone, written only by the editor. `talkthrough_03.md` §5."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.pronunciations import pronunciations_path

PASSWORD = "let-me-draw"
DISC = {"match": "DISC1", "say": "disconnect 1"}


@pytest.fixture
def nested(settings: Settings, tmp_path: Path) -> Settings:
    """The drawing two levels down, as in `schematic_extraction/<drawing>/extracted_docs`, so the
    global list lands in this test's own directory rather than pytest's shared one."""
    deep = tmp_path / "schematic_extraction" / "DRAWING" / "extracted_docs"
    deep.parent.mkdir(parents=True)
    shutil.move(settings.drawing_dir, deep)
    return settings.model_copy(update={"drawing_dir": deep})


@pytest.fixture
def editor(nested: Settings):
    edits = nested.model_copy(update={"allow_edits": True, "editor_password": PASSWORD})
    with TestClient(create_app(edits)) as c:
        yield c


def put(client: TestClient, scope: str, entries: list, password: str | None = PASSWORD):
    headers = {"X-Editor-Password": password} if password else {}
    return client.put(f"/api/pronunciations/{scope}", json={"entries": entries}, headers=headers)


def test_no_files_reads_as_two_empty_lists(nested: Settings) -> None:
    with TestClient(create_app(nested)) as reader:
        assert reader.get("/api/pronunciations").json() == {"global": [], "drawing": []}


def test_the_lists_sit_beside_every_drawing_and_beside_this_one(nested: Settings) -> None:
    root = nested.drawing_dir.parent.parent
    assert pronunciations_path(nested.drawing_dir, "global") == root / "pronunciations.json"
    assert pronunciations_path(nested.drawing_dir, "drawing") == (
        root / "DRAWING" / "walkthrough" / "pronunciations.json"
    )


def test_both_lists_are_read_by_anyone(nested: Settings) -> None:
    for scope, entries in (("global", [DISC]), ("drawing", [{"match": "0V", "say": "zero volt"}])):
        path = pronunciations_path(nested.drawing_dir, scope)  # type: ignore[arg-type]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"schema": 1, "entries": entries}))
    with TestClient(create_app(nested)) as reader:
        body = reader.get("/api/pronunciations").json()
    assert body == {"global": [DISC], "drawing": [{"match": "0V", "say": "zero volt"}]}


def test_a_malformed_list_is_a_500_that_names_the_file(nested: Settings) -> None:
    path = pronunciations_path(nested.drawing_dir, "global")
    path.write_text('{"entries": [{"match": ""}]}')
    with TestClient(create_app(nested)) as reader:
        response = reader.get("/api/pronunciations")
    assert response.status_code == 500 and str(path) in response.json()["detail"]


def test_a_save_replaces_the_list_whole_and_atomically(editor, nested: Settings) -> None:
    assert put(editor, "drawing", [DISC, {"match": "W12", "say": ""}]).status_code == 200
    assert put(editor, "drawing", [DISC]).status_code == 200
    path = pronunciations_path(nested.drawing_dir, "drawing")
    saved = json.loads(path.read_text())
    assert saved["schema"] == 1
    assert [(e["match"], e["say"]) for e in saved["entries"]] == [("DISC1", "disconnect 1")]
    assert saved["entries"][0]["at"].endswith("Z")  # stamped when the client sends none
    assert [p.name for p in path.parent.iterdir()] == ["pronunciations.json"]  # no temp left
    assert editor.get("/api/pronunciations").json()["drawing"][0]["match"] == "DISC1"


def test_it_needs_the_editor_password(editor) -> None:
    assert put(editor, "global", [DISC], password=None).status_code == 401
    assert put(editor, "global", [DISC], password="wrong").status_code == 401


@pytest.mark.parametrize(
    "entries",
    [
        [{"match": "", "say": "x"}],
        [{"match": "A", "say": "x" * 201}],
        [{"match": "A"}],
        [{"match": "A", "say": "x", "pattern": ".*"}],
        [{"match": "A", "say": "x"}, {"match": "A", "say": "y"}],
    ],
)
def test_a_list_that_is_not_one_is_refused(editor, entries: list) -> None:
    assert put(editor, "drawing", entries).status_code in (400, 422)


def test_an_unknown_scope_is_404(editor) -> None:
    assert put(editor, "everything", [DISC]).status_code == 404


def test_a_read_only_server_reads_but_has_no_way_to_write(nested: Settings) -> None:
    with TestClient(create_app(nested)) as reader:
        assert reader.get("/api/pronunciations").status_code == 200
        assert put(reader, "drawing", [DISC]).status_code in (404, 405)
