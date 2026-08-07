#!/usr/bin/env python3
"""
Transform an enriched circuit_logic.json into a LightRAG custom knowledge graph.

The master artifact (circuit_logic.json, see references/circuit_logic_schema.md) is a
superset of what LightRAG's `ainsert_custom_kg` accepts. This script flattens it into
`{chunks, entities, relationships}` so the schematic graph is injected verbatim, with no
LLM extraction step - a schematic is a deterministic netlist, and completeness has to be a
property of this pipeline rather than of a model's attention.

Field requirements verified against lightrag/lightrag.py:2342 (`ainsert_custom_kg`):
    chunks[]        content (required), source_id (required), file_path, chunk_order_index
    entities[]      entity_name (required), entity_type, description, source_id, file_path
    relationships[] src_id, tgt_id, description, keywords (all required), weight, source_id

`keywords` is read with no default, so omitting it raises KeyError. A relationship naming a
node that does not exist creates it as an UNKNOWN placeholder, so every referenced id must
also be emitted as an entity - `--validate` fails the build when that is not true.

Every entity and relationship gets its own prose chunk. Terse designators embed poorly;
LightRAG retrieves chunks alongside the graph, so the prose is what makes a query like
"what is wire 110 connected to" match at all.

Usage:
    python build_kg.py circuit_logic.json -o custom_kg.json --pretty
    python build_kg.py circuit_logic.json -o custom_kg.json --validate --report
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

#: Relationship types the troubleshooting graph understands. ON_NET and
#: COIL_CONTROLS_CONTACT are what turn a static netlist into something you can reason with:
#: a fault propagates to every terminal on a net, and a coil energising is what closes a
#: contact somewhere else on the sheet.
RELATION_TYPES = {
    "HAS_TERMINAL",
    "CONNECTS_TO",
    "ON_NET",
    "POWERS",
    "PROTECTS",
    "ACTUATES",
    "COIL_CONTROLS_CONTACT",
    "PART_OF",
    "GROUNDED_TO",
    "REFERENCES",
}


def _clean(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _sentence(*parts: str) -> str:
    """Join non-empty fragments into one prose blob.

    Source fields may or may not already end in a full stop, so runs of terminal
    punctuation are collapsed rather than doubled.
    """
    text = " ".join(p.strip() for p in parts if p and p.strip())
    return re.sub(r"\.\s*\.(\s|$)", r".\1", text)


# --------------------------------------------------------------------------------------
# Prose generation - one descriptive passage per entity
# --------------------------------------------------------------------------------------
def describe_component(c: dict[str, Any], drawing_no: str) -> str:
    ratings = c.get("ratings") or {}
    rating_text = ", ".join(
        f"{k}: {v}" for k, v in ratings.items() if v not in (None, "")
    )
    aliases = c.get("aliases") or []
    alias_text = f"It is also referred to as {', '.join(aliases)}." if aliases else ""
    loc = c.get("location") or {}
    loc_text = (
        f"It is drawn in the {loc['zone']} area of the schematic."
        if loc.get("zone")
        else ""
    )
    return _sentence(
        f"{c['id']} is a {_clean(c.get('class')).replace('_', ' ') or 'component'} on drawing {drawing_no}.",
        _clean(c.get("description")),
        f"Function: {_clean(c['function'])}." if c.get("function") else "",
        f"Ratings - {rating_text}." if rating_text else "",
        f"It operates in the {c['power_domain']} power domain."
        if c.get("power_domain")
        else "",
        f"Its normal state is {c['normal_state']}." if c.get("normal_state") else "",
        f"Part number {c['part_number']}." if c.get("part_number") else "",
        f"Manufactured by {c['manufacturer']}." if c.get("manufacturer") else "",
        alias_text,
        loc_text,
    )


def describe_terminal(t: dict[str, Any]) -> str:
    return _sentence(
        f"{t['id']} is a connection point on component {t.get('parent_component', 'unknown')}.",
        f"It serves as a {_clean(t['function']).replace('_', ' ')} terminal."
        if t.get("function")
        else "",
        f"It is tied to net {t['net']}."
        if t.get("net")
        else "It is not assigned to a net.",
        _clean(t.get("description")),
    )


def describe_net(n: dict[str, Any]) -> str:
    members = n.get("member_terminals") or []
    member_text = (
        f"The terminals electrically common on this net are: {', '.join(members)}."
        if members
        else "No member terminals were resolved for this net."
    )
    return _sentence(
        f"Net {n['id']} is an electrically common node on the schematic.",
        f"It carries a {_clean(n['signal_type'])} signal."
        if n.get("signal_type")
        else "",
        f"Its nominal voltage is {n['nominal_voltage']}."
        if n.get("nominal_voltage")
        else "",
        member_text,
        "Every point on this net sees the same potential, so a fault anywhere on it affects "
        "all of these terminals.",
        _clean(n.get("description")),
    )


def describe_wire(w: dict[str, Any]) -> str:
    spec = " ".join(x for x in [_clean(w.get("color")), _clean(w.get("gauge"))] if x)
    return _sentence(
        f"Wire {w['id']} is a {spec} conductor."
        if spec
        else f"Wire {w['id']} is a conductor.",
        f"It runs from {w['from_terminal']} to {w['to_terminal']}."
        if w.get("from_terminal") and w.get("to_terminal")
        else "",
        f"It is part of cable {w['cable']}." if w.get("cable") else "",
        f"It carries net {w['net']}." if w.get("net") else "",
        _clean(w.get("description")),
    )


def describe_cable(c: dict[str, Any]) -> str:
    members = c.get("member_wires") or []
    return _sentence(
        f"Cable {c['id']} is a wire harness on the schematic.",
        _clean(c.get("description")),
        f"It bundles the following wires: {', '.join(members)}." if members else "",
    )


def describe_subsystem(s: dict[str, Any]) -> str:
    members = s.get("member_components") or []
    return _sentence(
        f"{s['id']} is a functional section of the assembly.",
        _clean(s.get("description")),
        f"It comprises the components: {', '.join(members)}." if members else "",
    )


def describe_drawing(d: dict[str, Any]) -> str:
    refs = d.get("references") or []
    notes = d.get("notes") or []
    return _sentence(
        f"{d.get('drawing_number', 'This drawing')} is an electrical schematic titled "
        f'"{_clean(d.get("title"))}".',
        f"Revision {d['revision']}." if d.get("revision") else "",
        f"Dated {d['date']}." if d.get("date") else "",
        f"It documents the {d['assembly']}." if d.get("assembly") else "",
        f"{d['proprietary_notice']}" if d.get("proprietary_notice") else "",
        f"It references the related drawings: {', '.join(refs)}." if refs else "",
        (" Drawing notes: " + " ".join(notes)) if notes else "",
    )


# --------------------------------------------------------------------------------------
# Transform
# --------------------------------------------------------------------------------------
def build(master: dict[str, Any], file_path: str) -> dict[str, Any]:
    drawing = master.get("drawing") or {}
    drawing_no = _clean(drawing.get("drawing_number")) or "UNTITLED-SCHEMATIC"

    chunks: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []
    order = 0

    def emit_entity(name: str, etype: str, description: str) -> None:
        nonlocal order
        source_id = f"{drawing_no}::entity::{name}"
        chunks.append(
            {
                "content": description,
                "source_id": source_id,
                "file_path": file_path,
                "chunk_order_index": order,
            }
        )
        entities.append(
            {
                "entity_name": name,
                "entity_type": etype,
                "description": description,
                "source_id": source_id,
                "file_path": file_path,
            }
        )
        order += 1

    def emit_relationship(rel: dict[str, Any], index: int) -> None:
        nonlocal order
        rtype = _clean(rel.get("type")) or "RELATED_TO"
        src, tgt = _clean(rel.get("src")), _clean(rel.get("tgt"))
        description = _clean(rel.get("description")) or f"{src} {rtype} {tgt}."
        props = rel.get("properties") or {}
        keywords = ", ".join(
            [rtype.lower().replace("_", " ")]
            + [f"{k}: {v}" for k, v in props.items() if v not in (None, "")]
        )
        source_id = f"{drawing_no}::rel::{index:05d}"
        chunks.append(
            {
                "content": description,
                "source_id": source_id,
                "file_path": file_path,
                "chunk_order_index": order,
            }
        )
        relationships.append(
            {
                "src_id": src,
                "tgt_id": tgt,
                "description": description,
                "keywords": keywords,
                "weight": float(rel.get("weight", 1.0)),
                "source_id": source_id,
                "file_path": file_path,
            }
        )
        order += 1

    if drawing:
        emit_entity(drawing_no, "drawing", describe_drawing(drawing))

    for c in master.get("components", []):
        emit_entity(
            c["id"],
            _clean(c.get("class")) or "component",
            describe_component(c, drawing_no),
        )
    for t in master.get("terminals", []):
        emit_entity(t["id"], "terminal", describe_terminal(t))
    for n in master.get("nets", []):
        emit_entity(n["id"], "net", describe_net(n))
    for w in master.get("wires", []):
        emit_entity(w["id"], "wire", describe_wire(w))
    for c in master.get("cables", []):
        emit_entity(c["id"], "cable", describe_cable(c))
    for s in master.get("subsystems", []):
        emit_entity(s["id"], "subsystem", describe_subsystem(s))

    for i, rel in enumerate(master.get("relationships", []), start=1):
        emit_relationship(rel, i)

    return {"chunks": chunks, "entities": entities, "relationships": relationships}


def validate(master: dict[str, Any], kg: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Check the KG. Returns (problems, notes).

    `problems` are structural faults that corrupt the graph and should block the build.
    `notes` are things worth a human glance that are often legitimate - a schematic really
    does have spare terminals and deliberately unconnected conductors.
    """
    problems: list[str] = []
    notes: list[str] = []

    names = [e["entity_name"] for e in kg["entities"]]
    duplicates = [n for n, c in Counter(names).items() if c > 1]
    if duplicates:
        problems.append(f"duplicate entity names: {sorted(duplicates)[:20]}")

    known = set(names)
    dangling: set[str] = set()
    for rel in kg["relationships"]:
        for side in ("src_id", "tgt_id"):
            if rel[side] not in known:
                dangling.add(rel[side])
    if dangling:
        problems.append(
            "relationships reference undefined entities (LightRAG will create them as "
            f"UNKNOWN placeholder nodes): {sorted(dangling)[:20]}"
        )

    chunk_ids = {c["source_id"] for c in kg["chunks"]}
    orphans = [
        e["entity_name"] for e in kg["entities"] if e["source_id"] not in chunk_ids
    ]
    if orphans:
        problems.append(f"entities whose source_id has no chunk: {orphans[:20]}")

    for rel in master.get("relationships", []):
        rtype = _clean(rel.get("type"))
        if rtype and rtype not in RELATION_TYPES:
            problems.append(f"unknown relationship type: {rtype}")
            break

    for e in kg["entities"]:
        if len(e["description"]) < 25:
            problems.append(
                f"entity '{e['entity_name']}' has a very short description "
                f"({len(e['description'])} chars) - it will embed poorly"
            )
            break

    # Cross-check the netlist for terminals that never landed on a net. Spare poles and
    # deliberately-unconnected cable conductors are normal, so this is a note, not a fault.
    floating = [t["id"] for t in master.get("terminals", []) if not t.get("net")]
    if floating:
        notes.append(
            f"terminals with no net assigned: {len(floating)} ({', '.join(floating[:10])})"
            " - confirm each is a genuine spare rather than a missed connection"
        )

    return problems, notes


def report(master: dict[str, Any], kg: dict[str, Any]) -> str:
    rel_types = Counter(_clean(r.get("type")) for r in master.get("relationships", []))
    ent_types = Counter(e["entity_type"] for e in kg["entities"])
    lines = [
        "Custom KG build report",
        f"  chunks         {len(kg['chunks'])}",
        f"  entities       {len(kg['entities'])}",
        f"  relationships  {len(kg['relationships'])}",
        "  entity types:",
    ]
    lines += [f"    {k:22s} {v}" for k, v in sorted(ent_types.items())]
    lines.append("  relationship types:")
    lines += [f"    {k:22s} {v}" for k, v in sorted(rel_types.items())]
    missing = sorted(RELATION_TYPES - set(rel_types))
    if missing:
        lines.append("  relationship types not used: " + ", ".join(missing))
        if "ON_NET" in missing:
            lines.append(
                "    WARNING: no ON_NET edges. Net-tracing questions ('what is wire 110 "
                "connected to') will only reach one wire's two ends."
            )
        if "COIL_CONTROLS_CONTACT" in missing:
            lines.append(
                "    WARNING: no COIL_CONTROLS_CONTACT edges. Control-logic questions "
                "('what happens when CR-ON is energised') have nothing to traverse."
            )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transform circuit_logic.json into a LightRAG custom KG"
    )
    parser.add_argument("master", help="Path to the enriched circuit_logic.json")
    parser.add_argument(
        "-o", "--output", help="Output custom_kg.json (default: stdout)"
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty print JSON")
    parser.add_argument(
        "--file-path",
        help="file_path recorded on every chunk/entity/relationship (default: master filename)",
    )
    parser.add_argument(
        "--validate", action="store_true", help="Fail on structural problems"
    )
    parser.add_argument(
        "--report", action="store_true", help="Print a build report to stderr"
    )
    args = parser.parse_args()

    master_path = Path(args.master)
    if not master_path.exists():
        print(f"ERROR: File not found: {master_path}", file=sys.stderr)
        sys.exit(1)

    master = json.loads(master_path.read_text())
    kg = build(master, args.file_path or master_path.name)

    problems, notes = validate(master, kg)
    if args.report:
        print(report(master, kg), file=sys.stderr)
    if notes:
        print("\nValidation notes (informational):", file=sys.stderr)
        for n in notes:
            print(f"  - {n}", file=sys.stderr)
    if problems:
        print("\nValidation problems:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        if args.validate:
            print("\nRefusing to write output (--validate).", file=sys.stderr)
            sys.exit(2)

    payload = json.dumps(kg, indent=2 if args.pretty else None)
    if args.output:
        Path(args.output).write_text(payload)
        print(
            f"\nWrote {args.output}: {len(kg['chunks'])} chunks, {len(kg['entities'])} entities, "
            f"{len(kg['relationships'])} relationships",
            file=sys.stderr,
        )
    else:
        print(payload)


if __name__ == "__main__":
    main()
