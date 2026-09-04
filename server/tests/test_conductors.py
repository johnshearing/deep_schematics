"""`GET /api/conductors` — the 149 runs of ink, reduced to what tracing a wire needs.

Three properties are why this file exists apart from `test_paths.py`, and the first two are the
same fact from both sides.

1. **This route is gated and `/api/paths` is not.** They look like a pair and they are opposites.
   A path is *authored display geometry* out of `locations.json` and a reader is exactly who wants
   it (`H20`). This is the *raw ink* — 149 candidate polylines out of `geometry.json` — and it is
   no use at all to somebody who cannot accept one of them into an authored file.
2. **`geometry.json` still never leaves the process.** The loader narrows it and the route narrows
   it again, key by key, and the key set is pinned here so a later `**spread` cannot widen it
   (`H17`).
3. **Every Phase F correction is applied.** The ranking compares a run's printed net name against
   a wire's net id, 30 of this sheet's 70 names were read at confidence 0.4 and nine were wrong,
   and correcting them was the entire point of doing Phase F before Phase E. A route that
   published the extraction's raw binding would have thrown that away silently.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.ink import load_ink
from app.label_corrections import load_corrections
from app.main import create_app

PASSWORD = "let-me-draw"

#: A miniature `geometry.json` carrying every case the ranking has to get right: a run with a
#: printed net name and a spec, a run whose name is a **misread** that a correction fixes, a
#: bending run whose polyline is not the box round its ends, and a short unlabelled stroke of the
#: kind 46 of the real 149 are.
INK: dict[str, Any] = {
    "source_file": "PS20115MLM4-2.pdf",
    "pages": [
        {
            "page": 1,
            "page_size": {"width": 1224.0, "height": 792.0},
            "labels": [
                {"id": "T0012", "text": "LI-A", "raw_ocr": "LI-A", "confidence": 0.4,
                 "kind": "text", "ocr_status": "ok", "bbox": [415, 44, 425, 48]},
                {"id": "T0330", "text": "110", "raw_ocr": "110", "confidence": 0.9,
                 "kind": "net_number", "ocr_status": "ok", "bbox": [300, 40, 320, 50]},
            ],
            "conductors": [
                # The straightforward case: a printed name, a spec, and both ends on a dot.
                {"id": "C0098", "points": [[300, 46], [420, 46]],
                 "endpoints": [[300, 46], [420, 46]], "net_label": "110",
                 "spec_label": "BLUE 18AWG", "color": "BLUE", "gauge": "18AWG",
                 "label_ids": ["T0330"], "length": 120.0, "segment_count": 1,
                 "node_ids": [0, 1],
                 "endpoint_bindings": [
                     {"point": [300, 46], "symbol_id": "S0001",
                      "symbol_kind": "terminal_point", "symbol_distance": 1.7,
                      "label_id": "T0330", "label_text": "110", "label_distance": 6.0},
                     {"point": [420, 46], "symbol_id": None, "symbol_kind": None,
                      "symbol_distance": None, "label_id": None, "label_text": None,
                      "label_distance": None},
                 ]},
                # The misread: `LI-A` for `L1-A`, capital I for the digit 1. Its name is read
                # *from* `T0012`, so correcting the label has to reach this run.
                {"id": "C0030", "points": [[500, 100], [560, 100], [560, 180]],
                 "endpoints": [[500, 100], [560, 180]], "net_label": "LI-A",
                 "spec_label": "RED 16AWG", "color": "RED", "gauge": "16AWG",
                 "label_ids": ["T0012"], "length": 140.0, "segment_count": 2,
                 "node_ids": [2, 3],
                 "endpoint_bindings": [
                     {"point": [500, 100], "symbol_id": "S0002",
                      "symbol_kind": "terminal_point", "symbol_distance": 0.4},
                     {"point": [560, 180], "symbol_id": "S0003",
                      "symbol_kind": "device_circle", "symbol_distance": 2.0},
                 ]},
                # 10.8 pt and diagonal: a stroke of a contact symbol the tracer collected, with
                # no name, no spec and a loose end. `C0107` on the real sheet.
                {"id": "C0107", "points": [[717.9, 525.9], [711.4, 534.5]],
                 "endpoints": [[717.9, 525.9], [711.4, 534.5]], "net_label": None,
                 "spec_label": None, "color": None, "gauge": None, "label_ids": [],
                 "length": 10.8, "segment_count": 1, "node_ids": [4, 5],
                 "endpoint_bindings": [
                     {"point": [717.9, 525.9], "symbol_id": None, "symbol_kind": None},
                     {"point": [711.4, 534.5], "symbol_id": None, "symbol_kind": None},
                 ]},
            ],
            "symbols": [{"id": "S0001", "kind": "terminal_point"}],
            "boxes": [{"id": "B0001"}],
            "junctions": [],
            "nets": [],
            "rects": [],
            "review_queue": [
                {"kind": "low_confidence_label", "id": "T0012",
                 "bbox": [415, 44, 425, 48], "raw_ocr": "LI-A", "text": "LI-A",
                 "confidence": 0.4},
                {"kind": "incomplete_conductor", "id": "C0107",
                 "endpoints": [[717.9, 525.9], [711.4, 534.5]],
                 "missing": ["net_label", "spec_label", "unbound_endpoints"]},
            ],
            "stats": {"text_labels": 2},
            "params": {"glyph_gap": 1.5},
        }
    ],
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
    (drawing_dir / "geometry.json").write_text(json.dumps(INK), encoding="utf-8")
    return drawing_dir


def editing(settings: Settings, **overrides: Any) -> Settings:
    return settings.model_copy(
        update={"allow_edits": True, "editor_password": PASSWORD, **overrides}
    )


@pytest.fixture
def editor(settings: Settings, inked: Path):
    with TestClient(create_app(editing(settings))) as c:
        yield c


@pytest.fixture
def reader(settings: Settings, inked: Path):
    with TestClient(create_app(settings)) as c:
        yield c


def get(client: TestClient, password: str | None = PASSWORD):
    headers = {"X-Editor-Password": password} if password is not None else {}
    return client.get("/api/conductors", headers=headers)


def runs(client: TestClient) -> dict[str, dict[str, Any]]:
    return {c["id"]: c for c in get(client).json()["conductors"]}


def correct(drawing_dir: Path, labels: dict[str, Any]) -> None:
    (drawing_dir / "label_corrections.json").write_text(
        json.dumps({"drawing_number": "PS20115MLM4-2", "schema": 1, "labels": labels}),
        encoding="utf-8",
    )
    load_corrections.cache_clear()


# -- the gate -------------------------------------------------------------------------------


def test_a_reader_never_downloads_the_ink(reader) -> None:
    """The other half of `H20`, stated from this side.

    `/api/paths` answers for a reader with no password, because a highlight is display geometry
    and *which of these lines is the one I care about* is a reader's question. This route hands
    back 149 candidate polylines out of `geometry.json` — the input to a decision only an editor
    can take — so it is registered inside `if settings.allow_edits` and there is no handler here
    to find a bug in. **The two must not be merged for convenience.**
    """
    assert get(reader).status_code == 404
    assert reader.get("/api/paths").status_code == 200


def test_tracing_without_the_password_is_refused(editor) -> None:
    assert get(editor, password=None).status_code == 401
    assert get(editor, password="wrong").status_code == 401
    assert get(editor).status_code == 200


# -- the boundary round `geometry.json` -----------------------------------------------------

#: Every key one published run may carry. Pinned rather than described, because the failure mode
#: is a `**spread` that quietly sends the extraction's `params` — or its `node_ids`, which name
#: nothing anybody can use — to a browser, and nothing on screen would look any different.
RUN_KEYS = {
    "id", "points", "ends", "net_label", "was", "spec_label", "color", "gauge", "length",
}


def test_a_conductor_carries_only_what_tracing_needs(editor) -> None:
    body = get(editor).json()
    for run in body["conductors"]:
        assert set(run) <= RUN_KEYS, f"{run['id']} carries {set(run) - RUN_KEYS}"
    text = json.dumps(body)
    for dropped in ("symbols", "boxes", "junctions", "rects", "stats", "params", "node_ids",
                    "label_ids", "label_text", "endpoint_bindings"):
        assert f'"{dropped}"' not in text


def test_geometry_json_is_parsed_once_however_many_times_the_panel_asks(editor) -> None:
    """The same `lru_cache` the review screen uses, and the same reason: a 608 KB parse behind a
    screen somebody is about to sit in front of for 71 wires."""
    before = load_ink.cache_info()
    for _ in range(4):
        assert get(editor).status_code == 200
    after = load_ink.cache_info()
    assert after.misses - before.misses == 1
    assert after.hits - before.hits >= 3


# -- what a run says ------------------------------------------------------------------------


def test_a_run_publishes_its_shape_and_not_the_box_round_its_ends(editor) -> None:
    """**The field this whole route exists for.** `points` is what gets accepted into
    `path.runs`, so a run that published only its endpoints would let a wire be highlighted along
    a straight chord between two corners — which is precisely the invented route §3 forbids.

    `C0030` here bends, exactly as 50 of the real 149 do.
    """
    run = runs(editor)["C0030"]
    assert run["points"] == [[500, 100], [560, 100], [560, 180]]
    # And the corner is the middle vertex, not something a reader has to infer from two ends.
    assert len(run["points"]) == 3


def test_each_end_names_the_terminal_point_it_lands_on_and_how_far_away(editor) -> None:
    """The third signal in the ranking and the strongest one on this drawing: every measured
    pairing in `07_drawing_facts.md` is within 4 pt at both ends, against conductor rows 16 pt
    apart.

    A `terminal_point` symbol is one of the sheet's 88 little circles where ink meets a pin — it
    is **not** one of the netlist's terminals, and mistaking the two was the hardest-won lesson of
    the extraction. So an end that lands on a `device_circle`, or on nothing, carries no symbol at
    all rather than a symbol the ranking would read as a terminal.
    """
    ends = runs(editor)["C0098"]["ends"]
    assert ends[0] == {"point": [300, 46], "symbol": "S0001", "distance": 1.7}
    assert ends[1] == {"point": [420, 46]}
    # A device circle is a binding and is not a terminal point.
    assert runs(editor)["C0030"]["ends"][1] == {"point": [560, 180]}


def test_the_endpoint_is_published_beside_its_binding_rather_than_inferred(editor) -> None:
    """They agree for all 149 runs on this sheet, and relying on that would be relying on one
    drawing. The binding records where the *extraction* thought the run ended; a client should not
    have to assume that is the first or last vertex of the polyline."""
    for run in get(editor).json()["conductors"]:
        assert all("point" in end for end in run["ends"])


def test_the_spec_is_published_whole_and_in_halves(editor) -> None:
    """A wire's `spec` is `BLUE 18AWG`, so the whole string is the strong test. The halves are
    there because a run whose colour matches while its gauge does not is a real candidate that
    belongs **below** an exact match rather than out of the list — and a run with neither is
    almost always one of the 46 symbol strokes."""
    run = runs(editor)["C0098"]
    assert (run["spec_label"], run["color"], run["gauge"]) == ("BLUE 18AWG", "BLUE", "18AWG")
    assert run["length"] == 120.0
    stroke = runs(editor)["C0107"]
    for absent in ("spec_label", "color", "gauge", "net_label", "was"):
        assert absent not in stroke
    # 10.8 pt of diagonal on an orthogonal sheet. Published, because it is real ink and the
    # ranking is what decides it is not wiring — dropping it here would be a judgement made in
    # the wrong place.
    assert stroke["length"] == 10.8


# -- the corrections, which are the reason Phase F came first -------------------------------


def test_a_run_reads_the_name_a_person_corrected_on_the_label_beside_it(
    editor, drawing_dir: Path
) -> None:
    """`LI-A` → `L1-A` on `T0012` and the **run** reads `L1-A` too.

    This is the join Session 4 built and the reason it built it: the ranking compares the *run's*
    printed name against a wire's net id, so a route publishing the extraction's raw binding
    would have left this run reading `LI-A` forever while the screen beside it said `L1-A`. Nine
    of this sheet's nets were unreachable for exactly that reason.
    """
    correct(drawing_dir, {"T0012": {"text": "L1-A", "was": "LI-A"}})
    run = runs(editor)["C0030"]
    assert run["net_label"] == "L1-A"
    # `was` is the extraction's own binding, which is the thing a re-extraction destroys, and it
    # is what lets the panel say *corrected* rather than *printed*.
    assert run["was"] == "LI-A"


def test_a_correction_on_the_run_itself_wins_over_the_label(editor, drawing_dir: Path) -> None:
    """Naming a run directly is the more specific claim — and it is the only thing available for
    the 79 runs with no label bound at all, which is more than the 30 misreads."""
    correct(
        drawing_dir,
        {
            "T0012": {"text": "L1-A", "was": "LI-A"},
            "C0030": {"text": "130", "was": "LI-A"},
            "C0107": {"text": "24E-1", "was": None},
        },
    )
    found = runs(editor)
    assert found["C0030"]["net_label"] == "130"
    # A run that never had a name bound gains one, and there is no `was` to record: the machine
    # read nothing there.
    assert found["C0107"]["net_label"] == "24E-1"
    assert "was" not in found["C0107"]


def test_a_run_somebody_called_not_a_label_has_no_name_to_match_against(
    editor, drawing_dir: Path
) -> None:
    """`corrected_text()` drops a `null`, deliberately: *a matcher must not compare against a
    string somebody said was not a name.* On a **run** row that button means *no net name is
    printed on this run*, which is a claim about the paper — and it cost 34 net names on
    2026-09-01 when it was used as a bookmark instead."""
    correct(drawing_dir, {"C0098": {"text": None, "was": "110"}})
    run = runs(editor)["C0098"]
    assert "net_label" not in run
    # The extraction's binding is still recorded, so the panel can say what was given up.
    assert run["was"] == "110"


def test_the_counts_say_how_many_runs_the_ranking_can_use(editor, drawing_dir: Path) -> None:
    """The one number that decides how much of the work is picking rather than drawing. On the
    real sheet it is 70 of 149 after the review run — the same count the extraction started with
    and a different seventy."""
    assert get(editor).json()["counts"] == {"conductors": 3, "named": 2}
    correct(drawing_dir, {"C0107": {"text": "24E-1", "was": None}})
    assert get(editor).json()["counts"] == {"conductors": 3, "named": 3}


def test_a_drawing_with_no_ink_answers_empty_rather_than_failing(settings: Settings) -> None:
    """A bare extraction with no vector pass is not broken, and the panel has to be able to say
    *there is no ink here to offer you* instead of showing a spinner. Same rule as `Ink.present`."""
    with TestClient(create_app(editing(settings))) as client:
        body = get(client).json()
    assert body["conductors"] == []
    assert body["counts"] == {"conductors": 0, "named": 0}
