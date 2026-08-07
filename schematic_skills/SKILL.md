---
name: schematic-extraction
description: Extract the full netlist of an electrical schematic or wiring diagram PDF — components, terminals, nets, wires, cables and control logic — by combining deterministic vector extraction with tiled AI-vision verification, then emit a LightRAG custom knowledge graph. Use when a user needs a schematic indexed for troubleshooting, or asks what is connected to what on a drawing.
---

# Schematic Extraction Skill

Turn an electrical schematic PDF into an auditable netlist (`circuit_logic.json`) and then
into a LightRAG knowledge graph that can be queried for troubleshooting.

`references/HowToUseThisSkill.md` is the operator's guide to the same pipeline, written for
the human. Point the user at it when they ask how to run this themselves, what to tune, or
where output should go.

## Why this is not a vision-only task

Handing a whole D-size schematic to a vision model captures a small fraction of its ~50
components and ~150 conductors. The sheet is too dense, and a model asked to enumerate
everything at once will confidently return a partial answer.

So the work is split by what each method is actually good at:

- **Geometry is deterministic.** Which conductor touches which terminal is in the vector
  layer. A script recovers it completely, every time.
- **Interpretation needs eyes.** What a symbol *means*, whether a crossing is a junction,
  and what a garbled label actually says need a vision pass — but on **small tiles**, never
  on the whole sheet.
- **Completeness is a property of the script, not the model.** Nothing is silently dropped;
  every unresolved item lands in a review queue that the vision pass has to work through.

The knowledge graph is then injected with `ainsert_custom_kg`, bypassing LLM extraction
entirely. A schematic is a deterministic netlist; it should not be re-guessed by a model.

## Workflow

### Step 1: Extract geometry and labels

```bash
python <skill_dir>/scripts/extract.py drawing.pdf --layers SCHEMATIC -o geometry.json --pretty
```

Run `--stats-only` first for a fast look at the sheet. Useful flags:

- `--layers NAME` — restrict conductors to a PDF layer (OCG). Most CAD exports separate the
  schematic from the border/title block; check the `layers` block in the output.
- `--params '{"wire_min_len": 4}'` — retune for a different sheet size or text height.
- `--no-ocr` — geometry only, when you intend to read all text visually.

`extract.py` needs `pymupdf`; label OCR additionally needs the `tesseract` binary and
`pillow`. Without them it still produces full geometry and marks every label unread.

### Step 2: Read the stats block before trusting anything

```json
"stats": {
  "text_labels": 502, "labels_read": 431, "labels_low_confidence": 159,
  "conductors": 149, "conductors_with_net_label": 70,
  "junctions": 2, "nets": 111, "review_items": 278
}
```

What to check, in order:

| Symptom | Likely cause | Action |
|---|---|---|
| `has_embedded_text: false` | CAD stroke font — no real text in the PDF | Expected on plotted drawings. Every label came from OCR, so plan on a thorough vision pass. |
| `labels_low_confidence` is a large share of `text_labels` | Stroke font, small text | Normal. Work the contact sheets in Step 4. |
| `conductors_with_net_label` far below `conductors` | Labels not attaching | Check `label_attach_dy` against the pitch between parallel runs. |
| `junctions` implausibly high | Crossovers being read as junctions | Inspect them visually — a false junction merges two nets and produces confidently wrong answers. |
| `nets` ≈ `conductors` | Nets are not merging | Net labels were not read, or `build_nets` found no shared nodes. |

### Step 3: Look at the drawing, tile by tile

```bash
python <skill_dir>/scripts/render_tiles.py tiles drawing.pdf -o tiles/ \
    --annotate geometry.json --rows 4 --cols 4 --dpi 400 --overlap 30
```

Record the exact flags you used — see "Record the commands" below. The reference run for
`PS20115MLM4-2` used `--rows 4 --cols 4 --dpi 400 --overlap 30` and **no** `--annotate`;
re-running it with different flags produces different tile PNGs.

Tiles overlap so nothing is lost at a seam, and each is annotated with the IDs the
extraction assigned — conductors in red, uncertain labels boxed in blue, junctions and
device symbols in green. **View every tile.** For each one:

1. **Verify what the symbols are.** A large circle is a coil, lamp or meter — decide which.
   Read `references/schematic_conventions.md` §4.
2. **Check junctions and crossovers.** Confirm each green junction is a real connection.
3. **Check for conductors the script missed** — a run with no red ID on it.
4. **Read the descriptive legends.** Blocks like `CR-ON: MOD-LINX RUN / RUN SIGNAL TO CARDS
   / 1N.O.` are the authoritative statement of what a device does. They become the entity
   `description` and `function`.
5. **Note off-page references** — external drawing numbers, "previous machine", interfaces.

To go back to a specific area at higher magnification:

```bash
python <skill_dir>/scripts/render_tiles.py region drawing.pdf --rect 700,430,1000,530 \
    -o zoom.png --annotate geometry.json --dpi 500
```

### Step 4: Transcribe the uncertain labels

```bash
python <skill_dir>/scripts/render_tiles.py crops drawing.pdf --geometry geometry.json -o crops/
```

This builds numbered contact sheets of every low-confidence label — many crops in one image,
each captioned with its label ID and the raw OCR. It is **optional**: it is a convenience for
reading many uncertain labels at once, and nothing downstream consumes `crops/`. The
`PS20115MLM4-2` reference run did not use it — every label was read from the tiles and
targeted `region` zooms instead, which is why that drawing's output directory has no
`crops/`. View each sheet and transcribe what you actually see, citing IDs:

```
T0316: 24E-1   (OCR said "4E-1" — leading digit was clipped)
T0327: 110     (OCR said "10")
T0332: BLUE 18AWG
```

Numeric labels matter most: they carry net identity, and one wrong digit silently rewires
the graph. `references/schematic_conventions.md` §9 lists the recurring stroke-font misreads.

### Step 5: Write `author_circuit_logic.py`, which emits `circuit_logic.json`

Using the geometry as the connectivity backbone and your visual reading as the
interpretation, write the master artifact. Full field spec and a worked example:
`references/circuit_logic_schema.md`.

**Do not hand-write the JSON.** Write a generator script, `author_circuit_logic.py`, in the
output directory, and run it to produce `circuit_logic.json`. This is mandatory, for three
reasons: the derived edges cannot drift out of sync with the tables they come from; the
human readings stay in one small reviewable place instead of scattered through 200 KB of
JSON; and a correction becomes a one-line edit plus a re-run instead of a hand-patch.
A worked example is
`/home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py`.

Structure it in this order:

1. **Docstring** stating that the tables below are the *human-read* result of the vision pass
   over the tiles, cross-checked against `geometry.json`, and giving the re-run command.
2. **Literal tables** — `drawing`, `components`, `terminals`, `nets`, `wires`, `cables`,
   `subsystems` — transcribed from what you actually saw on the tiles.
3. **Derived edges**, generated by looping over those tables, never typed out:
   `HAS_TERMINAL`, `ON_NET`, `CONNECTS_TO`, `PART_OF`.
4. **Authored edges**, written explicitly because no netlist implies them: `POWERS`,
   `PROTECTS`, `ACTUATES`, `COIL_CONTROLS_CONTACT`, `GROUNDED_TO`, `REFERENCES`.
5. **Write** to `Path(__file__).parent / "circuit_logic.json"` — relative to the script, so a
   copy into another drawing's directory writes beside itself.

```bash
python <output_dir>/author_circuit_logic.py     # regenerates circuit_logic.json
```

This script is the only artifact in the pipeline that cannot be regenerated by a tool. It
holds the human readings. Tell the user to commit it to version control.

Two things the raw netlist does not contain and you must synthesise:

- **`ON_NET` edges** for *every* terminal on *every* net. A fault propagates across the whole
  net, not just one wire's two ends. Without these, "what is wire 110 connected to" returns
  two terminals instead of five.
- **`COIL_CONTROLS_CONTACT` edges** linking each relay's coil (`A1`/`A2`) to the contacts it
  operates (`11`/`12`/`14`), which are usually drawn far away on the sheet.

Also mandatory:

- Entity names are the drawing's **exact designators** (`CR-BP`). Plain-language names go in
  `aliases`. A troubleshooting manual indexed into the same working_dir merges onto these
  nodes only if the names match.
- Every entity and relationship gets a real prose `description`. Terse designators embed
  poorly, and the prose is what a query actually matches against.
- Off-page designators get a boundary entity and a `REFERENCES` edge, so the answer is
  "this continues on MXCS-P9" instead of a confident invention.

### Step 6: Build and validate the knowledge graph

```bash
python <skill_dir>/scripts/build_kg.py circuit_logic.json -o custom_kg.json \
    --pretty --validate --report
```

`--validate` refuses to write when the KG is structurally unsafe. It catches duplicate
entity names, relationships pointing at undefined entities (LightRAG would silently create
them as `UNKNOWN` placeholder nodes), entities whose `source_id` has no chunk, unknown
relationship types, and descriptions too short to embed usefully. The report warns loudly if
`ON_NET` or `COIL_CONTROLS_CONTACT` edges are missing entirely.

### Step 7: Index and query

```bash
python <skill_dir>/scripts/index_schematic.py custom_kg.json -w /path/to/work_dir --dry-run
python <skill_dir>/scripts/index_schematic.py custom_kg.json -w /path/to/work_dir
```

The embedding model must match everything else in that working directory
(`text-embedding-3-large`, dim 3072 for this project). Changing it means clearing vector
storage and re-indexing.

Index the machine's troubleshooting manual into the **same working_dir** with the ordinary
`ainsert` path. The two graphs merge on shared entity names — which is the whole reason
Step 5 insists on exact designators.

Query in **`hybrid` mode**.

### Step 8: The correction loop

When a query returns something wrong, fix the reading at its source and regenerate. Never
hand-patch `circuit_logic.json` or `custom_kg.json`.

```bash
# edit the offending entry in the tables at the top of author_circuit_logic.py, then:
python <output_dir>/author_circuit_logic.py
python <skill_dir>/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate --report
python <skill_dir>/scripts/index_schematic.py custom_kg.json -w /path/to/work_dir
```

Before editing, go back to the drawing: `tiles/tiles.json` maps every tile to its PDF
rectangle, so `render_tiles.py region --rect ...` gets you a high-magnification look at the
area in question. Record what changed and why in `EXTRACTION_NOTES.md`.

## Record the commands — mandatory

Every script here takes flags that change its output, and none of them writes the invoking
command line into its own output. `geometry.json` records the `params` dict but **not**
`--layers`, `--page` or `--no-ocr`; `tiles/tiles.json` records dpi, grid, overlap and whether
annotation was on, but not the source paths. So the only place the run is reconstructable
from is `EXTRACTION_NOTES.md`.

End `EXTRACTION_NOTES.md` with a verbatim, copy-pasteable block of every command you ran, in
order, including the ones you decided *not* to run:

```markdown
## Commands used (reproduction record)

Environment: PyMuPDF 1.27.2, tesseract 4.1.1, Python 3.x (venv at ...)

python <skill>/scripts/extract.py <pdf> --layers SCHEMATIC -o <out>/geometry.json --pretty
python <skill>/scripts/render_tiles.py tiles <pdf> -o <out>/tiles/ --rows 4 --cols 4 --dpi 400 --overlap 30
# crops: not run — labels were read from the tiles
python <out>/author_circuit_logic.py
python <skill>/scripts/build_kg.py <out>/circuit_logic.json -o <out>/custom_kg.json --pretty --validate --report
```

Without this block, a later run cannot be checked against the earlier one, because a
difference in the output is indistinguishable from a difference in the flags.

## Output layout

Everything for one drawing goes in one directory, with the input PDF and the generated files
kept apart. Nothing in this skill has a hardcoded destination, so state the output directory
explicitly and keep drawings separated:

```
<root>/schematic_extraction/<DRAWING_NUMBER>/
    source_docs/                     the input PDF(s) — never written to
    extracted_docs/
        geometry.json  tiles/  crops/  author_circuit_logic.py
        circuit_logic.json  custom_kg.json  EXTRACTION_NOTES.md
```

The worked example on this machine is
`/home/js/schematics/schematic_extraction/PS20115MLM4-2/`.

Reusing a directory for a second drawing silently overwrites all of it, including the one
irreplaceable file, `author_circuit_logic.py`.

## Accuracy risks

Ranked by how much damage they do:

1. **A junction that is really a crossover** merges two nets. Every downstream answer about
   either net is then confidently wrong. Confirm each one visually.
2. **A misread net designator** (`10` for `110`) silently rewires the graph. Numeric labels
   need the closest attention.
3. **Label-to-conductor mis-association.** Parallel runs sit ~10pt apart, so the spec below
   one run and the designator above the next occupy nearly the same band. `extract.py`
   assigns labels exclusively and gates by label kind, but dense areas still need checking.
4. **Missing `ON_NET` edges** turn a troubleshooting graph back into a bare wire list. This
   fails quietly — the query returns a plausible partial answer.
5. **Fragmented off-page nets** produce invented destinations instead of honest boundaries.

## Limitations

- **Scanned schematics.** With no vector layer there is no geometry to trace. This skill
  does not handle them; that needs raster line-following (OpenCV) or a trained symbol
  detector first.
- **Symbol identity.** The scripts report a circle's size and position, never what it is.
  Coil vs lamp vs meter is always a vision decision.
- **N.O. vs N.C. contacts** differ by a single short bar in the symbol. Read the terminal
  numbers (`11/14` = N.O., `11/12` = N.C.) as the cross-check.
- **Multi-sheet drawings.** Each page extracts independently; joining them across page
  boundaries via off-page designators is manual.
- **Domain facts that are not on the drawing.** A breaker wired as a manual switch looks
  exactly like a breaker used as protection. See `references/schematic_conventions.md` §7 —
  this specific trap exists on the Mod-Linx sheets.

## Scripts Reference

### extract.py
```bash
python extract.py drawing.pdf --stats-only                        # fast sanity check
python extract.py drawing.pdf --layers SCHEMATIC -o geo.json --pretty
python extract.py drawing.pdf --no-ocr -o geo.json                # geometry only
python extract.py drawing.pdf --params '{"label_attach_dy": 6}' -o geo.json
```

### render_tiles.py
```bash
python render_tiles.py tiles drawing.pdf -o tiles/ --annotate geo.json --rows 4 --cols 4
python render_tiles.py region drawing.pdf --rect 700,430,1000,530 -o zoom.png --dpi 500
python render_tiles.py crops drawing.pdf --geometry geo.json -o crops/
python render_tiles.py crops drawing.pdf --geometry geo.json --ids T0316,T0327 -o crops/
```

### build_kg.py
```bash
python build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate --report
```

### index_schematic.py
```bash
python index_schematic.py custom_kg.json -w /path/to/work_dir --dry-run
python index_schematic.py custom_kg.json -w /path/to/work_dir
```

## Example Prompts

**For a full extraction:**
> Extract the complete netlist from this schematic into <output_dir>. Run the geometry
> extraction, then review every tile visually and transcribe the low-confidence labels before
> writing author_circuit_logic.py. I want every net to list all of its member terminals.

**For a targeted question:**
> What is wire 110 connected to on this drawing? Extract the geometry, then zoom into the
> regions where net 110 appears and confirm each terminal it reaches.

**For indexing:**
> Build the LightRAG custom KG from circuit_logic.json, validate it, and index it into
> <work_dir>. Then query in hybrid mode to check the netlist survived.

**For answering questions without LightRAG:**
> Read `EXTRACTION_NOTES.md` and `circuit_logic.json` in <output_dir> and answer these
> questions about the drawing, citing the nets, terminals and wires you used.

Reading `circuit_logic.json` directly answers troubleshooting questions markedly better than
querying the indexed graph — see
`/home/js/schematics/_claude_notes/direct_file_query_test_PS20115MLM4-2.md`. Indexing is now
mainly for browsing the knowledge graph in the LightRAG WebUI.
