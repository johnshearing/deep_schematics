Greetings. Background first, then the request at the bottom. **Read this file whole — it is short on
purpose — and then do §1 and nothing else.**

---

## 1. The request

**Read `_claude_notes/goals_01.md`, then `_claude_notes/highlighting_wires_and_nets_03.md`, both
whole. Then execute plan 03's §4 — Phase 3a — and stop there.**

In my own words, because this is the one I want most:

> **The all-paths overlay on the Locate tab — every authored route and bus painted at once, one
> colour, toggled, with `58 of 71 wires have a route` in the legend. The unpainted ink is then my
> queue, read off the paper. It reuses the layer built on 2026-09-13. Half a session. Remove
> `Unclaimed ink` in the same change.**

*(That count was **58 of 71** when I wrote it and is **59** today. Get it from the payload, never
from this page.)*

Those two documents are self-contained. `goals_01.md` is the definition of done — the nine features
I must be able to author and the eight things the model must be able to highlight, audited against
the tree on 2026-09-15. Plan 03's §3 line numbers were read out of the files the same day.
**Trust its reading lists over your instinct to look around**; that instinct is what makes these
sessions cost $100.

**One phase per session.** When §4's acceptance criteria are met, write up what happened and stop,
even if there is context left. §5 and then §6 are the two sessions after this one; §7 and §8 are
plans to write rather than code.

**§6 of plan 02 shipped on 2026-09-13 and I walked it — and then rejected it.** Do not rebuild it
and do not defend it; §2 below says why in one sentence, and plan 03 §1 says it properly. Its code
stays in the tree as a diagnostic.

*If I have found something while working since, I will say so in this session and that overrides the
above. Otherwise §4 is the job.*

---

## 2. What this project is

A WebUI where **a human points at features on a schematic and they become JSON a model can reason
over** — and where the highlighting is what proves the JSON is a complete and correct representation
of the sheet. `PS20115MLM4-2` is the test specimen, not the goal; the goal is a library of indexed
drawings and a system that works on any of them.

The long-term aim, so nothing here loses sight of it: **the model highlights notes, components,
terminals, paths, path_nets, path_cables, labels and symbols on the drawing as it speaks its answer
to me.** `goals_01.md` is that list audited against what exists. Everything I ask for is one of
those items.

`circuit_logic.json` is generated from four authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn), `wiring.json` (which two terminals each
wire *joins*, plus each block's bus), and — read by the app, not the generator —
`label_corrections.json` (what the ink says).

**What I rejected on 2026-09-15, and why it matters more than the feature did.** Plan 02's §6 painted
every run of ink that no wire's route and no block's bus claimed. It works, and it does not move us
toward the goal: **the conductors are the model's notion of where the ink is, and I can see the ink
itself.** The extractor missed 41 lines, about 90 of the 149 conductors are leader lines and symbol
strokes nothing will ever claim, and one place on the sheet is drawn wrong — so *unclaimed
conductors* measures the extraction, not the JSON. `prompts.py:52` even tells the model **"Do NOT
read `geometry.json`."** What I need is the opposite view: **paint what has been authored and let my
eye find the rest.** That is §4.

**Where the authoring stands, measured 2026-09-15. Read the files, never the prose, if a count
matters** — every document in this project quotes the census of the day it was written, and I author
between sessions.

| | |
|---|---|
| `locations.json` | 131 placed terminals · 41 components at 47 sites · **59 wire routes, 17 hand-traced** · 113 end-label overrides on 56 wires |
| `label_corrections.json` | 654 decisions |
| `wiring.json` | 71 records, **3 `source: human`** · **6 commoning blocks, 2 drawn by hand** |
| the ink | 149 runs · 44 claimed by a route · 7 by a bus · 98 claimed by nothing |

Get any of those with a one-liner:

```
cd schematic_extraction/PS20115MLM4-2/extracted_docs && python3 -c "…"
```

**The authoring run is mine and it has barely begun.** All six commoning blocks are decided and I am
working through the paths now. §4 does not touch my queue; it tells me where the queue *is*, which
is the thing I have no way to see today.

---

## 3. Why the plan exists, in one paragraph

Every editor so far was built as a **confirmation surface**, not an **authoring surface**: each panel
takes its list of objects from something the machine found and its edit control from a proposal the
machine computed, so where the machine found nothing there is no row and no button. On 2026-09-11 the
answer to two of my authoring questions was *hand-edit the JSON*, and I deliberately did not do it —
a hand edit produces correct data and destroys the finding. **An un-authorable thing is a named gap in
a panel, not a file edit.** Wires and paths now have both halves; commoning got them on 2026-09-12.
**What still has no screen at all is `author_circuit_logic.py`** — whether a terminal exists, which
net it is on, what a component is, and the drawing's notes — and that is plan 03 §7. The highlighting
half is correct per object and has no *complete* view until §4 paints the whole of what I have
authored at once.

---

## 4. Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`, so with it false there is
   nothing there to be wrong about — deliberate, not a bug.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.** §4 is one server
   function plus client work, so it needs both.
4. **A test asserting an absolute count against an authored file goes red as I author.** This has
   bitten three times. The cure is always the same: **reconstruct the indexing pass's own answer from
   `was`, and assert against that.** `INDEXED` in `test_extraction_generator.py` and `loadReal` in
   `wiring.test.ts` are the two implementations and both carry the reasoning. **§4's legend counts are
   exactly this trap** — get them from the payload, never hard-code, and expect them to move under you.
5. **`H18` — three whole-document drafts over three authored files.** They must not learn about each
   other. `wiringModel.pathStale` and the trace's target tag are the only two places two of them meet,
   and both meet them *as arguments*. **`H26` is the newest hazard in the book** — read it if you
   touch the trace. **§4 is a third place they could meet and must not**: the overlay reads the
   published `/api/paths`, never two drafts.
6. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before touching
   `features/locate/wiring.ts`.
7. **`H25` — the `W` table is no longer the list of wires that exist.** A record saying `"added": true`
   is a wire I put there; an unknown id *without* it is still a typo and still refused by name.
8. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it must
   supply the file.
9. **`H20` — geometry is free and connectivity is not.** `GET /api/paths` and `GET /api/conductors`
   have no editor password, on purpose, which is why §4 needs no new endpoint.
10. **A panel's plumbing is three edits, and `TargetPanel.tsx` is all three** — the props interface,
    the sub-panel that renders it, and the call site. Assume the same gap in every reading list.
11. **The test file for a panel is not named after the panel.** Commoning is tested in
    `WiringPanel.test.tsx`; the Drawing tab's overlays in `DrawingTab.test.tsx`. Look before starting
    a new spec file.
12. **`wiringStore.edit` takes no note**, unlike the locations store's. One `tsc` error if you assume
    otherwise.
13. **A new canvas overlay is four edits in `TileSheet.tsx`** — the prop, the paint call in the layout
    effect, the `data-` attribute a test reads it through, **and the effect's dependency array.** The
    fourth is silent: a missed dependency is a stale frame, not an error. This is what §6's reading
    list missed on 2026-09-13.
14. **The Locate tab paints one target at a time.** `LocateTab.tsx:621` is
    `draftRuns(document, paths, targetEntry)`, and `draftRuns` (`features/locate/paths.ts:410`)
    prefers the unsaved draft over the saved index. That is the thing §4 changes, and the distinction
    between *the armed row's route* and *the whole sheet's authored routes* is the whole design.
15. **`/api/paths`'s `nets` map is built from the generated `wires[].net`**
    (`server/app/drawing.py:332-338`), which holds one net per wire. `W019` bonds `0V` to `GND`, so
    selecting `GND` does not paint it today. §4.6 fixes it from `member_terminals`. There is exactly
    one such wire on this sheet and there will be more on other drawings.

Running it:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Start from green, and read the counts off your own run rather than off this page** — they moved
twice in the last week. A red check in a session that has written no code means something else is
wrong — say so loudly. The one exception is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which goes red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names which. That is `K6`
doing its job; clear it with the generator first so you can tell your breakage from mine. **It was
green on 2026-09-15** — my path authoring does not reach the netlist, by design.

**Two venvs, and only one has `pymupdf`:** `/home/js/schematics/.venv/bin/python` can read the PDF
(`page.get_drawings()` with a clip is cheap and exact); `server/.venv` cannot, and neither can system
`python3`. *Is the ink there, or did we miss it?* has cost this project three open items — that venv
is how you answer it, and plan 03 §6 is the phase that needs it.

---

## 5. What not to do

- **Do not build a conductor editor, and do not build another view over conductors.** Struck twice:
  2026-09-13 as a thing to author — a conductor is a measurement of the paper, so drawing one would
  be inventing ink — and 2026-09-15 as a thing to view, for the reason in §2. What a person authors
  is the **interpretation**: *this run is that wire's route*, *this stretch is that block's bus*, and
  where the ink is missing they draw it directly, which is what `geometry: "human"` records. Ink the
  extractor lost is a **bug upstream** (plan 03 §6), not a gap in the screen.
- **Do not author anything in the four authored files.** The run is mine. To verify a write loop end
  to end: back the file up, write one record through the running server, check the generator folds it
  in, restore, and prove it with `md5sum` — `git status --short schematic_extraction/` coming back
  **unchanged from how you found it** is the proof. Every session since Session 2 has done it that way.
- **Do not renumber anything.** Not terminals, not `C####` ids, and not spent T-numbers: `19_`'s
  T-14xx are used, so §4's tests start at **T-1450**.
- **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the shape
  rule found, and not a conductor list a hand trace computed. `W042` is the standing reason: I pressed
  *I looked and it was right* on a wire the ink says nothing about, and that was the correct answer.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

  No phase in plan 03 moves the artifact.
- **Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** If you
  need a number, get it with a `python3 -c` one-liner that prints a summary. On 2026-09-15 four
  one-liners answered every measurement question in this file for a few hundred tokens each; it is the
  single biggest saving available.
- **Do not read the lesson documents in `_claude_notes/locate_tab_testing/1x_tests_*.md`.** They are
  written for me to walk. A lesson document is the **output** of a phase, never its input.

---

## 6. Three things I want built *for*, not just built

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's
   own tables; everything in `server/app/` and `webui/src/` knows only shapes. **If you find yourself
   typing `TB-`, `W019` or `C0060` into the server or the client, stop.** The commoning gate — *two or
   more of this component's terminals on one net* — is the worked example of doing this right, and
   §4.6's *either end is a member of this net* is the next one.
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except `commoning`,
   which stores polylines and already carries an optional `page` for exactly that day.
3. **Build for the model's highlight.** Every feature the model must point at while it answers needs
   **an id in `circuit_logic.json`** — that is the whole reason notes, cables, printed labels and
   symbols cannot be cited today, and it is the constraint that orders plan 03 §7 before §8.

---

## 7. The budget, and how to check it

I fund this from API credits, so tokens are money and plan 03's §11 is not advice.

**Measured over 28 session transcripts on 2026-09-15: $1,052 spent to date.** The two $100 sessions
ran at 407 K context over ~400 calls, where cache reads were 84% of the bill. Recent work, for
comparison: plan 02's §4 cost **$23.84** at 136 K; its §6 **implementation** cost **$11 at 100 K over
128 calls** — the cheapest phase-sized work this project has had — and **the same session reached $32
by 190 calls** once we reviewed the design, re-planned and wrote the three documents that replaced
the plan. Prose at full context is not free either.

Price a session, including the one you are in:

```
ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
# then sum message.usage over the file: input ×$5, output ×$25,
# cache_creation ×$6.25, cache_read ×$0.50, per 1M tokens (Opus 5)
```

**Cost ≈ $0.50 × (context in M tokens) × (number of calls).** Nothing else is close.

**Sanity marks while working:** at 60 calls you should be around $3–6. Past $25 before the tests are
written means the reading list grew — cut the phase rather than push it through. A phase should land
near $20 at ≤120 K context and ≤200 calls.

**Say what the session cost at the end.** About **$93** of the $150 I funded remains, against plan
03's $50–89 for everything left in it.

---

## 8. Four standing instructions

1. **I do all the git work myself. Do not commit and do not push.** Read git freely — `git status`,
   `git diff`, `git show`, `git log` are often the fastest answer. When something ought to be
   committed, name the files and say so.

2. **There are four authored files git cannot regenerate:**

       locations.json           where everything is drawn
       label_corrections.json   what the ink says
       wiring.json              what each wire joins, and each block's bus
       author_circuit_logic.py  what each thing is  (a Python file, but the tables in it are my data)

   **Say at the end of your session which files want committing**, and remember that anything I author
   while walking your lessons lands in the same commit as your code unless I am told to separate them.

   *Currently uncommitted and known:* `locations.json` — my path authoring since `22d0b1b`. **I may be
   editing it while you work**, so re-read rather than trusting a count you took at the start.

3. **Tell me afterwards** which files I asked you to read that did not earn their tokens, and which
   files you needed that I did not name. I use it to rewrite this file — traps 10 to 15 above all came
   from that answer.

4. **Keep token usage as low as you can without lowering quality.** Measure the data with a one-liner
   before reading the code that renders it, read line ranges rather than files, batch independent calls
   into one message, and run the four checks at the start and the end rather than between edits.

---

## 9. If you are picking this up cold and §1 does not apply

The things a session might otherwise be, in the order I would want them:

1. **Plan 03's remaining phases** — §4 the all-paths overlay, §5 the orphaned end-label rows, §6 the
   extractor's layer fix. All specified; none needs new design.
2. **Plan 03 §7 — a screen for `author_circuit_logic.py`.** Notes, whether a terminal or component
   *exists*, and **which net a terminal is on**, which is the sharpest gap in the whole surface because
   net membership is what the highlight paints. It **wants a plan, not a session**, and it becomes
   urgent on drawing two.
3. **Plan 03 §8 — cables, label and symbol binding, and widening the citation loop** so an answer can
   paint a note or a cable. After §7, because §7 is what creates the ids. **A plan, not a session.**
4. **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
   pointed at a drawing. It is the test of everything above and **wants a plan, not a session.**
5. **Something I have found while working.** Most likely I do not understand how to use what you have
   built and need instruction, or something is not working. This overrides §1.

**Plans are documents first.** Write the plan into `_claude_notes` and stop — I read plans and execute
them in separate sittings, and the plan is the cheap half.
