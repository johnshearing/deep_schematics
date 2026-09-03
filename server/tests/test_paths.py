"""`GET /api/paths` — where each traced wire runs, and what a net is made of.

The endpoint exists because a highlight is two questions and the index answers neither. *Where
does `W052` run* is authored geometry out of `locations.json`, and *which wires is net 120 made
of* is in the netlist but nowhere in `/api/designators`. Both are display facts, which is why
neither is in `circuit_logic.json` and why this route is free of the editor gate.

The one thing every test here is really guarding: **a net stores nothing.** Its highlight is the
union of its wires' paths, and the moment a net could carry a path of its own there would be two
answers to the same question and no rule for which wins.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import ink
from app.config import Settings
from app.drawing import load_circuit_logic, paths_index
from app.locations import load_locations
from app.main import create_app

#: The plan's §6 block, with this fixture's ids. Two points of ink, the conductor it came from,
#: and the two axes that say how we know it.
PATH: dict[str, Any] = {
    "runs": [[[379.8, 663.7], [301.8, 663.7]]],
    "conductors": ["C0080"],
    "geometry": "extracted",
    "attribution": "human",
    "by": "js",
    "at": "2026-09-02T18:04:11.512Z",
}

#: A hand trace: the same shape, no `conductors`, and it says so on both axes.
TRACED: dict[str, Any] = {
    "runs": [[[100, 100], [100, 140], [220, 140]], [[240, 140], [300, 140]]],
    "geometry": "human",
    "attribution": "human",
}


@pytest.fixture
def two_wire_net(drawing_dir: Path) -> Path:
    """The fixture netlist with a **second** wire on net 110.

    A net with one wire cannot show the property this endpoint exists for. The real sheet's net
    120 has four — `W052`, `W053`, `W063` and `W068` — and its highlight is the union of whichever
    of them somebody has traced; two is the smallest number that tests the same thing.
    """
    path = drawing_dir / "circuit_logic.json"
    doc = json.loads(path.read_text("utf-8"))
    doc["wires"].append(
        {
            "id": "W048",
            "net": "110",
            "color": "RED",
            "gauge": "16AWG",
            "from_terminal": "CB1:2",
            "to_terminal": "TB-110:1",
        }
    )
    path.write_text(json.dumps(doc), encoding="utf-8")
    load_circuit_logic.cache_clear()
    return drawing_dir


def write_locations(drawing_dir: Path, wires: dict[str, Any]) -> None:
    """The `wires` section, whole records — `{"W047": {"path": PATH}}` — so a test can put a
    path beside an end label the way a real file does."""
    (drawing_dir / "locations.json").write_text(
        json.dumps(
            {
                "drawing_number": "PS20115MLM4-2",
                "schema": 2,
                "page_size_pt": [1224.0, 792.0],
                "components": {},
                "terminals": {},
                "wires": wires,
            }
        ),
        encoding="utf-8",
    )
    load_locations.cache_clear()


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as c:
        yield c


def test_a_net_is_its_wires_and_stores_no_path_of_its_own(two_wire_net: Path) -> None:
    """The shape of the whole answer: paths keyed by **wire**, membership keyed by net.

    The union is taken by the client rather than here, and that is not laziness — it is what lets
    a net say *none of my wires has a path yet* instead of drawing nothing and reading as broken.
    """
    write_locations(two_wire_net, {"W047": {"path": PATH}})
    body = paths_index(two_wire_net)

    assert body["nets"]["110"] == ["W047", "W048"]
    assert body["wires"]["W047"]["runs"] == [[[379.8, 663.7], [301.8, 663.7]]]
    assert body["wires"]["W047"]["geometry"] == "extracted"
    assert body["wires"]["W047"]["attribution"] == "human"
    assert body["wires"]["W047"]["conductors"] == ["C0080"]
    # A net is in `nets` whether or not any of its wires is traced, because its membership is the
    # question this map answers. Nothing anywhere in the payload is keyed on a net.
    assert "110" not in body["wires"]


def test_a_wire_with_no_path_is_absent_rather_than_null(two_wire_net: Path) -> None:
    """The client asks *is there one*. A key whose value is null is a third state to explain, and
    every reader of it would have to remember which of the two "no" answers it is."""
    write_locations(two_wire_net, {"W047": {"path": PATH}})
    body = paths_index(two_wire_net)

    assert "W048" not in body["wires"]
    assert body["nets"]["110"] == ["W047", "W048"]


def test_a_hand_trace_says_so_and_names_no_conductor(drawing_dir: Path) -> None:
    """The two axes are the point of the field, and `conductors` is absent rather than empty: on a
    hand trace there was no conductor to lift, and that absence is the record. The two runs are a
    crossover hop — a real gap in the ink, which a path across it must show rather than close."""
    write_locations(drawing_dir, {"W047": {"path": TRACED}})
    wire = paths_index(drawing_dir)["wires"]["W047"]

    assert (wire["geometry"], wire["attribution"]) == ("human", "human")
    assert "conductors" not in wire
    assert len(wire["runs"]) == 2
    assert wire["runs"][0][0] == [100.0, 100.0]


def test_the_route_is_free_because_a_highlight_is_a_readers_question(
    settings: Settings, drawing_dir: Path
) -> None:
    """Unlike `/api/review`, and deliberately.

    That one is gated because it is the only route that opens `geometry.json`, and because 664 OCR
    readings are no use to somebody who cannot correct them. A path is the opposite on both counts:
    it comes out of `locations.json`, and *which of these lines is the one I care about* is a
    reader's question before it is an editor's. So the Drawing tab highlights with the editor
    switched off, which is the same acceptance criterion the designator list had in Session 3.
    """
    write_locations(drawing_dir, {"W047": {"path": PATH}})
    reader = Settings(**{**settings.model_dump(), "allow_edits": False})
    with TestClient(create_app(reader)) as client:
        assert client.get("/api/review").status_code == 404
        body = client.get("/api/paths").json()
    assert body["wires"]["W047"]["conductors"] == ["C0080"]


def test_nothing_here_opens_the_ink(client, drawing_dir: Path, monkeypatch) -> None:
    """`H17`, kept structurally rather than by remembering it.

    `geometry.json` is 608 KB and about 150,000 tokens, and exactly one route on this server reads
    it. A path is *authored* — a person confirmed those polylines and they live in
    `locations.json` — so this route has no business touching the ink loader, and Session 6's
    `/api/conductors` is where that changes. Asserted by making the loader raise.
    """
    write_locations(drawing_dir, {"W047": {"path": PATH}})

    def refuse(*_: Any, **__: Any) -> Any:
        raise AssertionError("/api/paths must not read geometry.json")

    monkeypatch.setattr(ink, "load_ink", refuse)
    assert client.get("/api/paths").status_code == 200


def test_the_answer_is_empty_and_not_an_error_before_anybody_has_traced_anything(
    client,
) -> None:
    """The state of every drawing until Session 6's editor exists — and of every drawing after a
    re-extraction. Empty `wires`, a full `nets`: the memberships are the netlist's and are true
    whether or not anybody has drawn a line."""
    body = client.get("/api/paths").json()
    assert body["wires"] == {}
    assert body["nets"] == {"110": ["W047"]}


def test_a_refused_path_is_absent_here_and_named_in_the_locations_report(
    client, drawing_dir: Path
) -> None:
    """The two halves of *nothing refused is silent*: this endpoint draws nothing, and the report
    the editor already shows says why. A path that reached the sheet after being refused would be
    the worse failure, so the drop happens in `resolve_geometry` and both routes inherit it."""
    write_locations(drawing_dir, {"W047": {"path": {**PATH, "geometry": "derived"}}})

    assert client.get("/api/paths").json()["wires"] == {}
    problems = client.get("/api/designators").json()["locations"]["problems"]
    assert any("geometry 'derived'" in p for p in problems)

