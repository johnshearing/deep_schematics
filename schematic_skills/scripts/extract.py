#!/usr/bin/env python3
"""
PDF Vector Data Extraction for Electrical Schematics / Wiring Diagrams.

Deterministic half of the schematic-reading pipeline. Extracts, from a vector PDF:

  * text labels        - CAD sheets often stroke their text as line geometry, so labels are
                         recovered by clustering short strokes into glyphs/lines and OCRing
                         the rendered crop (tesseract) with a domain lexicon correction pass.
  * wire conductors    - long segments joined at shared endpoints into polyline runs, split
                         at junctions, with the net label (above the run) and the wire spec
                         label (below the run) associated by proximity.
  * symbols            - circles (terminal points, relay coils, indicator lamps) and closed
                         rectangles (component/terminal-block outlines).
  * junctions          - endpoints shared by three or more conductor segments.
  * nets               - conductors sharing a net designator, merged with geometric union.

Nothing is silently dropped: every label, conductor and symbol appears in the output, and
anything the script could not resolve is listed in `review_queue` for the vision pass.

Usage:
    python extract.py schematic.pdf -o geometry.json --pretty
    python extract.py schematic.pdf --page 1 --no-ocr -o geometry.json
    python extract.py schematic.pdf --layers SCHEMATIC -o geometry.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher, get_close_matches
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF required. Install with: pip install pymupdf", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------------------
# Tunable geometry parameters
#
# Defaults are calibrated against a 1224x792pt (D-size, plotted to 17x11in) DraftSight/Teigha
# export whose text cap-height is ~4.1pt. Override with --params if your sheet differs; run
# with --stats-only first to see what the sheet looks like.
# --------------------------------------------------------------------------------------
DEFAULTS: dict[str, float] = {
    # A stroke shorter than this is treated as part of a glyph, not as a conductor.
    "glyph_max_len": 8.0,
    # A conductor segment must be at least this long.
    "wire_min_len": 6.0,
    # Endpoints closer than this are the same node (conductors are drawn to touch exactly,
    # but exports carry rounding noise).
    "node_snap": 0.35,
    # Union-find cell size when clustering glyph strokes into glyphs.
    "glyph_cell": 1.2,
    # Two glyphs belong to the same text line if their vertical centres are within this.
    "line_band": 2.5,
    # Two glyphs on the same line merge into one label if the horizontal gap is below
    # this multiple of the glyph height (a word space measures ~1.2x cap height).
    "word_gap_ratio": 1.45,
    # A text cluster taller than this is graphics, not a text line.
    "text_max_height": 12.0,
    # Vertical search distance for the net label above / spec label below a conductor run.
    # Keep this below the pitch between adjacent parallel wire runs, or a run will steal
    # its neighbour's label.
    "label_attach_dy": 8.5,
    # A label must overlap the conductor run horizontally by at least this fraction of its
    # own width to be attached to it.
    "label_overlap": 0.5,
    # Radius within which a conductor endpoint binds to a symbol or a terminal-number label.
    "endpoint_bind_radius": 7.0,
    # Circles at or below this diameter are terminal points; larger ones are devices.
    "terminal_dot_max_dia": 5.0,
    # Deviation allowed when testing a segment for horizontal / vertical.
    "ortho_tol": 0.25,
    # DPI used to rasterise label crops for OCR.
    "ocr_dpi": 600.0,
    # Padding (pt) around a label bbox when cropping for OCR.
    "ocr_pad": 2.5,
}


# --------------------------------------------------------------------------------------
# Domain lexicon - post-OCR correction
#
# CAD stroke fonts routinely render O with a slash, so tesseract reports O as D or 0
# ("CR-ON" -> "CR-DN", "MOD-LINX" -> "MDD-LINX"). W/AWG is also commonly read as AVG.
# Correction is lexicon-driven and always non-destructive: raw_ocr is preserved.
# --------------------------------------------------------------------------------------
WIRE_COLORS = [
    "BLACK",
    "WHITE",
    "BLUE",
    "GREEN",
    "RED",
    "ORANGE",
    "BROWN",
    "GREY",
    "GRAY",
    "YELLOW",
    "VIOLET",
    "PURPLE",
    "PINK",
    "TAN",
    "CLEAR",
    "SHIELD",
]

LEXICON = WIRE_COLORS + [
    # structure / device words
    "TERMINAL",
    "TERMINALS",
    "TERMINAL'S",
    "CIRCUIT",
    "BREAKER",
    "AMP",
    "POWER",
    "SUPPLY",
    "SPEED",
    "CONTROLLER",
    "RECEPTACLE",
    "INTERFACE",
    "DISCHARGE",
    "INFEED",
    "CABLE",
    "CABLES",
    "SWITCH",
    "RELAY",
    "GROUND",
    "PANEL",
    "DISCONNECT",
    "PLUG",
    "MICRO",
    "FEMALE",
    "MALE",
    "MINI",
    "PIN",
    "LIGHT",
    "MOTOR",
    "FUSE",
    "CARD",
    "CARDS",
    "DRIVE",
    "MASTER",
    "REVERSE",
    "BYPASS",
    "RUN",
    "START",
    "STOP",
    "INPUT",
    "OUTPUT",
    "PHASE",
    "SCHEMATIC",
    "ASSY",
    "DWG",
    "REV",
    "DATE",
    "SIZE",
    "SHEET",
    "TITLE",
    "DRAWN",
    "WEIGHT",
    "NOTE",
    "NOTES",
    "CONNECTED",
    "NOT",
    "REMOVE",
    "INSULATION",
    "HEAT",
    "SHRINK",
    "EXPOSED",
    "END",
    "MINIMUM",
    "CLEARANCE",
    "FROM",
    "WIRES",
    "WIRE",
    "KEEP",
    "ALL",
    "AND",
    "THE",
    "WITH",
    "EXTERNAL",
    "DEVICE",
    "CONNECTION",
    "SEE",
    "DRAWINGS",
    "INDIVIDUAL",
    "POINTS",
    "TERMINATION",
    "DOUBLE",
    "PLACE",
    "LABEL",
    "DOOR",
    "PROPRIETARY",
    "INFORMATION",
    "CONFIDENTIAL",
    "PROPERTY",
    "SIGNAL",
    "TO",
    "OF",
    "CONTROL",
    "BUS",
    "COMMON",
    "COIL",
    "CONTACT",
    "NORMALLY",
    "OPEN",
    "CLOSED",
]

# Designator prefixes that identify a component tag rather than prose.
DESIGNATOR_RE = re.compile(
    r"^(CR|CB|PB|PS|PLG|P|S|L|H|TB|FU|F|M|SW|LT|DISC|SPD|GND|PE)[-_]?[A-Z0-9]{0,6}$"
)
GAUGE_RE = re.compile(r"^(\d{1,2})\s*A[VW]G$", re.IGNORECASE)
NET_NUMBER_RE = re.compile(r"^\d{1,4}$")
VOLTAGE_RE = re.compile(r"^[+-]?\d{1,3}\s*V(AC|DC)?$", re.IGNORECASE)

# Standard AWG sizes used for wire-spec repair; the stroke font makes 6/G, 0/O/D and 1/I/L
# hard to tell apart, so a garbled gauge is snapped to the nearest legal size.
STANDARD_AWG = {8, 10, 12, 14, 16, 18, 20, 22, 24}
# Glyph confusions introduced by slashed-zero CAD stroke fonts, applied only to short
# alphanumeric tokens (terminal numbers, net numbers, gauges).
DIGIT_FIXES = str.maketrans(
    {"I": "1", "L": "1", "O": "0", "D": "0", "G": "6", "S": "5", "B": "8"}
)
# Terminal designations that appear next to a symbol: relay coil A1/A2, contact 11/12/14,
# line/neutral/ground L1/L2/N/G, plug pins 1..9, supply rails +/-.
TERMINAL_TOKEN_RE = re.compile(r"^([A-Z]{1,2}\d{0,2}|\d{1,2}|[+-])$")


def _fix_slashed_o(token: str) -> list[str]:
    """Return plausible readings of a token given the slashed-O confusion."""
    out = {token}
    for a, b in (("D", "O"), ("0", "O"), ("O", "0")):
        if a in token:
            out.add(token.replace(a, b))
    return list(out)


def _repair_gauge(token: str) -> tuple[str, float] | None:
    """Repair a garbled AWG token such as '1GAWG' or 'IOAVG' into a standard gauge."""
    m = re.match(r"^(.{1,2})A[VWU][GC6]$", token)
    if not m:
        return None
    digits = m.group(1).translate(DIGIT_FIXES)
    if not digits.isdigit():
        return None
    value = int(digits)
    if value in STANDARD_AWG:
        return f"{value}AWG", 0.95 if token == f"{value}AWG" else 0.8
    nearest = min(STANDARD_AWG, key=lambda s: abs(s - value))
    if abs(nearest - value) <= 1:
        return f"{nearest}AWG", 0.7
    return None


def correct_token(token: str) -> tuple[str, float]:
    """Correct a single OCR token against the lexicon. Returns (token, confidence)."""
    t = token.strip().upper()
    if not t:
        return "", 0.0

    # 0V is the common-return net; the stroke font's slashed zero makes it read as 'OV'.
    if re.match(r"^[O0]V$", t):
        return "0V", 0.9

    # Numbers, voltages and net numbers are taken as-is; they carry no lexicon signal.
    if NET_NUMBER_RE.match(t) or VOLTAGE_RE.match(t):
        return t, 0.9

    g = GAUGE_RE.match(t.replace(" ", ""))
    if g:
        return f"{int(g.group(1))}AWG", 0.95
    repaired = _repair_gauge(t.replace(" ", ""))
    if repaired:
        return repaired

    # Compound colours such as WHITE/BLUE.
    if "/" in t:
        parts = [correct_token(p) for p in t.split("/") if p]
        if parts and all(p[0] in WIRE_COLORS for p in parts):
            return "/".join(p[0] for p in parts), min(p[1] for p in parts)

    for cand in _fix_slashed_o(t):
        if cand in LEXICON:
            return cand, 1.0 if cand == t else 0.85
        if DESIGNATOR_RE.match(cand) and len(cand) >= 3:
            return cand, 0.9 if cand == t else 0.8

    # Short tokens are terminal/pin markings, not words. Fuzzy-matching them against the
    # prose lexicon turns 'A1' into 'ALL', so they get glyph repair instead.
    if len(t) <= 3:
        if TERMINAL_TOKEN_RE.match(t):
            return t, 0.75
        repaired_short = t[0] + t[1:].translate(DIGIT_FIXES)
        if TERMINAL_TOKEN_RE.match(repaired_short):
            return repaired_short, 0.6
        return t, 0.4

    for cand in _fix_slashed_o(t):
        match = get_close_matches(cand, LEXICON, n=1, cutoff=0.8)
        if match:
            ratio = SequenceMatcher(None, cand, match[0]).ratio()
            return match[0], round(ratio * 0.9, 2)

    return t, 0.4


def correct_text(raw: str) -> tuple[str, float]:
    """Correct a whole OCR line. Returns (text, mean confidence)."""
    tokens = [t for t in re.split(r"\s+", raw.strip()) if t]
    if not tokens:
        return "", 0.0
    fixed, confs = [], []
    for tok in tokens:
        f, c = correct_token(tok)
        if f:
            fixed.append(f)
            confs.append(c)
    if not fixed:
        return "", 0.0
    return " ".join(fixed), round(sum(confs) / len(confs), 2)


def classify_label(text: str) -> str:
    """Classify a corrected label into the role it plays on a wiring diagram."""
    t = text.strip().upper()
    if not t:
        return "empty"
    parts = t.split()
    colour_first = parts[0].split("/")[0] in WIRE_COLORS
    has_gauge = any(GAUGE_RE.match(p) for p in parts)
    if colour_first and has_gauge:
        return "wire_spec"
    if colour_first and len(parts) == 1:
        return "wire_colour"
    if len(parts) == 1:
        if VOLTAGE_RE.match(t) or t == "0V":
            return "voltage"
        if NET_NUMBER_RE.match(t):
            # Relay contact and plug pin markings are one or two digits; printed net
            # designators on this drawing style are three or four.
            return "terminal_number" if len(t) <= 2 else "net_number"
        if DESIGNATOR_RE.match(t):
            return "designator"
        if re.match(r"^[A-Z]{1,2}\d{0,2}$", t):
            return "terminal_number"
    if len(parts) >= 5:
        return "note"
    return "text"


# --------------------------------------------------------------------------------------
# Geometry primitives
# --------------------------------------------------------------------------------------
def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


class UnionFind:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def collect_primitives(
    page: fitz.Page, layers: list[str] | None, prm: dict[str, float]
):
    """Split page vector content into glyph strokes, conductor segments, circles, boxes."""
    glyph_strokes: list[tuple[tuple[float, float], tuple[float, float]]] = []
    segments: list[dict[str, Any]] = []
    circles: list[dict[str, Any]] = []
    rects: list[dict[str, Any]] = []
    layer_counter: Counter = Counter()

    for grp in page.get_drawings():
        layer = grp.get("layer")
        layer_counter[layer] += 1
        if layers and layer not in layers:
            # Off-layer content still contributes text (title block lives on FORMAT), so
            # glyph strokes are kept; only conductors are restricted to the wanted layers.
            wanted = False
        else:
            wanted = True

        items = grp.get("items", [])
        curves = [i for i in items if i[0] == "c"]
        rect = grp.get("rect")

        # A group made only of curves whose bbox is near-square is a circle.
        if curves and len(curves) == len(items) and rect is not None:
            w, h = rect.width, rect.height
            if max(w, h) > 0 and abs(w - h) < 0.6 * max(w, h):
                circles.append(
                    {
                        "center": (
                            round((rect.x0 + rect.x1) / 2, 2),
                            round((rect.y0 + rect.y1) / 2, 2),
                        ),
                        "diameter": round(max(w, h), 2),
                        "layer": layer,
                    }
                )
                continue

        for item in items:
            op = item[0]
            if op == "l":
                a, b = item[1], item[2]
                p1, p2 = (a.x, a.y), (b.x, b.y)
                length = _dist(p1, p2)
                if length < prm["glyph_max_len"]:
                    glyph_strokes.append((p1, p2))
                elif wanted and length >= prm["wire_min_len"]:
                    segments.append(
                        {"p1": p1, "p2": p2, "length": length, "layer": layer}
                    )
            elif op == "c":
                a, b = item[1], item[4]
                glyph_strokes.append(((a.x, a.y), (b.x, b.y)))
            elif op == "re":
                r = item[1]
                rects.append(
                    {
                        "bbox": (
                            round(r.x0, 2),
                            round(r.y0, 2),
                            round(r.x1, 2),
                            round(r.y1, 2),
                        ),
                        "width": round(r.width, 2),
                        "height": round(r.height, 2),
                        "layer": layer,
                    }
                )

    return glyph_strokes, segments, circles, rects, layer_counter


# --------------------------------------------------------------------------------------
# Text recovery
# --------------------------------------------------------------------------------------
def cluster_glyphs(strokes, prm: dict[str, float]) -> list[list[float]]:
    """Cluster short strokes into glyph bounding boxes via grid union-find."""
    if not strokes:
        return []
    cell = prm["glyph_cell"]
    uf = UnionFind(len(strokes))
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, (p1, p2) in enumerate(strokes):
        for pt in (p1, p2):
            grid[(int(pt[0] // cell), int(pt[1] // cell))].append(i)
    for (kx, ky), _ in list(grid.items()):
        neigh: list[int] = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                neigh.extend(grid.get((kx + dx, ky + dy), []))
        for i in neigh[1:]:
            uf.union(neigh[0], i)

    groups: dict[int, list[int]] = defaultdict(list)
    for i in range(len(strokes)):
        groups[uf.find(i)].append(i)

    glyphs = []
    for members in groups.values():
        xs: list[float] = []
        ys: list[float] = []
        for i in members:
            p1, p2 = strokes[i]
            xs += [p1[0], p2[0]]
            ys += [p1[1], p2[1]]
        glyphs.append([min(xs), min(ys), max(xs), max(ys)])
    return glyphs


def group_text_lines(
    glyphs: list[list[float]], prm: dict[str, float]
) -> list[dict[str, Any]]:
    """Merge glyph boxes into horizontal text lines (and detect vertical/rotated text)."""
    horizontal = [g for g in glyphs if (g[3] - g[1]) <= prm["text_max_height"]]
    tall = [g for g in glyphs if (g[3] - g[1]) > prm["text_max_height"]]

    # Horizontal lines: bucket by y-centre band, then merge left-to-right by gap.
    bands: list[dict[str, Any]] = []
    for g in sorted(horizontal, key=lambda g: ((g[1] + g[3]) / 2, g[0])):
        yc = (g[1] + g[3]) / 2
        for band in bands:
            if abs(band["yc"] - yc) < prm["line_band"]:
                band["items"].append(g)
                band["yc"] = (band["yc"] * (len(band["items"]) - 1) + yc) / len(
                    band["items"]
                )
                break
        else:
            bands.append({"yc": yc, "items": [g]})

    lines: list[dict[str, Any]] = []
    for band in bands:
        items = sorted(band["items"], key=lambda g: g[0])
        cur = list(items[0])
        for g in items[1:]:
            height = max(cur[3] - cur[1], g[3] - g[1], 3.0)
            if g[0] - cur[2] < prm["word_gap_ratio"] * height:
                cur = [
                    min(cur[0], g[0]),
                    min(cur[1], g[1]),
                    max(cur[2], g[2]),
                    max(cur[3], g[3]),
                ]
            else:
                lines.append({"bbox": cur, "orientation": "h"})
                cur = list(g)
        lines.append({"bbox": cur, "orientation": "h"})

    # Tall clusters that are narrow are rotated text; the rest are graphics left for vision.
    for g in tall:
        w, h = g[2] - g[0], g[3] - g[1]
        if w > 0 and h / w > 2.0 and w <= prm["text_max_height"]:
            lines.append({"bbox": list(g), "orientation": "v"})
        else:
            lines.append({"bbox": list(g), "orientation": "graphic"})

    return lines


def ocr_lines(
    page: fitz.Page,
    lines: list[dict[str, Any]],
    prm: dict[str, float],
    workers: int = 8,
) -> None:
    """OCR each text line crop in place. Adds raw_ocr / text / confidence keys."""
    if not shutil.which("tesseract"):
        for ln in lines:
            ln["raw_ocr"] = ""
            ln["text"] = ""
            ln["confidence"] = 0.0
            ln["ocr_status"] = "tesseract_not_installed"
        return

    dpi = prm["ocr_dpi"]
    scale = dpi / 72.0
    pix = page.get_pixmap(dpi=int(dpi))
    tmpdir = Path(tempfile.mkdtemp(prefix="schematic_ocr_"))
    page_png = tmpdir / "page.png"
    pix.save(str(page_png))

    try:
        from PIL import Image
    except ImportError:
        for ln in lines:
            ln["raw_ocr"] = ""
            ln["text"] = ""
            ln["confidence"] = 0.0
            ln["ocr_status"] = "pillow_not_installed"
        return

    image = Image.open(page_png).convert("L")
    pad = prm["ocr_pad"]
    whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-.,#'\"()+ "

    def run_one(index_line: tuple[int, dict[str, Any]]) -> None:
        idx, ln = index_line
        if ln["orientation"] == "graphic":
            ln["raw_ocr"] = ""
            ln["text"] = ""
            ln["confidence"] = 0.0
            ln["ocr_status"] = "skipped_graphic"
            return
        x0, y0, x1, y1 = ln["bbox"]
        box = (
            max(int((x0 - pad) * scale), 0),
            max(int((y0 - pad) * scale), 0),
            min(int((x1 + pad) * scale), image.width),
            min(int((y1 + pad) * scale), image.height),
        )
        if box[2] - box[0] < 4 or box[3] - box[1] < 4:
            ln["raw_ocr"] = ""
            ln["text"] = ""
            ln["confidence"] = 0.0
            ln["ocr_status"] = "too_small"
            return
        crop = image.crop(box)
        if ln["orientation"] == "v":
            crop = crop.rotate(-90, expand=True)
        crop_path = tmpdir / f"l{idx}.png"
        crop.save(crop_path)
        psm = "6" if (y1 - y0) > 2.2 * max(prm["text_max_height"] / 3, 1) else "7"
        proc = subprocess.run(
            [
                "tesseract",
                str(crop_path),
                "stdout",
                "--psm",
                psm,
                "-c",
                f"tessedit_char_whitelist={whitelist}",
            ],
            capture_output=True,
            text=True,
        )
        raw = " ".join(proc.stdout.split())
        text, conf = correct_text(raw)
        ln["raw_ocr"] = raw
        ln["text"] = text
        ln["confidence"] = conf
        ln["ocr_status"] = "ok" if text else "empty"
        try:
            crop_path.unlink()
        except OSError:
            pass

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(run_one, enumerate(lines)))

    shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------------------------
# Conductor tracing
# --------------------------------------------------------------------------------------
def build_conductor_graph(segments: list[dict[str, Any]], prm: dict[str, float]):
    """Snap segment endpoints to shared nodes and return (nodes, adjacency)."""
    snap = prm["node_snap"]
    node_of: dict[tuple[int, int], int] = {}
    nodes: list[tuple[float, float]] = []

    def node_id(pt: tuple[float, float]) -> int:
        key = (int(round(pt[0] / snap)), int(round(pt[1] / snap)))
        # Probe the 3x3 neighbourhood so points either side of a rounding boundary merge.
        for dx in (0, -1, 1):
            for dy in (0, -1, 1):
                found = node_of.get((key[0] + dx, key[1] + dy))
                if found is not None:
                    return found
        idx = len(nodes)
        nodes.append((round(pt[0], 2), round(pt[1], 2)))
        node_of[key] = idx
        return idx

    adjacency: dict[int, set[tuple[int, int]]] = defaultdict(set)
    edges: list[dict[str, Any]] = []
    for seg in segments:
        a, b = node_id(seg["p1"]), node_id(seg["p2"])
        if a == b:
            continue
        eid = len(edges)
        edges.append({"a": a, "b": b, "length": seg["length"], "layer": seg["layer"]})
        adjacency[a].add((b, eid))
        adjacency[b].add((a, eid))
    return nodes, edges, adjacency


def trace_conductors(nodes, edges, adjacency, prm: dict[str, float]):
    """Walk the conductor graph into polyline runs split at junctions and free ends.

    A run terminates at a node of degree 1 (a termination) or degree >= 3 (a junction).
    Closed loops with no such node are emitted as `boxes` (component outlines), not wires.
    """
    degree = {n: len(adjacency[n]) for n in adjacency}
    breakpoints = {n for n, d in degree.items() if d != 2}
    used: set[int] = set()
    runs: list[dict[str, Any]] = []

    def walk(start: int, first_edge: int) -> dict[str, Any]:
        path_nodes = [start]
        path_edges = [first_edge]
        edge = edges[first_edge]
        cur = edge["b"] if edge["a"] == start else edge["a"]
        path_nodes.append(cur)
        used.add(first_edge)
        while cur not in breakpoints:
            nxt = [(n, e) for n, e in adjacency[cur] if e not in used]
            if not nxt:
                break
            n, e = nxt[0]
            used.add(e)
            path_edges.append(e)
            path_nodes.append(n)
            cur = n
        return {
            "nodes": path_nodes,
            "edges": path_edges,
            "points": [nodes[n] for n in path_nodes],
        }

    for start in sorted(breakpoints):
        for _, eid in sorted(adjacency[start]):
            if eid in used:
                continue
            runs.append(walk(start, eid))

    # Remaining edges belong to closed loops (component / terminal-block outlines).
    loops: list[dict[str, Any]] = []
    for eid, edge in enumerate(edges):
        if eid in used:
            continue
        start = edge["a"]
        loop = walk(start, eid)
        loops.append(loop)

    conductors = []
    for i, run in enumerate(runs, start=1):
        pts = run["points"]
        length = sum(_dist(pts[j], pts[j + 1]) for j in range(len(pts) - 1))
        conductors.append(
            {
                "id": f"C{i:04d}",
                "points": [[round(p[0], 2), round(p[1], 2)] for p in pts],
                "endpoints": [
                    [round(pts[0][0], 2), round(pts[0][1], 2)],
                    [round(pts[-1][0], 2), round(pts[-1][1], 2)],
                ],
                "node_ids": run["nodes"],
                "length": round(length, 2),
                "segment_count": len(run["edges"]),
            }
        )

    boxes = []
    for i, loop in enumerate(loops, start=1):
        xs = [p[0] for p in loop["points"]]
        ys = [p[1] for p in loop["points"]]
        boxes.append(
            {
                "id": f"B{i:04d}",
                "bbox": [
                    round(min(xs), 2),
                    round(min(ys), 2),
                    round(max(xs), 2),
                    round(max(ys), 2),
                ],
                "point_count": len(loop["points"]),
                "closed": _dist(loop["points"][0], loop["points"][-1]) < 1.0,
            }
        )

    junctions = [
        {
            "id": f"J{i:04d}",
            "point": [round(nodes[n][0], 2), round(nodes[n][1], 2)],
            "degree": degree[n],
            "node_id": n,
        }
        for i, n in enumerate(sorted(n for n, d in degree.items() if d >= 3), start=1)
    ]
    return conductors, boxes, junctions


def longest_horizontal_run(points: list[list[float]], prm: dict[str, float]):
    """Return (x0, x1, y) of the longest horizontal stretch of a conductor polyline."""
    best = None
    for a, b in zip(points, points[1:]):
        if abs(a[1] - b[1]) <= prm["ortho_tol"]:
            span = abs(b[0] - a[0])
            if best is None or span > best[0]:
                best = (span, min(a[0], b[0]), max(a[0], b[0]), (a[1] + b[1]) / 2)
    if best is None:
        return None
    return best[1], best[2], best[3]


#: Label kinds that can name a net (printed above a conductor run).
NET_LABEL_KINDS = {"net_number", "voltage", "designator", "terminal_number", "text"}
#: Label kinds that describe the conductor itself (printed below a conductor run).
SPEC_LABEL_KINDS = {"wire_spec", "wire_colour"}


def attach_labels(conductors, labels, prm: dict[str, float]) -> None:
    """Attach the net label (above the run) and the wire-spec label (below it).

    On a point-to-point wiring diagram the designator is printed just above each conductor
    run and the colour/gauge just below it. Adjacent parallel runs are only ~10pt apart, so
    assignment is done globally: every (conductor, label) candidate is scored by distance
    and claimed shortest-first, and each label can be claimed once. Without that exclusivity
    a run happily adopts the spec label belonging to the run above it.
    """
    usable = [
        lb
        for lb in labels
        if lb["orientation"] == "h" and lb.get("text") and lb["kind"] != "note"
    ]
    by_x: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for lb in usable:
        for cx in range(int(lb["bbox"][0] // 50), int(lb["bbox"][2] // 50) + 1):
            by_x[cx].append(lb)

    candidates: list[tuple[float, str, dict[str, Any], dict[str, Any]]] = []
    for cond in conductors:
        run = longest_horizontal_run(cond["points"], prm)
        cond["horizontal_run"] = (
            [round(run[0], 2), round(run[1], 2), round(run[2], 2)] if run else None
        )
        cond["net_label"] = None
        cond["spec_label"] = None
        cond["color"] = None
        cond["gauge"] = None
        cond["label_ids"] = []
        if run is None:
            continue
        x0, x1, y = run
        nearby: list[dict[str, Any]] = []
        for cx in range(int(x0 // 50) - 1, int(x1 // 50) + 2):
            nearby.extend(by_x.get(cx, []))
        for lb in nearby:
            lx0, ly0, lx1, ly1 = lb["bbox"]
            overlap = min(lx1, x1) - max(lx0, x0)
            width = max(lx1 - lx0, 0.1)
            if overlap < prm["label_overlap"] * width:
                continue
            above_gap = y - ly1
            below_gap = ly0 - y
            if (
                0 < above_gap <= prm["label_attach_dy"]
                and lb["kind"] in NET_LABEL_KINDS
            ):
                candidates.append((above_gap, "net", cond, lb))
            elif (
                0 < below_gap <= prm["label_attach_dy"]
                and lb["kind"] in SPEC_LABEL_KINDS
            ):
                candidates.append((below_gap, "spec", cond, lb))

    claimed_labels: set[str] = set()
    for _, role, cond, lb in sorted(candidates, key=lambda c: c[0]):
        if lb["id"] in claimed_labels or cond[f"{role}_label"] is not None:
            continue
        claimed_labels.add(lb["id"])
        cond[f"{role}_label"] = lb["text"]
        cond["label_ids"].append(lb["id"])
        if role == "spec":
            parts = lb["text"].split()
            if parts and parts[0].split("/")[0] in WIRE_COLORS:
                cond["color"] = parts[0]
            for p in parts:
                if GAUGE_RE.match(p):
                    cond["gauge"] = p.upper()


def bind_endpoints(conductors, symbols, labels, prm: dict[str, float]) -> None:
    """Bind each conductor endpoint to the nearest symbol and nearest short label."""
    radius = prm["endpoint_bind_radius"]
    short_labels = [
        lb
        for lb in labels
        if lb.get("text")
        and lb["kind"] in ("terminal_number", "designator", "net_number", "voltage")
    ]

    for cond in conductors:
        bindings = []
        for pt in cond["endpoints"]:
            best_sym = None
            for sym in symbols:
                d = _dist((pt[0], pt[1]), (sym["center"][0], sym["center"][1]))
                if d <= radius and (best_sym is None or d < best_sym[0]):
                    best_sym = (d, sym)
            best_lbl = None
            for lb in short_labels:
                lx = (lb["bbox"][0] + lb["bbox"][2]) / 2
                ly = (lb["bbox"][1] + lb["bbox"][3]) / 2
                d = _dist((pt[0], pt[1]), (lx, ly))
                if d <= radius * 1.6 and (best_lbl is None or d < best_lbl[0]):
                    best_lbl = (d, lb)
            bindings.append(
                {
                    "point": pt,
                    "symbol_id": best_sym[1]["id"] if best_sym else None,
                    "symbol_kind": best_sym[1]["kind"] if best_sym else None,
                    "symbol_distance": round(best_sym[0], 2) if best_sym else None,
                    "label_id": best_lbl[1]["id"] if best_lbl else None,
                    "label_text": best_lbl[1]["text"] if best_lbl else None,
                    "label_distance": round(best_lbl[0], 2) if best_lbl else None,
                }
            )
        cond["endpoint_bindings"] = bindings


def build_nets(conductors) -> list[dict[str, Any]]:
    """Group conductors that share a net designator or are joined at a junction node."""
    idx_of = {c["id"]: i for i, c in enumerate(conductors)}
    uf = UnionFind(len(conductors))

    # Geometric union: conductors sharing a graph node are electrically common.
    node_users: dict[int, list[int]] = defaultdict(list)
    for i, c in enumerate(conductors):
        for n in (c["node_ids"][0], c["node_ids"][-1]):
            node_users[n].append(i)
    for users in node_users.values():
        for u in users[1:]:
            uf.union(users[0], u)

    # Label union: same printed net designator means the same net even across the sheet.
    by_label: dict[str, list[int]] = defaultdict(list)
    for i, c in enumerate(conductors):
        if c.get("net_label"):
            by_label[c["net_label"]].append(i)
    for members in by_label.values():
        for m in members[1:]:
            uf.union(members[0], m)

    groups: dict[int, list[int]] = defaultdict(list)
    for i in range(len(conductors)):
        groups[uf.find(i)].append(i)

    nets = []
    for k, (_, members) in enumerate(sorted(groups.items()), start=1):
        names = Counter(
            conductors[m]["net_label"]
            for m in members
            if conductors[m].get("net_label")
        )
        net_id = names.most_common(1)[0][0] if names else f"NET-UNLABELLED-{k:03d}"
        nets.append(
            {
                "id": net_id,
                "labels_seen": sorted(names),
                "member_conductors": [conductors[m]["id"] for m in members],
                "conductor_count": len(members),
                "labelled": bool(names),
                "conflicting_labels": len(names) > 1,
            }
        )
    del idx_of
    return nets


# --------------------------------------------------------------------------------------
# Assembly
# --------------------------------------------------------------------------------------
def extract_page(
    page: fitz.Page, page_num: int, layers, prm, do_ocr: bool
) -> dict[str, Any]:
    glyph_strokes, segments, circles, rects, layer_counter = collect_primitives(
        page, layers, prm
    )

    glyphs = cluster_glyphs(glyph_strokes, prm)
    lines = group_text_lines(glyphs, prm)
    if do_ocr:
        ocr_lines(page, lines, prm)
    else:
        for ln in lines:
            ln.setdefault("raw_ocr", "")
            ln.setdefault("text", "")
            ln.setdefault("confidence", 0.0)
            ln.setdefault("ocr_status", "ocr_disabled")

    labels = []
    ordered = sorted(lines, key=lambda ln: (round(ln["bbox"][1], 1), ln["bbox"][0]))
    for i, ln in enumerate(ordered, 1):
        bbox = [round(v, 2) for v in ln["bbox"]]
        labels.append(
            {
                "id": f"T{i:04d}",
                "text": ln.get("text", ""),
                "raw_ocr": ln.get("raw_ocr", ""),
                "confidence": ln.get("confidence", 0.0),
                "ocr_status": ln.get("ocr_status", "unknown"),
                "kind": classify_label(ln.get("text", "")),
                "orientation": ln["orientation"],
                "bbox": bbox,
                "center": [
                    round((bbox[0] + bbox[2]) / 2, 2),
                    round((bbox[1] + bbox[3]) / 2, 2),
                ],
            }
        )

    symbols = []
    for i, c in enumerate(circles, start=1):
        kind = (
            "terminal_point"
            if c["diameter"] <= prm["terminal_dot_max_dia"]
            else "device_circle"
        )
        symbols.append(
            {
                "id": f"S{i:04d}",
                "kind": kind,
                "center": [c["center"][0], c["center"][1]],
                "diameter": c["diameter"],
                "layer": c["layer"],
                "note": "device_circle is a relay coil, lamp or meter - confirm with vision"
                if kind == "device_circle"
                else "",
            }
        )

    nodes, edges, adjacency = build_conductor_graph(segments, prm)
    conductors, boxes, junctions = trace_conductors(nodes, edges, adjacency, prm)
    attach_labels(conductors, labels, prm)
    bind_endpoints(conductors, symbols, labels, prm)
    nets = build_nets(conductors)

    # Everything the deterministic pass could not resolve, for the vision pass to fix.
    review: list[dict[str, Any]] = []
    for lb in labels:
        if lb["orientation"] == "graphic":
            continue
        if lb["confidence"] < 0.7 or not lb["text"]:
            review.append(
                {
                    "kind": "low_confidence_label",
                    "id": lb["id"],
                    "bbox": lb["bbox"],
                    "raw_ocr": lb["raw_ocr"],
                    "text": lb["text"],
                    "confidence": lb["confidence"],
                }
            )
    for c in conductors:
        missing = []
        if not c["net_label"]:
            missing.append("net_label")
        if not c["spec_label"]:
            missing.append("spec_label")
        unbound = [
            i
            for i, b in enumerate(c["endpoint_bindings"])
            if b["symbol_id"] is None and b["label_id"] is None
        ]
        if unbound:
            missing.append(f"unbound_endpoints:{unbound}")
        if missing:
            review.append(
                {
                    "kind": "incomplete_conductor",
                    "id": c["id"],
                    "endpoints": c["endpoints"],
                    "missing": missing,
                }
            )
    for n in nets:
        if n["conflicting_labels"]:
            review.append(
                {
                    "kind": "net_label_conflict",
                    "id": n["id"],
                    "labels_seen": n["labels_seen"],
                    "member_conductors": n["member_conductors"][:20],
                }
            )

    return {
        "page": page_num,
        "page_size": {
            "width": round(page.rect.width, 2),
            "height": round(page.rect.height, 2),
        },
        "layers": {str(k): v for k, v in layer_counter.items()},
        "labels": labels,
        "symbols": symbols,
        "conductors": conductors,
        "boxes": boxes,
        "junctions": junctions,
        "nets": nets,
        "rects": rects,
        "review_queue": review,
        "stats": {
            "glyph_strokes": len(glyph_strokes),
            "glyph_clusters": len(glyphs),
            "text_labels": len([lb for lb in labels if lb["orientation"] != "graphic"]),
            "labels_read": len([lb for lb in labels if lb["text"]]),
            "labels_low_confidence": len(
                [
                    lb
                    for lb in labels
                    if lb["orientation"] != "graphic" and lb["confidence"] < 0.7
                ]
            ),
            "conductor_segments": len(segments),
            "conductors": len(conductors),
            "conductors_with_net_label": len([c for c in conductors if c["net_label"]]),
            "conductors_with_spec_label": len(
                [c for c in conductors if c["spec_label"]]
            ),
            "junctions": len(junctions),
            "boxes": len(boxes),
            "symbols_terminal_points": len(
                [s for s in symbols if s["kind"] == "terminal_point"]
            ),
            "symbols_device_circles": len(
                [s for s in symbols if s["kind"] == "device_circle"]
            ),
            "nets": len(nets),
            "nets_labelled": len([n for n in nets if n["labelled"]]),
            "review_items": len(review),
        },
    }


def extract_pdf(
    pdf_path: str, page_num: int | None, layers, prm, do_ocr: bool
) -> dict[str, Any]:
    doc = fitz.open(pdf_path)
    result: dict[str, Any] = {
        "source_file": Path(pdf_path).name,
        "source_path": str(Path(pdf_path).resolve()),
        "total_pages": len(doc),
        "pdf_metadata": doc.metadata,
        "has_embedded_text": any(
            doc[i].get_text("text").strip() for i in range(len(doc))
        ),
        "params": prm,
        "pages": [],
    }
    if not result["has_embedded_text"]:
        result["text_source"] = (
            "OCR of stroked glyph geometry - this PDF has no embedded font text, so every "
            "label must be verified with the vision pass."
        )
    else:
        result["text_source"] = "stroked glyph geometry (embedded text also present)"

    targets = [page_num - 1] if page_num else range(len(doc))
    for i in targets:
        if 0 <= i < len(doc):
            result["pages"].append(extract_page(doc[i], i + 1, layers, prm, do_ocr))
    doc.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract wiring geometry and labels from an electrical schematic PDF"
    )
    parser.add_argument("pdf_path", help="Path to the schematic PDF")
    parser.add_argument("-o", "--output", help="Output JSON file (default: stdout)")
    parser.add_argument("--page", type=int, help="Extract a single page only")
    parser.add_argument("--pretty", action="store_true", help="Pretty print JSON")
    parser.add_argument(
        "--layers",
        help="Comma-separated PDF layer (OCG) names to treat as conductors, e.g. SCHEMATIC",
    )
    parser.add_argument(
        "--no-ocr", action="store_true", help="Skip the tesseract OCR pass"
    )
    parser.add_argument(
        "--params",
        help="JSON object overriding tunable parameters, e.g. '{\"wire_min_len\": 4}'",
    )
    parser.add_argument(
        "--stats-only",
        action="store_true",
        help="Print the stats block only (fast sanity check)",
    )
    args = parser.parse_args()

    if not Path(args.pdf_path).exists():
        print(f"ERROR: File not found: {args.pdf_path}", file=sys.stderr)
        sys.exit(1)

    prm = dict(DEFAULTS)
    if args.params:
        prm.update(json.loads(args.params))
    layers = [s.strip() for s in args.layers.split(",")] if args.layers else None

    result = extract_pdf(args.pdf_path, args.page, layers, prm, not args.no_ocr)

    if args.stats_only:
        summary = {
            "source_file": result["source_file"],
            "has_embedded_text": result["has_embedded_text"],
            "text_source": result["text_source"],
            "pages": [
                {"page": p["page"], "layers": p["layers"], "stats": p["stats"]}
                for p in result["pages"]
            ],
        }
        print(json.dumps(summary, indent=2))
        return

    payload = json.dumps(result, indent=2 if args.pretty else None)
    if args.output:
        Path(args.output).write_text(payload)
        print(f"Extracted data written to: {args.output}", file=sys.stderr)
        for page in result["pages"]:
            print(
                f"  page {page['page']}: {json.dumps(page['stats'])}", file=sys.stderr
            )
    else:
        print(payload)


if __name__ == "__main__":
    main()
