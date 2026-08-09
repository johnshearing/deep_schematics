"""Deterministic facts about the drawing, straight out of `circuit_logic.json`.

This endpoint costs nothing, is instant, and is exactly repeatable — and it answers §12
Q21–Q25 and Q64 outright, before anyone spends a token. That is the whole thesis of
`webui_ideas.md` §4 in one file: **a good version of this application answers as many
questions as possible with ordinary code and saves the model for what only it can do.**

It is also the natural home for the deterministic tabs that come next (net explorer, tables,
BOM), which is why the loader exposes the parsed document rather than only the summary.
"""

from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

#: The one fact about this drawing that a careful reader still gets wrong. The title block
#: has no revision field; the `D` in the side tab and the SIZE box is the sheet size. §12 Q21
#: exists purely to catch it, so we say it out loud on the front page rather than waiting to
#: be asked.
REVISION_NOTE = "Revision: none — the 'D' in the title block is the sheet size, not a revision."


class DrawingUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=8)
def load_circuit_logic(drawing_dir: Path) -> dict[str, Any]:
    path = drawing_dir / "circuit_logic.json"
    try:
        return json.loads(path.read_text("utf-8"))
    except FileNotFoundError as exc:
        raise DrawingUnavailable(f"no circuit_logic.json in {drawing_dir}") from exc
    except json.JSONDecodeError as exc:
        raise DrawingUnavailable(f"circuit_logic.json is not valid JSON: {exc}") from exc


def drawing_summary(drawing_dir: Path) -> dict[str, Any]:
    doc = load_circuit_logic(drawing_dir)
    meta = doc.get("drawing") or {}
    relationships = doc.get("relationships") or []

    return {
        "drawing_number": meta.get("drawing_number"),
        "title": meta.get("title"),
        "assembly": meta.get("assembly"),
        "date": meta.get("date"),
        "revision": meta.get("revision"),
        "revision_note": REVISION_NOTE if not meta.get("revision") else None,
        "proprietary_notice": meta.get("proprietary_notice"),
        "notes": meta.get("notes") or [],
        "references": meta.get("references") or [],
        "counts": {
            "components": len(doc.get("components") or []),
            "terminals": len(doc.get("terminals") or []),
            "nets": len(doc.get("nets") or []),
            "wires": len(doc.get("wires") or []),
            "cables": len(doc.get("cables") or []),
            "subsystems": len(doc.get("subsystems") or []),
            "relationships": len(relationships),
        },
        "subsystems": [
            {
                "id": s.get("id"),
                "description": s.get("description"),
                "members": len(s.get("member_components") or []),
            }
            for s in (doc.get("subsystems") or [])
        ],
        "component_classes": dict(
            sorted(Counter(c.get("class") for c in (doc.get("components") or [])).items())
        ),
        "relationship_types": dict(
            sorted(Counter(r.get("type") for r in relationships).items())
        ),
        "artifacts": _artifacts(drawing_dir),
    }


def _artifacts(drawing_dir: Path) -> list[dict[str, Any]]:
    """What the model can actually see, with sizes. Shown in the UI because "which files did
    it read?" is the first question anyone sensible asks about an answer like this."""
    out = []
    for name in ("EXTRACTION_NOTES.md", "circuit_logic.json", "custom_kg.json", "geometry.json"):
        path = drawing_dir / name
        if path.exists():
            out.append({"name": name, "bytes": path.stat().st_size})
    return out
