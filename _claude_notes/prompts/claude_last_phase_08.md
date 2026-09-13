Greetings. Background first, then the request at the bottom. **Read this file whole — it is short on
purpose — and then do §1 and nothing else.**

---

## 1. The request

**Read `_claude_notes/highlighting_wires_and_nets_02.md`, whole. Then execute its §4 — Phase 2a,
"trace a block's bus by hand" — and stop there.**

That plan is self-contained. It was written 2026-09-12 for exactly this, it names every file and line
number the phase needs, and its §0 tells you which documents *not* to open. **Trust its reading lists
over your instinct to look around**; the instinct is what makes these sessions cost $100.

**One phase per session.** When §4's acceptance criteria are met, write up what happened and stop,
even if there is context left. §6, §5 and §7 are the next three sessions, in that order.

*If I have found something while working since, I will say so in this session and that overrides the
above. Otherwise §4 is the job.*

---

## 2. What this project is

A WebUI where **a human points at features on a schematic and they become JSON a model can reason
over** — and where the highlighting is what proves the JSON is a complete and correct representation
of the sheet. `PS20115MLM4-2` is the test specimen, not the goal; the goal is a library of indexed
drawings and a system that works on any of them.

`circuit_logic.json` is generated from four authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn), `wiring.json` (which two terminals each
wire *joins*, plus each block's bus), and — read by the app, not the generator —
`label_corrections.json` (what the ink says).

**Where the authoring stands, measured 2026-09-12.** Read the files, never the prose, if a count
matters — every document in this project quotes the *original* census and none is updated as I work.

| | |
|---|---|
| `locations.json` | 131 placed terminals · 62 wire routes |
| `label_corrections.json` | 654 decisions |
| `wiring.json` | 71 endpoint records, **3 `source: human`** · 4 commoning blocks |

**The authoring run is mine and it has barely begun.** §4 of the plan unblocks the commoning half of
it — all six blocks become authorable, including the three the notes call *questions for my eyes*.
Nothing in the plan touches the wire queue.

---

## 3. Why the plan exists, in one paragraph

Every editor so far was built as a **confirmation surface**, not an **authoring surface**: each panel
takes its list of objects from something the machine found and its edit control from a proposal the
machine computed, so where the machine found nothing there is no row and no button. On 2026-09-11 the
answer to two of my authoring questions was *hand-edit the JSON*, and I deliberately did not do it —
a hand edit produces correct data and destroys the finding. **An un-authorable thing is a named gap in
a panel, not a file edit.** Paths already have both halves (`Trace by hand`, draggable corners,
`convertPath`); commoning and end-labels have neither. The plan gives them what paths have.

---

## 4. Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`, so with it false there is
   nothing there to be wrong about — deliberate, not a bug.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.**
4. **A test asserting an absolute count against an authored file goes red as I author.** This has bitten
   three times and been paid three times. The cure is always the same: **reconstruct the indexing
   pass's own answer from `was`, and assert against that.** `INDEXED` in
   `test_extraction_generator.py` and `loadReal` in `wiring.test.ts` are the two implementations and
   both carry the reasoning. **Assume I will confirm all 71 and correct twenty-two.**
5. **`H18` — three whole-document drafts over three authored files, two written from one screen.** They
   must not learn about each other. `wiringModel.pathStale` is the one place two documents meet, and it
   meets them as arguments. **Plan §4.5 adds the second such place** and asks for `H26`.
6. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before touching
   `features/locate/wiring.ts`.
7. **`H25` — the `W` table is no longer the list of wires that exist.** A record saying `"added": true`
   is a wire I put there; an unknown id *without* it is still a typo and still refused by name. Read it
   before touching `build_wires`.
8. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it must
   supply the file.
9. **`H20` — geometry is free and connectivity is not.** `GET /api/conductors` has no editor password,
   on purpose.

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

**Start from green.** A red check in a session that has written no code means something else is wrong —
say so loudly. The one exception is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which is red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names which. That is `K6` doing
its job; clear it with the generator first so you can tell your breakage from mine.

**Two venvs, and only one has `pymupdf`:** `/home/js/schematics/.venv/bin/python` can read the PDF
(`page.get_drawings()` with a clip is cheap and exact); `server/.venv` cannot, and neither can system
`python3`. *Is the ink there, or did we miss it?* has cost this project three open items — that venv is
how you answer it.

---

## 5. What not to do

- **Do not author anything in the four authored files.** The run is mine. To verify a write loop end to
  end: back the file up, write one record through the running server, check the generator folds it in,
  restore, and prove it with `md5sum` — `git status --short schematic_extraction/` coming back **empty**
  is the proof. Every session since Session 2 has done it that way.
- **Do not renumber anything.** Proved unnecessary; 48 placed `TB-*` points and 111 end-label overrides
  stay where they are.
- **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the shape
  rule found, not a conductor list a hand trace computed. **`W042` is the standing reason:** I pressed
  *I looked and it was right* on a wire the ink says nothing about, and that was the correct answer.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

  Plan §4 does not move the artifact, and `test_commoning_does_not_reach_the_netlist` asserts that in
  bytes.
- **Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** If you need
  a number, get it with a `python3 -c` one-liner that prints a summary.

---

## 6. Two things I want built *for*, not just built

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's own
   tables; everything in `server/app/` and `webui/src/` knows only shapes. **If you find yourself typing
   `TB-` into the server or the client, stop.** (Plan §4.4 is where this is easiest to break, and names
   two places `CommoningPanel.tsx` has already broken it in user-visible copy.)
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except `commoning`,
   which stores polylines and already carries an optional `page` for exactly that day.

---

## 7. The budget, and how to check it

I fund this from API credits, so tokens are money and the plan's §10 is not advice.

**Measured 2026-09-12 over 26 session transcripts: $1,031.76 spent to date, mean $39.68 a session,
dearest $121.34.** Cost is almost entirely **context size × number of calls** — the two $100 sessions
ran at 407 K average context over ~400 calls, where cache reads were 84% of the bill. An analysis
session at 60 K context cost $6.27. The spread is roughly **7× for the same thinking.**

Price a session, including the one you are in:

```
ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
# then sum message.usage over the file: input ×$5, output ×$25,
# cache_creation ×$6.25, cache_read ×$0.50, per 1M tokens (Opus 5)
```

**Sanity marks while working:** at 60 calls you should be around $3–6. Past $25 before the tests are
written means the reading list grew — cut the phase rather than push it through. A phase should land
near $20 at ≤120 K context and ≤200 calls.

**Say what the session cost at the end.** Roughly $134 of the $150 I funded remains after the planning
session, against §9's estimate of $72–153 for all four phases.

---

## 8. Four standing instructions

1. **I do all the git work myself. Do not commit and do not push.** Read git freely — `git status`,
   `git diff`, `git show`, `git log` are often the fastest answer. When something ought to be committed,
   name the files and say so.

2. **There are four authored files git cannot regenerate:**

       locations.json           where everything is drawn
       label_corrections.json   what the ink says
       wiring.json              what each wire joins, and each block's bus
       author_circuit_logic.py  what each thing is  (a Python file, but the tables in it are my data)

   **Say at the end of your session which files want committing**, and remember that anything I author
   while walking your lessons lands in the same commit as your code unless I am told to separate them.

   *Currently uncommitted and known:* `wiring.json` (four commoning decisions, real work),
   `locations.json` (a 0.1 pt `TB-110` nudge from 2026-09-11 — I may revert it),
   `_claude_notes/highlighting_wires_and_nets_02.md` (the plan), and this file.

3. **Tell me afterwards** which files I asked you to read that did not earn their tokens, and which files
   you needed that I did not name. I use it to rewrite this file.

4. **Keep token usage as low as you can without lowering quality.** Use your knowledge of bash to avoid
   reading what you can measure, and batch independent calls into one message.

---

## 9. If you are picking this up cold and §1 does not apply

The four things a session might otherwise be, in the order I would want them:

1. **The plan's remaining phases** — §6 the coverage overlay, §5 the orphaned end-label rows, §7 the
   extractor's layer fix. All specified; none needs new design.
2. **The `Ask` tab driving the highlight.** The loop is already closed one click wide —
   `prompts.py` makes the model spell identifiers, `Markdown.tsx` renders them as `Citation`, and
   `Citation.tsx` calls `select(kind, id)` and switches tabs. Widening it so an answer paints a whole
   net is the next real feature **after** the plan, deliberately: the highlighting has to be
   trustworthy before anything reasons on top of it. **No plan document yet — write one and stop.**
3. **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
   pointed at a drawing. It is the test of everything above and **wants a plan, not a session.**
4. **Something I have found while working.** Most likely I do not understand how to use what you have
   built and need instruction, or something is not working. This overrides §1.

**Plans are documents first.** Write the plan into `_claude_notes` and stop — I read plans and execute
them in separate sittings, and the plan is the cheap half.
