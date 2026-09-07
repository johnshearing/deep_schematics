This document was written by the previous Claude Code session on my (John's) behalf.  
These are the instructions for the current session.  

Greetings.

**This session writes a plan and no code.** The wires-and-nets project is finished and shipped, and
using it has turned up something underneath it: **a wire's two endpoints were never read off the
sheet.** Your job is to understand that with me, argue with my conclusions, and leave a plan document
behind. Do not start building.

---

## What I found, in my own words

I worked through `14_tests_path_editor.md`. **Everything worked as expected**, and I have already
used the `Paths` filter to assign and create visible wire paths for the wires where it made sense.

Some of the wires had errors, so I did not create paths for those. They are still in the `Paths`
list: **W014, W018, W019, W036, W037, W039, W044, W045, W046, W050, W062, W063, W069.**

- **W014** goes from `PS1:GND` to `TB-GND-B:2` when I can see on the schematic it should go from
  `PS1:GND` to `TB-GND-B:1`, which appears to be conductor `C0046`. I cannot fix that by choosing a
  conductor, because one of the wire's *terminals* is wrong.
- **W018** goes from `PS1:-1` to `TB-0V:1` when I can see it goes from `PS1:-1` to `TB-0V:3`. I
  cannot fix it by drawing my own path, because the underlying data is not correct.
- **W019** is worse. Its two terminals are not connected to each other at all except through the
  power supply — they are on the same net but used in very different parts of the circuit, and I can
  see on the sheet that **no wire joins them.** `PS1:-2` is wired to `TB-GND-B:2`; `TB-0V:2` is wired
  to `SPD1:2`. I asked the **Ask** tab *"what terminal is `PS1:-2` connected to and what wire
  connects them"* and it answered `TB-0V:2`. That is wrong, and **we need a way to fix these issues
  so the model can reason correctly about the schematic.**
- **The rest were right at the component end and wrong at the terminal-block end.** So I need some
  way to assign the correct terminals to a wire.

Two more things I want:

- **There are wires on the sheet that are not in our data at all.** I need a way to click a wire on
  the schematic and get some indication of whether a wire exists there or not.
- **I should probably be creating all the wires myself, by assigning two terminals to each one.**
  Then I should be able to click a terminal and see every wire attached to it highlighted — which
  also tells me when I have *missed* a wire, because it will be obviously absent. **That has to be
  separated from clicking a terminal to move it.**

And the realisation behind all of it, which I want you to take seriously:

> The system we have created is very good at recognising components and terminals. I am pretty sure
> it found all of them during indexing. I remember, though, that I had to place the markers for all
> of them because the model's guess was often incorrect. Now I realise the indexing process is not
> accurate in seeing where the **wires** are.

I am willing to roll back the highlighting work and start it over if that is what this needs. A lot
of work and a lot of my money went into it, but plenty was learned, so I do not consider it wasted.
**Tell me honestly whether rolling back is the right call.**

---

## What the previous session measured before writing this, so you do not have to guess

All of this was checked against the shipped files on 2026-09-05. It is the part that is expensive to
re-derive, and some of it changes what the problem *is*.

### 1. The wires are authored in a Python table, and it is one literal

`W` at **`author_circuit_logic.py:635`** — 71 tuples of
`(from, to, colour, gauge, net, cable, note)`. Every id is assigned by **position in that list**
(`for i, (...) in enumerate(W, start=1)`). So `W014` *is* the fourteenth tuple. Correcting an
endpoint is a one-line edit to a hand-maintained file; nothing about it is generated.

**`net` membership does not come from the wires.** It comes from each terminal's own `net` field
(`net_members` in the generator), so the 26 nets and their 127 member terminals are unaffected by
any of this. Everything Session 1's net highlight does is still sound.

### 2. The terminal-block point numbers and the wire assignments are **one** degree of freedom

This is the finding that reframes my list above, and it is the thing to have in your head before you
propose anything.

`INVENTED_TERMINAL_PREFIX = "TB-"`: the point numbers on a terminal block are **ours**.
`EXTRACTION_NOTES.md` §2 of *"Inferences"* says so outright and adds the admission that matters —
*"`TB-0V` is modelled with 12 points; the exact physical count is not determinable from the sheet."*

Now the measurement. Taking each block's points in ascending order and listing the wire that lands
on each:

| Block | Points | Wires, in point order | Ascending by wire id? |
|---|---|---|---|
| `TB-0V` | 12 | W018 W019 W036 W037 W039 W042 W044 W045 W046 W050 W057 W062 | **yes** |
| `TB-24E1-A` | 8 | W017 W020 W021 W022 W023 W024 W025 W026 | **yes** |
| `TB-24E1-B` | 5 | W020 W028 W029 W030 W031 | **yes** |
| `TB-110` | 4 | W058 W059 W047 W060 | no |
| `TB-120` | 3 | W052 W063 W053 | no |
| `TB-130` | 2 | W049 W064 | **yes** |
| `TB-GND-B` | 2 | W013 W014 | **yes** |

**17 of the 19 blocks have their points allocated in ascending wire-declaration order.** The notes
claim the numbering is *drawing order, top to bottom*; the two would coincide if the `W` table was
itself written down the sheet, and it is grouped by circuit rather than by geometry. So this is not
proof the notes are wrong — **it is proof that the data cannot tell the two apart.** Nothing in any
file distinguishes *the numbering is right and this wire is on the wrong screw* from *this wire is
right and the numbering is off by one*. **Only my eyes on the paper can.**

**And that is why all thirteen of the wires I flagged touch a `TB-*` point.** Every single one.

### 3. So the problem is bigger than thirteen wires, and smaller than the whole project

| | |
|---|---|
| Wires touching a **multi-point** block — an assignment nobody read | **40** of 71 |
| Wires touching only a single-point block, or no block at all — cannot be wrong this way | **31** |
| Of the 40, the ones I have spotted so far | **13** |

The other 27 are not vindicated; they are **unchecked**. A sequential allocation is right by luck
about as often as not, and `W052`/`W053`/`W068` came out right when Session 5 measured them by hand.
**Assume all 40 need a human look.**

`W019` is a different failure and the only one of its kind so far: not a wrong endpoint but an
**invented edge** — a wire that does not exist. Nothing in the data says how many more of those
there are, and my Ask-tab question is what a wrong edge costs: the model answered faithfully from
`CONNECTS_TO PS1:-2 → TB-0V:2`, which is in `circuit_logic.json` **and** in `custom_kg.json`. That
is a data defect, not a prompt bug and not a model failure. Do not go looking in `prompts.py`.

### 4. **Wire ids are positional, and 58 authored paths already key on them**

`locations.json` now holds **62 wire records: 58 with a `path`** — 42 lifted from the ink, 16
hand-traced, 2 across a crossover hop — plus 111 end-label overrides keyed on terminal ids. I have
committed that work (`6db5302 "Added new wire paths"`), and it is the largest body of authoring in
the project after the 131 placed points.

**Inserting one wire into the middle of `W` renumbers every wire after it**, and all 58 paths would
silently reattach to the wrong wires. There is no test that would catch it and nothing on screen
would look different. Any plan that adds a wire has to answer this **first**.

The same shape of problem sits under any renumbering of the blocks: **48 `TB-*` points carry a
human-placed coordinate** in `locations.json` and the end-label overrides key on those ids too.

### 5. **`W063` is on my list, and it is also one of Session 6's four test fixtures**

This one is worth knowing before you trust anything measured.

`07_drawing_facts.md` §*"Which conductor belongs to which wire"* carries four wire-to-conductor
pairings *"measured 2026-09-02, and it corrects the plan"*, and Session 6 turned all four into
fixtures in `webui/src/features/locate/paths.test.ts` — the test file whose own header calls them
**"the acceptance criterion for the whole phase"**. Two of the four are `W063` and `W068`, and both
are recorded as ending at **`TB-120:2`**.

**`W063` is on my list of thirteen.** So a pairing measured against a placed point may have been
measured against the *wrong* pin, and if so the fixture, the table and the sentence in the manual
saying the ranking reproduces it are all built on it. Note that `W068` — which lands on the same
`TB-120:2` — is **not** on my list, and `TB-120` is one of the only two blocks whose numbering is
*not* in wire-declaration order. Work out what that means before you write anything down about it.

**Do not assume the measured table is wrong either.** It was derived from geometry — both ends
within 4 pt — so it may be that the pairing is right and the *pin name* on that end of `W063` is
what is wrong, which would be the numbering question again in miniature and a very useful worked
example for the plan.

### 6. What is *not* broken, which is most of it

The path editor, the highlighter, `/api/conductors` and the ranking are all fine — they read the
netlist's endpoints and do the right thing with them. **They are the instrument that found this
bug.** The Review tab is unrelated: it corrects readings of the ink, and 654 of those decisions are
mine. The net highlight is unrelated (see §1). The placement editor is unrelated, and its output —
131 human-confirmed points — is what makes any of the diagnosis above possible.

---

## One correction to my own framing

I wrote that *"the indexing and OCR process is not accurate in seeing where the wires are."* The
session that wrote this document went and checked, and the truth is less flattering to us than
that — and it changes what the fix is.

**OCR never had anything to do with the wires.** `EXTRACTION_NOTES.md` correction 1 says the PDF has
no embedded text and *"the OCR in `geometry.json` was a cross-check only"* — the 71 wires were
written into the `W` table by a **vision pass**, Claude reading the 400 DPI tiles. And for the 40
wires that land on a multi-point block, §2 above shows the block end was not read even by that: it
was **allocated**, one number after another, as the table was written.

So this is not a perception system that saw badly. It is **the same failure as the component
positions, one layer up** — a guess presented as a fact, in a file nothing checks. Which means my
paragraph above arrives from the other direction at the rule this project already lives by. The
manual's §2 says *"the indexing pass gets one chance to guess, and after that a human owns the
positions"*, and what I have run into is that **the same sentence was never applied to the wires.**
It worked for 131 points. **What this session has to plan is what it means for 71 wires.**

That is also why I do not think you took the wrong path. You built the editor that made the wrong
data visible. What was never built is an editor for the layer below it.

---

## Whether to roll back — the recommendation I was left, and I want it argued with

The session that wrote this says **do not roll back**, and gives four reasons. I am not in a
position to judge the fourth one, so treat all of them as a case to test rather than a conclusion to
inherit:

1. **Nothing that shipped is wrong.** Every phase of the wires-and-nets plan reads the netlist and
   behaves correctly given it. Reverting them would remove working code to fix data.
2. **The path editor is the instrument.** It is how I found these thirteen, and it is how I will
   confirm the fix — a corrected wire should snap to an obvious candidate. Rolling it back means
   diagnosing blind.
3. **My 58 paths are real authored work.** A path is a claim about *ink*, and the ink has not moved.
   Most of them should stay true after an endpoint is corrected.
4. **The plan's own assumption is what broke, not its code.** §2 of
   `highlighting_wires_and_nets.md` measured the netlist for **duplicates** — 26 nets, 131
   terminals, no twins — and from that the phrase *"the netlist is already right"* went into the
   plan, the code map's invariant 6, two lesson documents and a server test docstring. **It was
   checked for twins and never for truth.** Correcting that sentence in all five places is the
   honest repair; deleting the code it justified is not.

**What genuinely needs redoing is smaller and sharper than a rollback:** wire ids must stop being
positional, and there has to be a screen where a wire is two terminals a person chose. That is a new
piece of work, not a re-run of an old one.

**And the honest case against all four**, which it also wrote down: **wires should perhaps never
have been entities in a generated netlist at all.** They may belong in an authored file beside
`locations.json`, keyed on their endpoints, with `author_circuit_logic.py` reading them the way it
already reads points. If that is where the plan lands, some of Session 5 and 6's file format really
does get revisited — and that is a rollback of a kind, just a much narrower one than starting the
highlighting over. **It is question 1 below, and it is the one I most want a straight answer on.**

---

## The questions the plan has to answer

Eleven of them, roughly in the order they block each other. Bring me a recommendation on each, with the reasoning —
not options for me to pick blind.

1. **Where does a corrected or new wire live?** The `W` table in `author_circuit_logic.py` (the
   authored source today, but not reachable from the WebUI); a **fourth authored file** the generator
   folds in, like `locations.json` and `label_corrections.json`; or a section inside
   `locations.json`. The project has done the middle one twice and has reasons written down both
   times — read `label_corrections.py`'s docstring before answering.
2. **How does a wire get an id that survives an insertion?** 58 paths depend on the answer. Freeze
   the 71 and append? Put an explicit id in the table? Key a wire on its endpoint pair? Say what
   happens to the paths either way, and whether it needs a migration or a one-off script.
3. **Numbering or assignment — which one does a person author?** They are one degree of freedom
   (§2). Renumbering the blocks to what the sheet shows top-to-bottom is arguably the honest fix, but
   it moves 48 placed points and 111 label overrides onto different ids. Reassigning the wires
   instead leaves the numbering a fiction nobody can check. **This is the hardest question here.**
4. **What does *create a wire* look like on screen?** What I asked for is: pick two terminals, and
   the wire exists. Where does that live — a new tab, or a mode on the Locate tab? What does a wire
   need besides its two ends (colour, gauge, net, cable)? And how is the **net** decided, given that
   net membership currently comes from the *terminals* rather than from the wires?
5. **How do the two meanings of clicking a terminal stay apart?** Moving a marker and wiring it are
   different acts on the same dot. `H10` and `K5` are both about exactly this kind of collision.
6. **How does the sheet answer *is there a wire here*?** All 149 conductor polylines are already
   published by `/api/conductors`. A click that hit-tests them and reports *this is `C0059`, and no
   wire claims it* looks buildable on what exists. Is it?
7. **A terminal's wires, highlighted.** `lib/paths.ts` `pathsFor` returns null for a terminal today.
   Extending it to *every wire touching this pin* is the feature that makes a missing wire visible by
   its absence. Confirm that is all it takes.
8. **The census — measure before scoping.** How many wires are actually missing, and how many of the
   40 are wrong? Starting points, already checked: 67 of the 149 conductors carry a printed
   `spec_label` (a colour and gauge, which is what the sheet writes beside a *wire*); 23 of those
   have **both** ends bound to a `terminal_point` symbol and 34 have one; 28 conductors are longer
   than 15 pt with neither a net name nor a spec. None of those is an answer yet. **Do not scope the
   work before this number exists.**
9. **What of the 58 paths survives a correction?** The ink did not move, so most should. Say the rule
   — and say how a person is *told* which paths to re-check.
10. **What becomes of the four measured pairings and their fixtures?** See §5 of the measured facts.
    If `W063`'s block end moves, `paths.test.ts` has a fixture and a table to correct — and a
    ranking whose acceptance criterion partly rested on it.
11. **What happens to the sentences that are now too confident?** *"The netlist is already right"*
    is in `highlighting_wires_and_nets.md` §*Not in this plan*, `06_code_map.md` invariant 6,
    `12_tests_label_corrections.md`, `test_review.py`'s docstring and `review_tab_questions.md`
    Fact 1; `EXTRACTION_NOTES.md` §2 of *"Inferences"* is the other one. Correct them in place with
    the reason, the way the `W052`/`C0080` pairing was — a wrong fact in a document the next session
    reads is how nine days went by last time.

---

## What to read

Less than you think. Most of the shipped code is not implicated.

1. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index,
   whole. **§5a** is what is actually in the files, **§7** is the known issues, **§8** is the rule
   about routes. It is the one door into fifteen leaf documents; do not read them all.
2. **`_claude_notes/change_history.md`**, the **`NEXT UP`** section only — what the last session left
   and in what order it thought things should happen. It is about to be rewritten around this.
3. **`schematic_extraction/PS20115MLM4-2/extracted_docs/EXTRACTION_NOTES.md`** — whole, 115 lines,
   and the most important thing on this list. It is where the vision pass wrote down what it
   inferred rather than saw, and §2 of *"Inferences"* is the admission at the centre of this session.
4. **`author_circuit_logic.py`** — the `W` table at line 635 and the wire/net/relationship building
   from line 905. **Not the whole 1118 lines.** This is the file the fix probably lands in.
5. **`server/app/label_corrections.py`** — its module docstring only. It is the project's own
   argument for *when a new authored file is right and when folding in is right*, and question 1 is
   that argument again.
6. **`_claude_notes/highlighting_wires_and_nets.md`** — **§2, §5 and §*Not in this plan* only.** §2
   is the one to read closely: it is the measurement of the netlist that found no duplicates, and
   the *"already right"* conclusion drawn from it lives in the third of those. Do not read the whole
   plan; it is finished, and its §13 landing notes are history now.
7. **`_claude_notes/locate_tab_testing/07_drawing_facts.md`** — the §*"Which conductor belongs to
   which wire"* table and the re-measured distribution under it. This is where §5 above bites, and
   it exists so nobody has to open `geometry.json`.

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** Get
numbers out of either with a `python3 -c` one-liner that prints a summary.
`_claude_notes/locate_tab_testing/07_drawing_facts.md` exists so the first never becomes necessary.

---

## What I have already done, so you do not undo it

- **All 131 terminals and 47 component sites are placed by hand.** That work is finished and
  committed, and it is what makes the diagnosis above possible. Nothing in this session should ask
  me to redo any of it.
- **58 wire paths are authored and committed.** 42 from the ink, 16 traced by hand. See §4 above.
- **654 review decisions are authored** in `label_corrections.json` and committed. Unrelated to this,
  and not to be reopened.
- **`circuit_logic.json` is regenerated but uncommitted** — I moved a few markers by a tenth of a
  point while working. `git status` will show it. Tell me to commit it; do not commit it yourself.

---

## Running it, if you need to look at something

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

Editor password `edit-1234`. Three facts that have each cost a session:

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.

**If you start the server, stop it in the same turn. The console is mine.**

The four checks, currently green at **172 server · 318 web · ruff clean · tsc clean**:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

You should not need any of this. **If a check goes red in a session that wrote no code, say so
loudly** — something else is wrong.

---

## Questions only I can answer — ask them, do not model around them

I have the sheet and the 400 DPI tiles in front of me, and there are things in this that no amount of
reading files will settle. **Ask me these early, in conversation, before you commit to a shape** —
and add any others you find.

1. **How many points does `TB-0V` physically have?** `EXTRACTION_NOTES.md` says outright that *"the
   exact physical count is not determinable from the sheet"* and that we modelled it with **12**.
   If it really has eight screws, then 12 point ids are four fictions and the numbering question
   answers itself. Same for `TB-24E1-A` (modelled with 8) and `TB-24E1-B` (5). **This may be the
   single most useful thing you can ask me**, and I can zoom in and count.
2. **Which end of each block is point 1?** Top or bottom. If the numbering is to mean anything, this
   is the convention it hangs off, and only I can look.
3. **`W063` and `W068` both land on `TB-120:2` today and I only flagged `W063`.** Ask me what the
   two of them actually land on. See §5 of the measured facts for why this one matters more than it
   looks.
4. **How wrong do you think the wires are, as a proportion?** You have thirteen from me. Before you
   scope a plan around 40 or around 71, ask me to spot-check a handful you choose, and use my answers
   as the census's ground truth rather than guessing from the ink.

**And where a question is mine to *decide* rather than mine to look up — the
numbering-versus-assignment one above all, question 3 of the previous list — ask me rather than
deciding it and offering me a flip later.** The *"what I decided on your behalf"* table is the right
home for the small calls, not for the one that moves 48 placed points and 111 label overrides.

---

## What "done" means for this session

**A plan document, at `_claude_notes/authoring_the_wires.md`, and then stop.** Same shape as
`highlighting_wires_and_nets.md`, because that one worked: a §0 that says what to read, the decisions
on record with their consequences, the measured facts the plan rests on, the phases in build order,
the verification, the test-and-lesson documents to be delivered with it, **what you decided on my
behalf and how to flip each one**, and a session-by-session schedule with an honest stopping point
after each.

Specifically, it must:

- **answer all eleven questions above**, with a recommendation and the reasoning, not a menu;
- **say plainly whether to roll anything back**, and if so exactly what and why;
- **carry the census** (question 8) as measured numbers, so the scope is not a guess;
- **name the migration** for the 58 paths and the 48 placed `TB-*` points, if either is needed;
- **say what I have to author by hand and roughly what it will cost me** — 40 wires to check, some
  number to create, and how many clicks each. I have done 131 points and 654 readings; tell me
  honestly what this one is.

**Write no code, change no authored file, and do not touch `author_circuit_logic.py` this session.**
If you find yourself wanting to fix W014 because it is one line, that is the instinct to resist:
thirteen one-line fixes would leave the other 27 unchecked and the numbering question unanswered, and
we would be back here in a fortnight.

Then update the **`NEXT UP`** section of `change_history.md` to point at the new plan, and report to
me in plain words: what you think is really wrong, what you recommend, and what you are least sure
about.

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all useful and often the fastest answer. When something ought
to be committed, name the files and say so.

**`locations.json` and `label_corrections.json` are authored content git cannot regenerate**, and
`author_circuit_logic.py` is a third — it is a Python file, but the `W` table and the component,
terminal and net tables in it are *my* data, not code. Treat all three that way. Do not hand-edit
`circuit_logic.json` or `custom_kg.json`; both are generated, and the recipe is
`python author_circuit_logic.py` **then** `build_kg.py`.
