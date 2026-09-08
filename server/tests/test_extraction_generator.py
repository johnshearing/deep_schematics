"""`author_circuit_logic.py` folding in the other two authored files.

This is the extraction's own script rather than the server's code, and it is tested here because
the seam is shared: the script writes the positions into `circuit_logic.json` and
`app/locations.py` reads the same `locations.json` at request time. If the two ever disagree about
precedence, the viewer and the artifact the model reads would place the same terminal in different
spots — and nothing else in the project would notice.

**Since 2026-09-07 there is a third input and it behaves the opposite way.** `wiring.json` says
which two terminals each wire joins, and where a broken `locations.json` is warned about and
skipped, a broken or missing `wiring.json` **stops the run**. The asymmetry is the point: a
missing point makes a worse drawing, and a missing endpoint makes a different netlist. Half of
the tests below are that asymmetry.

The first test is the load-bearing one: **the committed `circuit_logic.json` is exactly what the
generator writes from the two authored inputs.** That is what keeps generated files fully
generated. It catches a hand-edit of the artifact, a fold-in that drifts, and — the case that
motivated it — someone typing a coordinate into `circuit_logic.json` instead of placing it.

It used to be phrased as "with no `locations.json`, the output is byte-identical", which was the
same property while no drawing had a locations file. The moment one does, that phrasing asserts
the artifact *ignores* the second authored input, which is the opposite of the intent. The
inertness of the loader is now its own test below.

Skipped rather than failed when the drawing is not this repo's, so the suite stays honest when it
is pointed at a different extraction.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

EXTRACTION = (
    Path(__file__).resolve().parents[2] / "schematic_extraction/PS20115MLM4-2/extracted_docs"
)
SCRIPT = EXTRACTION / "author_circuit_logic.py"

pytestmark = pytest.mark.skipif(not SCRIPT.is_file(), reason="PS20115MLM4-2 is not in this tree")


WIRING = EXTRACTION / "wiring.json"

#: What the extraction's own `wiring.json` says today. Copied into every scratch run that does not
#: name one of its own, because the generator refuses to write a netlist without it — the tests
#: about *locations* have no business also being tests about a missing wiring file.
REAL_WIRING = json.loads(WIRING.read_text("utf-8")) if WIRING.is_file() else None


def run(
    work: Path,
    locations: dict | str | None = None,
    wiring: dict | str | None = REAL_WIRING,
) -> tuple[dict, str]:
    """Run the generator in a scratch directory. It writes beside itself, which is what makes
    this possible: copy the script, get its output and nothing else.

    `wiring` defaults to the real file and takes `None` to mean *do not write one at all*, which
    is a thing worth being able to say here and nowhere else.
    """
    copy = work / SCRIPT.name
    copy.write_bytes(SCRIPT.read_bytes())
    if locations is not None:
        text = locations if isinstance(locations, str) else json.dumps(locations)
        (work / "locations.json").write_text(text, encoding="utf-8")
    if wiring is not None:
        text = wiring if isinstance(wiring, str) else json.dumps(wiring)
        (work / "wiring.json").write_text(text, encoding="utf-8")

    done = subprocess.run(  # noqa: S603
        [sys.executable, str(copy)], capture_output=True, text=True, timeout=120, check=True
    )
    return json.loads((work / "circuit_logic.json").read_text("utf-8")), done.stdout


def refuse(work: Path, wiring: dict | str | None) -> str:
    """Run the generator expecting it to write nothing, and hand back what it said."""
    copy = work / SCRIPT.name
    copy.write_bytes(SCRIPT.read_bytes())
    if wiring is not None:
        text = wiring if isinstance(wiring, str) else json.dumps(wiring)
        (work / "wiring.json").write_text(text, encoding="utf-8")

    done = subprocess.run(  # noqa: S603
        [sys.executable, str(copy)], capture_output=True, text=True, timeout=120, check=False
    )
    assert done.returncode != 0, done.stdout
    assert not (work / "circuit_logic.json").exists(), "it wrote a netlist anyway"
    return done.stderr


def wired(**records: dict) -> dict:
    """A `wiring.json` payload: the real one with a few records replaced."""
    return {**REAL_WIRING, "wires": {**REAL_WIRING["wires"], **records}}


def find(items: list[dict], identifier: str) -> dict:
    return next(item for item in items if item["id"] == identifier)


def test_the_committed_artifact_is_exactly_what_the_generator_writes(tmp_path: Path) -> None:
    """Generated files stay fully generated.

    Run against **all three** authored inputs — the script, whatever `locations.json` the
    extraction currently has, and its `wiring.json` — and compare to the committed
    `circuit_logic.json`. A hand-edit of the artifact fails here, and so does an authored file that
    has been changed but never regenerated, which is the staleness the editor puts a banner up
    about.

    **The failure names which file is ahead**, and that is `K12` narrowed. Since 2026-09-07 two
    inputs can make this red, and *"re-run the generator"* is still one command either way — but a
    person who has spent an afternoon placing points and meets a red test about a wiring change
    they made yesterday has been told the wrong thing about their own work. The comparison is one
    `st_mtime` each; see `_whats_ahead`.
    """
    real = EXTRACTION / "locations.json"
    doc, _ = run(tmp_path, json.loads(real.read_text("utf-8")) if real.is_file() else None)
    assert doc == json.loads((EXTRACTION / "circuit_logic.json").read_text("utf-8")), _whats_ahead()


def _whats_ahead() -> str:
    """Which authored file is newer than the artifact, in words, for the assertion above.

    Best-effort and deliberately so: an mtime is not provenance, a `git checkout` can reorder them,
    and this is a hint attached to a failure rather than a fact anything depends on. It says what it
    knows and admits when it knows nothing, which is better than the bare dict diff this replaced —
    and *much* better than naming the wrong file confidently.
    """
    artifact = EXTRACTION / "circuit_logic.json"
    if not artifact.is_file():
        return "circuit_logic.json is not here at all. Run `python author_circuit_logic.py`."
    generated = artifact.stat().st_mtime
    ahead = [
        name
        for name in ("locations.json", "wiring.json")
        if (EXTRACTION / name).is_file() and (EXTRACTION / name).stat().st_mtime > generated
    ]
    where = (
        "cd schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py"
    )
    if not ahead:
        return (
            "circuit_logic.json is newer than both authored inputs, so this is **not** the "
            "ordinary stale case: something hand-edited the artifact, or the generator's own "
            f"output moved. Re-run it and read the diff — {where}"
        )
    names = " and ".join(ahead)
    tail = (
        " A wiring change also needs `build_kg.py` afterwards, because an endpoint is connectivity "
        "rather than geometry."
        if "wiring.json" in ahead
        else ""
    )
    return f"{names} is ahead of circuit_logic.json. Re-run the generator — {where}{tail}"


def test_the_loader_is_inert_when_there_is_no_locations_file(tmp_path: Path) -> None:
    """A fresh extraction has no locations file, and reading for one must not change the netlist
    it would have written anyway — no `sites`, no provenance on a location, nothing folded."""
    doc, out = run(tmp_path)
    assert "from locations.json: 0 sites, 0 terminals, 0 labels" in out
    assert not any("sites" in c for c in doc["components"])
    assert not any("source" in (c.get("location") or {}) for c in doc["components"])
    assert not any("location" in t for t in doc["terminals"])
    assert not any("label_location" in w for w in doc["wires"])
    # The vision pass's own estimate, untouched: this is what `seed` means.
    assert find(doc["components"], "CR-BP")["location"] == {"x": 861, "y": 679,
                                                            "zone": "bottom-right"}


def test_placed_sites_reach_the_components_and_their_terminals(tmp_path: Path) -> None:
    """CR-BP is the case that motivated sites: a coil and two contacts, drawn in three places, so
    `11` and `21` must land in different circuits even though both are function `common`."""
    doc, out = run(
        tmp_path,
        {
            "drawing_number": "PS20115MLM4-2",
            "schema": 1,
            "page_size_pt": [1224.0, 792.0],
            "components": {
                "CR-BP": {
                    "sites": [
                        {"id": "coil", "point": [861, 679], "terminals": ["A1", "A2"],
                         "source": "human", "label": {"dir": "e"}},
                        {"id": "nc", "point": [714, 520], "terminals": ["11", "12"],
                         "source": "human"},
                        {"id": "no", "point": [592, 223], "terminals": ["21", "24"],
                         "source": "human"},
                    ]
                }
            },
            "terminals": {"CR-BP:A2": {"point": [870, 708], "source": "human"}},
        },
    )

    relay = find(doc["components"], "CR-BP")
    assert [s["id"] for s in relay["sites"]] == ["coil", "nc", "no"]
    assert relay["sites"][0]["label"] == {"dir": "e"}
    # The first site is the component's one point, and it says who put it there. `zone` survives:
    # the fold updates the location rather than replacing it.
    assert relay["location"] == {"x": 861.0, "y": 679.0, "zone": "bottom-right",
                                 "source": "human", "site": "coil"}

    # Its own point beats the site's — the same precedence the server applies.
    assert find(doc["terminals"], "CR-BP:A2")["location"] == {"x": 870.0, "y": 708.0,
                                                              "source": "human"}
    # Claimed by a site, so it takes the site's point and records which one.
    assert find(doc["terminals"], "CR-BP:11")["location"] == {"x": 714.0, "y": 520.0,
                                                              "source": "human", "site": "nc"}
    assert find(doc["terminals"], "CR-BP:24")["location"]["x"] == 592.0
    # Nobody placed this one, and it is left alone rather than being given CR-ON's point:
    # "somewhere on CR-ON" and "on CR-ON:A1" are different claims.
    assert "location" not in find(doc["terminals"], "CR-ON:A1")
    assert "sites" not in find(doc["components"], "CR-ON")
    assert "from locations.json: 3 sites, 6 terminals, 0 labels" in out


def test_a_wire_gets_where_its_name_is_written_and_never_a_route_from_its_endpoints(
    tmp_path: Path,
) -> None:
    """The distinction the `wires` section exists to hold. A wire's path is its two endpoint
    terminals; a line drawn between them because no conductor joined them would be an invented
    route, and the netlist's authority rests on never having invented one. So the key is
    `label_location`, and there is nowhere in the format to say where a wire *goes*."""
    doc, out = run(
        tmp_path,
        {
            "drawing_number": "PS20115MLM4-2",
            "schema": 1,
            "components": {},
            "terminals": {},
            "wires": {"W048": {"label_point": [742, 511], "source": "human",
                               "label": {"dir": "w"}}},
            "nets": {"110": {"label_point": [520, 300], "source": "human"}},
        },
    )

    wire = find(doc["wires"], "W048")
    assert wire["label_location"] == {"x": 742.0, "y": 511.0, "source": "human",
                                     "label": {"dir": "w"}}
    # Its endpoints are untouched, and there is no `location` on it at all.
    assert "location" not in wire
    assert (wire["from_terminal"], wire["to_terminal"]) == ("CR-BP:A2", "BYPASS-CB:2")
    assert find(doc["nets"], "110")["label_location"]["x"] == 520.0
    assert "from locations.json: 0 sites, 0 terminals, 2 labels" in out


def test_a_broken_locations_file_still_writes_the_netlist(tmp_path: Path) -> None:
    """The netlist does not depend on the geometry, so a typo in one must not cost the other."""
    doc, out = run(tmp_path, "{ not json")
    assert len(doc["components"]) == 47
    assert "WARNING: locations.json ignored" in out
    assert "from locations.json: 0 sites, 0 terminals" in out


def test_a_path_does_not_reach_the_netlist(tmp_path: Path) -> None:
    """**The proof of Phase D, in bytes.** Saving a path must not make `circuit_logic.json` stale.

    A polyline says nothing about *what connects to what*: `from_terminal` and `to_terminal`
    already answer that, and 149 conductors half of them multi-segment would inflate the one file
    the model reads end to end. So paths are display geometry, they live only in `locations.json`,
    and the generator does not read them — which is why authoring one costs no regeneration, no
    banner, and no red artifact test. This is invariant 6's treatment of `label_corrections.json`
    applied to the fourth thing that could quietly move the artifact every answer is checked
    against.
    """
    base = {
        "drawing_number": "PS20115MLM4-2",
        "schema": 2,
        "components": {},
        "terminals": {},
        "wires": {"W048": {"label_point": [742, 511], "source": "human"}},
    }
    traced = {
        **base,
        "wires": {
            "W048": {
                **base["wires"]["W048"],
                "path": {
                    "runs": [[[379.8, 663.7], [301.8, 663.7]]],
                    "conductors": ["C0080"],
                    "geometry": "extracted",
                    "attribution": "human",
                },
                "no_path_on_this_sheet": False,
            }
        },
    }

    (tmp_path / "plain").mkdir()
    (tmp_path / "with-path").mkdir()
    plain, _ = run(tmp_path / "plain", base)
    with_path, out = run(tmp_path / "with-path", traced)
    assert with_path == plain
    # And it is not merely ignored by accident: the fold still saw the record and applied the one
    # thing in it that belongs in the netlist.
    assert find(with_path["wires"], "W048")["label_location"]["x"] == 742.0
    assert "from locations.json: 0 sites, 0 terminals, 1 labels" in out


# -- wiring.json, the third authored input ---------------------------------------------------
#
# The file exists because the `W` table's endpoints were **allocated** rather than read: for the
# 40 wires landing on a multi-point terminal block the indexing pass incremented a counter, and
# 11 of the 71 are on the wrong screw. See `_claude_notes/authoring_the_wires.md` §2 and §3.


def test_wiring_json_covers_every_wire_in_the_netlist_and_invents_none(tmp_path: Path) -> None:
    """**The id freeze, and the standing form of Phase 0's acceptance criterion.**

    Wire ids stopped being positional on 2026-09-07: every record carries an explicit id, the 71
    that existed are frozen at their current values, and an id is never reused. What makes that
    true rather than merely intended is this — the two id sets are the same set. A record for a
    wire the netlist does not have would be a connection nobody can see; a wire with no record
    would fall back to the guess in the `W` table with nothing saying so, which is the exact
    state this file exists to end.

    It also means the 58 authored paths need no migration, because no id moves.
    """
    netlist = json.loads((EXTRACTION / "circuit_logic.json").read_text("utf-8"))
    assert set(REAL_WIRING["wires"]) == {w["id"] for w in netlist["wires"]}
    assert REAL_WIRING["drawing_number"] == netlist["drawing"]["drawing_number"]


def test_an_unconfirmed_record_still_says_exactly_what_the_indexing_pass_guessed(
    tmp_path: Path,
) -> None:
    """A record nobody has confirmed must agree with the `W` table it was lifted from.

    This is Phase 0's *"reproduces the table exactly"*, written so it stays green through the
    authoring run rather than going red on the first correction: a record a person has settled
    says `source: human` and is exempt, and what is asserted is that **nothing has silently
    rewritten an endpoint nobody looked at.**

    The day this goes red without a `source: human` beside it, either the table or the file was
    hand-edited and the other was not, and the two are now telling different stories about what
    the machine originally said.
    """
    plain, _ = run(tmp_path, wiring={**REAL_WIRING, "wires": {}})
    from_table = {w["id"]: [w["from_terminal"], w["to_terminal"]] for w in plain["wires"]}
    for wire_id, record in REAL_WIRING["wires"].items():
        if record.get("source") != "index":
            continue
        assert [record["from"], record["to"]] == from_table[wire_id], wire_id


def test_the_generator_output_is_byte_identical_when_the_file_only_repeats_the_table(
    tmp_path: Path,
) -> None:
    """**Phase 0's other half: lifting the endpoints out of the literal changed nothing.**

    The whole point of doing the id freeze alone and first was that it must be invisible. So a
    `wiring.json` saying exactly what the `W` table said produces exactly the netlist the table
    produced on its own — compared as bytes, because an argument about it is not the same as a
    check.
    """
    (tmp_path / "empty").mkdir()
    (tmp_path / "index").mkdir()
    plain, _ = run(tmp_path / "empty", wiring={**REAL_WIRING, "wires": {}})
    same = {
        wire["id"]: {"from": wire["from_terminal"], "to": wire["to_terminal"], "source": "index"}
        for wire in plain["wires"]
    }
    folded, out = run(tmp_path / "index", wiring={**REAL_WIRING, "wires": same})
    assert folded == plain
    assert "71 of 71 wires have a record, 0 confirmed by a person" in out


def test_a_missing_wiring_file_stops_the_netlist_being_written(tmp_path: Path) -> None:
    """**The asymmetry with `locations.json`, and it is the whole reason this file is separate.**

    A broken `locations.json` is warned about and skipped, because the netlist does not depend on
    the geometry and a typo in one must not cost the other. This is the opposite claim: an
    endpoint *is* the netlist. Falling back silently to the `W` table would regenerate the
    artifact the model answers from using the guesses this project spent a session measuring as
    wrong, and nothing on screen or in git would say so.
    """
    said = refuse(tmp_path, None)
    assert "wiring.json is not here" in said
    assert "bootstrap_wiring.py" in said, "the refusal has to say how to fix it"
    assert "Nothing was written" in said


def test_a_broken_wiring_file_stops_the_netlist_being_written(tmp_path: Path) -> None:
    """The same rule for a file that is there and unreadable, which is the likelier accident."""
    assert "could not be read" in refuse(tmp_path, "{ not json")


def test_a_wiring_record_that_says_nothing_is_refused_by_name(tmp_path: Path) -> None:
    """Every refusal names the wire, because a wiring file is read and edited by a person.

    `from`/`to` may be **null** — an end nobody has set is a real state and the only honest one
    for a wire added on screen before its second click — but the key has to be there. Absent is
    not *unset*, it is *unsaid*, and the two are different claims.
    """
    said = refuse(tmp_path, wired(W019={"to": "TB-0V:2", "source": "human"}))
    assert "wires['W019']" in said and "'from'" in said

    said = refuse(tmp_path, wired(W019={"from": "PS1:-2", "to": "TB-0V:2", "source": "guess"}))
    assert "W019" in said and "source 'guess'" in said


def test_an_endpoint_on_a_terminal_that_does_not_exist_is_refused_by_name(
    tmp_path: Path,
) -> None:
    """`H14`'s treatment, in a fourth file.

    `TB-0V` has twelve points and a hand edit will reach for a thirteenth sooner or later. An
    endpoint on a terminal the netlist does not have connects nothing, would never be drawn and
    would never be mentioned — the symptom is *nothing at all* — so it is named and the run stops.
    """
    said = refuse(
        tmp_path, wired(W018={"from": "PS1:-1", "to": "TB-0V:13", "source": "human"})
    )
    assert "W018" in said and "TB-0V:13" in said and "not a terminal" in said


def test_a_record_for_a_wire_that_is_not_in_the_table_is_refused_by_name(
    tmp_path: Path,
) -> None:
    """Adding a wire is Phase E and this generator does not do it yet, so an unknown id is a typo.

    Refused rather than tolerated: a tolerated `W07` would appear in the netlist as a wire with no
    colour, no gauge and no cable, and a phantom connection is the one thing worse than a missing
    one. When Phase E arrives it lifts this refusal deliberately, which is the right way round.
    """
    said = refuse(
        tmp_path, wired(W072={"from": "PS1:-1", "to": "TB-0V:1", "source": "human"})
    )
    assert "'W072'" in said and "not a wire in the W table" in said


def test_a_confirmed_correction_reaches_the_netlist_and_says_who_made_it(
    tmp_path: Path,
) -> None:
    """**`W019`, the wire this whole plan was found through.**

    The netlist had it as `PS1:-2 → TB-0V:2`. The ink runs `PS1:-2` to `TB-GND-B:2` as conductor
    `C0056`, 242 pt, printed `GND` — so it is a 0V-to-ground **bond** rather than the invented
    edge the first diagnosis called it, and correcting it is what makes twelve wires reach `TB-0V`
    on the sheet and twelve in the data.

    Three things have to happen at once, and each is one of the plan's decisions:

    * the endpoint moves;
    * the **net moves with it**, because a wire's net is derived from its two ends rather than
      stored — and here the two ends are on *different* nets, so it is **flagged and not fixed**.
      A bond is supposed to join two nets; picking one of them would hide the only interesting
      thing about the wire;
    * the artifact says a **person** settled it, in the same words a placed coordinate does.
    """
    doc, out = run(
        tmp_path,
        wiring=wired(
            W019={
                "from": "PS1:-2",
                "to": "TB-GND-B:2",
                "source": "human",
                "by": "js",
                "at": "2026-09-07T14:22:03.118Z",
                "was": ["PS1:-2", "TB-0V:2"],
                "note": "a 0V-to-ground bond; the two ends are on different nets and that is right",
            }
        ),
    )

    wire = find(doc["wires"], "W019")
    assert (wire["from_terminal"], wire["to_terminal"]) == ("PS1:-2", "TB-GND-B:2")
    assert wire["net"] == "0V"
    assert wire["net_mismatch"] == {"from": "0V", "to": "GND"}
    assert wire["endpoints"]["source"] == "human"
    assert wire["endpoints"]["was"] == ["PS1:-2", "TB-0V:2"]
    # The spec is read off the printed callout and this plan does not reopen it: colour, gauge and
    # cable stay in the `W` table and are untouched by a correction to where the wire lands.
    assert (wire["color"], wire["gauge"]) == ("WHITE/BLUE", "12AWG")

    edge = next(
        r
        for r in doc["relationships"]
        if r["type"] == "CONNECTS_TO" and r["properties"]["wire"] == "W019"
    )
    assert (edge["src"], edge["tgt"]) == ("PS1:-2", "TB-GND-B:2")
    assert "1 confirmed by a person, 0 retired, 1 joining two nets" in out
    assert "W019 joins two nets: 0V at one end, GND at the other" in out


def test_a_wire_nobody_has_confirmed_carries_no_provenance_at_all(tmp_path: Path) -> None:
    """`source: index` adds nothing to the artifact, and that absence is the record.

    It is the same rule as everywhere else in this project: a value the machine produced is never
    dressed up as a decision. `endpoints` appears on a wire when a person has taken responsibility
    for where it lands, and on no other wire — which is what lets a reader of `circuit_logic.json`
    tell the 47 the ink confirms from the 47 somebody has actually confirmed.
    """
    doc, _ = run(tmp_path)
    assert not any("endpoints" in w for w in doc["wires"])
    assert not any("net_mismatch" in w for w in doc["wires"])


def test_a_retired_wire_leaves_the_netlist_and_its_id_is_not_reused(tmp_path: Path) -> None:
    """A tombstone, so a stale path or a stale citation gets an answer rather than silence.

    The wire and its `CONNECTS_TO` edge both go; the id stays spoken for, because the whole reason
    ids became explicit is that reusing one would silently reattach somebody's authored path to a
    different wire.
    """
    doc, out = run(tmp_path, wiring=wired(W019={"retired": "read twice; W014 is this run"}))
    assert not any(w["id"] == "W019" for w in doc["wires"])
    assert not any(
        r["properties"].get("wire") == "W019"
        for r in doc["relationships"]
        if r["type"] == "CONNECTS_TO"
    )
    assert not any(w["id"] == "W072" for w in doc["wires"]), "no id is recycled into the gap"
    assert "1 retired" in out
    assert "W019 retired: read twice" in out


def test_a_half_authored_wire_is_kept_and_earns_no_edge_until_both_ends_are_set(
    tmp_path: Path,
) -> None:
    """`null` is a real endpoint state — the only honest one between a wire's two clicks.

    The wire stays in the netlist, because somebody started it and a queue has to be able to show
    it. What it does **not** get is a `CONNECTS_TO`, because an edge to nothing is a connection the
    model could answer a question about.
    """
    doc, out = run(tmp_path, wiring=wired(W019={"from": "PS1:-2", "to": None, "source": "human"}))
    wire = find(doc["wires"], "W019")
    assert wire["to_terminal"] is None
    assert wire["net"] == "0V", "the end that is settled still says which net it is on"
    assert not any(
        r["properties"].get("wire") == "W019"
        for r in doc["relationships"]
        if r["type"] == "CONNECTS_TO"
    )
    assert "1 half-set" in out
