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
| Web UI + query server | **Built and working.** v1 chat, streaming, cited answers, and a password gate in the header. Acceptance 6/6 on Sonnet for $0.37. See [`server/README.md`](server/README.md). |
| Reachable on the LAN | **Working, password-gated.** WSL2 port-forwarding, with `SWUI_DEMO_PASSWORD` set and `SWUI_ANONYMOUS_MODELS` empty so no question reaches the model unauthenticated. |
| Hardened for the public internet | **Not done.** Still needs the §3.1 layers: a dedicated unix user with its own `HOME` and an API key, and a tunnel instead of a forwarded port. |

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

server/                      The query server (FastAPI, Python 3.12, its own uv venv)
    .env.example              every setting, with its default and why it is the default
    app/__main__.py           the launch entry point, so `.env` decides the bind address
    app/claude_runner.py      spawns headless `claude`; the security boundary
    app/config.py             all `SWUI_`-prefixed settings; `drawing_dir` is the one knob
    app/prompts.py            the orientation prompt, versioned in git
    app/limits.py             rate limit, concurrency cap, daily spend ledger
    scripts/acceptance.py     runs the §8 ground-truth questions, archives the report
    tests/                    46 tests, all offline against a stub `claude`

webui/                       The browser client (Vite + React + Tailwind, npm)
    src/tabs.ts               the tab registry — adding a tab is one file + one array entry
    src/api/client.ts         the only place `fetch` appears
    src/components/Header.tsx model toggle, daily spend, and the login button
    src/components/UnlockButton.tsx  the demo-password gate
    src/features/ask/         the one v1 tab
    src/*.test.tsx            15 tests, 7 of them XSS cases against the markdown renderer

_claude_notes/               Design record
    webui_v1_plan.md          the implementation plan for the query server, with build notes
    webui_ideas.md            longer-range vision
    webui_acceptance/         archived acceptance runs, one file per run
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

`circuit_logic.json` and `custom_kg.json` are byte-for-byte reproducible — re-running steps 5 and 6
diffs clean. `geometry.json` is reproducible in its geometry but **not in its OCR**: tesseract
gives slightly different label readings run to run, even at a fixed version. That variance stops at
`geometry.json`, because every label in the master artifact was read visually rather than by OCR.
`HowToUseThisSkill.md` §3.1 has the measurements.

Re-run after correcting any reading:

```bash
python author_circuit_logic.py && python <skill_dir>/scripts/build_kg.py
```

`author_circuit_logic.py` is the one artifact in this repository that **cannot** be regenerated —
it encodes readings a human made from the tiles. It is the reason this repository exists.

## The query server

A visitor opens a page, asks a question about the drawing, and watches a cited answer stream in.

```bash
cd webui && npm install && npm run build   # builds into server/app/static — do this first
cd ../server && uv sync
uv run python -m app                       # then http://127.0.0.1:9700/webui/
```

That runs on the defaults, which are the ones in `server/.env.example` — no `.env` is required to
start. Copy it to `server/.env` when you want to change something; it is gitignored, so check
whether one already exists before copying over it.

Launch with `python -m app`, not `uvicorn app.main:app`: uvicorn's CLI takes the bind address as
a flag, so it silently ignores `SWUI_HOST` in your `.env` — and under WSL2 that is the difference
between reachable from another device and a connection timeout with nothing in any log. Use the
uvicorn CLI only for `--reload` during frontend work.

The full design is in [`_claude_notes/webui_v1_plan.md`](_claude_notes/webui_v1_plan.md) and the
operational detail in [`server/README.md`](server/README.md); the parts worth knowing before
touching the code:

- **Answers come from the files, not from a vector search.** A headless `claude` process is given
  `Read`, `Grep` and `Glob` — and nothing else — scoped to a single drawing directory. Bash, Write
  and Edit do not exist in the session, so no injected instruction can reach them.
- **The working directory is not a security boundary.** An unqualified `Read` grant was measured
  reading `~/.claude.json`. Only path-scoped rules (`Read(./**)`) produce a recorded denial, and
  only a recorded denial counts. Plan §1.3–1.4.
- **A permission rule cannot stop what never becomes a tool call.** Without `--safe-mode` the
  child auto-loads this repository's own `~/.claude/projects/…/memory/MEMORY.md` into its
  context, with `permission_denials[]` empty throughout. Measured with a canary. Plan §2
  addendum.
- **Cost is a v1 feature.** A hard question runs ~$0.64 and ~2 minutes on Opus against ~$0.16
  and ~60 s on Sonnet — and in the acceptance sweep Sonnet came in at $0.04–$0.12, because the
  orientation prompt routes it to grep rather than reading the netlist whole. It still gets the
  hard question right, so it is the default. There is a per-IP limit, a concurrency cap, a daily
  ceiling that disables the endpoint, and a per-turn budget. Plan §3.2.
- **Everything free is answered for free.** `/api/drawing` serves the title block, notes,
  references and counts straight from `circuit_logic.json`, answering a chunk of the §12
  question bank before anyone spends a token.
- **The login is one line of `.env`.** `SWUI_DEMO_PASSWORD` turns on the button in the header;
  it is not compiled into the frontend and appears nowhere else. But the password alone does
  not close the server — `SWUI_ANONYMOUS_MODELS` decides what a stranger gets *without* it, and
  emptying that is what makes the password a gate on every question. Both tables are in
  [`server/README.md`](server/README.md#the-demo-password). The browser holds the password in
  memory for the tab only, never `localStorage`.

## License

The code and documentation in this repository are released under the
**[MIT License](LICENSE)** — take the pipeline, adapt it to your own drawings, build on it
commercially. Specifically covered:

- `schematic_skills/` — the extraction skill in its entirety: `extract.py`, `render_tiles.py`,
  `build_kg.py`, `index_schematic.py`, `SKILL.md` and the reference guides
- `_claude_notes/` — the design record
- `schematic_extraction/*/extracted_docs/` — the extraction artifacts authored here, including
  `author_circuit_logic.py`, `circuit_logic.json` and `custom_kg.json`

### Not covered by the MIT license

`schematic_extraction/*/source_docs/` contains manufacturer electrical schematics.  
These are **third-party documents**, included so the extraction is reproducible and
auditable against its source. They are not this project's work, they are not MIT licensed, and no
license or permission is granted over them here — the MIT grant above does not extend to them.

If you are the rights holder and would prefer they not be redistributed, open an issue and they
will be removed. The pipeline and the netlist stand without them.

Note that the extracted netlist is a derivative reading of those drawings. The MIT license covers
this project's own expression — the schema, the code, the derivation and the audit trail — and is
not a representation about the underlying circuit designs.
