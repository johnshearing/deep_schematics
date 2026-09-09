This document was written by the previous Claude Code session on my (John's) behalf.
These are the instructions for the current session.

Greetings.

**This session builds Phases C and D of `_claude_notes/authoring_the_wires.md` — a terminal
block's commoning, a net you can actually see, a terminal's wires, and *is there a wire here*.**
Sessions 1 and 2 landed on 2026-09-07 and 2026-09-08, and are committed (`bc1ce3c`, `a510f1b`). I
walked T-1000–T-1090 and everything worked — **and while I was walking them I made three real
decisions and committed them**, so the authoring run has started. See *Where the project is*.

**Build this session only.** The plan's §13 has four sessions plus my own authoring run, and it
says why they are separate: I walk the lessons between them and the next phase assumes I have.
**After this session I start the run** — §13 says so, and it is the reason this session is the last
one before it.

---

## Where the project is, in one paragraph

`circuit_logic.json` is generated from three authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn — 131 terminal points, 47 component
sites, 58 wire routes, all placed by me), and `wiring.json` (which two terminals each wire *joins*).
`label_corrections.json` is a fourth authored file the generator does **not** read.

Since 2026-09-08 there is a screen for `wiring.json`: a `Wiring` filter on the Locate tab, a queue
reading `n of 71 wires confirmed`, two end slots per wire, and the ink proposing an endpoint for
each.

**The queue reads `3 of 71` today, and those three are real.** I used the screen while walking the
lessons and committed what I did:

| | | |
|---|---|---|
| `W019` | `PS1:-2` → **`TB-GND-B:2`**, `was` `TB-0V:2` | one of the eleven — the 0 V-to-ground bond |
| `W063` | `INFEED1:3` → **`TB-120:1`**, `was` `TB-120:2` | one of the eleven |
| `W042` | `PB2:3` → `TB-0V:6`, **no `was`** | confirmed unchanged: the ink is wrong and the data is right |

`circuit_logic.json` and `custom_kg.json` were regenerated and agree, and `W019` now carries
`net_mismatch: {"from": "0V", "to": "GND"}` in the artifact — decision 5's flag, visible in the file
the model reads. **So the diagnosis is now: nine of the eleven still to correct, thirteen still
needing my eyes, and 68 of 71 records still saying `source: index`.**

Two things follow that you need to hold on to:

- **the numbers in the plan's §3 and in every document are the *original* census** and are not
  updated as I work. `wiring.json` is where the current state is, and `was` is where the machine's
  original answer is kept. Read the file, not the prose, if a count matters;
- **a test that asserts an absolute count against these files will go red as I work.** That has now
  happened twice and it is trap 4 below. Do not add a third.

**What is left is the reader's half.** Everything built so far is an editor. Nothing yet lets me
*look* at the sheet and see whether a net is complete, whether a terminal has the wires it should,
or whether a line I am pointing at belongs to anything. That is this session, and §7 of the plan
calls it the second of the two screens.

---

## What to read, in this order

1. **`_claude_notes/authoring_the_wires.md`** — whole. It is the plan. **§6** is the `commoning`
   file format, **§7** is the two screens and carries the hazard Phase C has to assert, **§4 q6** is
   the sheet hit-test in detail, **§4 q7** is a terminal's wires, **§4 q10** is the `W063` repair
   that is now **yours to do**, **§9** is the phases, **§11** is the document you deliver, and
   **§15 is the record of what Sessions 1 and 2 actually did**, including eight places where the
   execution departed from the plan and why. **Read §15 before you trust §3, §8 or §9 literally** —
   three of §3's own numbers are corrected there by measurement.
2. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index,
   whole. **§5i** is Session 2. **§5a** is what is in the files. **§7** is the known issues. **§8**
   is the rule about routes, and Phase C is the first thing that stores a polyline which is *not* a
   wire's route — read it before you decide where commoning lives.
3. **`_claude_notes/locate_tab_testing/06_code_map.md`** — behaviour → file and symbol, and hazards
   `H1`–`H24`. **`H24` is new and is the arithmetic Phase C builds on.** `H11`, `H17`, `H18` and
   `H20` are the four Phase D can break, and `H20` is the one it makes *wrong* rather than merely
   fragile. Read it before writing anything.
4. **`_claude_notes/locate_tab_testing/15_tests_wiring_editor.md`** — **T-1060 especially**, which
   is the commoning as it already behaves, and **T-1090**, which is the list of what was
   deliberately left for you. This is the document your new one is a sibling of.
5. **`_claude_notes/locate_tab_testing/07_drawing_facts.md`** — the real ids and coordinates.
   **§*"The commoning, and the six wires the ink cannot reach"* is new, measured 2026-09-08, and is
   the table Phase C authors against.** Note the `W063` row is still wrong on purpose — see *What
   to repair*.

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** The
plan's §3, `07_drawing_facts.md` and `15_tests_wiring_editor.md` exist so you do not have to. If you
need a number, get it with a `python3 -c` one-liner that prints a summary.

---

## What Session 3 is

### Phase C — the commoning, and a net you can see

**This is the change I asked for on 2026-09-06:** *"these vertical lines are the block's own
commoning, but when we highlight a net the commoning needs to be highlighted too — this will make
it easier to see the net."* Net `0V` should paint eleven wire runs **and** the 279.6 pt vertical
they all land on. That is the thing that makes a net legible on paper.

**You are not starting from nothing.** `webui/src/features/locate/wiring.ts` already finds a
block's bus **by shape** — two or more of one component's terminals lying on one conductor — and it
recovers all eight of this sheet's commoning conductors having been told nothing about the drawing.
`isCommoning(index, conductorId)` already answers *no wire may claim this run*. What Phase C adds is
three things that module deliberately does not do:

- **the geometry.** §6 stores `runs` — a list of polylines — and not just `conductors`, because
  `C0105` and `C0008` are each **partly a wire and partly bus**. `C0105` is one conductor holding
  `DISCHARGE1:2`'s wire *and* all 279.6 pt of `TB-0V`'s vertical, so pointing at the whole conductor
  would highlight that wire as though it were the bus. `wiring.ts` computes exactly the stretch you
  need — `stretches()` and the effective-end arithmetic — and both are **private**. Exporting the
  bus polyline for a component is the natural extension, and doing it there rather than re-deriving
  it is what keeps one answer to *where is this block's bus*;
- **the server's half.** `server/app/wiring.py` parses `commoning` for its **key and its shape
  only**, on purpose, and says so: a key that is not a component is refused by name and the body is
  carried through untouched. Phase C defines what is inside — `runs`, `conductors`, and the two
  provenance axes, with **`derived` refused by name on both**, which is §8's rule made enforceable;
- **the screen, and the highlight.** `pathsFor` in `webui/src/lib/paths.ts` is the one answer to
  *what does this selection paint*, shared by both tabs so they cannot come to disagree about what
  net 120 is. A net's case gains the commoning of every block holding one of its member terminals.

**Acceptance:** selecting net `0V` paints eleven wire runs and the vertical they land on; **saving a
commoning record leaves `circuit_logic.json` current, asserted in bytes** the way
`test_a_path_does_not_reach_the_netlist` does. Commoning is display geometry: no `W###`, no
`CONNECTS_TO` edge, no entity, and it never enters the netlist.

**And §7 asks for one assertion while it is still true.** A block's commoning belongs to *one* net
today — every multi-point block's points share a single net — but nothing enforces it, and a block
whose points ever spanned two nets would paint the whole bus for both. **Assert the one-net property
now**, so the day it stops being true a test says so rather than a highlight.

### Phase D — a terminal's wires, and *is there a wire here*

Four pieces, and **three of them need no server change**:

- **`pathsFor`'s third case.** `kind === 'terminal'` returns the wires whose endpoints include that
  terminal, the union of their runs, **plus the commoning of that terminal's block**, with the same
  `geometry`/`attribution`/`mixed` collapsing it already does. It returns `null` for a terminal
  today, deliberately, and the docstring explains why — replace the reason, do not just delete it.
- **The reverse index, terminal → wires.** It is not in the payload: `/api/designators` publishes
  `terminals` on each wire and net, not wires on each terminal. It is one pass over the wire entries
  the client already has, so it belongs in `webui/src/lib/designators.ts` beside `readerRowState`.
  `wiringModel.terminalNets` is the same shape of reverse pass and is the precedent. **No server
  change for this one.**
- **The sheet hit-test.** A click on bare paper names the nearest conductor polyline within a few
  points, hit-tested in **point space** through the same `tileDestRect` projection every marker uses
  (invariant 2 — one projection, never a second). The card says `C0059, RED 16AWG, printed 120` and
  then one of *claimed by `W063`*, *`TB-120`'s commoning*, or ***no wire claims this run.***
- **`GET /api/conductors` losing the editor password.** *Is there a wire here* is a reader's
  question. **Server change — restart needed**, and it is the only one this session has.

**Acceptance:** clicking `TB-0V:6` on the Drawing tab highlights `W042` and the commoning and says
so; clicking `C0092` says *`TB-120`'s commoning*; clicking a label leader says *no wire claims this
run*, **beside the count of how many wires have a route yet**; and `/api/conductors` answers with
`SWUI_ALLOW_EDITS=false`, which is the criterion §11 names.

**One honesty requirement, and it is not optional.** Until my authoring run is finished, *"no wire
claims this run"* is the answer for around **90 of the 149** — most of them label leaders and symbol
strokes. The card must say **how many wires have a route yet** beside the verdict, or the feature
teaches a false fact on its first use. `PathSummary` already carries `wires` and `traced` for exactly
this reason.

**And decision 7 is what keeps the two tabs apart.** Clicking a terminal on the **Drawing** tab
highlights every wire attached to it — a reader's question, on the reader's tab, no password, no
draft, nothing to move. Clicking one on the **Locate** tab still places or moves. Clicking a
terminal on the Drawing tab already *selects* it, so this is a change to what the selection
**paints**, not to what the click **means** — which is `relatedIds` and `H11`, and is what stops
`H10`'s collision getting a third occupant.

### What to repair, and it is now yours

**§4 q10's `W063` correction, and it is now more than a documentation fix.** Session 2 was told to
leave it because it belongs with the commoning work. Since then **I have corrected `W063` in
`wiring.json` and regenerated**, so the netlist says `INFEED1:3 → TB-120:1` while the fixture and
the drawing-facts row still say `:2`. They now contradict committed data rather than merely being
out of date. The finding itself is already executable — `wiring.test.ts` asserts `C0092` is
`TB-120`'s bus and is offered to nothing. What is left:

- **`webui/src/features/locate/paths.test.ts`**: the `W063` fixture's second endpoint,
  `['TB-120:2', [300.1, 639.6]]` → `['TB-120:1', [300.1, 563.3]]` (line ~91); the file header's
  `W063` line (~18); and the name of the test *"offers `C0091` and `C0092` for `W063`"* (~148).
- **Add the assertion that carries the finding** — *`C0092` is `TB-120`'s commoning and no wire may
  claim it.* **§4 q10 warns that this is a trap: both of that test's assertions still hold after the
  correction**, because `C0091` ranks first *more* strongly and `C0092` stays in the list on
  proximity. So a fixture corrected carelessly here will not go red, and the new assertion is the
  whole point of touching it.
- **`07_drawing_facts.md`**: the `W063` row, and the sentence under that table claiming *"the second
  half of a real path is routinely a conductor with no printed net label (`C0092`, `C0057`)"*.
  `C0057` still makes that point and `C0092` never did — a bus has no printed name because it is not
  a wire. The argument survives on one example instead of two, and it is the better one.
- **`14_tests_path_editor.md` T-915** tells me to accept `C0091` and then *add `C0092`* to `W063`.
  That instruction now authors a route that includes the block's bus. Correct it, and say why.

**One thing you do *not* have to worry about:** no route is affected. `W063` has a `labels` entry
and **no `path`** — as do `W014`, `W018` and `W019` — which is §4 q9's finding holding up exactly as
predicted: *I authored no path for any of the thirteen wires I flagged.* I checked on 2026-09-09 and
**nothing on this drawing is currently stale.** Which means the other thing worth knowing:
**`path may be stale` has no live instance yet.** It is asserted six ways in `wiringModel.test.ts`
and once end-to-end in `WiringPanel.test.tsx`, and it has never fired on the real sheet. If Phase C
or D gives you a cheap way to exercise it against real data, take it — otherwise say so in your
report, because *"tested but never seen"* is worth my knowing before I trust it during the run.

**One decision I want you to make deliberately rather than by default:** once a block's commoning is
authored, should `paths.ts` `candidates()` **stop offering** those runs as a wire's route? It would
turn *no wire may claim it* from an assertion into something the screen enforces. My inclination is
yes, and the reason to be careful is that `candidates()` currently has no access to the wiring
document — so it is a plumbing change on the busiest ranking in the project. Weigh it, do whichever
you can argue for, and write the argument down.

---

## Anchors, so you do not start with a search

| What | Where |
|---|---|
| A block's bus, already found by shape — and the two private functions Phase C wants | `webui/src/features/locate/wiring.ts` — `inkIndex`, `InkIndex.commoning`, `isCommoning`, and the private `stretches` / effective-end arithmetic |
| The one answer to *what does this selection paint*, shared by both tabs | `webui/src/lib/paths.ts` — `pathsFor`, `PathSummary` (`wires`, `traced`, `mixed`) |
| Where the commoning records are parsed today, key and shape only | `server/app/wiring.py` — `parse`'s `COMMONING_SECTION` branch, `resolve_wiring`'s component check |
| The `runs`/provenance validation to model Phase C's on | `server/app/locations.py` — `WirePath`, `_paths`, `GEOMETRIES`, `ATTRIBUTIONS`, `DERIVED` |
| The store and the draft that already own `wiring.json` | `webui/src/stores/wiringStore.ts` — and read its header before adding a second writer |
| The reverse-index precedent, and where the terminal → wires one belongs | `webui/src/lib/designators.ts` — `readerRowState`; `wiringModel.ts` `terminalNets` |
| What the selection marks, and the switch exemption | `webui/src/features/drawing/DrawingTab.tsx` — `relatedIds`, `located`, `markers`, `shown` |
| The card that has to say the three verdicts | `webui/src/features/drawing/SelectionCard.tsx` — `PathNote`, `GEOMETRY_WORD`, `ATTRIBUTION_WORD`, `MemberRow` |
| The one projection, both directions, and the stroke | `webui/src/features/drawing/paint.ts` — `cssToPoint`, `pointToCss`, `polylineToDevice`, `paintRuns`, `HIGHLIGHT`, `CANDIDATE` |
| The gate Phase D opens, and the test that pins it shut | `server/app/main.py` inside `if settings.allow_edits:`; `server/tests/test_conductors.py` `test_a_reader_never_downloads_the_ink` |
| The narrowing that must survive freeing the route | `server/app/main.py` `_traceable`; `test_a_conductor_carries_only_what_tracing_needs` |
| The 149 polylines, and each end's bound symbol | `GET /api/conductors`; `server/app/ink.py` `Conductor.points`, `Binding` |
| The eight commoning conductors, measured | `07_drawing_facts.md` §*"The commoning, and the six wires the ink cannot reach"* |

---

## Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart, and this
   session has a server change.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.**
4. **A test that asserts an absolute count against an authored file goes red as I author.** This
   has bitten **twice now, on my first three decisions**, and both were found and fixed on
   2026-09-09 — read the fix before you write a whole-drawing test:

   - `test_a_confirmed_correction_reaches_the_netlist_and_says_who_made_it` and
     `test_a_wire_nobody_has_confirmed_carries_no_provenance_at_all` (Session 1) asserted
     *"1 confirmed by a person"* and *"no wire carries `endpoints`"* against the **live**
     `wiring.json`. They were really asserting *nobody has authored anything yet*.
   - `wiring.test.ts`'s *"does not even offer the screw the netlist claims"* and *"agrees on 48
     wires"* (Session 2, mine) anchored to the **netlist's current endpoints** — and
     `circuit_logic.json` is generated from `wiring.json`, so correcting `W019` made the netlist
     stop claiming the wrong screw and inverted the assertion.

   **The cure both times was the same and it is the pattern to copy: reconstruct the indexing
   pass's own answer from `was`, and assert against that.** `was` keeps the machine's answer
   forever — that is what it is *for* — so a claim about what the machine guessed is true for the
   whole run. `INDEXED` in `test_extraction_generator.py` and `loadReal` in `wiring.test.ts` are the
   two implementations, and both carry the reasoning. Session 1's §15 had already spotted this once
   and written one test to survive; the tests beside it were not. **Assume I will confirm all 71 and
   correct twenty-two, and write accordingly.**

5. **`H18` — three whole-document drafts, and Phase C is the first thing that could put two writers
   on one file.** `wiringStore` owns `wiring.json`, and `commoning` lives in it. If you author
   commoning from a *second* store or a second screen, `H1` fires **inside a single file** — a
   placement-style last-write-wins between the wiring queue and the commoning editor, which is
   exactly what having three separate files was supposed to have made impossible. **Author it
   through `wiringStore`**, and keep it on the Locate tab beside the wiring queue unless you can
   argue otherwise in writing. §12's table already put the wiring editor there.
6. **`H20` is the hazard Phase D makes *wrong*, not merely fragile.** It currently argues that
   `/api/conductors` is gated and `/api/paths` is not, ends with *"the two must not be merged for
   convenience"*, and `test_a_reader_never_downloads_the_ink` asserts **404 and 200 in the same
   test** because the fact worth pinning was that two sibling-looking routes sit on opposite sides
   of one gate. Phase D removes that gate. **Rewrite the hazard and the test with the new
   reasoning** — do not delete either. The property that survives is `H17`: what a reader may not
   have is a section of `geometry.json` nobody narrowed, and `_traceable`'s key-by-key boundary with
   no `**rest` becomes *more* load-bearing once anyone can call it, not less.
7. **`H11` — the selection shows through a switched-off layer.** A net's commoning is a new thing to
   paint, and it must obey the same exemption the rings and the end labels do: the highlight is read
   off the **selection alone**, so it survives its own switch being off. And `located` must stay
   built from the components group whether or not that group is on, or every `runs through` chip
   goes dead.
8. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before
   touching `wiring.ts`. A landing must be nearer *this* end of a run than the other (`C0017` is
   17.2 pt long and `W069`'s correction disappears without that clause), and only
   `placement: 'confirmed'` pins may be fed to it.
9. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it
   must supply the file. Several tests already do.

Running it, if you need to look at something:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks, currently green at **229 server · 392 web · ruff clean · tsc clean**:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Start from green.** A red check in a session that has written no code means something else is
wrong — say so loudly. The plan's §10 expects roughly 35 new server tests and 55 new web tests
across all of Phases A–E; Sessions 1 and 2 have spent **57 and 74** of those, so the estimate is
already behind and is not a budget.

---

## What not to do

- **Do not add a fourth `source: human` record, and do not author any commoning record.** Three
  exist and they are **mine** — `W019`, `W063`, `W042`, made on 2026-09-08 and committed. The run
  is Phase F and it is mine: §13 says it starts after this session, and nine quick edits by a coding
  session would leave 47 confirmations unrecorded and the run unstarted. Build the screen; leave
  the file alone.

  **If you need to verify a write loop end to end, do what Session 2 did**: back the file up, write
  one record through the running server, check the generator folds it in, then restore and prove it
  with `md5sum`. Everything is committed now, so `git checkout -- schematic_extraction/` is an even
  cleaner restore, and `git status --short schematic_extraction/` coming back **empty** is the
  proof. That is how the 2026-09-09 housekeeping proved its own test fix without leaving a mark on
  your data.
- **Do not start Phase E.** `Add a wire` and `Retire this wire` are last on purpose: §3.7 measured
  **0** genuinely missing field wires, so it is insurance for drawing number two. The format is
  already ready for it and the door is deliberately shut — a record for an id the `W` table does not
  have is refused by name.
- **Do not renumber anything.** Decision 3, proved unnecessary in §3.4 and confirmed by me: 48
  placed `TB-*` points and 111 end-label overrides stay exactly where they are.
- **Do not auto-accept anything**, and this now applies to commoning too. A run the shape rule calls
  a bus is a **proposal**, exactly as a candidate route is. `TB-130` has no bus conductor at all and
  `TB-120:3` sits off the end of `C0092` — see the questions below — so the rule is already known to
  be incomplete on this sheet. **`W042` is the standing reason**: I pressed
  *I looked and it was right* on a wire the ink says nothing about, and that was the correct answer.
  A screen that had proposed something there would have talked me out of correct data.
- **Do not model commoning as wires.** My answer, 2026-09-06: they are the block's own, not field
  wire, and §3.7's *"0 missing field wires"* depends on that reading. Modelling them as wires would
  put six edges the sheet does not mean in front of the model.

---

## Two things I want built *for*, not just built

These are mine, and Sessions 1 and 2 honoured them. Keep honouring them.

1. **This has to generalise to other drawings.** The long-term goal is a library of indexed
   schematics — a whole factory or sort centre — that a model can answer troubleshooting questions
   about. So the drawing-specific half stays in the extraction's own tables, and everything in
   `server/app/` and `webui/src/` knows only shapes. **Phase C is the test of that.** The bus
   detection already works this way: *two terminals of one component on one conductor*, no prefix,
   no class. If you find yourself typing `TB-` into the server or the client, stop.
2. **This has to generalise to circuits that need several pages.** A wire's endpoints are terminal
   designators, which is why `wiring.json` has no page in it. **`commoning` is the one section that
   will need one**, because it stores polylines and a polyline only means something on a sheet.
   Session 1 flagged this and left room; **this is the session that has to decide.** My preference
   is that you put the page in now, even though this drawing has one — an optional `page` on a
   commoning record costs nothing today and is a schema change later.

And one that is not this session's, named so it is not lost: **the Ask tab should be able to reason
about the highlighted wires, and to turn highlighting on for the wires it is explaining.** The plan
says that lands after Phase D — which is *this* session, so it is next. Everything it needs is what
you are building: a terminal's wires, the commoning on the sheet, and a hit-test that can name what
a line belongs to. **Do not build it. Do leave the seams where it can reach them**, and say in your
report what it would still need.

---

## Questions only I can answer — ask them early, do not model around them

The plan's §14 lists three. **Two of them are now directly in Phase C's way** rather than merely
interesting, because they are blocks with no commoning to author:

1. **`TB-130` has two points, three wires and no commoning conductor at all** — its points are 71 pt
   apart with nothing joining them. Phase C cannot author a bus for it from the ink. Ask me and I
   will zoom in; the answer decides whether the file needs a way to say *this block has no bus* or
   whether I am going to hand-trace one.
2. **`TB-120:3` sits 24 pt below `:2`, off the end of `C0092`.** It may be a third landing rather
   than a separate point. Same offer, and the answer changes what `TB-120`'s bus record covers.
3. **Which of `W044`, `W050` and `W057` is on `TB-0V:8`, `:9` and `:11`** — that one is for my
   authoring run, not for you, and §3.5 has the rows.

And ask me anything where the answer is mine to **decide** rather than mine to look up. The *"what I
decided on your behalf"* table is the right home for the small calls, not for one that changes what
I have to click.

---

## One piece of feedback from walking T-1000–T-1090

I got through every test and everything worked. **I also did not understand everything I was being
shown**, and I said so — it is recorded in `08_results_log.md` beside the result.

That is a result about the *document*, not about the code. `15_tests_wiring_editor.md` taught me the
gestures and not always the reasons, because the reasons were woven through long sentences with the
argument and the instruction in the same breath. **Write `16_tests_terminal_wires_and_commoning.md`
plainer:**

- **the *do* and the *expected* first and short.** I should be able to work the whole document
  without reading a single explanation;
- **the *why* underneath, in one or two sentences, clearly marked as skippable.** Not folded into
  the instruction;
- **leave the arguments in the code.** The module headers and the hazards are where a future session
  needs them, and they are excellent there. A lesson document is for a person with a mouse.

Do not make it shorter by leaving things out — make it shorter per sentence. And keep naming the one
or two cases that matter most, the way `W042` was named: that worked, and it is the part I remember.

---

## What "done" means for this session

1. **Phases C and D built**, both acceptance criteria met — net `0V` paints its eleven runs **and**
   the vertical they land on; a commoning save leaves `circuit_logic.json` current, asserted in
   bytes; clicking `TB-0V:6` highlights `W042` and the bus and says so; clicking `C0092` says
   *`TB-120`'s commoning*; clicking a label leader says *no wire claims this run* **beside the count
   of how many wires have a route**; and `/api/conductors` answers with `SWUI_ALLOW_EDITS=false`.
2. **The `W063` repair done**, with the *`C0092` is commoning* assertion added — and remember that
   the suite will not catch a careless fixture edit there.
3. **The one-net assertion on a block's commoning**, written while it is still true.
4. **The four checks green**, and the new tests named after the properties they defend rather than
   after the functions they call.
5. **`_claude_notes/locate_tab_testing/16_tests_terminal_wires_and_commoning.md`**, T-1100–T-1160,
   per §11: clicking a terminal on the Drawing tab · a missing wire visible by its absence · a net
   highlighted *with* its commoning · authoring a block's commoning · the sheet hit-test and its
   three verdicts · **`/api/conductors` with `SWUI_ALLOW_EDITS=false`, which is the acceptance
   criterion**. Both tabs; no password for the reader's half. **Written plainer — see above.**
6. **The manual's §3 table, a new §5j, §1 counts, and `06_code_map.md`** updated; a dated entry in
   **`change_history.md`** and its **`NEXT UP`** rewritten around Session 4 **and my authoring run**;
   and the plan's **§15** appended with what Session 3 actually did and where it departed.
7. **Report to me in plain words:** what you built, what you are least sure about, what I should
   click first to find out whether it is right — and **what I should do first when I sit down to
   author the remaining 68 wires**, because that starts after this session and you will have just
   built the last screen I need for it. Include **which files want committing**, and say whether
   any test you wrote would go red as I author (trap 4).

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all useful and often the fastest answer. When something ought
to be committed, name the files and say so.

**There are three authored files git cannot regenerate**, and `author_circuit_logic.py` is a fourth
— it is a Python file, but the `W` table and the component, terminal and net tables in it are *my*
data, not code:

    locations.json           where everything is drawn
    label_corrections.json   what the ink says
    wiring.json              what each wire joins  (and, after Phase C, each block's bus)
    author_circuit_logic.py  what each thing is

Treat all four that way. Do not hand-edit `circuit_logic.json` or `custom_kg.json`; both are
generated, and the recipe is two commands:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs
    python author_circuit_logic.py
    python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

**This session should need neither, and that is one of its acceptance criteria.** Commoning is
display geometry: it must not move the netlist, and a test should say so in bytes rather than making
the argument. If you find yourself needing to regenerate, something is wrong with where you put the
commoning — not with the command.

**All of it is committed as of `a510f1b`** — Session 2's code, my three decisions, and the
regenerated artifacts. `label_corrections.json`'s 654 decisions went in with it. So the project has
no unbacked authored work for the first time in weeks, and the thing to protect is that state: **say
at the end of your session which files want committing**, and remember that anything I author while
walking your lessons lands in the same commit as your code unless I am told to separate them.
