#!/usr/bin/env python3
"""
Tiled rendering for AI-vision verification of an electrical schematic.

A D-size schematic rendered whole is unreadable to a vision model: a 1224x792pt sheet holds
~500 labels at ~4pt cap height. One global pass is exactly the failure mode this pipeline
exists to avoid. So the sheet is rendered as overlapping high-DPI tiles, each small enough
that every label in it is legible, and each annotated with the IDs that `extract.py`
assigned - so a correction can name the thing it corrects.

Subcommands
    tiles    Split the page into an overlapping grid of high-DPI PNGs.
    region   Render one arbitrary PDF-coordinate rectangle.
    crops    Build numbered contact sheets from the extraction review queue, so many
             uncertain labels can be transcribed in a single look.

Usage:
    python render_tiles.py tiles schematic.pdf -o tiles/ --annotate geometry.json
    python render_tiles.py region schematic.pdf --rect 700,430,1000,530 -o zoom.png
    python render_tiles.py crops schematic.pdf --geometry geometry.json -o crops/
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF required. Install with: pip install pymupdf", file=sys.stderr)
    sys.exit(1)


RED = (0.85, 0.05, 0.05)
BLUE = (0.05, 0.15, 0.85)
GREEN = (0.0, 0.5, 0.1)


def _open_page(pdf_path: str, page_num: int) -> tuple[fitz.Document, fitz.Page]:
    doc = fitz.open(pdf_path)
    if not 1 <= page_num <= len(doc):
        raise SystemExit(f"ERROR: page {page_num} out of range (1..{len(doc)})")
    return doc, doc[page_num - 1]


def _page_geometry(geometry_path: str | None, page_num: int) -> dict[str, Any] | None:
    if not geometry_path:
        return None
    data = json.loads(Path(geometry_path).read_text())
    for page in data.get("pages", []):
        if page.get("page") == page_num:
            return page
    return None


def annotate(page: fitz.Page, geo: dict[str, Any], show: set[str]) -> None:
    """Draw extraction IDs onto the page so vision corrections can cite them.

    Annotations are added to an in-memory copy of the PDF; the file on disk is untouched.
    Drawing goes through page-level calls rather than a Shape, because a Shape only renders
    what was in it at commit() time.
    """
    if "conductors" in show:
        for cond in geo.get("conductors", []):
            run = cond.get("horizontal_run")
            if run:
                x0, x1, y = run
                # Both ends of the run: the net label is centred, so the corners are usually
                # clear, and a long run crossing a tile boundary stays identifiable.
                anchors = [fitz.Point(x0 + 1.5, y - 1.0)]
                if x1 - x0 > 60:
                    anchors.append(fitz.Point(x1 - 14.0, y - 1.0))
            else:
                pts = cond.get("points") or []
                if not pts:
                    continue
                anchors = [fitz.Point(pts[0][0] + 1.5, pts[0][1] - 1.0)]
            for anchor in anchors:
                page.insert_text(
                    anchor, cond["id"], fontsize=3.0, color=RED, fontname="helv"
                )

    if "junctions" in show:
        for j in geo.get("junctions", []):
            p = fitz.Point(j["point"][0], j["point"][1])
            page.draw_circle(p, 2.2, color=GREEN, width=0.4)
            page.insert_text(
                fitz.Point(p.x + 2.5, p.y - 1.0),
                j["id"],
                fontsize=3.0,
                color=GREEN,
                fontname="helv",
            )

    if "review" in show:
        flagged = {
            item["id"]
            for item in geo.get("review_queue", [])
            if item["kind"] == "low_confidence_label"
        }
        for lb in geo.get("labels", []):
            if lb["id"] not in flagged:
                continue
            x0, y0, x1, y1 = lb["bbox"]
            page.draw_rect(
                fitz.Rect(x0 - 0.8, y0 - 0.8, x1 + 0.8, y1 + 0.8), color=BLUE, width=0.3
            )
            page.insert_text(
                fitz.Point(x0, y0 - 1.2),
                lb["id"],
                fontsize=2.6,
                color=BLUE,
                fontname="helv",
            )

    if "symbols" in show:
        for sym in geo.get("symbols", []):
            if sym["kind"] != "device_circle":
                continue
            p = fitz.Point(sym["center"][0], sym["center"][1])
            page.insert_text(
                fitz.Point(p.x + sym["diameter"] / 2 + 0.5, p.y),
                sym["id"],
                fontsize=3.0,
                color=GREEN,
                fontname="helv",
            )


def cmd_tiles(args: argparse.Namespace) -> None:
    doc, page = _open_page(args.pdf_path, args.page)
    geo = _page_geometry(args.annotate, args.page)
    if geo:
        annotate(page, geo, set(args.show.split(",")))

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    rect = page.rect
    cols = args.cols
    rows = args.rows
    overlap = args.overlap
    tile_w = rect.width / cols
    tile_h = rect.height / rows

    index: list[dict[str, Any]] = []
    for r in range(rows):
        for c in range(cols):
            x0 = max(rect.x0 + c * tile_w - overlap, rect.x0)
            y0 = max(rect.y0 + r * tile_h - overlap, rect.y0)
            x1 = min(rect.x0 + (c + 1) * tile_w + overlap, rect.x1)
            y1 = min(rect.y0 + (r + 1) * tile_h + overlap, rect.y1)
            clip = fitz.Rect(x0, y0, x1, y1)
            pix = page.get_pixmap(dpi=args.dpi, clip=clip)
            name = f"tile_r{r + 1}c{c + 1}.png"
            pix.save(str(out_dir / name))
            index.append(
                {
                    "file": name,
                    "row": r + 1,
                    "col": c + 1,
                    "pdf_rect": [
                        round(x0, 2),
                        round(y0, 2),
                        round(x1, 2),
                        round(y1, 2),
                    ],
                    "pixels": [pix.width, pix.height],
                }
            )

    manifest = {
        "source_file": Path(args.pdf_path).name,
        "page": args.page,
        "page_size": [round(rect.width, 2), round(rect.height, 2)],
        "dpi": args.dpi,
        "grid": {"rows": rows, "cols": cols, "overlap_pt": overlap},
        "annotated": bool(geo),
        "annotations_shown": args.show if geo else None,
        "tiles": index,
    }
    (out_dir / "tiles.json").write_text(json.dumps(manifest, indent=2))
    doc.close()
    print(f"Wrote {len(index)} tiles to {out_dir} (manifest: {out_dir / 'tiles.json'})")
    for tile in index:
        print(
            f"  {tile['file']}  pdf_rect={tile['pdf_rect']}  {tile['pixels'][0]}x{tile['pixels'][1]}px"
        )


def cmd_region(args: argparse.Namespace) -> None:
    doc, page = _open_page(args.pdf_path, args.page)
    geo = _page_geometry(args.annotate, args.page)
    if geo:
        annotate(page, geo, set(args.show.split(",")))
    x0, y0, x1, y1 = (float(v) for v in args.rect.split(","))
    pix = page.get_pixmap(dpi=args.dpi, clip=fitz.Rect(x0, y0, x1, y1))
    pix.save(args.output)
    doc.close()
    print(
        f"Wrote {args.output} ({pix.width}x{pix.height}px) for pdf_rect=[{x0},{y0},{x1},{y1}]"
    )


def cmd_crops(args: argparse.Namespace) -> None:
    """Contact sheets of uncertain labels: many small crops, numbered, in one image."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise SystemExit(
            "ERROR: Pillow required for contact sheets. pip install pillow"
        )

    doc, page = _open_page(args.pdf_path, args.page)
    geo = _page_geometry(args.geometry, args.page)
    if geo is None:
        raise SystemExit("ERROR: --geometry is required for the crops subcommand")

    labels_by_id = {lb["id"]: lb for lb in geo["labels"]}
    if args.ids:
        wanted = [labels_by_id[i] for i in args.ids.split(",") if i in labels_by_id]
    else:
        wanted = [
            labels_by_id[item["id"]]
            for item in geo["review_queue"]
            if item["kind"] == "low_confidence_label" and item["id"] in labels_by_id
        ]
    wanted = [lb for lb in wanted if lb["orientation"] != "graphic"]
    if not wanted:
        print("No labels to crop.")
        return

    scale = args.dpi / 72.0
    pix = page.get_pixmap(dpi=args.dpi)
    full = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    pad = 3.0
    cell_h = args.cell_height
    cols = args.cols
    per_sheet = cols * args.rows
    manifest: list[dict[str, Any]] = []

    for sheet_no, start in enumerate(range(0, len(wanted), per_sheet), start=1):
        batch = wanted[start : start + per_sheet]
        rows = math.ceil(len(batch) / cols)
        cell_w = args.cell_width
        sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
        draw = ImageDraw.Draw(sheet)
        entries = []
        for i, lb in enumerate(batch):
            x0, y0, x1, y1 = lb["bbox"]
            box = (
                max(int((x0 - pad) * scale), 0),
                max(int((y0 - pad) * scale), 0),
                min(int((x1 + pad) * scale), full.width),
                min(int((y1 + pad) * scale), full.height),
            )
            crop = full.crop(box)
            if lb["orientation"] == "v":
                crop = crop.rotate(-90, expand=True)
            # Fit the crop into the cell, leaving a strip for the id caption.
            avail_w, avail_h = cell_w - 8, cell_h - 20
            ratio = min(
                avail_w / max(crop.width, 1), avail_h / max(crop.height, 1), 4.0
            )
            crop = crop.resize(
                (max(int(crop.width * ratio), 1), max(int(crop.height * ratio), 1))
            )
            cx = (i % cols) * cell_w
            cy = (i // cols) * cell_h
            sheet.paste(crop, (cx + 4, cy + 16))
            draw.rectangle(
                [cx, cy, cx + cell_w - 1, cy + cell_h - 1], outline="#cccccc"
            )
            draw.text(
                (cx + 4, cy + 3), f"{lb['id']}  ocr='{lb['raw_ocr']}'", fill="#0033cc"
            )
            entries.append(
                {
                    "id": lb["id"],
                    "cell": [i // cols + 1, i % cols + 1],
                    "bbox": lb["bbox"],
                    "raw_ocr": lb["raw_ocr"],
                    "current_text": lb["text"],
                    "confidence": lb["confidence"],
                }
            )
        name = f"labels_sheet{sheet_no:02d}.png"
        sheet.save(out_dir / name)
        manifest.append({"file": name, "count": len(batch), "labels": entries})

    (out_dir / "crops.json").write_text(json.dumps(manifest, indent=2))
    doc.close()
    print(
        f"Wrote {len(manifest)} contact sheet(s) covering {len(wanted)} labels to {out_dir}"
    )
    for sheet in manifest:
        print(f"  {sheet['file']}  {sheet['count']} labels")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tiled rendering for schematic vision verification"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("pdf_path", help="Path to the schematic PDF")
    common.add_argument("--page", type=int, default=1, help="Page number (default 1)")
    common.add_argument("--dpi", type=int, default=400, help="Render DPI (default 400)")
    common.add_argument(
        "--annotate", help="geometry.json from extract.py; draws extraction IDs"
    )
    common.add_argument(
        "--show",
        default="conductors,review,junctions,symbols",
        help="Comma list of annotation layers: conductors,review,junctions,symbols",
    )

    p_tiles = sub.add_parser("tiles", parents=[common], help="Overlapping tile grid")
    p_tiles.add_argument("-o", "--output", required=True, help="Output directory")
    p_tiles.add_argument("--rows", type=int, default=4)
    p_tiles.add_argument("--cols", type=int, default=4)
    p_tiles.add_argument(
        "--overlap", type=float, default=25.0, help="Tile overlap in PDF points"
    )
    p_tiles.set_defaults(func=cmd_tiles)

    p_region = sub.add_parser("region", parents=[common], help="Render one rectangle")
    p_region.add_argument("--rect", required=True, help="x0,y0,x1,y1 in PDF points")
    p_region.add_argument("-o", "--output", required=True, help="Output PNG path")
    p_region.set_defaults(func=cmd_region)

    p_crops = sub.add_parser("crops", help="Contact sheets of uncertain labels")
    p_crops.add_argument("pdf_path")
    p_crops.add_argument("--page", type=int, default=1)
    p_crops.add_argument("--dpi", type=int, default=600)
    p_crops.add_argument(
        "--geometry", required=True, help="geometry.json from extract.py"
    )
    p_crops.add_argument(
        "--ids", help="Comma-separated label ids (default: the review queue)"
    )
    p_crops.add_argument("-o", "--output", required=True, help="Output directory")
    p_crops.add_argument("--cols", type=int, default=6)
    p_crops.add_argument("--rows", type=int, default=10)
    p_crops.add_argument("--cell-width", type=int, default=300)
    p_crops.add_argument("--cell-height", type=int, default=70)
    p_crops.set_defaults(func=cmd_crops)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
