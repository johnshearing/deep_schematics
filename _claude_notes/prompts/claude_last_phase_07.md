This document was written by the previous Claude Code session on my (John's) behalf.
These are the instructions for the current session.

Greetings.

**`_claude_notes/authoring_the_wires.md` is finished except for the run, and the run is mine.**
Session 4 landed Phase E on 2026-09-10 — `Add a wire` and `Retire this wire` — and with it every
phase in that plan's §9 is built. **There is no next coding session in that plan.** What is left is
Phase F: I sit down with the screens and confirm 71 wires, and that is not a session's work to do.

**So before you build anything, ask me where the run is.** The answer changes what this session is,
and there is no way to tell from the tree: `wiring.json` says how many records read `source: human`
but not whether I have stopped.

---

## Where the project is, in one paragraph

`circuit_logic.json` is generated from four authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn), `wiring.json` (which two terminals each
wire *joins*, and each block's bus), and — read by the app but not by the generator —
`label_corrections.json` (what the ink says).

There are screens for all of it. The `Wiring` queue with the ink's proposal per end (Session 2), the
`Commoning` filter and a net's highlight that includes the bus (Session 3), a terminal's wires and
the sheet hit-test on the Drawing tab with no password (Session 3), and `Add a wire` /
`Retire this wire` (Session 4).

**Read the file, not the prose, if a count matters.** Every document in this project quotes the
*original* census — 71 wires, 47 confirmed by the ink, 11 provably wrong, 13 unresolved — and none of
them is updated as I work. `wiring.json` is where the current state is and `was` is where the
machine's original answer is kept.

---

## The four things this session might be

Ask me which. **Do not guess, and do not do two.**

1. **The repairs after my run.** Plan §13 Session 4's second half. Most of it is already done —
   Session 1 corrected q11's seven sentences, Session 3 did the `W063` fixture and
   `07_drawing_facts.md`. What is genuinely left is: re-run `author_circuit_logic.py` **and**
   `build_kg.py`, refresh the manual's §5a counts against the finished file, and write up whatever
   the run turned up. **This one needs my run to be finished.**
2. **The `Ask` tab reasoning about highlighted wires**, and turning highlighting on for the wires it
   is explaining. This is my own note at the end of `authoring_the_wires.md` and it is the next real
   feature. Everything it needs now exists — a terminal's wires, the commoning on the sheet, a
   hit-test that can name what a line belongs to, and `pathsFor` as the one answer to *what does this
   selection paint*. **It has no plan document yet. Write one first and stop** — I read plans and
   execute them in separate sittings.
3. **Drawing number two.** The long-term goal is a library of indexed schematics a model can answer
   troubleshooting questions about. Everything in `server/app/` and `webui/src/` knows only shapes,
   and `schematic_skills/scripts/bootstrap_wiring.py` exists to start a second drawing — but nothing
   has ever been pointed at one. **This is the biggest thing and it wants a plan, not a session.**
4. **Something I have found while working.** Most likely. `08_results_log.md` is where I write it
   down; read that first either way.

---

## What to read, in this order

1. **`_claude_notes/change_history.md`, the `NEXT UP` section** — it is written to stand alone and it
   is the shortest true account of where the project is. **§*"The run — what to do first"*** is my
   own order of work and tells you what I am probably in the middle of.
2. **`_claude_notes/locate_tab_testing/08_results_log.md`** — what I actually reported. A
   troubleshooting session should read this before anything else.
3. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index over
   **seventeen** leaf documents. **§5a** is what is in the files, **§7** the known issues, **§8** the
   rule about routes, **§5k** is Session 4.
4. **`_claude_notes/locate_tab_testing/06_code_map.md`** — behaviour → file and symbol, and hazards
   `H1`–`H25`. Read it before writing anything. **`H25` is new** and is the one Phase E created.
5. **`_claude_notes/authoring_the_wires.md` §15** — what each of the four sessions actually did and
   the twenty-odd places the execution departed from the plan. **Read §15 before you trust §3, §8 or
   §9 literally.**

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** If you
need a number, get it with a `python3 -c` one-liner that prints a summary.

---

## Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.**
4. **A test that asserts an absolute count against an authored file goes red as I author.** This has
   now bitten **three times** and been paid three times. The cure is always the same: **reconstruct
   the indexing pass's own answer from `was`, and assert against that.** `INDEXED` in
   `test_extraction_generator.py` and `loadReal` in `wiring.test.ts` are the two implementations, and
   both carry the reasoning. **Assume I will confirm all 71 and correct twenty-two.**
5. **`H18` — three whole-document drafts over three authored files, two of them written from one
   screen.** They must not learn about each other. `wiringModel.pathStale` is the one place two
   documents meet and it meets them as arguments.
6. **`H25` — the `W` table is no longer the list of wires that exist.** A record saying
   `"added": true` is a wire I put there. An unknown id **without** it is still a typo and still
   refused by name, and a marked id the table has *also* grown to cover is refused as a collision.
   Read it before touching `build_wires`.
7. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before
   touching `features/locate/wiring.ts`.
8. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it
   must supply the file.

Running it:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks, currently green at **261 server · 458 web · ruff clean · tsc clean**:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Start from green.** A red check in a session that has written no code means something else is
wrong — say so loudly. The one exception is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which is red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json` and names which one. That is `K6`
doing its job; clear it with the generator first, so you can tell your own breakage from mine.

---

## What not to do

- **Do not author anything in the four authored files.** The run is mine. If you need to verify a
  write loop end to end, back the file up, write one record through the running server, check the
  generator folds it in, then restore and prove it with `md5sum` — `git status --short
  schematic_extraction/` coming back **empty** is the proof. Every session since Session 2 has done
  it that way.
- **Do not renumber anything.** Decision 3, proved unnecessary in the plan's §3.4.
- **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the
  shape rule found. **`W042` is the standing reason**: I pressed *I looked and it was right* on a
  wire the ink says nothing about, and that was the correct answer.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

---

## Two things I want built *for*, not just built

Every session so far has honoured these. Keep honouring them.

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's
   own tables; everything in `server/app/` and `webui/src/` knows only shapes. If you find yourself
   typing `TB-` into the server or the client, stop.
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except
   `commoning`, which stores polylines and already carries an optional `page` for exactly that day.

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all useful and often the fastest answer. When something ought to
be committed, name the files and say so.

**There are four authored files git cannot regenerate:**

    locations.json           where everything is drawn
    label_corrections.json   what the ink says
    wiring.json              what each wire joins, and each block's bus
    author_circuit_logic.py  what each thing is  (a Python file, but the tables in it are my data)

**Say at the end of your session which files want committing**, and remember that anything I author
while walking your lessons lands in the same commit as your code unless I am told to separate them.

---

## And one piece of feedback that is now standing policy

I walked T-1000–T-1090 and everything worked, **and I said I did not understand everything I was
being shown.** That is a result about the *document*, not the code, and it is recorded in
`08_results_log.md` beside the result. `16_` and `17_` were written for it and this is the shape to
keep:

- **the *do* and the *expected* first and short.** I should be able to work the whole document
  without reading a single explanation;
- **the *why* underneath, in one or two sentences, clearly marked as skippable;**
- **leave the arguments in the code.** The module headers and the hazards are where a future session
  needs them, and they are excellent there. A lesson document is for a person with a mouse.

Do not make it shorter by leaving things out — make it shorter per sentence. And keep naming the one
or two cases that matter most, the way `W042` was: that worked, and it is the part I remember.
