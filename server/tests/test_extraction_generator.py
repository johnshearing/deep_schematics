"""`author_circuit_logic.py` folding in the second authored file.

This is the extraction's own script rather than the server's code, and it is tested here because
the seam is shared: the script writes the positions into `circuit_logic.json` and
`app/locations.py` reads the same `locations.json` at request time. If the two ever disagree about
precedence, the viewer and the artifact the model reads would place the same terminal in different
spots — and nothing else in the project would notice.

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


def run(work: Path, locations: dict | str | None = None) -> tuple[dict, str]:
    """Run the generator in a scratch directory. It writes beside itself, which is what makes
    this possible: copy the script, get its output and nothing else."""
    copy = work / SCRIPT.name
    copy.write_bytes(SCRIPT.read_bytes())
    if locations is not None:
        text = locations if isinstance(locations, str) else json.dumps(locations)
        (work / "locations.json").write_text(text, encoding="utf-8")

    done = subprocess.run(  # noqa: S603
        [sys.executable, str(copy)], capture_output=True, text=True, timeout=120, check=True
    )
    return json.loads((work / "circuit_logic.json").read_text("utf-8")), done.stdout


def find(items: list[dict], identifier: str) -> dict:
    return next(item for item in items if item["id"] == identifier)


def test_the_committed_artifact_is_exactly_what_the_generator_writes(tmp_path: Path) -> None:
    """Generated files stay fully generated.

    Run against **both** authored inputs — the script and whatever `locations.json` the extraction
    currently has — and compare to the committed `circuit_logic.json`. A hand-edit of the artifact
    fails here, and so does a `locations.json` that has been placed but never regenerated, which is
    the staleness the editor puts a banner up about.
    """
    real = EXTRACTION / "locations.json"
    doc, _ = run(tmp_path, json.loads(real.read_text("utf-8")) if real.is_file() else None)
    assert doc == json.loads((EXTRACTION / "circuit_logic.json").read_text("utf-8"))


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
