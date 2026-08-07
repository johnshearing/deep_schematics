# How To Use This Skill

Operator's guide to the `schematic-extraction` skill: what it produces, in what order, what
you do yourself, what needs Claude, and how to run it on a new drawing without destroying
previous work.

`SKILL.md` is written for Claude. This file is written for you.

**Everything now lives under `/home/js/schematics`:**

```
/home/js/schematics/
    schematic_skills/                       the skill (this file is in references/)
    schematic_extraction/<DRAWING>/
        source_docs/                        input PDF(s) — never written to
        extracted_docs/                     everything the skill produces
    _claude_notes/                          test reports and project notes
```

### Setting up the environment

The skill uses its own virtual environment at `/home/js/schematics/.venv`, so it depends on
nothing outside this project:

```bash
python3 -m venv /home/js/schematics/.venv
source /home/js/schematics/.venv/bin/activate
pip install pymupdf pillow numpy
```

That covers **steps 1–6**, which is the whole extraction pipeline. Label OCR additionally needs
the `tesseract` binary from your package manager (`apt install tesseract-ocr`) — without it
`extract.py` still produces full geometry and marks every label unread.

**Only step 7 (`index_schematic.py`) needs LightRAG**, because it imports `lightrag` to inject the
custom KG. Install it only if you are actually indexing:

```bash
pip install lightrag-hku
```

If you already have a LightRAG environment elsewhere and prefer to run step 7 from it, that works
too — the two halves of the pipeline communicate through `custom_kg.json` on disk, not through a
shared interpreter.

---

## 1. What the skill is for

LightRAG indexes prose well and schematics badly. Handing a D-size electrical drawing to a
vision model gets you a confident, partial answer — it will find maybe a third of the
components and quietly invent the rest.

This skill splits the job by what each method is actually good at:

- **Geometry is deterministic.** Which conductor touches which terminal is in the PDF's
  vector layer. A script recovers it completely, every time.
- **Interpretation needs eyes.** What a symbol *means*, whether a crossing circle is a
  junction or a crossover hop, what a stroked label actually says — those need a vision
  pass, on small tiles, never on the whole sheet.
- **Completeness is a property of the script, not the model.** Nothing is silently dropped.

The end product is `circuit_logic.json`: a complete, auditable netlist of the drawing.

### Two ways to use the result

1. **Ask Claude Code directly.** Point it at `circuit_logic.json` and `EXTRACTION_NOTES.md`
   and ask troubleshooting questions. This is now the primary path — it substantially
   out-performed querying the indexed graph. Report:
   `/home/js/schematics/_claude_notes/direct_file_query_test_PS20115MLM4-2.md`.
2. **Index into LightRAG** (`custom_kg.json` via `ainsert_custom_kg`, which bypasses LLM
   entity extraction entirely). Now used mainly for *viewing* the knowledge graph in the
   LightRAG WebUI rather than for answering questions. See §8.

---

## 2. The pipeline and its artifacts

### 2.1 Order of creation

Read this chart as: to make row *N*'s output you need row *N*'s inputs, which the earlier
rows produced. The numbers are **artifacts in creation order**, and are used consistently
throughout this file — they are not the same as `SKILL.md`'s step numbers, which count
instructions to Claude rather than files. `<DWG>` is the drawing directory, e.g.
`/home/js/schematics/schematic_extraction/PS20115MLM4-2`; all outputs land in
`<DWG>/extracted_docs/`.

| # | Output file(s) | Required inputs | Produced by | Who runs it | Edit it? |
|---|---|---|---|---|---|
| 1 | `geometry.json` | `<DWG>/source_docs/<drawing>.pdf` | `schematic_skills/scripts/extract.py` (+ `tesseract`, `pillow`) | script — you or Claude | **No** — regenerate |
| 2 | `tiles/tile_r*c*.png` (16) and `tiles/tiles.json` | the PDF; optionally `geometry.json` when `--annotate` is used | `schematic_skills/scripts/render_tiles.py tiles` | script — you or Claude | **No** — regenerate |
| 3 | `crops/labels_sheet*.png`, `crops/crops.json` — **optional, not produced for `PS20115MLM4-2`** | the PDF **and** `geometry.json` | `schematic_skills/scripts/render_tiles.py crops` | script — you or Claude | **No** — regenerate |
| 3b | ad-hoc zoom PNGs (throwaway, not kept in the directory) | the PDF; optionally `geometry.json`; a rect from `tiles/tiles.json` | `schematic_skills/scripts/render_tiles.py region` | script — you or Claude | n/a |
| 4 | `author_circuit_logic.py` | `tiles/*.png` **read visually**, `geometry.json`, zooms, `references/schematic_conventions.md`, `references/circuit_logic_schema.md` | **Claude, by hand** — the vision pass | **Claude only** | **Yes — this is the one you maintain** |
| 5 | `circuit_logic.json` | `author_circuit_logic.py` only | `python <DWG>/extracted_docs/author_circuit_logic.py` | script — either | **No** — regenerate from #4 |
| 6 | `custom_kg.json` | `circuit_logic.json` | `schematic_skills/scripts/build_kg.py` | script — you or Claude | **No** — regenerate |
| 7 | `EXTRACTION_NOTES.md` | everything above, plus Claude's judgement and your domain corrections | **Claude, by hand** | Claude | Yes — it is documentation |
| 8 | LightRAG working directory (not in `extracted_docs/`) | `custom_kg.json`, an OpenAI API key | `schematic_skills/scripts/index_schematic.py` | script — you or Claude | n/a |

As a flow:

```
source_docs/<drawing>.pdf
   ├─(1 extract.py)──────────────► geometry.json
   │                                   │
   ├─(2 render_tiles.py tiles)◄────────┤ (only if --annotate)
   │        └──────────────────────► tiles/*.png + tiles/tiles.json
   │                                   │
   └─(3 render_tiles.py crops)◄────────┘
            └─────────────────────► crops/*.png + crops/crops.json   [optional]
                                        │
   (4) CLAUDE reads tiles + crops + geometry.json  (the vision pass)
                                        │
                                        ▼
                             author_circuit_logic.py   ◄── the only irreplaceable file
                                        │ (5) python author_circuit_logic.py
                                        ▼
                                circuit_logic.json  ──────► answer questions directly
                                        │ (6) build_kg.py
                                        ▼
                                  custom_kg.json  ────────► (8) index_schematic.py ──► LightRAG
```

**The file you index into LightRAG is `custom_kg.json`.** Not the PDF, not
`circuit_logic.json`.

**The file you correct when an answer is wrong is `author_circuit_logic.py`.** Then re-run
it, rebuild, re-index. Never hand-edit the JSON — it will drift out of sync with its own
derived edges.

### 2.2 The correction loop

```bash
# 1. fix the misreading in the tables at the top of author_circuit_logic.py
python author_circuit_logic.py                       # regenerates circuit_logic.json
python <skill>/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate --report
python <skill>/scripts/index_schematic.py custom_kg.json -w <work_dir>     # only if indexing
```

---

## 3. Reproducing an existing extraction exactly

### 3.1 Is the pipeline deterministic?

**Steps 5 and 6 are, exactly and provably.** Re-running `author_circuit_logic.py` and
`build_kg.py` reproduces `circuit_logic.json` and `custom_kg.json` **byte for byte**, from any
directory. Verified 2026-08-04 by regenerating both in a scratch directory and diffing
against the stored copies: no differences. `build_kg.py` writes the *filename*
(`circuit_logic.json`), never a path, into every chunk, entity and relationship, so moving
the drawing directory changes nothing.

**Steps 1–3 are deterministic in their algorithm but not in their environment.** They will
reproduce provided four things hold:

| Requirement | Why | Status for `PS20115MLM4-2` |
|---|---|---|
| Identical PDF bytes | Everything derives from it | ✅ `md5 59b25be552fa2937fa3c39430fce890c`, unchanged by the move |
| Identical command-line flags | `--layers`, `--dpi`, `--overlap`, `--annotate` and `--params` all change the output, and most are not recorded in it | ✅ recovered and written down in §3.2 |
| Same PyMuPDF version | It rasterises the page for OCR (step 1) and renders the tile PNGs (step 2); a MuPDF change alters the pixels | ⚠️ project venv is now 1.28.2; extraction-time version was not recorded (1.27.2 when this was written) |
| Same tesseract version | It reads those rasters into `raw_ocr`, which feeds label text, label `kind`, net-label attachment and the review queue | ⚠️ 4.1.1 — matches extraction time, but see below: **matching it is still not sufficient** |

Nothing inside the scripts is random or order-dependent: no `random`, no hashing of strings
into ordered structures, and every set iteration is either sorted or provably single-element.

**But the OCR is not reproducible, and the four requirements above are not sufficient.**
This paragraph previously claimed the whole of steps 1–3 was reproducible given a fixed
environment. That was wrong, and it was measured wrong on 2026-08-07.

Six full runs of `extract.py` on the same machine, same PDF, same flags, same code and the
**same tesseract 4.1.1** — the version used for the original extraction, so this is not
version drift — disagree with one another:

| Configuration | Two consecutive runs agree? |
|---|---|
| As shipped (`workers=8`) | No — 29 differing lines |
| `OMP_THREAD_LIMIT=1` | No — 7 differing lines |
| `OMP_THREAD_LIMIT=1` **and** `workers=1` | **No** — still differs |

Serialising the OCR reduces the variance but never removes it, so the source is tesseract
itself rather than this script's thread pool. Suppressing threading is not a fix.

**What is stable.** All deterministic geometry is identical on every run — 149 conductors,
111 nets, 2 junctions, 29 boxes, 502 text labels, 431 read. The vector layer, the conductor
tracing and the net topology reproduce exactly. That half of the claim holds.

**What varies.** Only OCR-derived fields: `text`, `confidence`, `label_text`, `net_label` and
net `id`. Nearly every difference is an `O`/`0`/`D` confusion — `DISCONNECT` vs `DISC0NNECT`,
`STOP` vs `ST0P`, `SPEED` vs `SPEEO`.

**This is not purely cosmetic.** The confusion reaches identifiers. Two runs minutes apart
produced:

```
net_label: "SPD"   vs   net_label: "SPO"
id:        "SPD"   vs   id:        "SPO"
```

— the speed-controller net, carrying a different `id` depending on the run.

**Why this is tolerable here.** For `PS20115MLM4-2` the PDF contains no selectable text at
all, so *every* label in `circuit_logic.json` was read visually from the tiles;
`EXTRACTION_NOTES.md` records the OCR in `geometry.json` as a cross-check only. Nothing
downstream consumes these fields, so the master artifact does not inherit the variance —
which is exactly why steps 5 and 6 still diff clean byte for byte.

**Treat `geometry.json`'s OCR as a hint, never as evidence.** If you need a label to be
right, read it off the tile. If you ever make a net `id` depend on OCR text, that identifier
becomes run-dependent.

**One line of `geometry.json` will differ no matter what.** `extract.py` records
`source_path` as the *absolute resolved* path of the input PDF. It currently reads
`/home/js/LightRAG-Dev/jrs/work/mod_linx/mod_linx_data/PS20115MLM4-2.pdf`; a re-run from the
new location will write
`/home/js/schematics/schematic_extraction/PS20115MLM4-2/source_docs/PS20115MLM4-2.pdf`. That
is metadata, not data — no downstream script reads it. Everything else in the file should be
identical **except the OCR fields described above**, which will differ on every run.

So: **your expectation is right for the second half of the pipeline, half right for the
first.** Steps 5 and 6 are byte-for-byte reproducible; steps 1–3 reproduce their geometry
exactly but not their OCR. The one place it is genuinely wrong is step 4.

### 3.2 The exact commands that produced `PS20115MLM4-2/extracted_docs`

Recovered from `geometry.json` (`params` block, all defaults), `tiles/tiles.json` (dpi 400,
4×4, 30 pt overlap, `"annotated": false`), `EXTRACTION_NOTES.md` (`--layers SCHEMATIC`) and
the absence of a `crops/` directory.

```bash
source /home/js/schematics/.venv/bin/activate

SKILL=/home/js/schematics/schematic_skills
DWG=/home/js/schematics/schematic_extraction/PS20115MLM4-2
PDF=$DWG/source_docs/PS20115MLM4-2.pdf
OUT=$DWG/extracted_docs

# 1 — geometry (all tunable params left at their defaults)
python $SKILL/scripts/extract.py "$PDF" --layers SCHEMATIC -o "$OUT/geometry.json" --pretty

# 2 — tiles. NOTE: --overlap 30 is NOT the script default (25), and --annotate was NOT used
python $SKILL/scripts/render_tiles.py tiles "$PDF" -o "$OUT/tiles/" \
    --rows 4 --cols 4 --dpi 400 --overlap 30

# 3 — crops: NOT RUN for this drawing. Labels were read from the tiles and targeted
#     `region` zooms. Running it now would add a crops/ directory that is not currently there.

# 4 — the vision pass. Already done; its result is $OUT/author_circuit_logic.py

# 5 — circuit_logic.json  (byte-identical, guaranteed)
python "$OUT/author_circuit_logic.py"

# 6 — custom_kg.json  (byte-identical, guaranteed)
python $SKILL/scripts/build_kg.py "$OUT/circuit_logic.json" -o "$OUT/custom_kg.json" \
    --pretty --validate --report
```

Expected `build_kg.py` report: 693 chunks, 291 entities, 402 relationships; one informational
note about 4 terminals with no net (`DISC1:L2`, `DISC1:T2`, `LT1:BROWN`, `LT1:WHITE`).

If you want to check reproduction without risking the originals, send the output somewhere
else and diff:

```bash
mkdir -p /tmp/repro && cp "$OUT/author_circuit_logic.py" /tmp/repro/
python $SKILL/scripts/extract.py "$PDF" --layers SCHEMATIC -o /tmp/repro/geometry.json --pretty
python /tmp/repro/author_circuit_logic.py
python $SKILL/scripts/build_kg.py /tmp/repro/circuit_logic.json -o /tmp/repro/custom_kg.json --pretty --validate
diff /tmp/repro/circuit_logic.json "$OUT/circuit_logic.json"      # expect: no output
diff /tmp/repro/custom_kg.json     "$OUT/custom_kg.json"          # expect: no output
diff /tmp/repro/geometry.json      "$OUT/geometry.json"           # expect: only source_path
```

### 3.3 Step 4 is not reproducible, and cannot be

`author_circuit_logic.py` is written by Claude from what it *sees* on sixteen tile images.
Ask a fresh session to redo the vision pass and you will get a correct netlist, but not the
same file: different prose in the descriptions, possibly different wire IDs, possibly a
different judgement call on one of the inferences listed in `EXTRACTION_NOTES.md`
(receptacle pin numbering, terminal-block point counts, how many points `TB-0V` has). Since
`circuit_logic.json` and `custom_kg.json` are generated from it, those would differ too.

**That is why `author_circuit_logic.py` is the file you keep.** It is not a cache of a
reproducible computation; it is the recorded output of human judgement. Keep it, commit it,
and re-run it — never regenerate it from scratch when you only wanted the same answer again.

The scripts have no hardcoded paths, so the move to `/home/js/schematics` broke nothing. Only
documentation referred to the old locations, and that has been updated.

---

## 4. Tunable parameters — what and where

### Where they live

The defaults are the `DEFAULTS` dict at **`scripts/extract.py:57`**. **Do not edit that
dict** — editing it silently changes the output of every past drawing you re-run. Override
per-drawing on the command line instead, so the skill stays reusable and the values you
actually used are recorded in the `params` block of the resulting `geometry.json`:

```bash
python extract.py drawing.pdf --params '{"wire_min_len": 4, "label_attach_dy": 6}' -o geometry.json
```

The one you'll reach for most is not in that dict at all:

```bash
python extract.py drawing.pdf --layers SCHEMATIC -o geometry.json --pretty
```

`--layers` restricts conductor detection to a named PDF layer (OCG). Most CAD exports put
the border, title block and revision notes on separate layers; without this flag the title
block's ruled lines become phantom conductors. Run `--stats-only` first and read the
`layers` block to see what the drawing actually has. `PS20115MLM4-2` has
`{0: 183, FORMAT: 157, SCHEMATIC: 6166, REVNOTE: 92}` — `SCHEMATIC` is obviously the one.

**`--layers` is not written into `geometry.json`.** Neither is `--page` or `--no-ocr`. Put
them in `EXTRACTION_NOTES.md` (see §7).

### The parameters worth knowing

| Parameter | Default | Change it when |
|---|---|---|
| `label_attach_dy` | 8.5 | **Most common tune.** Vertical search distance for the net label above / spec label below a conductor run. Must stay *below* the pitch between adjacent parallel runs, or a wire steals its neighbour's label. Symptom: `conductors_with_net_label` far below `conductors`, or labels attached to the wrong wire. Tighter drawing → lower it (6); airier drawing → raise it (11). |
| `wire_min_len` | 6.0 | A conductor segment must be at least this long. Lower it (3–4) on a B-size sheet or a dense drawing where short jumpers between adjacent terminals are being dropped. Raise it if glyph fragments are being counted as conductors. |
| `glyph_max_len` | 8.0 | Strokes shorter than this are treated as parts of letters, not wires. Raise it if the drawing uses a large text height and letter strokes are showing up as conductors; lower it if genuine short wires are vanishing. |
| `terminal_dot_max_dia` | 5.0 | Circles at or below this diameter are terminal points, larger ones are devices. Raise it if small relay coils are being classed as terminals; lower it if terminal dots are being reported as device circles. Check `symbols_terminal_points` vs `symbols_device_circles` in the stats. |
| `endpoint_bind_radius` | 7.0 | How close a conductor endpoint must be to a symbol or terminal-number label to bind to it. Raise slightly if wires aren't landing on terminals; raise too far and a wire binds to the wrong adjacent terminal. |
| `node_snap` | 0.35 | Endpoints closer than this are the same node. Raise to ~1.0 for a sloppy export where wires don't quite meet. Symptom: `nets` ≈ `conductors`, i.e. nothing is merging. Raise it too far and separate nets fuse — dangerous. |
| `text_max_height` | 12.0 | Clusters taller than this are graphics, not text. Raise for a drawing with a large title-block font. |
| `ortho_tol` | 0.25 | Deviation allowed when calling a segment horizontal or vertical. Raise for a hand-drawn or rotated-export drawing with slightly skewed runs. |
| `word_gap_ratio` | 1.45 | Horizontal gap (as a multiple of glyph height) at which two glyphs stop being one word. Lower it if `BLUE 18AWG` merges with the label next to it; raise it if single words are splitting. |
| `line_band` | 2.5 | Vertical tolerance for "same text line". Raise for a drawing with wobbly baselines. |
| `glyph_cell` | 1.2 | Union-find cell size when clustering strokes into glyphs. Rarely needs touching. |
| `ocr_dpi` / `ocr_pad` | 600 / 2.5 | Raster DPI and padding for OCR crops. Raise `ocr_dpi` to 800 for very small text. Irrelevant if the PDF has real embedded text or you pass `--no-ocr`. |

`render_tiles.py` has its own flags rather than a params dict: `--rows`, `--cols`
(default 4×4 — go to 5×5 or 6×6 for an E-size sheet), `--overlap` (**script default 25 pt;
`PS20115MLM4-2` was rendered with 30**), `--dpi` (default 400), and `--annotate geometry.json`.

### How to know a parameter needs changing

Run this first, always:

```bash
python extract.py drawing.pdf --stats-only
```

Then read the stats block **before trusting anything downstream**:

| Symptom | Likely cause | Action |
|---|---|---|
| `has_embedded_text: false` | CAD stroke font — no real text in the PDF | Expected on plotted drawings. Every label came from OCR; plan on a thorough vision pass. |
| `labels_low_confidence` a large share of `text_labels` | Stroke font, small text | Normal. Work the contact sheets (`render_tiles.py crops`). |
| `conductors_with_net_label` ≪ `conductors` | Labels not attaching | Tune `label_attach_dy`. |
| `junctions` implausibly high | Crossovers read as junctions | Inspect visually. A false junction merges two nets and produces confidently wrong answers. |
| `nets` ≈ `conductors` | Nets not merging | Net labels unread, or `node_snap` too tight. |
| Conductor count wildly high | Border/title block included | Use `--layers`. |
| Near-zero `conductor_segments` on a drawing that obviously has wires | It's a scan, not a vector PDF | Out of scope — see §10. |

`PS20115MLM4-2` reference stats, for calibration:
`glyph_strokes: 17546, glyph_clusters: 881, text_labels: 502, labels_read: 431,
labels_low_confidence: 159, conductor_segments: 360, conductors: 149,
conductors_with_net_label: 70, conductors_with_spec_label: 67, junctions: 2, boxes: 29,
symbols_terminal_points: 88, symbols_device_circles: 10, nets: 111, nets_labelled: 34,
review_items: 278`.

Note `nets: 111` from geometry versus **26** in the finished `circuit_logic.json` — the
vision pass merged them. That gap is normal and is exactly the value the human step adds.

---

## 5. Can you do this yourself, or do you need Claude?

**Both.** The pipeline is deliberately split.

**You can run alone** — pure scripts, no model:

- Step 1 `extract.py` — geometry
- Step 2 `render_tiles.py` — tiles, zooms, crops
- Step 5 running `author_circuit_logic.py` (once it exists)
- Step 6 `build_kg.py` — validation and KG build
- Step 8 `index_schematic.py` — indexing
- Any correction to `author_circuit_logic.py` where you already know the right answer

**Claude must do** — needs vision and judgement:

- Viewing all 16+ tiles and deciding what each symbol is (coil vs lamp vs meter)
- Distinguishing a junction from a crossover hop arc
- Transcribing low-confidence labels
- **Writing `author_circuit_logic.py`** — the component/terminal/net/wire tables
- Synthesising `ON_NET` and `COIL_CONTROLS_CONTACT` edges
- Writing the prose descriptions that a query actually matches against
- Writing `EXTRACTION_NOTES.md`

So the realistic workflow for a new drawing is: **ask Claude Code**, and let it drive the
scripts. You take over for re-runs, corrections and re-indexing. There is no way to skip the
Claude step and get a usable netlist — the vision pass *is* the skill.

### How a new session knows to write `author_circuit_logic.py`

Because **`SKILL.md` Step 5 tells it to.** This is worth knowing about, because it was
briefly not true. The first Mod-Linx session invented the generator-script pattern on the fly
and did not write it back into the skill — Step 5 said only "write `circuit_logic.json`". A
fresh session reading that would have hand-written 200 KB of JSON directly, losing the
derived-edge guarantee and the provenance trail, and the correction loop in §2.2 would not
have existed.

Step 5 was amended on 2026-07-27 to mandate the pattern, specify the five-part structure
(docstring → literal tables → derived edges → authored edges → write), and point at the
`PS20115MLM4-2` script as the worked example. Step 8 (correction loop) and the output-layout
section were added at the same time. The "record the commands" mandate was added 2026-08-04.

**The general lesson:** when a session invents a technique that turns out to matter, it has
to be written back into `SKILL.md` or it is lost. If you notice a good practice from one run
missing from the skill, say so — that's a skill bug, not a documentation nicety.

### Installing the skill so Claude can find it

The skill lives at `/home/js/schematics/schematic_skills/` and is **not installed** as a
Claude Code skill — there is no `.claude/skills/` entry for it, so Claude will not
auto-discover it by description. Two options:

**A. Point at it explicitly** (works today, no setup):

> Read /home/js/schematics/schematic_skills/SKILL.md and follow it to extract the netlist
> from `<pdf>`.

**B. Install it properly** so it triggers on its own:

```bash
# available in every project:
ln -s /home/js/schematics/schematic_skills \
      /home/js/.claude/skills/schematic-extraction

# or scoped to this directory only:
mkdir -p /home/js/schematics/.claude/skills
ln -s /home/js/schematics/schematic_skills \
      /home/js/schematics/.claude/skills/schematic-extraction
```

The link name must match the `name:` field in `SKILL.md`'s frontmatter
(`schematic-extraction`).

---

## 6. Output locations — nothing is hardcoded

**Every script writes wherever you tell it to.** All output paths are explicit `-o` /
`--output` / `-w` arguments. There is no built-in destination.

The **one** exception: `author_circuit_logic.py` contains

```python
OUT = Path(__file__).parent / "circuit_logic.json"
```

which is relative to *its own location*. Copy it into a new directory and it writes there.
That is the behaviour you want, but it means a copied script writes next to itself, not next
to where you ran it from.

### The convention

One directory per drawing, input and output separated:

```
/home/js/schematics/schematic_extraction/<DRAWING_NUMBER>/
    source_docs/
        <DRAWING_NUMBER>.pdf
    extracted_docs/
        geometry.json
        tiles/
        crops/                    (optional)
        author_circuit_logic.py
        circuit_logic.json
        custom_kg.json
        EXTRACTION_NOTES.md
```

`PS20115MLM4-2/` follows this exactly. `ModLinx/` holds three source PDFs but uses
`source_docs/` with a hyphen and has an empty `extracted_docs/`; rename it to `source_docs`
if you want the layout uniform before running that batch. Note also that
`ModLinx/source_docs/PS20115MLM4-2.pdf` is byte-identical to the one already extracted —
extracting it a second time under the `ModLinx` name would produce a duplicate, and if both
were indexed into one working directory their entities would merge (see §8).

**When you ask Claude to process a new drawing, state the output directory in your prompt.**
Left unspecified it may well reuse the `PS20115MLM4-2` path, because that's the example it
can see.

### Everything that would be clobbered

`geometry.json`, `tiles/*`, `crops/*`, `author_circuit_logic.py`, `circuit_logic.json`,
`custom_kg.json`, `EXTRACTION_NOTES.md` — all of them. `author_circuit_logic.py` is the
painful one: it's the only place the human readings live, and it cannot be regenerated by a
script. **Commit it to git before starting another drawing.**

---

## 7. Running a new drawing, start to finish

**This is a reference listing, not a shell script to run.** You can't run it end to end —
step 4 in the middle is the vision pass, and no shell can do it. It's here so you can see the
whole pipeline at once, and so you can run any individual step yourself when you need to.

**In practice you prompt Claude**, giving it three things: where the skill is, which PDF, and
where the output goes. Claude then drives the scripts itself.

### Activate the virtual environment first

`ModuleNotFoundError: No module named 'fitz'` means you're on the system Python rather than in
the venv:

```bash
source /home/js/schematics/.venv/bin/activate
```

`No module named 'lightrag'` means something different: you're in the venv, but LightRAG isn't
installed there. It's needed only for step 7 — `pip install lightrag-hku`.

### The listing

```bash
SKILL=/home/js/schematics/schematic_skills
DWG=/home/js/schematics/schematic_extraction/<DRAWING_NO>
PDF=$DWG/source_docs/<DRAWING_NO>.pdf
OUT=$DWG/extracted_docs
mkdir -p "$OUT"

# 0. sanity check — read the stats and the layers block
python $SKILL/scripts/extract.py "$PDF" --stats-only

# 1. full geometry, restricted to the schematic layer
python $SKILL/scripts/extract.py "$PDF" --layers SCHEMATIC -o "$OUT/geometry.json" --pretty

# 2. tiles for the vision pass
python $SKILL/scripts/render_tiles.py tiles "$PDF" -o "$OUT/tiles/" \
    --annotate "$OUT/geometry.json" --rows 4 --cols 4 --dpi 400 --overlap 30

# 3. contact sheets of the low-confidence labels (optional)
python $SKILL/scripts/render_tiles.py crops "$PDF" \
    --geometry "$OUT/geometry.json" -o "$OUT/crops/"

# --- 4. CLAUDE: view every tile and every crop sheet, then write
#        $OUT/author_circuit_logic.py ---

# 5. run it — produces circuit_logic.json beside itself
python "$OUT/author_circuit_logic.py"

# 6. build and validate the KG
python $SKILL/scripts/build_kg.py "$OUT/circuit_logic.json" -o "$OUT/custom_kg.json" \
    --pretty --validate --report

# 7. CLAUDE: write $OUT/EXTRACTION_NOTES.md, ending with a verbatim record of
#    every command above, so the run can be reproduced and audited later.

# 8. index — dry run first (only if you want the graph in the WebUI)
python $SKILL/scripts/index_schematic.py "$OUT/custom_kg.json" -w <work_dir> --dry-run
python $SKILL/scripts/index_schematic.py "$OUT/custom_kg.json" -w <work_dir>
```

**Write the commands down.** None of the scripts records its own command line, and several
flags that change the output (`--layers`, `--overlap`, `--annotate`, `--dpi`) are either
absent from the output or easy to misremember. `EXTRACTION_NOTES.md` is the only place the
run survives; `SKILL.md` now requires a "Commands used (reproduction record)" section there.

---

## 7b. Ready-to-paste prompts

Start the session in `/home/js/schematics`.

### Full extraction of a new drawing

The general form. Substitute the PDF path and the output directory:

> Read `/home/js/schematics/schematic_skills/SKILL.md` and
> `references/HowToUseThisSkill.md`, then follow the skill to extract the complete netlist
> from `<path/to/drawing.pdf>`.
>
> Put all output in
> `/home/js/schematics/schematic_extraction/<DRAWING_NO>/extracted_docs/`.
>
> Run `--stats-only` first and show me the stats and layers block before going further. Then
> review every tile visually and transcribe the low-confidence labels before writing
> `author_circuit_logic.py`. Pay particular attention to junction-vs-crossover — on
> `PS20115MLM4-2` all 88 small circles were classified as terminal points and most were
> crossover hops. I want every net to list all of its member terminals.
>
> End `EXTRACTION_NOTES.md` with the exact commands you ran.
>
> Stop after `build_kg.py --validate --report` and show me the report.
> I want to inspect the output files and do the indexing myself after the inspection.

Worked example, for the second Mod-Linx drawing:

> Read `/home/js/schematics/schematic_skills/SKILL.md` and
> `references/HowToUseThisSkill.md`, then follow the skill to extract the complete netlist
> from `/home/js/schematics/schematic_extraction/ModLinx/source_docs/PS10115MLC2-2.pdf`.
>
> Put all output for this drawing in
> `/home/js/schematics/schematic_extraction/PS10115MLC2-2/extracted_docs/`, and copy the PDF
> into `.../PS10115MLC2-2/source_docs/` first so the drawing directory is self-contained.
>
> Run `--stats-only` first and show me the stats and layers block before going further. Then
> review every tile visually and transcribe the low-confidence labels before writing
> `author_circuit_logic.py`. Pay particular attention to junction-vs-crossover: on
> `PS20115MLM4-2` all 88 small circles were classified as terminal points and most were
> crossover hops. I want every net to list all of its member terminals.
>
> End `EXTRACTION_NOTES.md` with the exact commands you ran.
>
> Stop after `build_kg.py --validate --report` and show me the report. Don't index into
> LightRAG. I want to inspect the output files and do the indexing myself.

Why each clause earns its place:

| Clause | What it prevents |
|---|---|
| Naming `SKILL.md` by path | Works whether or not the skill is installed as a symlink (§5). |
| A fresh output directory | Protects `author_circuit_logic.py`, the one irreplaceable file. |
| `--stats-only` checkpoint | Catches a wrong `--layers` before an hour of tile reading is wasted. |
| The junction-vs-crossover note | Carries the hardest-won lesson from the first run into the new session. |
| "every net lists all its member terminals" | Forces the `ON_NET` edges; without them the graph is a bare wire list. |
| "end with the exact commands" | Makes the run reproducible and auditable (§3). |
| Stop before indexing | Keeps the working-directory decision (§8) yours, and it's hard to undo. |

If the drawing turns out to be another sheet of the *same* panel, replace the last paragraph
with: *"Then index into `<work_dir>` and query in hybrid mode to check the netlist survived."*

### Sanity check only, before committing to a full run

> Run `schematic_skills/scripts/extract.py --stats-only` on `<pdf>` and tell me whether this
> drawing is a good candidate for the skill — check for a vector layer, which OCG holds the
> schematic, and whether any parameters need tuning off the defaults.

### Asking questions about an already-extracted drawing (the recommended path)

> Read `/home/js/schematics/schematic_skills/SKILL.md`, then read
> `/home/js/schematics/schematic_extraction/<DRAWING_NO>/extracted_docs/EXTRACTION_NOTES.md`
> and `circuit_logic.json` in the same directory, and answer the following questions about
> the drawing. Cite the nets, terminals and wires you used for each answer, and say so
> explicitly when the drawing cannot settle a question.

See `/home/js/schematics/_claude_notes/direct_file_query_test_PS20115MLM4-2.md` for how this
performed against the question set in §12.

### Correcting a wrong answer

> `<query>` gave me `<wrong answer>`; the drawing actually shows `<what you know is true>`.
> Go back to the tiles for
> `/home/js/schematics/schematic_extraction/<DRAWING_NO>/extracted_docs/`, confirm what's on
> the sheet, then fix the reading in `author_circuit_logic.py`, re-run it and rebuild the KG.
> Record the correction in `EXTRACTION_NOTES.md`.

### Indexing an already-extracted drawing

> Index
> `/home/js/schematics/schematic_extraction/<DRAWING_NO>/extracted_docs/custom_kg.json` into
> `<work_dir>` using `schematic_skills/scripts/index_schematic.py`. Dry-run first. Then query
> in hybrid mode to confirm the netlist survived — ask what net 110 connects to and check it
> lists every member terminal.

---

## 8. LightRAG indexing notes

Indexing is now optional. It is what puts the schematic into the **LightRAG WebUI's knowledge
graph viewer**; for answering questions, reading `circuit_logic.json` directly beats querying
the index (§1).

- **Index `custom_kg.json`**, via `index_schematic.py`, which uses `ainsert_custom_kg`. The
  graph goes in exactly as built; LightRAG runs no entity extraction over it.
- **Embedding model must match the working directory.** `text-embedding-3-large`, dim 3072
  for this project. Overridable via `EMBEDDING_MODEL` / `EMBEDDING_DIM` env vars, but
  changing it means clearing vector storage and re-indexing *everything* in that directory.
- **Index the machine's troubleshooting manual into the SAME working_dir**, through the
  ordinary `ainsert` path. The two graphs merge on shared entity names — which is the entire
  reason the schematic must use the drawing's exact designators (`CR-BP`) as entity names,
  with plain-language names in `aliases`.
- **Query in `hybrid` mode.**
- `--dry-run` validates without writing. Always run it first.
- `--doc-id` defaults to the KG filename. Give distinct drawings distinct doc-ids if you're
  putting several into one working directory.
- `LightRAG` must have `await rag.initialize_storages()` and `initialize_pipeline_status()`
  called after construction, and `finalize_storages()` at the end. `index_schematic.py`
  already does all three; any script you write yourself must too. Forgetting is the single
  most common LightRAG failure.

### Verified `ainsert_custom_kg` field requirements

Checked against `lightrag/lightrag.py` (`ainsert_custom_kg`). `build_kg.py` satisfies all of
this; the table matters if you ever hand-build a KG.

| Section | Field | Requirement |
|---|---|---|
| `chunks[]` | `content` | required |
| | `source_id` | required — the join key entities and relationships reference |
| | `file_path` | optional (default `"custom_kg"`) |
| | `chunk_order_index` | optional (default 0) |
| `entities[]` | `entity_name` | required — becomes the graph node id, so use canonical designators |
| | `entity_type` | optional (default `"UNKNOWN"`) |
| | `description` | optional (default `"No description provided"`) |
| | `source_id` | must equal some chunk's `source_id`, or the entity is orphaned from its text |
| `relationships[]` | `src_id`, `tgt_id` | required — an id with no matching entity is auto-created as an `UNKNOWN` placeholder node |
| | `description` | required |
| | `keywords` | **required, read with no default — omitting it raises `KeyError` partway through a paid indexing run** |
| | `weight` | optional (default 1.0) |
| | `source_id` | should match a chunk's `source_id` |

`index_schematic.py` pre-flights the `keywords` rule before spending anything. That check is
the one that earns its keep.

### One working_dir per machine — decide before you index a second drawing

Merge-on-name is the mechanism, and it cuts both ways:

- **Between a schematic and its manual — you want it.** The manual's prose about `CR-BP`
  lands on the same node as the schematic's netlist facts about `CR-BP`. That's the payoff.
- **Between two sheets of the same panel — you want it.** Net `110` continuing onto sheet 2
  should be one net, not two.
- **Between two different panels — it silently corrupts the graph.** Every schematic has a
  `CB1`, a `PS1`, a `CR-BP`. Index two different units into one working directory and those
  become single nodes carrying contradictory facts from both machines. Nothing errors; the
  answers just quietly blend two drawings.

So before indexing a second drawing, establish whether it is *another sheet of the same
panel* or *a different panel*. `ModLinx/source_docs/` holds `PS20115MLM4-2` (20 A, master, 4
drive cards) and `PS10115MLC2-2` — from the numbering, a sibling unit rather than a second
sheet. If that's right, they need separate working directories.

Three ways to handle a different panel, best first:

1. **Separate working directory per panel.** Clean, and each panel's manual can go in
   alongside it.
2. **Qualify the entity names** with the drawing number (`PS10115MLC2-2:CB1`) in
   `author_circuit_logic.py`, with the bare designator in `aliases`. Keeps one graph, but
   weakens manual merging, since the manual says "CB1".
3. **Accept the merge** — only defensible if the two panels really are electrically
   identical, and even then the wire colours and terminal counts usually differ.

### An experiment never run

Two ingestion orders were planned and never compared: (a) schematic only, versus (b) the
troubleshooting manual first (normal AI extraction) and *then* the schematic custom-KG into
the same working directory. The hypothesis for (b) was that seeding the graph with the
manual's plain-language entities gives the schematic's terse designators richer context to
attach to. Worth trying if you go back to querying the index.

---

## 9. Accuracy risks, ranked by damage

1. **A junction that is really a crossover.** Merges two nets; every downstream answer about
   either one is then confidently wrong. On the `PS20115MLM4-2` sheet, `extract.py` classified
   all **88** small circles as terminal points when most are semicircular hop arcs meaning
   *no connection*. Genuine terminal points appear only inside terminal-block rectangles.
   This is the single most important thing the vision pass has to catch, and it is
   drawing-specific — check it on every new sheet.
2. **A misread net designator** (`10` for `110`) silently rewires the graph. Numeric labels
   carry net identity and deserve the closest attention.
3. **Label-to-conductor mis-association.** Parallel runs sit ~10 pt apart, so the spec below
   one run and the designator above the next occupy nearly the same band. Tune
   `label_attach_dy`.
4. **Missing `ON_NET` edges** turn a troubleshooting graph back into a bare wire list. A
   fault propagates across a whole net, not just one wire's two ends — so every terminal on
   a net needs an `ON_NET` edge. Without them, "what is wire 110 connected to" returns two
   terminals instead of five. `build_kg.py --report` warns if they're missing entirely.
5. **Fragmented off-page nets** produce invented destinations instead of honest boundaries.
   Off-page designators need a boundary entity and a `REFERENCES` edge, so the answer is
   "this continues on MXCS-P9" rather than a confident fabrication.

---

## 10. Limitations — when this skill won't work

- **Scanned schematics.** No vector layer means no geometry to trace. This skill does not
  handle them; that needs raster line-following (OpenCV) or a trained symbol detector first.
  Check with `--stats-only`: near-zero `conductor_segments` on a drawing that obviously has
  wires means it's a scan.
- **Symbol identity is always a vision decision.** The scripts report a circle's size and
  position, never what it is. Coil vs lamp vs meter cannot be scripted.
- **N.O. vs N.C. contacts** differ by a single short bar. Read the terminal numbers as the
  cross-check: `11/14` = N.O., `11/12` = N.C.
- **Multi-sheet drawings** extract page by page. Joining them across page boundaries via
  off-page designators is manual.
- **Domain facts not on the drawing.** A breaker wired as a manual switch looks exactly like
  a breaker used for protection. On the Mod-Linx sheet the REVERSE and BYPASS 5A breakers
  are switches — only CB1 and CB2 are true over-current devices. Nothing in the PDF says so;
  it took your domain knowledge. Expect one or two of these per drawing and expect to have
  to supply them yourself. (`references/schematic_conventions.md` §7 records this one.)
- **Text may not be text.** `PS20115MLM4-2` was exported by DraftSight via Teigha with every
  glyph plotted as line geometry: `page.get_text()` returns an empty string and the PDF has
  no fonts at all. Wire *geometry* is still fully deterministic — but labels come from OCR of
  rendered crops, so the vision pass is mandatory, not optional. Check `has_embedded_text` in
  `geometry.json` before deciding how far to trust the labels; do not assume another drawing
  behaves the same way.
- **OCR is optional infrastructure.** `extract.py` needs `pymupdf`; label OCR additionally
  needs the `tesseract` binary and `pillow`. Without them you still get full geometry, with
  every label marked unread.

---

## 11. Practical habits

- **Run `--stats-only` first, every time.** Thirty seconds that tells you whether the rest of
  the run is worth doing.
- **Record every command in `EXTRACTION_NOTES.md`.** See §3 and §7. This is the habit that
  makes a re-run checkable.
- **Consider `--annotate`** when rendering tiles. The `PS20115MLM4-2` tiles were rendered
  clean (`"annotated": false` in `tiles.json`), which made them easier to read but left no
  visual record tying a conductor ID in `geometry.json` to a run on the drawing. That's an
  audit gap — you can't re-verify a specific ID later without re-rendering. Note that turning
  it on for that drawing would change its tile PNGs, so if you want both, render the
  annotated set into a separate directory such as `tiles_annotated/`.
- **`tiles.json` is the map back to the drawing.** It records each tile's PDF rectangle in
  points, so "the error is in `tile_r3c2`" converts directly into a high-magnification
  re-render:
  ```bash
  python $SKILL/scripts/render_tiles.py region drawing.pdf --rect 700,430,1000,530 \
      -o zoom.png --annotate geometry.json --dpi 500
  ```
- **Write an `EXTRACTION_NOTES.md` for every drawing.** Corrections to earlier assumptions,
  flagged inferences, open uncertainties, commands used. Six months from now it's the only
  thing that tells you which parts of the graph to distrust. The `PS20115MLM4-2` one is the
  template.
- **Keep a ground-truth Q&A list** — §12 is it — and check every finished extraction against
  it. It caught real errors on the first run.
- **Commit `author_circuit_logic.py` and `EXTRACTION_NOTES.md` to git.** They encode human
  work that no script can reproduce. The other artifacts are all regenerable.
- **Prefer prose over designators in descriptions.** Terse designators embed poorly, and the
  prose description is what a query matches against.

---

## 12. Acceptance questions — the ground-truth set

Migrated from `_claude_notes/schematic_indexing_plan.md` §8 (that file is being retired).
`EXTRACTION_NOTES.md` for `PS20115MLM4-2` cites this material as "plan §8.1" and "plan §8";
those references now mean this section.

Use it two ways: as an acceptance test after any extraction, and as the question set for
querying. §12.2 is organised so that every schema entity type (component, terminal, net,
wire, cable, subsystem, drawing) and every relationship type (`CONNECTS_TO`, `ON_NET`,
`POWERS`, `PROTECTS`, `ACTUATES`, `COIL_CONTROLS_CONTACT`, `PART_OF`, `REFERENCES`) is
exercised by at least one question. Some §12.2 questions deliberately overlap §12.1 as
cross-checks.

> **⚠️ Domain correction — not deducible from the drawing alone.** The **REVERSE 5A** and
> **BYPASS 5A** circuit breakers are used as **manual switches, not over-current
> protection** (they DIN-rail mount conveniently). Keep `class: "circuit_breaker"` — that is
> the physical part — but their `function`/`description` must say they are used as switches,
> and they take `ACTUATES`-style control-path edges, **not** `PROTECTS`. Only `CB1`, `CB2`
> and the supply's own protection are genuine over-current devices. This is also recorded in
> `references/schematic_conventions.md` §7. Read questions 22, 34, 41, 42 and 45 with it in
> mind.

### 12.1 John's original questions, with expected answers

1. **What is wire 110 connected to?** Terminal 14 of relay CR-SW; terminal 110; wire 111 of
   the previous machine (this is the Master machine, so there may well be no previous
   machine); terminal A2 of relay CR-ON; terminal 12 of relay CR-BP.
2. **What colour is wire 110?** Blue.
3. **What does wire 110 do?** (a) Energises relay CR-ON. (b) Carries the start/stop signal
   from the master machine to all subordinate machines.
4. **How many start/stop switches are shown?** 2.
5. **What happens when CR-ON is energised?** The RUN wire becomes energised, the RUN pin on
   the MDR drive receives 24 V, and the machine runs.
6. **What conditions energise CR-ON?** Relay CR-SW or relay CR-BP must be energised.
7. **What conditions energise CR-SW?** Without the subordinate machine's schematic it will
   appear that CR-SW cannot be energised.
8. **What conditions energise CR-BP?** Both start/stop buttons must be on — energising CR1
   and CR2 — and the bypass switch must be on.
9. **What components have a wired connection with the bypass switch, and via which wires?**
   (verify against the drawing)
10. **What happens to CR-BP if the bypass switch is turned on?** CR-BP energises if the
    start/stop circuit is closed.
11. **What happens if CR-BP energises?** The machine runs.
12. **What does relay CR-SW do?** Without the subordinate machine's schematic, CR-SW appears
    to do nothing.
13. **What components have a wired connection with CR-BP, and via which wires?** (verify)
14. **What is the colour and type of wire 110?** (verify)
15. **What do the start/stop buttons control?** Relays CR1 and CR2.
16. **What are the start/stop buttons connected to, and via which wires?** (verify)
17. **How are the start/stop buttons labelled?** PB1 Start/Stop Switch and PB2 Start/Stop
    Switch.
18. **Describe the start/stop buttons.** Lighted push-button switches, red when open and
    green when closed. Terminal 1 takes 24 V; terminal 2 is not connected; terminal 3 is
    common; terminal 4 is the signal wire carrying 24 V to terminal A1 of CR1 and CR2. (See
    `EXTRACTION_NOTES.md` inference 4: the drawing actually routes terminal 2 to a spare
    terminal that goes nowhere else, so both readings agree in substance.)
19. **What happens when CR1 and CR2 are activated?** CR-BP energises if the bypass switch is
    on.
20. **Describe the start/stop circuit.** (open — compare the answer against your own
    understanding)

### 12.2 Additional categorised acceptance questions

**Drawing / title-block metadata** (`drawing`, `REFERENCES`)

21. What is the drawing number and revision of this schematic? *(Trap: `D` is the sheet size,
    not a revision — the title block has no revision field.)*
22. What assembly does this drawing document, and who owns it? *(CONVEYX CORP.)*
23. What are the input power specifications (voltage, phase, frequency, FLA, SCCR)?
24. What other drawings does it reference for external device connections? *(MXCS-M9,
    MXCS-M11, MXCS-P9, MXCS-P11)*
25. What are the wiring notes? *(4" DC/AC clearance; individual wires — do not double-place;
    label all wires and cables 1" from the end)*

**Component inventory & identification** (`components`)

26. List every component shown on the schematic.
27. How many relays, and what are their designators? *(CR-ON, CR-BP, CR-SW, CR1, CR2)*
28. How many circuit breakers, with ratings and purposes? *(CB1 8A, CB2 20A, REVERSE 5A,
    BYPASS 5A — the two 5A units are switches)*
29. How many start/stop switches, and how are they labelled? *(PB1, PB2)*
30. What does the `24E-1` designator refer to?
31. What is `CR-ON` and what is its stated function? *("MOD-LINX RUN — run signal to cards")*
32. Describe the speed controller and its terminals.
33. What connectors/receptacles are on this drawing and how many pins does each have?

**Ratings & specifications** (`components.ratings`)

34. What is the rating of `CB1`? Of `CB2`? Of the reverse and bypass breakers?
35. What are the input and output ratings of power supply `PS1`? *(115VAC in, 24VDC 20A out)*
36. What is the coil voltage of the control relays?

**Power distribution & power domains** (`POWERS`, `power_domain`, nets)

37. What supplies 24VDC, and which components run on the 24VDC bus?
38. Trace the 115VAC path from the input plug to the power supply.
39. Which components operate on 115VAC versus 24VDC?
40. What is connected to the `0V` (common) net?

**Protection / mode switching** (`PROTECTS`, plus the switch-breakers)

41. What does `CB1` protect?
42. Which device gates the reverse (DIR) path, and which gates the bypass control path?
    *(The REVERSE 5A and BYPASS 5A breakers — used as switches, not protection.)*
43. If `CB2` trips, what loses power?

**Connectivity / netlist — wire tracing** (`CONNECTS_TO`, `ON_NET`)

44. What is wire/net `110` connected to? *(endpoints and all intermediate terminals)*
45. What components have a wired connection to `CR-BP`, and which wires make each connection?
46. What are the start/stop buttons connected to, and by which wires?
47. What is on net `125`? On net `120`? On net `130`?
48. Trace the 5-pin micro female receptacle — where does each pin go?
49. What connects `INFEED INTERFACE #1` to `DISCHARGE INTERFACE #1`, net by net?
50. What is terminal `A1` of `CR1` connected to?

**Wire attributes** (`wires`: colour, gauge, cable)

51. What colour and gauge is wire `110`?
52. What gauge are the wires on the 115VAC input feed?
53. Which wires belong to cable `24E-1`?
54. What colour/gauge carries the SPD (speed) signal to the receptacle?

**Cables** (`cables`)

55. What cables are shown, and which wires does each bundle?
56. What are the four conductors in a start/stop cable, and what is each used for?

**Control logic / relay behaviour** (`ACTUATES`, `COIL_CONTROLS_CONTACT`)

57. What happens when `CR-ON` is energised?
58. What conditions must be met to energise `CR-ON`?
59. What actuates the coil of `CR1`? Of `CR2`?
60. When `CR1` and `CR2` are both energised, what happens next?
61. What does the bypass breaker (switch) do to relay `CR-BP` when closed?
62. What is the difference in function between `CR-ON`, `CR-BP` and `CR-SW`?
63. Describe the start/stop control circuit from button press to RUN signal.

**Subsystems / functional grouping** (`subsystems`, `PART_OF`)

64. What functional sections make up this power supply assembly?
65. Which components belong to the bypass circuit?
66. Which components form the operator start/stop control?

**Off-page / boundary probes — do NOT expect full answers**

67. What conditions are needed to energise `CR-SW`? *(Expected: cannot be determined without
    the subordinate-machine drawing. A good test that the answer says so rather than
    inventing one.)*
68. Where does the `RUN` signal go after leaving this drawing? *(Should surface the external
    MXCS references / the receptacle, not invent a destination.)*
69. What external devices connect through the 5-pin receptacle?

**Notes / installation instructions**

70. What special handling does the `CIRCUIT 1 LIGHT` cable require? *(Remove the white and
    brown wires at the insulation, heat-shrink the exposed end.)*
71. What is the minimum clearance between DC and 115VAC wiring? *(4 inches.)*

### 12.3 What these questions tell you

- **Q44–Q54 are the real proving ground.** They only answer well if `ON_NET` is correct — a
  fault on net 110 touches *every* terminal on that net, not just one wire's two ends. Q1 is
  exactly a multi-terminal net and is the single best test of net-building.
- **Q57–Q63 exercise `COIL_CONTROLS_CONTACT`,** which does not exist in the raw netlist and
  must be synthesised during the vision pass. If these fail while Q44–Q54 pass, the netlist
  is fine but the control-logic layer was not populated.
- **Q67–Q68 deliberately probe off-page fragmentation.** "Correct" here means a bounded,
  honest answer, not a confident wrong one.
- When only the schematic is available (no manual), answer quality depends entirely on the
  prose descriptions attached to each entity and relationship. These questions tell you how
  much prose each one needs.

---

## 13. Glossary

- **Netlist** — the list of electrical connections: which component/terminal connects to
  which, and on what net.
- **Net** — a set of terminals that are electrically common (the same node). The drawing
  labels many nets with numbers (110, 120, 125, 130…) and names (24V, 0V, RUN, DIR, SPD).
- **Conductor** — in `geometry.json`, one traced polyline run between breakpoints. Several
  conductors usually make up one net.
- **OCG / layer** — a PDF optional-content group. CAD exports put the border, title block and
  circuit on separate ones; `--layers SCHEMATIC` keeps only the circuit.
- **Coil / contact** — a relay has a *coil* (energise to actuate) and *contacts* (N.O./N.C.)
  that switch other circuits, usually drawn far apart on the sheet.
  `COIL_CONTROLS_CONTACT` captures that dependency.
- **Crossover hop** — a small semicircular arc where one wire crosses another, meaning *no
  connection*. The main accuracy risk (§9).
- **Custom KG** — a `{chunks, entities, relationships}` graph injected straight into LightRAG
  via `ainsert_custom_kg`, bypassing LLM extraction.

---

## 14. Quick reference

```bash
# extract.py
python extract.py drawing.pdf --stats-only
python extract.py drawing.pdf --layers SCHEMATIC -o geo.json --pretty
python extract.py drawing.pdf --no-ocr -o geo.json
python extract.py drawing.pdf --params '{"label_attach_dy": 6}' -o geo.json
python extract.py drawing.pdf --page 2 -o geo_p2.json

# render_tiles.py
python render_tiles.py tiles drawing.pdf -o tiles/ --annotate geo.json --rows 4 --cols 4 --dpi 400 --overlap 30
python render_tiles.py region drawing.pdf --rect 700,430,1000,530 -o zoom.png --dpi 500
python render_tiles.py crops drawing.pdf --geometry geo.json -o crops/
python render_tiles.py crops drawing.pdf --geometry geo.json --ids T0316,T0327 -o crops/

# build_kg.py
python build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate --report

# index_schematic.py
python index_schematic.py custom_kg.json -w /path/to/work_dir --dry-run
python index_schematic.py custom_kg.json -w /path/to/work_dir --doc-id PS20115MLM4-2
```

Key file locations:

- Skill: `/home/js/schematics/schematic_skills/`
- Drawings: `/home/js/schematics/schematic_extraction/<DRAWING>/{source_docs,extracted_docs}/`
- Worked example: `/home/js/schematics/schematic_extraction/PS20115MLM4-2/`
- Parameter defaults: `scripts/extract.py:57` (`DEFAULTS`) — override with `--params`, don't edit
- Field spec for `circuit_logic.json`: `references/circuit_logic_schema.md`
- Symbol and convention notes: `references/schematic_conventions.md`
- Direct-query test report: `/home/js/schematics/_claude_notes/direct_file_query_test_PS20115MLM4-2.md`
- Virtual environment: `/home/js/schematics/.venv` (`pymupdf pillow numpy`; add `lightrag-hku`
  only for step 7)
