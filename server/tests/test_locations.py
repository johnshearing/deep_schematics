"""`locations.json` — the file a human writes to say where things are drawn.

Every test here is a failure that would otherwise be silent in a browser: a point applied to the
wrong pin, a file quietly ignored, a coordinate accepted against a page it was not measured on.
The one thing they all guard is that **a wrong dot must be impossible to mistake for a right
one** — either it is where a person put it, or the payload says whose guess it is.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.drawing import designator_index, load_circuit_logic
from app.locations import load_locations, resolve_geometry

# CR1 is drawn twice — coil and a second site — which is the case the old one-point-per-component
# model could not express. CB1 carries both a site *and* an explicit terminal point, so precedence
# has something to decide. TB-110 is left out entirely: it is the fallback case.
LOCATIONS: dict[str, Any] = {
    "drawing_number": "PS20115MLM4-2",
    "schema": 1,
    "page_size_pt": [1224.0, 792.0],
    "components": {
        "CR1": {
            "sites": [
                {"id": "coil", "point": [110, 210], "terminals": ["A1"], "source": "human"},
                {"id": "contact", "point": [500, 600], "terminals": [], "source": "seed",
                 "label": {"dir": "w"}},
            ]
        },
        "CB1": {
            "sites": [{"id": "block", "point": [305, 85], "terminals": ["2"], "source": "seed"}]
        },
    },
    "terminals": {"CB1:2": {"point": [307, 90], "source": "human"}},
}


def write_locations(drawing_dir: Path, body: dict[str, Any] | str) -> None:
    text = body if isinstance(body, str) else json.dumps(body)
    (drawing_dir / "locations.json").write_text(text, encoding="utf-8")
    load_locations.cache_clear()


def write_page(drawing_dir: Path, page: list[float]) -> None:
    """Just enough tile manifest for `designator_index` to know the page size."""
    tiles = drawing_dir / "tiles"
    tiles.mkdir(exist_ok=True)
    (tiles / "tile_r1c1.png").write_bytes(b"not really a png")
    (tiles / "tiles.json").write_text(
        json.dumps(
            {
                "page_size": page,
                "dpi": 400,
                "grid": {"rows": 1, "cols": 1},
                "tiles": [{"file": "tile_r1c1.png", "row": 1, "col": 1,
                           "pdf_rect": [0.0, 0.0, page[0], page[1]], "pixels": [100, 100]}],
            }
        ),
        encoding="utf-8",
    )


def index(drawing_dir: Path) -> dict[str, Any]:
    body = designator_index(drawing_dir)
    return {entry["id"]: entry for entry in body["entries"]}


def report(drawing_dir: Path) -> dict[str, Any]:
    return designator_index(drawing_dir)["locations"]


def test_nothing_changes_when_there_is_no_locations_file(drawing_dir: Path) -> None:
    """The state of every extraction until a human opens the editor. It has to be
    indistinguishable from the behaviour that shipped, except for saying whose guess the points
    are."""
    entries = index(drawing_dir)
    assert entries["CR1"]["point"] == [100.0, 200.0]
    assert entries["CR1"]["placement"] == "seed"
    assert "places" not in entries["CR1"]
    assert entries["CR1:A1"]["point"] == [100.0, 200.0]
    assert entries["CR1:A1"]["placement"] == "parent"
    assert report(drawing_dir)["file"] is False
    assert report(drawing_dir)["problems"] == []


def test_a_terminals_own_point_beats_its_site_which_beats_its_parent(drawing_dir: Path) -> None:
    write_locations(drawing_dir, LOCATIONS)
    entries = index(drawing_dir)

    # 1. Its own confirmed point, not the site's [305, 85].
    assert entries["CB1:2"]["point"] == [307.0, 90.0]
    assert entries["CB1:2"]["placement"] == "confirmed"
    # 2. The site that claims the pin. This is the fix for `CR-SW:14` landing on the coil.
    assert entries["CR1:A1"]["point"] == [110.0, 210.0]
    assert entries["CR1:A1"]["placement"] == "confirmed"
    # 3. Nothing stored, so the parent component's point — and it says so, because a marker that
    #    cannot say "this is the block, not the pin" is claiming to know something it does not.
    assert entries["TB-110:1"]["point"] == [200.0, 250.0]
    assert entries["TB-110:1"]["placement"] == "parent"
    # 4. Nowhere at all. Still citable, still unclickable.
    assert entries["UPSTREAM-MACHINE"]["point"] is None
    assert entries["UPSTREAM-MACHINE"]["placement"] is None


def test_a_component_drawn_in_two_places_publishes_both(drawing_dir: Path) -> None:
    """`CR-BP` on the real sheet is drawn three times — coil, NC contact, NO contact. One point
    per component cannot express that, and picking one silently would put the marker on a circuit
    the reader is not looking at."""
    write_locations(drawing_dir, LOCATIONS)
    entry = index(drawing_dir)["CR1"]

    assert entry["places"] == [
        {"point": [110.0, 210.0], "placement": "confirmed", "site": "coil"},
        # `label_dir` only appears where somebody moved a label off a conductor. The viewer's
        # default is east, so publishing it on all 275 entries would be bytes saying nothing.
        {"point": [500.0, 600.0], "placement": "seed", "site": "contact", "label_dir": "w"},
    ]
    assert entry["rect"] == [110.0, 210.0, 500.0, 600.0]
    # `placement` describes the primary — the first site, in file order.
    assert entry["placement"] == "confirmed"
    # A single-point entry does not carry `places` at all: 269 of the real 275 entries are single,
    # and duplicating each into a second field would grow the payload for nothing.
    assert "places" not in index(drawing_dir)["CB1"]


def test_a_single_dot_still_publishes_the_side_its_label_was_put_on(drawing_dir: Path) -> None:
    """The reported fault, and the exception to the rule directly above.

    `places` is elided for a single-dot entry because it would only repeat `point` — except that
    `label_dir` has nowhere else to go. `point` and `placement` are the only flat fields, and the
    viewer's default is east, so a pin whose label a human deliberately moved west to keep it off a
    conductor came back east on the Drawing tab: the one thing about that dot the person had chosen
    by hand, replaced by the default with nothing on screen saying so. `site` stays out of the test
    — it names which of several dots this is, and with one dot there are no several.
    """
    write_locations(
        drawing_dir,
        {**LOCATIONS, "terminals": {"CB1:2": {"point": [307, 90], "source": "human",
                                             "label": {"dir": "w"}}}},
    )
    entries = index(drawing_dir)

    assert entries["CB1:2"]["places"] == [
        {"point": [307.0, 90.0], "placement": "confirmed", "label_dir": "w"}
    ]
    # Unchanged where nothing was chosen: 269 of the real 275 entries say nothing about a side,
    # and publishing east on every one of them would be bytes saying "default".
    assert "places" not in entries["CB1"]
    assert "places" not in entries["TB-110:1"]


def test_a_net_frames_its_terminals_not_the_components_they_sit_on(drawing_dir: Path) -> None:
    """Before sites existed these were the same thing. They stop being the same the moment a net
    reaches one contact of a relay drawn in three places: framing the component would zoom out
    to include two circuits the net never touches."""
    write_locations(drawing_dir, LOCATIONS)
    net = index(drawing_dir)["110"]

    # CR1:A1 (110, 210), CB1:2 (307, 90), TB-110:1 (200, 250) — the placed points, not the
    # components' [100, 200] / [300, 80] / [200, 250].
    assert net["rect"] == [110.0, 90.0, 307.0, 250.0]
    # The components it runs through are unchanged: that list is what the overlay rings.
    assert net["members"] == ["CR1", "CB1", "TB-110"]
    assert index(drawing_dir)["W047"]["rect"] == [110.0, 90.0, 307.0, 210.0]


def test_nets_and_wires_are_never_placed_only_computed(drawing_dir: Path) -> None:
    """Placing 131 terminals gives all 71 wires their geometry for free, and that is why the
    editor lists them as work already done rather than as work to do. A `placement` on a wire
    would invite someone to place one, and a straight line between two component points is an
    invented wire route — the one thing the netlist's authority rests on never doing."""
    write_locations(drawing_dir, LOCATIONS)
    entries = index(drawing_dir)
    assert "placement" not in entries["W047"]
    assert "placement" not in entries["110"]
    assert "placement" in entries["CR1"] and "placement" in entries["CR1:A1"]


def test_a_wire_gets_a_label_position_and_never_a_route(drawing_dir: Path) -> None:
    """The one thing a wire or a net may carry, and the one thing it may not.

    `rect` still frames the run from its endpoint terminals, because that is what a wire's path
    *is*. `label_point` is where the text `BLUE 18AWG` is printed, so a citation of `W047` lands
    on the words instead of the midpoint of a rectangle. There is deliberately nowhere in the
    format to say where a wire goes: drawing a line between two terminals no conductor joined
    would be inventing a route, and the netlist's authority rests on never having invented one.
    """
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "wires": {"W047": {"label_point": [250.5, 140.25], "source": "human",
                               "label": {"dir": "n"}}},
            "nets": {"110": {"label_point": [180, 300], "source": "human"}},
        },
    )
    entries = index(drawing_dir)

    assert entries["W047"]["label_point"] == [250.5, 140.25]
    assert entries["W047"]["label_dir"] == "n"
    # Untouched: the run is still its two endpoints, and the label is not one of them.
    assert entries["W047"]["rect"] == [110.0, 90.0, 307.0, 210.0]
    assert "places" in entries["W047"]
    assert entries["110"]["label_point"] == [180.0, 300.0]
    assert "label_dir" not in entries["110"]
    # And a label is never a placement — nothing estimates one, and nothing derives one.
    assert "placement" not in entries["W047"]

    body = report(drawing_dir)
    assert (body["labels"], body["confirmed_labels"]) == (2, 2)
    assert body["problems"] == []


def test_a_label_for_something_that_is_not_a_wire_or_net_is_reported(drawing_dir: Path) -> None:
    write_locations(
        drawing_dir,
        {**LOCATIONS, "wires": {"W999": {"label_point": [1, 2], "source": "human"}}},
    )
    problems = report(drawing_dir)["problems"]
    assert any("W999" in p and "not a wire or net" in p for p in problems)


def test_a_label_with_no_point_costs_the_label_and_says_so(drawing_dir: Path) -> None:
    """The message names `label_point`, not `point`, because that is the key the human typed."""
    write_locations(drawing_dir, {**LOCATIONS, "nets": {"110": {"source": "human"}}})
    problems = report(drawing_dir)["problems"]
    assert any("has no usable label_point" in p for p in problems)
    assert "label_point" not in index(drawing_dir)["110"]
    # The rest of the file is untouched.
    assert index(drawing_dir)["CR1:A1"]["point"] == [110.0, 210.0]


def test_a_file_written_for_a_different_page_is_refused_whole(drawing_dir: Path) -> None:
    """A point is meaningless against a page it was not measured on, and applying it at an offset
    is worse than ignoring it: the dots would land plausibly and be wrong."""
    write_page(drawing_dir, [612.0, 792.0])
    write_locations(drawing_dir, LOCATIONS)

    entries = index(drawing_dir)
    assert entries["CR1:A1"]["point"] == [100.0, 200.0]  # back to the parent estimate
    assert entries["CR1:A1"]["placement"] == "parent"
    problems = report(drawing_dir)["problems"]
    assert len(problems) == 1
    assert "1224.0×792.0 pt page" in problems[0]
    assert "612.0×792.0 pt" in problems[0]


def test_a_matching_page_is_applied(drawing_dir: Path) -> None:
    write_page(drawing_dir, [1224.0, 792.0])
    write_locations(drawing_dir, LOCATIONS)
    assert index(drawing_dir)["CR1:A1"]["point"] == [110.0, 210.0]
    assert report(drawing_dir)["problems"] == []


def test_an_unreadable_file_reports_itself_instead_of_disappearing(drawing_dir: Path) -> None:
    """The worst outcome available here is a coordinate a human typed and the server silently
    dropped, so every refusal is published and the editor shows the list."""
    write_locations(drawing_dir, "{ not json")
    body = report(drawing_dir)
    assert body["file"] is True
    assert "could not be read" in body["problems"][0]
    assert index(drawing_dir)["CR1"]["placement"] == "seed"


def test_an_unknown_schema_is_refused_rather_than_guessed(drawing_dir: Path) -> None:
    write_locations(drawing_dir, {**LOCATIONS, "schema": 2})
    assert "declares schema 2" in report(drawing_dir)["problems"][0]
    assert index(drawing_dir)["CR1:A1"]["placement"] == "parent"


def test_ids_the_netlist_does_not_have_are_reported_not_fatal(drawing_dir: Path) -> None:
    """A locations file outlives the netlist it was written against: a component gets renamed and
    the coordinates for it are suddenly orphans. That has to be a message, not a 500, and not
    silence either — someone has work to redo."""
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "components": {
                **LOCATIONS["components"],
                "CR-GHOST": {"sites": [{"id": "coil", "point": [1, 2], "source": "human"}]},
                "TB-110": {"sites": [{"id": "block", "point": [200, 250],
                                      "terminals": ["1", "9"], "source": "human"}]},
            },
            "terminals": {**LOCATIONS["terminals"], "CB1:99": {"point": [1, 2],
                                                               "source": "human"}},
        },
    )
    problems = report(drawing_dir)["problems"]
    assert any("CR-GHOST" in p and "not in circuit_logic.json" in p for p in problems)
    assert any("CB1:99" in p and "not in the netlist" in p for p in problems)
    assert any("TB-110 site 'block' lists terminal '9'" in p for p in problems)
    # Everything that *does* exist still works, including the good pin on the same site.
    assert index(drawing_dir)["TB-110:1"]["placement"] == "confirmed"
    assert index(drawing_dir)["CR1:A1"]["point"] == [110.0, 210.0]


def test_a_pin_claimed_by_two_sites_is_reported_and_the_first_wins(drawing_dir: Path) -> None:
    """Two sites both saying they hold `A1` is a human error in the editor, and arbitrating it
    silently would put the marker somewhere nobody chose."""
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "components": {
                "CR1": {
                    "sites": [
                        {"id": "coil", "point": [110, 210], "terminals": ["A1"],
                         "source": "human"},
                        {"id": "spare", "point": [700, 700], "terminals": ["A1"],
                         "source": "human"},
                    ]
                }
            },
        },
    )
    assert index(drawing_dir)["CR1:A1"]["point"] == [110.0, 210.0]
    assert any("claimed by two sites" in p for p in report(drawing_dir)["problems"])


def test_a_pin_is_assigned_to_a_site_explicitly_and_never_by_its_function(
    drawing_dir: Path,
) -> None:
    """`CR-BP` has two terminals whose function is `common` (`11` and `21`) at different sites, so
    a heuristic over `function` cannot tell them apart. Here `CR1:A1` is function `coil` and is
    deliberately claimed by the site named `contact`: the assignment wins, and the name of the
    site says nothing about which pins are on it."""
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "components": {
                "CR1": {
                    "sites": [
                        {"id": "coil", "point": [110, 210], "terminals": [], "source": "human"},
                        {"id": "contact", "point": [500, 600], "terminals": ["A1"],
                         "source": "human"},
                    ]
                }
            },
            "terminals": {},
        },
    )
    assert index(drawing_dir)["CR1:A1"]["point"] == [500.0, 600.0]


def test_a_bad_field_costs_that_field_and_nothing_else(drawing_dir: Path) -> None:
    """Validation is per value, so one typo does not discard a drawing's worth of confirmed
    work."""
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "components": {
                "CR1": {
                    "sites": [
                        # A label side that is not a compass point: the point survives, the
                        # side does not.
                        {"id": "coil", "point": [110, 210], "terminals": ["A1"],
                         "source": "human", "label": {"dir": "sideways"}},
                        # No usable point, so no site.
                        {"id": "broken", "point": ["x", 2], "source": "human"},
                        # A source we do not know: refused, because "who says so" is the whole
                        # value of the file. `derived` is deliberately among the words that are
                        # not known — nothing in this system derives a coordinate.
                        {"id": "guessed", "point": [1, 2], "source": "derived"},
                    ]
                }
            },
        },
    )
    entries = index(drawing_dir)
    assert entries["CR1"]["point"] == [110.0, 210.0]
    assert "places" not in entries["CR1"]  # the two bad sites are gone
    problems = report(drawing_dir)["problems"]
    assert any("label dir 'sideways'" in p for p in problems)
    assert any("no usable point" in p for p in problems)
    assert any("source 'derived'" in p for p in problems)


def test_counts_say_how_much_of_the_drawing_a_human_has_confirmed(drawing_dir: Path) -> None:
    """What a librarian needs per drawing, and the header of the Locate tab."""
    write_locations(drawing_dir, LOCATIONS)
    assert report(drawing_dir) == {
        "file": True,
        "components": 2,
        "sites": 3,
        "confirmed_sites": 1,
        "terminals": 1,
        "confirmed_terminals": 1,
        # Counted apart from the rest on purpose: a terminal with no point is missing data, a
        # wire with no label point is finished work with a nicety missing.
        "labels": 0,
        "confirmed_labels": 0,
        "problems": [],
    }


def test_the_label_side_survives_the_round_trip(drawing_dir: Path) -> None:
    """Stored because the emptiest side of a dot is a property of the drawing, not of the marker.
    Nothing renders it yet; the resolver must carry it or the editor has nowhere to put it."""
    write_locations(drawing_dir, LOCATIONS)
    geometry = resolve_geometry(drawing_dir, load_circuit_logic(drawing_dir))
    assert geometry.component("CR1")[1].label_dir == "w"
    assert geometry.component("CR1")[0].label_dir is None


def test_the_parse_is_cached_per_drawing_and_can_be_invalidated(drawing_dir: Path) -> None:
    """The editor's one hard requirement: after it writes, the next read must see the write."""
    (drawing_dir / "locations.json").write_text(json.dumps(LOCATIONS), encoding="utf-8")
    assert load_locations(drawing_dir).counts()["sites"] == 3

    (drawing_dir / "locations.json").write_text(
        json.dumps({**LOCATIONS, "components": {}}), encoding="utf-8"
    )
    assert load_locations(drawing_dir).counts()["sites"] == 3  # still the cached parse
    load_locations.cache_clear()
    assert load_locations(drawing_dir).counts()["sites"] == 0


def test_a_nets_membership_is_not_deduplicated_even_where_its_dots_are(drawing_dir: Path) -> None:
    """Two members on one point is **one dot and two members**, and the payload has to say both.

    `places` is deduplicated because drawing two dots on one coordinate is drawing one dot. The
    membership is not, because it is the answer to a different question — on the real sheet
    `TB-120:1`, `:2` and `:3` are three of net 120's seven terminals, and a roster that showed
    five rows because three of them share a block would be under-reporting the net.
    """
    write_locations(
        drawing_dir,
        {
            **LOCATIONS,
            "components": {},
            "terminals": {
                "CR1:A1": {"point": [400, 400], "source": "human"},
                "CB1:2": {"point": [400, 400], "source": "human"},
            },
        },
    )
    net = index(drawing_dir)["110"]

    assert [m["id"] for m in net["terminals"]] == ["CR1:A1", "CB1:2", "TB-110:1"]
    assert [m["point"] for m in net["terminals"]] == [
        [400.0, 400.0],
        [400.0, 400.0],
        [200.0, 250.0],
    ]
    # Two coincident members, one dot: the coordinate appears once in `places`.
    assert [p["point"] for p in net["places"]] == [[400.0, 400.0], [200.0, 250.0]]
    # And each member still says how well its *own* point is known.
    assert [m["placement"] for m in net["terminals"]] == ["confirmed", "confirmed", "parent"]
