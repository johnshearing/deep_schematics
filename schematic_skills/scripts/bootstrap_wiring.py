#!/usr/bin/env python3
"""
Write a drawing's first `wiring.json`, and stamp the paths it already has.

`wiring.json` is the fourth authored file. It says which two terminals each wire joins - a claim
about *what connects to what*, which until 2026-09-07 lived in a Python literal inside
`author_circuit_logic.py` where nothing could check it and no screen could reach it. On
PS20115MLM4-2 the far end of 40 of the 71 wires had been **allocated** by that indexing pass
rather than read off the sheet, one screw number after another, and 11 of them land on the wrong
screw. See `_claude_notes/authoring_the_wires.md`.

This script is the bootstrap for that file and it does two things, both of them once:

  1. **Writes `wiring.json`** with one record per wire, at the endpoints the netlist has today,
     every one `"source": "index"` - *this is what the machine guessed*. Nothing writes that
     again; from here on a person confirms or corrects each one in the editor and the record
     becomes `"source": "human"`.

  2. **Stamps `for` onto every authored path in `locations.json`.** A path is a claim about ink
     and the ink does not move, so correcting an endpoint does not invalidate a route - unless it
     moves the end that route reaches. `for` records the two endpoints a path was accepted
     against, so the editor can say *path may be stale* by comparing rather than by asking a
     person to remember. True by construction here: those endpoints are exactly what the path
     panel was showing when each route was accepted.

WHY IT IS SAFE TO KEEP AND SAFE TO RUN TWICE
--------------------------------------------
The plan called this a one-off script to be deleted, on the argument that *a migration that
survives is a migration somebody will run twice*. It survives instead, because the thing that
makes running it twice dangerous is overwriting a decision a person made - so it does not:

  * it **refuses** to write over an existing `wiring.json`, naming the file, rather than
    replacing 71 authored endpoints with the indexing pass's guesses;
  * it only **adds** a `for` to a path that has none, so a path re-authored since keeps its own.

That leaves it doing nothing at all on a second run, and available to the next drawing - which is
the point: the long-term goal is a library of indexed schematics, and every one of them needs
this file created exactly once.

IT KNOWS NOTHING ABOUT ANY PARTICULAR DRAWING
---------------------------------------------
It reads `circuit_logic.json` for the wire list and `locations.json` for the paths, both by name,
both out of the directory it is pointed at. A wire's endpoints are **terminal designators** and
not coordinates, so nothing here has a page in it - which is also why the format survives a
circuit that needs several sheets to describe: `CR-BP:A2` names the same terminal whichever page
prints it.

Usage:
    python bootstrap_wiring.py schematic_extraction/PS20115MLM4-2/extracted_docs
    python bootstrap_wiring.py . --dry-run

Run it with the server stopped and no editor tab open. The Locate editor holds a whole-document
draft and its next save would discard the `for` stamps it never saw - hazard H1.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCHEMA = 1

NETLIST = "circuit_logic.json"
LOCATIONS = "locations.json"
WIRING = "wiring.json"


def load(path: Path) -> Any:
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        sys.exit(f"  {path} is not here. Point this at an extracted_docs directory.")
    except (OSError, ValueError) as exc:
        sys.exit(f"  {path} could not be read: {exc}")


def wiring_document(netlist: dict) -> dict:
    """One record per wire, at today's endpoints, all of them the indexing pass's own answer.

    Written in the netlist's own wire order rather than sorted, so the file reads down the sheet
    the way the table it came from does, and a diff against the next hand edit stays small.
    """
    wires = {}
    for wire in netlist.get("wires") or []:
        wires[wire["id"]] = {
            "from": wire.get("from_terminal"),
            "to": wire.get("to_terminal"),
            "source": "index",
        }
    return {
        "drawing_number": (netlist.get("drawing") or {}).get("drawing_number"),
        "schema": SCHEMA,
        "wires": wires,
        # Phase C fills this in: a terminal block's own commoning, which is not field wire and
        # never enters the netlist. Empty rather than absent, because an empty section says
        # *nobody has authored any* and an absent one says nothing at all.
        "commoning": {},
    }


def stamp_paths(locations: dict, netlist: dict) -> int:
    """Add `for` to every path that has none. Returns how many were stamped."""
    endpoints = {
        wire["id"]: [wire.get("from_terminal"), wire.get("to_terminal")]
        for wire in netlist.get("wires") or []
    }
    stamped = 0
    for wire_id, record in (locations.get("wires") or {}).items():
        path = record.get("path")
        if not isinstance(path, dict) or "for" in path or wire_id not in endpoints:
            continue
        path["for"] = endpoints[wire_id]
        stamped += 1
    return stamped


def write(path: Path, document: dict) -> None:
    """Indented and newline-terminated, like every other authored file here: it lives in git and
    a one-line change should be a one-line diff."""
    path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("directory", type=Path, help="an extracted_docs directory")
    parser.add_argument(
        "--dry-run", action="store_true", help="say what would happen, write nothing"
    )
    args = parser.parse_args()

    directory: Path = args.directory
    netlist = load(directory / NETLIST)
    wiring_path = directory / WIRING
    locations_path = directory / LOCATIONS

    document = wiring_document(netlist)
    count = len(document["wires"])

    if wiring_path.is_file():
        # The refusal that makes this script safe to keep. Overwriting would replace whatever a
        # person has confirmed with the indexing pass's guesses, silently, and the whole file
        # exists to stop exactly that class of thing happening to a netlist.
        print(f"  {WIRING} already exists — left alone. Nothing here overwrites an authored file.")
    elif args.dry_run:
        print(f"  would write {wiring_path} with {count} wires, all source: index")
    else:
        write(wiring_path, document)
        print(f"  wrote {wiring_path}")
        print(f"    {count} wires, every one source: index — 0 confirmed by a person")

    if locations_path.is_file():
        locations = load(locations_path)
        stamped = stamp_paths(locations, netlist)
        if not stamped:
            print(f"  {LOCATIONS}: every path already carries a `for` — nothing to stamp")
        elif args.dry_run:
            print(f"  would stamp `for` onto {stamped} paths in {locations_path}")
        else:
            write(locations_path, locations)
            print(f"  stamped `for` onto {stamped} paths in {locations_path}")
    else:
        print(f"  no {LOCATIONS} here, so there are no paths to stamp")

    print("\n  Re-run the generator next, and then build_kg.py:")
    print("    python author_circuit_logic.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
