# deep_schematics

Turn an electrical schematic PDF into an **auditable netlist**, then let a maintenance
electrician interrogate it in plain English.

The premise is that a schematic is a *deterministic* artifact. Which conductor touches which
terminal is a fact recoverable from the PDF's vector layer — it should not be re-guessed by a
language model. So the geometry is extracted by script, only the *interpretation* (what a symbol
means, what a stroked-text label says) goes to a vision model, and the result is a netlist you can
audit line by line.

Everything downstream — the knowledge graph, the troubleshooting answers, the planned web UI —
reads from that netlist rather than from the drawing.

## Status

| Piece | State |
|---|---|
| `schematic_skills/` — the extraction pipeline | **Working.** Used end to end on a real drawing. |
| `schematic_extraction/PS20115MLM4-2/` — the first indexed drawing | **Complete.** 47 components, 131 terminals, 26 nets, 71 wires, 402 relationships. |
| Web UI + public query server | **Planned, not built.** Fully specified in [`_claude_notes/webui_v1_plan.md`](_claude_notes/webui_v1_plan.md). |

This repository is both the backup of that work and the launch point for the server.

## Layout

```
schematic_skills/            The Claude Code skill: extraction pipeline + operator's guide
    SKILL.md                   what Claude reads
    references/
        HowToUseThisSkill.md   the human operator's guide; §12 is a 71-question ground-truth bank
        circuit_logic_schema.md
        schematic_conventions.md
    scripts/
        extract.py             deterministic vector + label extraction from the PDF
        render_tiles.py        overlapping 400 DPI tiles for the vision pass
        build_kg.py            netlist -> LightRAG custom knowledge graph
        index_schematic.py     drives the whole pipeline

schematic_extraction/        Per-drawing working directories
    PS20115MLM4-2/
        source_docs/          the drawing PDF
        extracted_docs/
            geometry.json         raw deterministic extraction (608 KB) — not for querying
            author_circuit_logic.py   human-read tables + derivation  <-- irreplaceable
            circuit_logic.json        THE master artifact
            custom_kg.json            the same facts flattened for LightRAG
            EXTRACTION_NOTES.md       audit trail: corrections and flagged inferences
            tiles/                    the 16 renders the vision pass actually read
    ModLinx/
        source_docs/          related vendor drawings and the troubleshooting manual

_claude_notes/               Design record
    webui_v1_plan.md          the implementation plan for the query server
    webui_ideas.md            longer-range vision
    direct_file_query_test_PS20115MLM4-2.md
                              the test establishing direct file access beats RAG here
```

## The pipeline

1. **`extract.py`** pulls conductors, junctions and text geometry out of the PDF's vector layer,
   restricted to the `SCHEMATIC` layer so the border and title block don't pollute the netlist.
   Nothing is silently dropped — anything unresolved lands in a review queue.
2. **`render_tiles.py`** produces overlapping 400 DPI tiles. The vision pass reads *tiles*, never
   the whole D-size sheet; a model asked to enumerate ~50 components and ~150 conductors at once
   returns a confidently partial answer.
3. A human/vision pass resolves the review queue into `author_circuit_logic.py`, which emits
   **`circuit_logic.json`** — the master artifact.
4. **`build_kg.py`** flattens that into a LightRAG custom KG, injected via `ainsert_custom_kg` so
   the graph is built from the netlist rather than re-extracted by an LLM.

`EXTRACTION_NOTES.md` records what the process got wrong on the first pass. For this drawing that
included: the PDF contains no selectable text at all (DraftSight stroked every label as geometry),
and there is **no revision** — the `D` in the title block is the sheet size.

### Reproducing

`extracted_docs/` is meant to be byte-for-byte reproducible from the skill. Re-run after correcting
any reading:

```bash
python author_circuit_logic.py && python <skill_dir>/scripts/build_kg.py
```

`author_circuit_logic.py` is the one artifact in this repository that **cannot** be regenerated —
it encodes readings a human made from the tiles. It is the reason this repository exists.

## What the query server will be

A visitor opens a page, asks a question about the drawing, and watches a cited answer stream in.
The full design is in [`_claude_notes/webui_v1_plan.md`](_claude_notes/webui_v1_plan.md); the parts
worth knowing before touching the code:

- **Answers come from the files, not from a vector search.** A headless `claude` process is given
  `Read`, `Grep` and `Glob` — and nothing else — scoped to a single drawing directory. Bash, Write
  and Edit do not exist in the session, so no injected instruction can reach them.
- **The working directory is not a security boundary.** An unqualified `Read` grant was measured
  reading `~/.claude.json`. Only path-scoped rules (`Read(./**)`) produce a recorded denial, and
  only a recorded denial counts. Plan §1.3–1.4.
- **Cost is a v1 feature.** A hard question runs ~$0.64 and ~2 minutes on Opus. A public
  unauthenticated endpoint without a per-IP limit, a concurrency cap and a daily ceiling is an
  unbounded bill. Plan §3.2.

## A note on the source documents

`schematic_extraction/*/source_docs/` contains manufacturer drawings and a vendor troubleshooting
manual that are **third-party documents**, included here so the extraction is reproducible and
auditable against its source. They are not the authors' work and no license is granted over them by
this repository. If you are the rights holder and would prefer they not be redistributed, open an
issue and they will be removed — the pipeline and the netlist stand without them.
