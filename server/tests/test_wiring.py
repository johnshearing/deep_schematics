"""`wiring.json` — which two terminals each wire joins, and the screen that writes it.

**The property this whole file defends** is the one Phase A exists for:

> A wire whose endpoints do not change still gets a record when a person confirms it.

*I looked and it was right* is a decision. 47 of this drawing's 71 wires are that case, and a file
that stored only the corrections would leave those 47 indistinguishable from the wires nobody had
opened — which is the distinction `locations.json` exists for and the one this file inherits.

Three other things are asserted here rather than argued:

- **every refusal names the record**, because a wiring file is read by a person and a problem
  reported as *"the file is invalid"* is a problem nobody can act on;
- **a save says the netlist is behind**, and it is the *only* one of the three authored files that
  does. A path and a label correction never reach `circuit_logic.json` and tests compare bytes to
  prove it; an endpoint **is** the netlist;
- **the editor cannot write a record the generator refuses.** `author_circuit_logic.py` validates
  this same file, cannot import from `server/`, and is the thing that runs hours later. That
  duplication is the established shape here — so the guard is a test that puts the same records
  through both, rather than a comment asking the next session to be careful.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.drawing import load_circuit_logic
from app.main import create_app
from app.wiring import (
    FILENAME,
    Wire,
    WiringRefused,
    load_wiring,
    parse,
    resolve_wiring,
    save_wiring,
)

#: The fixture netlist's only wire, and its two real terminals. `W047` runs `CR1:A1 → CB1:2`.
CONFIRMED: dict[str, Any] = {
    "from": "CR1:A1",
    "to": "CB1:2",
    "source": "human",
    "by": "js",
    "at": "2026-09-07T14:22:03.118Z",
}


def document(wires: dict[str, Any], commoning: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "drawing_number": "PS20115MLM4-2",
        "schema": 1,
        "wires": wires,
        "commoning": commoning if commoning is not None else {},
    }


def write(drawing_dir: Path, wires: dict[str, Any], commoning: dict[str, Any] | None = None):
    (drawing_dir / FILENAME).write_text(json.dumps(document(wires, commoning)), encoding="utf-8")
    load_wiring.cache_clear()


def resolved(drawing_dir: Path):
    return resolve_wiring(drawing_dir, load_circuit_logic(drawing_dir))


def client(settings: Settings, *, allow: bool = True, password: str | None = "edit-1234"):
    app = create_app(
        settings.model_copy(
            update={"allow_edits": allow, "editor_password": password or ""}
        )
    )
    return TestClient(app)


HEADERS = {"X-Editor-Password": "edit-1234"}


# -- the acceptance criterion --------------------------------------------------------------


def test_a_confirmation_that_changes_nothing_is_still_a_decision(drawing_dir: Path):
    """**Phase A's whole point.** The endpoints are exactly the index's and the record still
    exists, still says `human`, and still moves the count — with **no `was`**, because nothing was
    replaced.

    47 of the 71 wires on the real sheet are this case. A file that only recorded corrections
    would say nothing about them, and *nobody has looked at this* would be indistinguishable from
    *somebody checked it*."""
    write(drawing_dir, {"W047": CONFIRMED})
    wiring = resolved(drawing_dir)

    assert wiring.wires["W047"].from_terminal == "CR1:A1"
    assert wiring.wires["W047"].to_terminal == "CB1:2"
    assert wiring.wires["W047"].confirmed
    assert wiring.wires["W047"].was is None
    assert not wiring.wires["W047"].corrected
    assert wiring.counts()["confirmed"] == 1
    assert wiring.counts()["corrected"] == 0


def test_an_untouched_file_says_nobody_has_confirmed_anything(drawing_dir: Path):
    """The honest first number. Every record the bootstrap wrote says `index`, so the queue reads
    `0 of n` the first time the screen is opened — which is decision 4 asking for the truth rather
    than for a full progress bar."""
    write(drawing_dir, {"W047": {"from": "CR1:A1", "to": "CB1:2", "source": "index"}})
    wiring = resolved(drawing_dir)
    assert wiring.counts() | {} == wiring.counts()
    assert wiring.counts()["wires"] == 1
    assert wiring.counts()["confirmed"] == 0


def test_a_correction_keeps_the_endpoints_it_replaced(drawing_dir: Path):
    """`was` is kept forever, for the same reason a label correction keeps it: the `W` table is
    hand-maintained and a future edit there would destroy the original."""
    write(
        drawing_dir,
        {"W047": {**CONFIRMED, "to": "TB-110:1", "was": ["CR1:A1", "CB1:2"]}},
    )
    wire = resolved(drawing_dir).wires["W047"]
    assert wire.to_terminal == "TB-110:1"
    assert wire.was == ("CR1:A1", "CB1:2")
    assert wire.corrected


def test_an_end_nobody_has_set_is_null_and_that_is_a_real_state(drawing_dir: Path):
    """`null` is the only honest value for a wire somebody started and has not finished, so it is
    a value rather than a missing key — and a record with a `null` end is `confirmed` but not
    `settled`, which are two different questions."""
    write(drawing_dir, {"W047": {"from": "CR1:A1", "to": None, "source": "human"}})
    wire = resolved(drawing_dir).wires["W047"]
    assert wire.to_terminal is None
    assert wire.confirmed and not wire.settled
    assert resolved(drawing_dir).counts()["unset"] == 1


def test_a_retired_wire_is_a_tombstone_with_a_reason_and_no_ends(drawing_dir: Path):
    """An id is never reused, so a removed wire leaves a marker rather than a hole — a stale path
    or a stale citation then gets an answer instead of silence."""
    write(drawing_dir, {"W047": {"retired": "duplicated W014"}})
    wire = resolved(drawing_dir).wires["W047"]
    assert wire.retired == "duplicated W014"
    assert not wire.confirmed and not wire.settled
    assert resolved(drawing_dir).counts()["retired"] == 1


# -- refusals, every one of them by name ---------------------------------------------------


@pytest.mark.parametrize(
    ("body", "says"),
    [
        ({"to": "CB1:2", "source": "human"}, "has no 'from'"),
        ({"from": "CR1:A1", "source": "human"}, "has no 'to'"),
        ({"from": "CR1:A1", "to": "CB1:2"}, "source None"),
        ({"from": "CR1:A1", "to": "CB1:2", "source": "derived"}, "source 'derived'"),
        ({"from": "CR1", "to": "CB1:2", "source": "human"}, "not a COMPONENT:PIN"),
        ({"from": "CR1:A1", "to": "CB1:2", "source": "human", "was": ["CR1:A1"]}, "has was"),
        ({"retired": "  "}, "a tombstone needs a reason"),
        ({"retired": "gone", "from": "CR1:A1", "to": "CB1:2"}, "still names endpoints"),
        ({"from": "CR1:A1", "to": "CB1:2", "source": "human", "note": 7}, "has note 7"),
        ("not an object", "is not an object"),
    ],
)
def test_a_bad_record_is_refused_by_name(body: Any, says: str):
    """Shape only, and the wire id is in every message.

    `derived` is in the list on purpose. It is refused **by name** rather than merely by not being
    one of the two, because an endpoint is read or it is guessed and there is no third thing it can
    be — the same treatment `locations.py` gives `derived` on a path's two axes."""
    wiring = parse(document({"W047": body}))
    assert "W047" not in wiring.wires
    assert any("W047" in p and says in p for p in wiring.problems), wiring.problems


def test_one_bad_record_costs_that_record_and_nothing_else():
    """The unit of refusal is **one wire**. A file whose 71 endpoints were all thrown away over
    one typo would be the worst possible answer to a typo, and the editor holding this document
    has to be able to show the person which record is wrong."""
    wiring = parse(
        document(
            {
                "W047": {"from": "CR1:A1", "to": "CB1:2", "source": "human"},
                "W048": {"from": "CR1:A1", "to": "CB1:2", "source": "guessed"},
            }
        )
    )
    assert set(wiring.wires) == {"W047"}
    assert len(wiring.problems) == 1


def test_a_file_declaring_another_schema_is_refused_whole():
    """Half-understood connectivity is worse than none — the same rule the other three files
    have."""
    wiring = parse({**document({}), "schema": 2})
    assert not wiring.wires
    assert any("schema 2" in p for p in wiring.problems)


def test_an_endpoint_on_a_terminal_the_netlist_does_not_have_is_refused_by_name(
    drawing_dir: Path,
):
    """The refusal whose symptom would otherwise be **nothing at all.**

    An endpoint on a terminal that does not exist connects nothing and is never drawn, so a hand
    edit that mistypes one would look exactly like a hand edit that worked — until the generator
    refused, hours later, in a command about an edit nobody remembers making. Same reasoning as
    `H14`'s end label on a pin its wire does not touch, and the check is here rather than in
    `parse` because only this layer has been handed the netlist."""
    write(drawing_dir, {"W047": {**CONFIRMED, "to": "TB-110:9"}})
    wiring = resolved(drawing_dir)
    assert "W047" not in wiring.wires
    assert any("'TB-110:9'" in p and "not a terminal" in p for p in wiring.problems)


def test_a_record_for_a_wire_the_netlist_does_not_have_is_refused_by_name(drawing_dir: Path):
    """Adding a wire is Phase E. Until then an id the netlist has never heard of is a typo, and a
    typo here would **invent a connection** — which is exactly the class of defect this whole plan
    exists to remove."""
    write(drawing_dir, {"W999": CONFIRMED})
    wiring = resolved(drawing_dir)
    assert not wiring.wires
    assert any("'W999'" in p and "not a wire" in p for p in wiring.problems)


def test_commoning_keyed_on_something_that_is_not_a_component_is_refused_by_name(
    drawing_dir: Path,
):
    """A block's bus keyed on nothing would be authored, saved, and never highlighted."""
    write(drawing_dir, {}, {"TB-999": {"runs": [[[0, 0], [0, 10]]]}})
    wiring = resolved(drawing_dir)
    assert not wiring.commoning
    assert any("'TB-999'" in p and "not a component" in p for p in wiring.problems)


def test_a_commoning_record_is_carried_through_untouched(drawing_dir: Path):
    """**Phase C owns what is inside one of these**, and this module validates the key and the
    shape and nothing else. Carrying the body through rather than half-validating a format nothing
    writes yet is cheaper than a validator somebody has to un-write — and the assertion that it
    arrives unchanged is what makes that safe to rely on."""
    body = {"runs": [[[954.4, 267.3], [954.4, 546.9]]], "conductors": ["C0105"], "by": "js"}
    write(drawing_dir, {}, {"TB-110": body})
    assert resolved(drawing_dir).commoning == {"TB-110": body}


# -- the routes ----------------------------------------------------------------------------


def test_the_wiring_routes_do_not_exist_on_a_readers_server(settings: Settings):
    """Not 401 — **404**, because with `allow_edits` false the routes were never registered. The
    same gate the other two editors are behind, and for a stronger reason than either: this is the
    file that changes what the model says connects to what."""
    reader = client(settings, allow=False)
    assert reader.get("/api/wiring").status_code == 404
    assert reader.put("/api/wiring", json={"document": document({})}).status_code == 404


def test_the_wiring_routes_are_behind_the_editor_password(settings: Settings):
    editor = client(settings)
    assert editor.get("/api/wiring").status_code == 401
    assert editor.get("/api/wiring", headers=HEADERS).status_code == 200


def test_a_drawing_with_no_wiring_file_gets_an_empty_document_rather_than_a_404(
    settings: Settings,
):
    """One load path for a fresh drawing and a half-authored one: they differ in content, not in
    kind. `present` is what says which."""
    body = client(settings).get("/api/wiring", headers=HEADERS).json()
    assert body["present"] is False
    assert body["document"]["wires"] == {}
    assert body["document"]["commoning"] == {}
    assert body["report"]["file"] is False


def test_the_document_comes_back_verbatim(settings: Settings, drawing_dir: Path):
    """The screen sends it straight back, so anything this endpoint normalised away — a `by`, an
    `at`, a field a later version adds — would be silently deleted on the next save."""
    raw = document({"W047": {**CONFIRMED, "unknown_key": "kept"}})
    (drawing_dir / FILENAME).write_text(json.dumps(raw), encoding="utf-8")
    body = client(settings).get("/api/wiring", headers=HEADERS).json()
    assert body["present"] is True
    assert body["document"] == raw


def test_a_saved_endpoint_is_visible_to_the_very_next_read(settings: Settings):
    """`load_wiring` is `lru_cache`d, so a writer that forgets `cache_clear()` saves an endpoint
    and is handed the old one back. `H2` for the third time in this project, and this is the test
    that fails without it."""
    editor = client(settings)
    saved = editor.put("/api/wiring", json={"document": document({"W047": CONFIRMED})},
                       headers=HEADERS)
    assert saved.status_code == 200
    assert saved.json()["report"]["confirmed"] == 1
    assert editor.get("/api/wiring", headers=HEADERS).json()["document"]["wires"]["W047"][
        "source"
    ] == "human"


def test_a_wiring_save_says_the_netlist_is_behind(settings: Settings):
    """**The one authored file whose save really does make `circuit_logic.json` stale**, and the
    banner names both commands.

    A path and a label correction are display geometry and a reading of the ink; neither reaches
    the netlist and a test compares bytes for each. An endpoint *is* the netlist — it is the
    `CONNECTS_TO` edge the model answers from — and unlike a placement run this work also needs
    `build_kg.py`, because `build_kg.py` emits no coordinates and only moves when connectivity
    does."""
    body = client(settings).put(
        "/api/wiring", json={"document": document({"W047": CONFIRMED})}, headers=HEADERS
    ).json()
    assert "author_circuit_logic.py" in body["stale"]
    assert "build_kg.py" in body["stale"]


def test_a_payload_for_another_drawing_is_refused(settings: Settings):
    """The mistake somebody with two tabs open will actually make. What one sheet's wires join
    says nothing about another's."""
    bad = {**document({}), "drawing_number": "SOMETHING-ELSE"}
    answer = client(settings).put("/api/wiring", json={"document": bad}, headers=HEADERS)
    assert answer.status_code == 409
    assert "SOMETHING-ELSE" in answer.json()["detail"]


def test_a_payload_declaring_another_schema_is_refused(settings: Settings):
    bad = {**document({}), "schema": 9}
    answer = client(settings).put("/api/wiring", json={"document": bad}, headers=HEADERS)
    assert answer.status_code == 409
    assert "schema 9" in answer.json()["detail"]


def test_there_is_no_page_size_check_and_that_is_the_honest_difference(
    settings: Settings, drawing_dir: Path
):
    """`save_locations` refuses a payload measured on a different page size, because a coordinate
    is only meaningful against one. **This file holds no coordinates**: `CR-BP:A2` names the same
    terminal whichever sheet prints it, which is the same difference `save_corrections` has — and
    it is the thing that will let this format survive a circuit that needs several pages."""
    raw = {**document({"W047": CONFIRMED}), "page_size_pt": [99.0, 99.0]}
    assert save_wiring(drawing_dir, raw, drawing_number="PS20115MLM4-2").wires["W047"].confirmed


def test_a_payload_that_is_not_an_object_is_refused(drawing_dir: Path):
    with pytest.raises(WiringRefused):
        save_wiring(drawing_dir, ["W047"], drawing_number="PS20115MLM4-2")


# -- the seam with the generator -----------------------------------------------------------

EXTRACTION = (
    Path(__file__).resolve().parents[2] / "schematic_extraction/PS20115MLM4-2/extracted_docs"
)
SCRIPT = EXTRACTION / "author_circuit_logic.py"

#: Every record shape worth putting through both validators: three the two must accept, and six
#: the two must refuse. Keyed on `W001`, which is a real wire in the extraction's own `W` table.
AGREED: list[tuple[str, Any]] = [
    ("an index record", {"from": "PLG1:B", "to": "TB-L1:1", "source": "index"}),
    ("a confirmation", {"from": "PLG1:B", "to": "TB-L1:1", "source": "human", "by": "js"}),
    (
        "a correction with was",
        {"from": "PLG1:B", "to": "TB-N:1", "source": "human", "was": ["PLG1:B", "TB-L1:1"]},
    ),
    ("a half-set wire", {"from": "PLG1:B", "to": None, "source": "human"}),
    ("a tombstone", {"retired": "duplicated"}),
    ("no from", {"to": "TB-L1:1", "source": "human"}),
    ("no source", {"from": "PLG1:B", "to": "TB-L1:1"}),
    ("source derived", {"from": "PLG1:B", "to": "TB-L1:1", "source": "derived"}),
    ("a bare component as an end", {"from": "PLG1", "to": "TB-L1:1", "source": "human"}),
    ("a one-element was", {"from": "PLG1:B", "to": "TB-L1:1", "source": "human", "was": ["x"]}),
    ("an endpoint that is not a terminal", {"from": "PLG1:B", "to": "TB-L1:9",
                                            "source": "human"}),
    ("a tombstone with no reason", {"retired": ""}),
]


@pytest.mark.skipif(not SCRIPT.is_file(), reason="PS20115MLM4-2 is not in this tree")
@pytest.mark.parametrize(("what", "body"), AGREED, ids=[a for a, _ in AGREED])
def test_the_editor_cannot_write_a_record_the_generator_refuses(
    what: str, body: Any, tmp_path: Path
):
    """**The guard on a duplication that is deliberate.**

    `read_wiring()` in `author_circuit_logic.py` validates this same file, and it cannot import
    from `server/`: it is a standalone script that ships inside an extraction directory and gets
    copied to the next drawing with the tables replaced. `read_locations()` and `app/locations.py`
    have lived that way since the beginning and it is the established shape here.

    The risk is exact. **If the two disagree about what a valid record is, this editor writes
    something the generator refuses and nothing else in the project notices** — the symptom is a
    `REFUSED:` from a command a person runs hours later about an edit they have forgotten making.
    So this puts one record at a time through both and asserts they reach the same verdict.

    Only the `wires` section: the generator does not read `commoning` at all, and that is correct
    rather than a gap — a block's own bus is display geometry and never enters the netlist.
    """
    work = tmp_path / what.replace(" ", "-")
    work.mkdir()
    (work / SCRIPT.name).write_bytes(SCRIPT.read_bytes())
    raw = {"drawing_number": "PS20115MLM4-2", "schema": 1, "wires": {"W001": body}}
    (work / FILENAME).write_text(json.dumps(raw), encoding="utf-8")

    done = subprocess.run(  # noqa: S603
        [sys.executable, str(work / SCRIPT.name)],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    generator_refused = done.returncode != 0

    # The server's verdict on the same record: `parse` for shape, and — for the netlist-level
    # refusals — the same check `resolve_wiring` makes, using the extraction's own netlist.
    wiring = parse(raw)
    server_refused = "W001" not in wiring.wires
    if not server_refused:
        wire = wiring.wires["W001"]
        netlist = json.loads((EXTRACTION / "circuit_logic.json").read_text("utf-8"))
        terminals = {t["id"] for t in netlist["terminals"]}
        server_refused = any(
            end is not None and end not in terminals
            for end in (wire.from_terminal, wire.to_terminal)
        )

    assert server_refused == generator_refused, (
        f"{what}: the server {'refused' if server_refused else 'accepted'} it and the generator "
        f"{'refused' if generator_refused else 'accepted'} it.\n{done.stdout}\n{done.stderr}"
    )


def test_a_wire_dataclass_says_what_a_person_did_rather_than_what_the_file_holds():
    """`confirmed`, `settled` and `corrected` are three different questions and the screen asks
    all three: the queue counts the first, the panel's flag reads the second, and the `was` stamp
    is the third. Spelling them out here is what stops a caller writing
    `source == "human" and from and to` and quietly folding two of them together."""
    assert Wire(source="index", from_terminal="A:1", to_terminal="B:1").settled
    assert not Wire(source="index", from_terminal="A:1", to_terminal="B:1").confirmed
    assert Wire(source="human", from_terminal="A:1").confirmed
    assert not Wire(source="human", from_terminal="A:1").settled
    moved = Wire(source="human", from_terminal="A:1", to_terminal="B:1", was=("A:1", "C:1"))
    assert moved.corrected
    assert not Wire(retired="gone", source="human").confirmed
