"""The label-corrections review — the third authored file, and the first that touches the ink.

Four properties are worth more than the rest and are why this file exists apart from
`test_editor.py`:

1. **With `allow_edits` off there is no review screen at all.** Not a locked one — an absent one,
   and in particular an absent `GET`, because that route is the only thing in this server that reads
   `geometry.json`.
2. **`geometry.json` does not reach the browser.** 608 KB, about 150,000 tokens, forbidden to the
   model by `prompts.py` §3. The loader narrows it and the route narrows it again, and the item key
   set is pinned here so a later `**spread` cannot quietly widen it.
3. **The netlist does not move.** Correcting a reading of the sheet must leave
   `author_circuit_logic.py`'s output byte-identical, or Phase F has silently become an edit to the
   index — which is the one thing it is not.
4. **`text: null` is not an empty correction.** *This is not a label* and *I read nothing here* are
   different claims about different things, and the file has to be able to say the first.
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
from app.ink import load_ink
from app.label_corrections import load_corrections
from app.main import create_app

PASSWORD = "let-me-draw"

EXTRACTION = (
    Path(__file__).resolve().parents[2] / "schematic_extraction/PS20115MLM4-2/extracted_docs"
)

#: A miniature `geometry.json`, the same shape as the real one and carrying every case the review
#: screen has to get right: a confident label, a low-confidence misread that a conductor's net name
#: is lifted *from*, a label that was not read at all, a label nobody flagged (which is what the
#: `All` scope is for), a run with a net name, and a run with none.
INK: dict[str, Any] = {
    "source_file": "PS20115MLM4-2.pdf",
    "text_source": "OCR of stroked glyph geometry",
    "pages": [
        {
            "page": 1,
            "page_size": {"width": 1224.0, "height": 792.0},
            "labels": [
                {"id": "T0001", "text": "BLUE 18AWG", "raw_ocr": "BLUE 18AWG", "confidence": 0.95,
                 "kind": "wire_spec", "ocr_status": "ok", "bbox": [100, 200, 140, 210],
                 "center": [120, 205]},
                {"id": "T0012", "text": "LI-A", "raw_ocr": "LI-A", "confidence": 0.4,
                 "kind": "text", "ocr_status": "ok", "bbox": [415.48, 44.73, 425.82, 48.86],
                 "center": [420, 46]},
                {"id": "T0104", "text": "YY", "raw_ocr": "YY", "confidence": 0.35,
                 "kind": "text", "ocr_status": "ok", "bbox": [500, 300, 510, 310],
                 "center": [505, 305]},
                {"id": "T0200", "text": "", "raw_ocr": "", "confidence": 0.0,
                 "kind": "empty", "ocr_status": "empty", "bbox": [600, 400, 610, 410],
                 "center": [605, 405]},
                {"id": "T0300", "text": "P0WER IN", "raw_ocr": "POWER IN", "confidence": 0.84,
                 "kind": "note", "ocr_status": "ok", "bbox": [700, 500, 760, 512],
                 "center": [730, 506]},
            ],
            "conductors": [
                {"id": "C0030", "points": [[300, 46], [420, 46], [420, 90]],
                 "endpoints": [[300, 46], [420, 90]], "net_label": "LI-A",
                 "spec_label": "BLUE 18AWG", "label_ids": ["T0012", "T0001"],
                 "node_ids": [0, 1], "length": 164.0, "segment_count": 2},
                {"id": "C0008", "points": [[468, 216], [761, 216]],
                 "endpoints": [[468.12, 215.97], [761.5, 232.51]], "net_label": None,
                 "spec_label": None, "label_ids": [], "node_ids": [2, 3], "length": 293.0,
                 "segment_count": 1},
            ],
            "symbols": [{"id": "S0001", "kind": "terminal_point"}],
            "boxes": [{"id": "B0001"}],
            "junctions": [],
            "nets": [],
            "rects": [],
            "review_queue": [
                {"kind": "low_confidence_label", "id": "T0012", "bbox": [415.48, 44.73, 425.82,
                 48.86], "raw_ocr": "LI-A", "text": "LI-A", "confidence": 0.4},
                {"kind": "low_confidence_label", "id": "T0104", "bbox": [500, 300, 510, 310],
                 "raw_ocr": "YY", "text": "YY", "confidence": 0.35},
                {"kind": "low_confidence_label", "id": "T0200", "bbox": [600, 400, 610, 410],
                 "raw_ocr": "", "text": "", "confidence": 0.0},
                {"kind": "incomplete_conductor", "id": "C0008",
                 "endpoints": [[468.12, 215.97], [761.5, 232.51]],
                 "missing": ["net_label", "spec_label"]},
            ],
            "stats": {"text_labels": 5},
        }
    ],
}

DOCUMENT: dict[str, Any] = {
    "drawing_number": "PS20115MLM4-2",
    "schema": 1,
    "labels": {
        "T0012": {"text": "L1-A", "was": "LI-A", "by": "js", "at": "2026-08-25T10:00:00Z"},
    },
}


@pytest.fixture(autouse=True)
def _clear_ink_cache():
    load_ink.cache_clear()
    load_corrections.cache_clear()
    yield
    load_ink.cache_clear()
    load_corrections.cache_clear()


@pytest.fixture
def inked(drawing_dir: Path) -> Path:
    """`drawing_dir` plus a `geometry.json`. The shared fixture has none, deliberately: nothing
    before this session read one, and every other test in the suite proves it still does not."""
    (drawing_dir / "geometry.json").write_text(json.dumps(INK), encoding="utf-8")
    return drawing_dir


def editing(settings: Settings, **overrides: Any) -> Settings:
    return settings.model_copy(
        update={"allow_edits": True, "editor_password": PASSWORD, **overrides}
    )


@pytest.fixture
def reviewer(settings: Settings, inked: Path):
    with TestClient(create_app(editing(settings))) as c:
        yield c


@pytest.fixture
def reader(settings: Settings, inked: Path):
    """The default server: edits not allowed, which is what a public demo runs."""
    with TestClient(create_app(settings)) as c:
        yield c


def get(client: TestClient, password: str | None = PASSWORD):
    headers = {"X-Editor-Password": password} if password is not None else {}
    return client.get("/api/review", headers=headers)


def put(client: TestClient, document: dict[str, Any], password: str | None = PASSWORD):
    headers = {"X-Editor-Password": password} if password is not None else {}
    return client.put("/api/review", json={"document": document}, headers=headers)


def items(client: TestClient) -> dict[str, dict[str, Any]]:
    return {i["id"]: i for i in get(client).json()["items"]}


# -- the gate -------------------------------------------------------------------------------


def test_a_read_only_server_has_no_review_screen_to_attack(reader) -> None:
    """Registered inside `if settings.allow_edits`, so this is the router answering rather than a
    handler — there is nothing there to be wrong about. It matters twice over for the `GET`: that
    is the only route in this server that opens `geometry.json`."""
    assert get(reader).status_code == 404
    assert put(reader, DOCUMENT).status_code in (404, 405)


def test_reviewing_without_the_password_is_refused_and_writes_nothing(
    reviewer, drawing_dir: Path
) -> None:
    assert get(reviewer, password=None).status_code == 401
    assert put(reviewer, DOCUMENT, password=None).status_code == 401
    assert put(reviewer, DOCUMENT, password="wrong").status_code == 401
    assert not (drawing_dir / "label_corrections.json").exists()


# -- the boundary round `geometry.json` -----------------------------------------------------

#: Every key a review item may carry. Pinned rather than described, because the failure mode is a
#: `**spread` that quietly sends a conductor's polyline — or the extraction's `params` — to a
#: browser, and nothing on screen would look any different.
ITEM_KEYS = {
    "id", "kind", "read", "text", "confidence", "flagged", "net_name", "rect",
    "label_kind", "raw_ocr", "missing", "conductors", "correction", "via", "points",
}


def test_a_review_item_carries_only_the_fields_the_screen_draws(reviewer) -> None:
    body = get(reviewer).json()
    for item in body["items"]:
        assert set(item) <= ITEM_KEYS, f"{item['id']} carries {set(item) - ITEM_KEYS}"
    # And the response as a whole holds none of the sections the loader drops on the way in.
    #
    # `points` left this list on 2026-09-03 and is now in `ITEM_KEYS` instead, which is the honest
    # place for it: a run's polyline is *published on purpose* so the ring follows the ink, and it
    # is 7 KB for all 149. The rule the list is defending has not changed — what may not reach a
    # browser is a **section of the file nobody narrowed**, and `node_ids` is still the tell.
    text = json.dumps(body)
    for dropped in ("symbols", "boxes", "junctions", "rects", "stats", "node_ids", "params"):
        assert f'"{dropped}"' not in text


def test_geometry_json_is_parsed_once_however_many_times_the_screen_asks(reviewer) -> None:
    """The `lru_cache` earning its place: a 608 KB parse behind a screen the editor polls. Nothing
    writes this file, so unlike `load_locations` there is no cache to invalidate — a re-extraction
    is a deploy."""
    before = load_ink.cache_info()
    for _ in range(4):
        assert get(reviewer).status_code == 200
    after = load_ink.cache_info()
    assert after.misses - before.misses == 1
    assert after.hits - before.hits >= 3


# -- the queue ------------------------------------------------------------------------------


def test_the_queue_names_every_reading_flagged_or_not(reviewer) -> None:
    """*"Editing all of them should be possible"* was half of the decision that produced this
    screen: a queue that can only reach what the extractor doubted cannot fix what it was
    confident and wrong about — and `P0WER` for `POWER` is exactly that, at 0.84."""
    body = get(reviewer).json()
    assert body["counts"] == {
        "labels": 5,
        "conductors": 2,
        "flagged": 4,
        "blank_labels": 1,
        "conductors_without_a_net_name": 1,
        # Every conductor, plus the labels some conductor's net name is read from.
        "net_names": 3,
    }
    found = items(reviewer)
    assert set(found) == {"T0001", "T0012", "T0104", "T0200", "T0300", "C0030", "C0008"}
    assert found["T0300"]["flagged"] is False
    assert found["T0012"]["flagged"] is True


def test_a_label_reports_what_was_read_how_sure_and_where_to_look(reviewer) -> None:
    item = items(reviewer)["T0012"]
    assert item["kind"] == "label"
    assert (item["read"], item["text"], item["confidence"]) == ("LI-A", "LI-A", 0.4)
    assert item["rect"] == [415.48, 44.73, 425.82, 48.86]
    assert item["label_kind"] == "text"
    # `raw_ocr` only where it differs from what the extraction settled on — a field that repeats
    # its neighbour is a field a reader stops reading.
    assert "raw_ocr" not in item
    assert items(reviewer)["T0300"]["raw_ocr"] == "POWER IN"


def test_a_conductor_has_no_confidence_because_its_net_name_was_bound_not_read(reviewer) -> None:
    """The reason the queue sorts the two kinds apart. A label is a *guess* with a number on it; a
    run's net name is a *binding* the extractor either made or did not, and 79 of this drawing's
    149 runs have none — a blank rather than a mistake."""
    found = items(reviewer)
    assert found["C0030"]["confidence"] is None
    assert found["C0030"]["read"] == "LI-A"
    assert found["C0008"]["read"] is None
    assert found["C0008"]["missing"] == ["net_label", "spec_label"]
    # Its own polyline frames the run, so the screen can fly to the ink rather than to a
    # transcription — see the next test for why that is not the box round its two ends.
    assert found["C0008"]["rect"] == [468, 216, 761, 216]
    # Every conductor is on the net-name filter, including the ones with nothing bound: those are
    # the ones a person can most usefully supply.
    assert found["C0008"]["net_name"] is True


def test_a_run_is_framed_by_its_own_polyline_and_not_by_the_box_round_its_ends(reviewer) -> None:
    """Small-batch item 5, and it is a wrong ring rather than a wrong reading.

    `C0030` in this fixture bends: (300, 46) → (420, 46) → (420, 90), so its two *endpoints* are
    (300, 46) and (420, 90) and a rectangle over those two is a box the ink only touches the
    corners of. On the real sheet `C0002` is a three-segment L inside a 206 × 215 pt rectangle
    with a dozen unrelated runs crossing it, and 19 of the 149 have a rectangle that does not even
    *contain* the ink — `C0057`'s ends span x 429.8–598.9 while the run goes out to x = 798.

    So the polyline is published and the rectangle is taken over every vertex. A ring round the
    wrong ink on the one screen whose whole job is *read this exact piece of ink* is the only
    defect that screen can have.
    """
    run = items(reviewer)["C0030"]
    assert run["points"] == [[300, 46], [420, 46], [420, 90]]
    assert run["rect"] == [300, 46, 420, 90]
    # A label is a box and has no shape of its own to publish.
    assert "points" not in items(reviewer)["T0012"]


def test_correcting_one_label_names_every_run_that_reads_its_net_name(reviewer) -> None:
    """What makes a label correction worth more than it looks, and what the `Net labels` filter is
    for: `C0030` reads its net name from `T0012`, so `LI-A` → `L1-A` is one edit that fixes the
    run as well. On the real sheet that is 70 labels, 30 of them flagged at confidence 0.4."""
    found = items(reviewer)
    assert found["T0012"]["net_name"] is True
    assert found["T0012"]["conductors"] == ["C0030"]
    # The spec label beside the same run is not a net name, and is not on that filter.
    assert found["T0001"]["net_name"] is False
    assert "conductors" not in found["T0001"]


# -- writing --------------------------------------------------------------------------------


def test_a_correction_is_written_with_what_it_replaced_and_read_back(
    reviewer, drawing_dir: Path
) -> None:
    """`was` is kept forever. `geometry.json` is regenerated by a re-extraction and would take the
    original reading with it, so the only durable record of what the machine actually saw is the
    one a correction carries."""
    body = put(reviewer, DOCUMENT).json()
    assert body["saved"] is True
    assert body["report"]["corrections"] == 1
    assert body["report"]["problems"] == []

    stored = json.loads((drawing_dir / "label_corrections.json").read_text("utf-8"))
    assert stored == DOCUMENT
    item = items(reviewer)["T0012"]
    assert item["text"] == "L1-A"
    assert item["read"] == "LI-A"
    assert item["correction"] == {
        "text": "L1-A", "was": "LI-A", "by": "js", "at": "2026-08-25T10:00:00Z"
    }


def test_the_file_on_disk_is_the_document_the_screen_sent(reviewer, drawing_dir: Path) -> None:
    """Verbatim, indented, newline-terminated — an authored file that belongs in git, where a
    one-reading change should be a one-line diff and a `note` this server does not model survives
    the round trip."""
    put(reviewer, {**DOCUMENT, "labels": {"T0104": {"text": None, "was": "YY",
                                                    "note": "not a net label"}}})
    text = (drawing_dir / "label_corrections.json").read_text("utf-8")
    assert text.endswith("}\n")
    assert "\n  " in text
    assert json.loads(text)["labels"]["T0104"]["note"] == "not a net label"


def test_not_a_label_is_null_and_an_empty_string_is_refused_by_name(reviewer) -> None:
    """The one ambiguity in this format, refused rather than guessed at. `null` says *this item is
    not a label*; `""` would read as *I looked and there is no text here*, which is a claim about
    the ink. Letting one string stand for both would make the file unable to say the first — and
    seven of this sheet's 34 printed net names need exactly that."""
    body = put(reviewer, {**DOCUMENT, "labels": {"T0104": {"text": None, "was": "YY"}}}).json()
    assert body["report"]["rejections"] == 1
    item = items(reviewer)["T0104"]
    assert item["text"] is None
    assert item["read"] == "YY"
    # Present, and null: dropping the key would turn *not a label* into an entry saying nothing.
    assert item["correction"] == {"text": None, "was": "YY"}

    refused = put(reviewer, {**DOCUMENT, "labels": {"T0104": {"text": "  ", "was": "YY"}}}).json()
    assert refused["saved"] is True
    assert refused["report"]["corrections"] == 0
    assert any("use null to say this is not a label" in p for p in refused["report"]["problems"])


def test_correcting_a_label_changes_what_the_run_reads(reviewer) -> None:
    """The whole reason this phase comes before Phase E.

    The matcher compares a **run's** printed net name against a wire's net id. Correcting the label
    and leaving the run reading `LI-A` would fix a row on a screen and unlock nothing at all — nine
    of the nine nets that fail to match a printed conductor group today are exactly this.
    """
    assert items(reviewer)["C0030"]["text"] == "LI-A"
    put(reviewer, DOCUMENT)
    run = items(reviewer)["C0030"]
    assert run["text"] == "L1-A"
    # Its own reading is untouched, and the run says where the new one came from — a claim it is
    # carrying rather than one anybody made about it.
    assert run["read"] == "LI-A"
    assert run["via"] == "T0012"
    assert "correction" not in run


def test_naming_a_run_directly_beats_the_label_beside_it(reviewer) -> None:
    """The more specific claim wins, and it is the only one available for the 79 runs with no label
    bound at all."""
    put(reviewer, {**DOCUMENT, "labels": {**DOCUMENT["labels"],
                                          "C0030": {"text": "130", "was": "LI-A"}}})
    run = items(reviewer)["C0030"]
    assert run["text"] == "130"
    assert "via" not in run


def test_a_correction_that_agrees_with_the_machine_is_kept(reviewer) -> None:
    """Deliberately, and it is the one place this project stores a value matching the computed one.
    Invariant 10 forbids that for an end label's side — but a side would have been produced anyway
    with nobody looking, and nothing produces *a person checked this* but a person. A confirmed
    low-confidence read is new information and the queue's job is to get smaller."""
    body = put(reviewer, {**DOCUMENT, "labels": {"T0104": {"text": "YY", "was": "YY"}}}).json()
    assert body["report"] == {
        "file": True, "corrections": 1, "rejections": 0, "confirmations": 1, "problems": []
    }


def test_a_correction_keyed_on_nothing_on_this_sheet_is_refused_by_name(reviewer) -> None:
    """The `H14` shape: the one mistake a hand edit can make here whose symptom is *nothing at
    all*. It is never applied, never drawn and never mentioned, so it is named."""
    body = put(reviewer, {**DOCUMENT, "labels": {"T9999": {"text": "L1-A"}}}).json()
    assert body["report"]["corrections"] == 0
    assert any("T9999" in p and "geometry.json" in p for p in body["report"]["problems"])


def test_one_malformed_reading_costs_that_reading_and_nothing_else(reviewer) -> None:
    """The rule that decides how validation is split, applied to a third file: a typo must cost
    that entry, not the afternoon — and what was refused has to come back in words."""
    body = put(
        reviewer,
        {
            **DOCUMENT,
            "labels": {
                "T0012": {"text": "L1-A", "was": "LI-A"},
                "T0104": {"was": "YY"},
                "T0200": {"text": 130},
            },
        },
    ).json()
    assert body["saved"] is True
    assert body["report"]["corrections"] == 1
    assert any("T0104" in p and "says nothing" in p for p in body["report"]["problems"])
    assert any(
        "T0200" in p and "neither a string nor null" in p for p in body["report"]["problems"]
    )
    assert items(reviewer)["T0012"]["text"] == "L1-A"


def test_a_correction_is_visible_to_the_very_next_read(reviewer) -> None:
    """`H2` in a second file. `load_corrections` is `lru_cache`d, so without the `cache_clear()`
    inside the writer this passes its own 200 and then hands the old reading back."""
    assert items(reviewer)["T0012"]["text"] == "LI-A"
    put(reviewer, DOCUMENT)
    assert items(reviewer)["T0012"]["text"] == "L1-A"


def test_deleting_the_entry_is_how_a_correction_is_taken_back(reviewer) -> None:
    """Invariant 10's shape, and the reason *Reset* deletes rather than writing the machine's
    reading back in: a file that cannot tell *nobody has looked at this* from *somebody decided the
    machine was right* has stopped being a record of who said what."""
    put(reviewer, DOCUMENT)
    body = put(reviewer, {**DOCUMENT, "labels": {}}).json()
    assert body["report"]["corrections"] == 0
    item = items(reviewer)["T0012"]
    assert item["text"] == "LI-A"
    assert "correction" not in item


def test_a_payload_for_another_drawing_is_refused_whole(reviewer, drawing_dir: Path) -> None:
    response = put(reviewer, {**DOCUMENT, "drawing_number": "SOMETHING-ELSE"})
    assert response.status_code == 409
    assert "SOMETHING-ELSE" in response.json()["detail"]
    assert not (drawing_dir / "label_corrections.json").exists()


def test_an_unknown_schema_is_refused_rather_than_written(reviewer, drawing_dir: Path) -> None:
    assert put(reviewer, {**DOCUMENT, "schema": 2}).status_code == 409
    assert not (drawing_dir / "label_corrections.json").exists()


def test_a_drawing_nobody_has_corrected_gets_an_empty_document_not_a_404(reviewer) -> None:
    body = get(reviewer).json()
    assert body["present"] is False
    assert body["document"] == {
        "drawing_number": "PS20115MLM4-2", "schema": 1, "labels": {}
    }
    assert body["report"]["corrections"] == 0


def test_an_extraction_with_no_vector_pass_says_so_rather_than_showing_nothing(
    settings: Settings, drawing_dir: Path
) -> None:
    """A bare extraction has no `geometry.json`. That is not a failure — it is a drawing whose ink
    was never lifted — so the screen gets an empty queue and a report that parses, exactly as a
    drawing with no `locations.json` gets `skeleton()`."""
    with TestClient(create_app(editing(settings))) as client:
        body = get(client).json()
        assert body["items"] == []
        assert body["counts"]["labels"] == 0
        assert body["report"]["problems"] == []


# -- the netlist does not move --------------------------------------------------------------


def test_a_correction_does_not_change_the_designator_index(reviewer) -> None:
    """Phase F corrects readings of the ink, not the netlist. `/api/designators` is built from
    `circuit_logic.json` alone, and a corrected label must not move a single point in it — every
    coordinate there came from `locations.json` and a person."""
    before = get_designators(reviewer)
    put(reviewer, DOCUMENT)
    assert get_designators(reviewer) == before


def get_designators(client: TestClient) -> str:
    return json.dumps(client.get("/api/designators").json(), sort_keys=True)


@pytest.mark.skipif(
    not (EXTRACTION / "author_circuit_logic.py").is_file(),
    reason="PS20115MLM4-2 is not in this tree",
)
def test_the_generator_output_is_byte_identical_with_and_without_a_corrections_file(
    tmp_path: Path,
) -> None:
    """The assertion the whole phase rests on, and it is worth having as bytes rather than as an
    argument: `author_circuit_logic.py` does not read this file and must not start.

    The netlist is already right — §2 of the plan measured it: 26 nets, 131 terminals, no twins,
    and `L1-A` against `L1-A1` is two real nets with a breaker between them rather than one misread.
    What is wrong is a layer below, in strings that never became entities. A later session wiring
    the corrections into the generator would quietly move the index that every answer is checked
    against, and nothing else in the project would notice.
    """
    script = EXTRACTION / "author_circuit_logic.py"

    def run(work: Path, corrections: dict[str, Any] | None) -> bytes:
        work.mkdir()
        (work / script.name).write_bytes(script.read_bytes())
        if corrections is not None:
            (work / "label_corrections.json").write_text(
                json.dumps(corrections), encoding="utf-8"
            )
        subprocess.run(  # noqa: S603
            [sys.executable, str(work / script.name)],
            capture_output=True, text=True, timeout=120, check=True,
        )
        return (work / "circuit_logic.json").read_bytes()

    plain = run(tmp_path / "plain", None)
    corrected = run(
        tmp_path / "corrected",
        {
            "drawing_number": "PS20115MLM4-2",
            "schema": 1,
            "labels": {
                "T0012": {"text": "L1-A", "was": "LI-A"},
                "T0104": {"text": None, "was": "YY"},
            },
        },
    )
    # Not two empty strings agreeing with each other: the real artifact is ~217 KB, and a
    # byte-identity test whose subject failed to be written would pass without saying anything.
    assert len(plain) > 100_000
    assert plain == corrected
