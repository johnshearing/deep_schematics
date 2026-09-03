This document was written by the previous Claude Code session on my (John's) behalf.  
These are the instructions for the current session.  

Greetings.

This is **Session 6** of the wires-and-nets plan — **the last one**. Your job is the **small batch**
at the end of the plan's §13, and then **Phase E**, and nothing else.

---

## What already exists, so you know it is there

You built all of this in earlier sessions. **Do not read any of it now** — this list is so you know
what each thing is if you later need it. The reading you actually have to do is the next section.

| Where | What it is |
|---|---|
| `/home/js/schematics/schematic_skills/` | the extraction pipeline — analyses a schematic and indexes it for querying |
| `_claude_notes/webui_ideas.md` | the project road map |
| `_claude_notes/webui_v1_plan.md` | the plan for the first, very simple WebUI |
| `webui/` and `server/` | that WebUI, built so functionality can be bolted on as we work through the road map |
| `_claude_notes/change_history.md` | the running record of progress, with what remains at the top |

---

## What to read, in this order, before you write anything

1. **`_claude_notes/highlighting_wires_and_nets.md`** — the plan, whole. Note especially:
   - **§13** — the six sessions. **You are Session 6**, and the *"Between Sessions 5 and 6 — the
     small batch"* block immediately above your row is **part of your job and goes first**.
   - **§9, Phase E** — the specification: `GET /api/conductors`, a pure ranked `candidates()`, the
     wire panel, **Trace**, and the counts.
   - **§3** and the **Session 5 landing note in §13** — the rule the phase honours, and the five
     things that went differently when the file format landed.
2. **`_claude_notes/review_tab_questions.md`** — the reasoning behind every item in the small batch.
   Read it before touching the `Review` tab; you will be touching it for items 1–5.
3. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index,
   whole. **§5f** is Session 5, **§5a** is what is in the files, **§7** is `K1`–`K11`.
4. **`_claude_notes/locate_tab_testing/08_results_log.md`** — **read this first of the four**. It is
   where I have marked up **T-800–T-840**, the first walk of the highlighter, and anything I found
   is your first job whatever else is on this list.
5. **`_claude_notes/locate_tab_testing/06_code_map.md`** — behaviour → file and symbol, the data
   flow, hazards `H1`–`H20`. Read this before writing anything.
6. **`_claude_notes/locate_tab_testing/07_drawing_facts.md`** — the real ids and coordinates. Its
   new section *"Which conductor belongs to which wire"* is the four measured answers your ranking
   should reproduce.

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** When you
need a number out of either, get it with a `python3 -c` one-liner that prints a summary.

---

## Where the project stands

Sessions 1–5 are done: Phases **0**, **A**, **B**, **C**, **F**, **D** and **G**. The sheet can now
highlight a wire along the PDF's own conductor strokes, and a net as the union of its wires' runs.

**What Session 5 left you, and it is most of the format:**

- **`locations.json` schema 2 holds a `path`** on a wire — `runs` (a list of polylines),
  `conductors`, `geometry: extracted | human`, `attribution: printed | human` — with **`derived`
  refused by name on both axes**. A net stores none; a path under `nets` is refused by name.
- **`no_path_on_this_sheet` is validated and counted and nothing on screen can write it.** It is
  yours, and it is what lets the `Paths` count reach 71 rather than stopping at the wires whose run
  is on another drawing. That is the `K7` defence and the plan says so in three places.
- **`GET /api/paths`** publishes `wires` → traced runs and `nets` → each net's wires. It is **free
  of the editor password** on purpose — hazard `H20`, and `/api/conductors` is the opposite case:
  it reads the ink, so it is gated, and the two must not be merged for convenience.
- **`server/app/ink.py` still drops `points` and `endpoint_bindings`** at the parse boundary, and
  `test_nothing_here_opens_the_ink` asserts Phase D never opened it. Add them **there**, named,
  behind the same `lru_cache`; `geometry.json` must go on reaching neither the browser nor the model
  whole (`H17`). Small-batch item 5 wants the polylines too, so do them together.
- **`webui/src/lib/paths.ts` `pathsFor`** is the union rule, shared by both tabs. The highlight is
  read off the Drawing tab's `selection` and the Locate tab's `target`, and it survives every layer
  switch because it is read off nothing else.
- **The plan's worked example was corrected.** `W052` pairs with `C0109`; `C0080` is `W053`'s.
  `07_drawing_facts.md` has all four of net 120's wires, and two of them need a conductor with **no
  printed label** to reach their second end — which is a fact about your ranking, not about this
  drawing.

**Verified green on 2026-09-02:**

```
157 server tests · 251 web tests · ruff clean · tsc clean
```

All 157 include `test_the_committed_artifact_is_exactly_what_the_generator_writes`, so
`circuit_logic.json` is current. If it goes red, that is `K6` doing its job — a **point** was saved,
never a path — and one command clears it:

```
cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py
```

**One thing to check before you start.** `13_tests_paths_highlight.md` T-800 asked me to paste one
to three `path` blocks into `locations.json` by hand, and T-840 asked me what to keep. Look at the
`wires` section and take what is there as authored fact: if `W052`, `W053` or `W068` carries a path,
I looked at it on the sheet and kept it deliberately, and **your ranking has that many answers to
check itself against.**

---

## Running it

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

Editor password `edit-1234` (`SWUI_EDITOR_PASSWORD` in `server/.env`). Three facts that have each
cost a session already:

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env` now.
   With it false the editing routes are never registered — deliberate, not a bug. `/api/paths` is
   deliberately *outside* that gate; `/api/conductors` must be inside it.
2. **`python -m app` has no reloader.** Any change under `server/app/` needs a restart.
3. **The client is a built bundle.** Any change under `webui/src/` needs `cd webui && npm run build`,
   *and* a server restart if the server changed too.

If you start the server to test something, stop it in the same turn. The console is mine.

The four checks, at every phase boundary:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

---

## The work

**First: the small batch** (plan §13, *"Between Sessions 5 and 6"*) — six items, perhaps half a
session, each too small to be one of its own. Items 1–4 change what I see while making 71 judgements
about conductors, item 5 wants the polylines you are about to load anyway, and item 6 is a generated
file that is behind. **Do them before Phase E**, for the same reason Phase 0 went before everything:
a tool you are about to spend a long authoring run inside is worth sharpening first. Four ideas were
**rejected** while answering the same questions and are recorded there with their reasons — do not
re-open them.

**Then Phase E — the path editor** (plan §9, *Phase E*). The summary, so you can tell whether you
have finished:

- **`GET /api/conductors`**, behind `settings.allow_edits`, the 149 conductors reduced to what
  tracing needs, with any Phase F correction applied to the printed name;
- **`webui/src/features/locate/paths.ts`** — pure, unit-tested: `candidates()`, ranked worst
  assumption first, **never auto-accepting**;
- **the wire panel** — the ranked candidates lighting on hover, click to accept, multi-select across
  a crossover hop, the provenance badges, **Clear**, re-pick, the **conversion to `geometry: human`
  before an extracted run may be edited**, and **Trace** with all four keys;
- **the counts and the `Paths` filter**, and the *no path on this sheet* state that lets the count
  reach 71;
- **`K10`** — publish each net's *printed* form beside its id and have `candidates()` compare
  against **both**. It is worth exactly two nets and takes the matcher to 26 of 26.

**Expect 19 wires with one candidate, 33 with two or three, 19 with none.** If the first two numbers
come out much smaller, the ranking is wrong rather than the drawing being hard.

---

## What "done" means, from the plan's §13

> **A session is not finished until:** the four checks in §10 are green · its new automated tests are
> written · **its numbered test-and-lesson document is written**, in the house style, every test a
> lesson that says what to click and what should happen · the index's §5a and §7 are brought up to
> date · `change_history.md` has an entry · and the session has reported to me, in plain words, what
> it built and what it did not.

Concretely, for this session that means:

- new tests: **`server/tests/test_conductors.py`** (or cases in `test_paths.py`), a new
  **`webui/src/features/locate/paths.test.ts`**, and the `LocateTab.test.tsx` cases §10 lists —
  including **accepting a candidate writes `path.runs` and nothing that looks like a `point`**;
- **`_claude_notes/locate_tab_testing/14_tests_path_editor.md`**, **T-900–T-960**, written by you and
  not left for later — plus whatever the small batch needs in `12_tests_label_corrections.md`;
- rows for T-900–T-960 added to **`08_results_log.md`**;
- **`06_code_map.md`** updated with the new files, symbols and any new hazard;
- the index's **§5a** and **§7** updated — including striking **`K10`** if you have fixed it and
  saying what became of **`K11`** — and its **§3** table given a row for the new lesson document;
- a **`change_history.md`** entry, and the **`NEXT UP`** section at the top of that file rewritten:
  this is the last session of the plan, so it should say what the project's next piece of work is
  rather than pointing at a session that does not exist.

Then stop, and report to me in plain words.

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all fine and often useful. When something ought to be
committed, name the files and say so, and I will do it. This is how I stay able to recover if
anything on the local machine goes wrong.

**`locations.json` and `label_corrections.json` are authored content git cannot regenerate.** If a
phase changes either one, say so clearly in your report. **Phase E is the first phase whose whole
job is to write `locations.json`**, so say what it wrote and how much of it I authored myself. Do
not hand-edit `circuit_logic.json` — it is generated.
