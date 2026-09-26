Greetings. Background first, then the request at the bottom. **Read this file whole — it is short on
purpose — and then do §1 and nothing else.**

---

## 1. The request

**Read `_claude_notes/highlighting_wires_and_nets_02.md`, whole. Then execute its §6 — Phase 2c,
"the coverage overlay" — and stop there.**

That plan is self-contained. §6's reading list was re-checked against the tree on 2026-09-13 and
every line number in it still holds, and its §0 tells you which documents *not* to open. **Trust
its reading lists over your instinct to look around**; the instinct is what makes these sessions
cost $100.

**One phase per session.** When §6's acceptance criteria are met, write up what happened and stop,
even if there is context left. §5 and then §7 are the two sessions after this one.

**§4 shipped on 2026-09-12 and I walked it the same evening** — `TB-110` and `TB-130` are authored,
both `geometry: "human"`. Do not redo any of it; §4 is marked SHIPPED and its detail is only for
somebody working on the trace machinery again.

*If I have found something while working since, I will say so in this session and that overrides the
above. Otherwise §6 is the job.*

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

**Where the authoring stands, measured 2026-09-13.** Read the files, never the prose, if a count
matters — every document in this project quotes the census of the day it was written.

| | |
|---|---|
| `locations.json` | 131 placed terminals · 41 sites · 58 wire routes (16 hand-traced) · 113 end-label overrides |
| `label_corrections.json` | 654 decisions |
| `wiring.json` | 71 records, **3 `source: human`** · **6 commoning blocks, 2 of them drawn by hand** |
| the ink | 149 runs · 44 claimed by a route · 7 by a bus · **98 claimed by nothing** |

**The authoring run is mine and it has barely begun.** §4 unblocked the commoning half and I have
finished that half — all six blocks are decided. §6 does not touch the wire queue; it tells me how
much of the sheet is still unaccounted for, which is the number I have no way to see today.

**§14 of the plan is new and worth your two minutes**: an audit of which features a human can
author today and which still need a Python file. It is the roadmap after this plan.

---

## 3. Why the plan exists, in one paragraph

Every editor so far was built as a **confirmation surface**, not an **authoring surface**: each panel
takes its list of objects from something the machine found and its edit control from a proposal the
machine computed, so where the machine found nothing there is no row and no button. On 2026-09-11 the
answer to two of my authoring questions was *hand-edit the JSON*, and I deliberately did not do it —
a hand edit produces correct data and destroys the finding. **An un-authorable thing is a named gap in
a panel, not a file edit.** §4 gave commoning what paths already had, and I used it the same night.
§6 is the other half of the same sentence: **correct** is per-object highlighting, which exists;
**complete** is *nothing on the sheet is unaccounted for*, which today takes 149 clicks to ask.

---

## 4. Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`, so with it false there is
   nothing there to be wrong about — deliberate, not a bug.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.** §6 is likely
   client-only, like §4 was — `GET /api/conductors` already publishes all 149 runs with no password.
4. **A test asserting an absolute count against an authored file goes red as I author.** This has bitten
   three times and been paid three times. The cure is always the same: **reconstruct the indexing
   pass's own answer from `was`, and assert against that.** `INDEXED` in
   `test_extraction_generator.py` and `loadReal` in `wiring.test.ts` are the two implementations and
   both carry the reasoning. **§6's count of unclaimed runs is exactly this trap** — get 149 with a
   one-liner, never hard-code it, and expect the claimed half to move under you.
5. **`H18` — three whole-document drafts over three authored files.** They must not learn about each
   other. `wiringModel.pathStale` and the trace's target tag are the only two places two of them
   meet, and both meet them *as arguments*. **`H26` is written and is the newest hazard in the
   book** — read it if you touch the trace.
6. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before touching
   `features/locate/wiring.ts`.
7. **`H25` — the `W` table is no longer the list of wires that exist.** A record saying `"added": true`
   is a wire I put there; an unknown id *without* it is still a typo and still refused by name.
8. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it must
   supply the file.
9. **`H20` — geometry is free and connectivity is not.** `GET /api/conductors` has no editor password,
   on purpose, which is why §6 needs no server change.
10. **A panel's plumbing is three edits, and `TargetPanel.tsx` is all three** — the props interface,
    the sub-panel that renders it, and the call site in `LocateTab`. §4's reading list named none of
    them. Assume the same gap in §6 for `DrawingTab.tsx`.
11. **The test file for a panel is not named after the panel.** Commoning is tested in
    `WiringPanel.test.tsx`; the Drawing tab's overlays are in `DrawingTab.test.tsx`. Look before
    starting a new spec file.
12. **`wiringStore.edit` takes no note**, unlike the locations store's. One `tsc` error if you assume
    otherwise.

Running it:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks, currently green at **261 server · 473 web · ruff clean · tsc clean**:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Start from green.** A red check in a session that has written no code means something else is wrong —
say so loudly. The one exception is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which is red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names which. That is `K6` doing
its job; clear it with the generator first so you can tell your breakage from mine. **It is red right
now**, because I authored `TB-110`, `TB-130` and some locations after the last commit — a wiring
change also needs `build_kg.py` afterwards, and the failure message says so.

**Two venvs, and only one has `pymupdf`:** `/home/js/schematics/.venv/bin/python` can read the PDF
(`page.get_drawings()` with a clip is cheap and exact); `server/.venv` cannot, and neither can system
`python3`. *Is the ink there, or did we miss it?* has cost this project three open items — that venv is
how you answer it. §7 is the phase that needs it.

---

## 5. What not to do

- **Do not author anything in the four authored files.** The run is mine. To verify a write loop end to
  end: back the file up, write one record through the running server, check the generator folds it in,
  restore, and prove it with `md5sum` — `git status --short schematic_extraction/` coming back
  **unchanged from how you found it** is the proof. Every session since Session 2 has done it that way.
  (§4 did it with one `curl`-equivalent PUT and an `X-Editor-Password` header, which is all the auth
  those routes have.)
- **Do not renumber anything.** Proved unnecessary; 48 placed `TB-*` points and 113 end-label overrides
  stay where they are.
- **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the shape
  rule found, not a conductor list a hand trace computed, and **not a conductor the overlay calls
  unclaimed.** `W042` is the standing reason: I pressed *I looked and it was right* on a wire the ink
  says nothing about, and that was the correct answer.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

  Neither §6 nor §5 moves the artifact, and §7 does not either because it does not re-extract.
- **Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** If you need
  a number, get it with a `python3 -c` one-liner that prints a summary. §4 answered four measurement
  questions that way for a few hundred tokens each; it is the single biggest saving available.

---

## 6. Two things I want built *for*, not just built

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's own
   tables; everything in `server/app/` and `webui/src/` knows only shapes. **If you find yourself typing
   `TB-` into the server or the client, stop.** §4's gate is the worked example of doing this right —
   *two or more of this component's terminals on one net* — and the plan's §4 records why the gate it
   originally specified could not be written.
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except `commoning`,
   which stores polylines and already carries an optional `page` for exactly that day.

---

## 7. The budget, and how to check it

I fund this from API credits, so tokens are money and the plan's §10 is not advice.

**Measured over 27 session transcripts: $1,055.60 spent to date.** §4's own session was **$23.84** at
136 K average context — inside its $25–55 estimate, and the cheapest phase-sized session this project
has had. The two $100 sessions ran at 407 K context over ~400 calls, where cache reads were 84% of the
bill. The spread is roughly **6× for the same thinking.**

Price a session, including the one you are in:

```
ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
# then sum message.usage over the file: input ×$5, output ×$25,
# cache_creation ×$6.25, cache_read ×$0.50, per 1M tokens (Opus 5)
```

**Sanity marks while working:** at 60 calls you should be around $3–6. Past $25 before the tests are
written means the reading list grew — cut the phase rather than push it through. A phase should land
near $20 at ≤140 K context and ≤200 calls, which is what §4 did.

**Say what the session cost at the end.** About **$110** of the $150 I funded remains, against the
plan's $47–98 for the three phases left.

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

   *Currently uncommitted and known:* `wiring.json` and `locations.json` — my authoring since
   `5c38400`, including the two hand-drawn buses. `circuit_logic.json` is therefore behind and wants
   the generator plus `build_kg.py`. **I may be editing those two files while you work**, so re-read
   rather than trusting a count you took at the start.

3. **Tell me afterwards** which files I asked you to read that did not earn their tokens, and which files
   you needed that I did not name. I use it to rewrite this file — traps 10, 11 and 12 above came from
   that answer last session.

4. **Keep token usage as low as you can without lowering quality.** Use your knowledge of bash to avoid
   reading what you can measure, and batch independent calls into one message.

---

## 9. If you are picking this up cold and §1 does not apply

The four things a session might otherwise be, in the order I would want them:

1. **The plan's remaining phases** — §6 the coverage overlay, §5 the orphaned end-label rows, §7 the
   extractor's layer fix. All specified; none needs new design.
2. **The rest of the authoring surface** — the plan's **§14** audit. `author_circuit_logic.py` is the
   one authored input with no screen at all, so *whether a terminal exists* and *which net it is on*
   are still Python edits. It **wants a plan, not a session**, and it becomes urgent on drawing two.
3. **The `Ask` tab driving the highlight.** The loop is already closed one click wide —
   `prompts.py` makes the model spell identifiers, `Markdown.tsx` renders them as `Citation`, and
   `Citation.tsx` calls `select(kind, id)` and switches tabs. Widening it so an answer paints a whole
   net is the next real feature **after** the plan, deliberately: the highlighting has to be
   trustworthy before anything reasons on top of it. **No plan document yet — write one and stop.**
4. **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
   pointed at a drawing. It is the test of everything above and **wants a plan, not a session.**
5. **Something I have found while working.** Most likely I do not understand how to use what you have
   built and need instruction, or something is not working. This overrides §1.

**Plans are documents first.** Write the plan into `_claude_notes` and stop — I read plans and execute
them in separate sittings, and the plan is the cheap half.
