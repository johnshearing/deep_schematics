Greetings.

This is **Session 5** of the wires-and-nets plan. Your job is **Phases D and G**, and nothing else.

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
| `_claude_notes/review_tab_questions.md` | 23 questions I asked about the `Review` tab on 2026-09-01 and your answers to them. **Not needed for Phases D and G.** Read it only if you touch the `Review` tab, and you should not be touching it this session |

---

## What to read, in this order, before you write anything

1. **`_claude_notes/highlighting_wires_and_nets.md`** — the plan for the whole project, whole.
   Its **§0** is written for you. Note especially:
   - **§9** — the phase order: `0 + A ·│· B ·│· C ·│· F ·│· D + G ·│· E`, sessions 1–6.
   - **§13** — the six sessions, and the contract each one signs. **You are Session 5.**
   - **§6** — the `locations.json` schema, including the exact `path` block you are implementing.
   - **§3** — *"a wire's route is never computed"*, which is the rule this phase exists to honour.
2. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index,
   whole. Especially **§5a** (what is actually in the files, refreshed 2026-09-02) and **§7** (the
   known issues `K1`–`K11`).
3. **`_claude_notes/locate_tab_testing/06_code_map.md`** — behaviour → file and symbol, the data
   flow, and hazards `H1`–`H19`. Read this before writing anything.
4. **`_claude_notes/locate_tab_testing/07_drawing_facts.md`** — the real ids and coordinates. It
   already holds what this session needs: `C0080` at (379.8, 663.7) → (301.8, 663.7) BLUE 18AWG, and
   net 120's four wires `W052`/`W053`/`W063`/`W068`.

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.**
`07_drawing_facts.md` exists so that never becomes necessary. When you need a number out of either,
get it with a `python3 -c` one-liner that prints a summary.

---

## Where the project stands

Sessions 1, 2, 3 and 4 are done — Phases **0**, **A**, **B**, **C** and **F**. I have worked through
every lesson document in `_claude_notes/locate_tab_testing/` and everything functioned as expected.

**Since Session 4 I have also worked the whole `Review` queue**, and two things came out of it that
you should know before you start, both already written into the documents above:

- **654 decisions over 664 readings.** The number that matters to this project is that the nets with
  at least one printed conductor to match against went **17 of 26 → 24 of 26**. The two that are
  left are `NET-PB1` and `NET-PB2`, which is **`K10`** rather than anything a reading can fix.
  Manual §5a has the detail; `K10` in §7 has been updated to say it is now the last thing between
  Phase E's matcher and every net on the sheet.
- **A small batch of six follow-up items** is recorded at the end of the plan's **§13**, as
  *"Between Sessions 5 and 6 — the small batch"*, together with four ideas that were considered and
  **rejected** with their reasons. **Do not do any of it this session.** It goes at the head of
  Session 6, and the plan says why.

**Verified green on 2026-09-02, immediately before this file was written:**

```
141 server tests · 232 web tests · ruff clean · tsc clean
```

All 141 include `test_the_committed_artifact_is_exactly_what_the_generator_writes`, so
`circuit_logic.json` is **current** with `locations.json` and you are starting from green. If it goes
red later, that is `K6` doing its job — a save happened — and one command clears it:

```
cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py
```

The only uncommitted things in the tree are `label_corrections.json` and four notes files. That is
mine to commit — see the last section.

---

## Running it

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

Editor password `edit-1234` (`SWUI_EDITOR_PASSWORD` in `server/.env`). Three facts that have each
cost a session already:

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env` now.
   With it false the editing routes are never registered — deliberate, not a bug. Anything you add
   behind `settings.allow_edits` inherits that.
2. **`python -m app` has no reloader.** Any change under `server/app/` needs a restart.
3. **The client is a built bundle.** Any change under `webui/src/` needs `cd webui && npm run build`,
   *and* a server restart if the server changed too. A rebuilt bundle against an unrestarted server
   is the dangerous combination — the new client can send fields the old validator ignores.

If you start the server to test something, stop it in the same turn. The console is mine.

The four checks, at every phase boundary:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

---

## The work: Phases D and G

The plan is the specification and I am not going to restate it here. The summary, so you can tell
whether you have finished:

**Phase D — wire paths: the file, the API, the painting** (plan §9, *Phase D*)

- `locations.py` — `_paths()` beside `_labels()`, validating as **§6** says, refusing per field into
  `problems`.
- **`GET /api/paths`**, new and uncached, beside `/api/designators`. A net stores nothing: its
  highlight is the union of its wires' paths.
- `paint.ts` — `polylineToDevice` and `paintRuns`, routed through the **same** `tileDestRect`
  arithmetic as `pointToCss`. Invariant 2 in the code map: there is exactly one projection.
- `TileSheet.tsx` — an optional `runs` prop, painted in the same rAF pass, after the tiles and under
  the DOM markers. One wire or one net at a time.

**Phase G — the triggers** (plan §9, *Phase G*) — two small items: an Ask-tab citation on a net or
wire now paints its runs, and arming a wire or net on the Locate tab highlights it.

**The one thing about Session 5 that is unlike the others**, and the plan is explicit about it:
there is **no path editor yet** — that is Session 6. So `13_tests_paths_highlight.md` must include
**a worked hand-edit**: the exact `W052` block from §6, for me to paste into `locations.json` with
the server stopped, or I will have nothing to look at. The document must say plainly that this is
temporary scaffolding and not the workflow.

**The proof to look for**, and it is the point of the phase: after saving a path,
`circuit_logic.json` stays current and the artifact test stays **green**. Paths are display
geometry, demonstrated rather than asserted.

---

## What "done" means, from the plan's §13

> **A session is not finished until:** the four checks in §10 are green · its new automated tests are
> written · **its numbered test-and-lesson document is written**, in the house style, every test a
> lesson that says what to click and what should happen · the index's §5a and §7 are brought up to
> date · `change_history.md` has an entry · and the session has reported to me, in plain words, what
> it built and what it did not.
>
> **Then stop.** Do not start the next phase in the same session.

Concretely, for this session that means:

- new tests: **`server/tests/test_paths.py`**, cases in **`paint.test.ts`**, plus the
  `test_locations.py` path-validation cases §10 lists (a path of one point refused and costing that
  path only · a path off the page refused · **`geometry: derived` refused by name**) and the
  `DrawingTab.test.tsx` cases;
- **`_claude_notes/locate_tab_testing/13_tests_paths_highlight.md`**, **T-800–T-840**, written by
  you and not left for later;
- rows for T-800–T-840 added to **`08_results_log.md`**;
- **`06_code_map.md`** updated with the new files, symbols and any new hazard;
- the manual index's **§5a** and **§7** updated, and its **§3** table given a row for the new
  lesson document;
- a **`change_history.md`** entry.

Then stop, and report to me in plain words. I will walk the lessons and mark up `08_results_log.md`,
and Session 6 begins by reading my results.

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all fine and often useful. When something ought to be
committed, name the files and say so, and I will do it. This is how I stay able to recover if
anything on the local machine goes wrong.

**`locations.json` and `label_corrections.json` are authored content git cannot regenerate.** If a
phase changes either one, say so clearly in your report. Do not hand-edit `circuit_logic.json` — it
is generated.
