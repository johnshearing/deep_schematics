# WebUI Ideas — What This Could Become

**Date:** 2026-08-07
**Status:** Idea space. Nothing here is committed. The committed work is in
`webui_v1_plan.md`, which is deliberately a tiny subset of this document.

---

## The premise

We proved something specific and useful in
[`direct_file_query_test_PS20115MLM4-2.md`](direct_file_query_test_PS20115MLM4-2.md): a long-context
agentic model reading `circuit_logic.json` directly answers real troubleshooting questions about a
schematic, and does it well enough that a technician would act on the answer. RAG over the same
data did not.

That changes what the application *is*. The original framing was "a viewer with a search box over
an indexed graph." The real opportunity is **a machine that understands one machine** — a thing a
technician can interrogate the way they'd interrogate the colleague who commissioned the panel.

Everything below follows from that. The organising question for each idea is not "what can we
display?" but **"what does a technician standing in front of a stopped conveyor at 2 a.m. actually
need?"**

A note on economics that shapes the whole document: an Opus answer costs roughly **$0.64 and two
minutes** (measured — see `webui_v1_plan.md`). So the features split into two families, and the
split matters more than it first appears:

- **Deterministic features** — computed from `circuit_logic.json` with ordinary code. Instant,
  free, exactly repeatable. Most of the "browse" and "simulate" ideas are in this family.
- **Model features** — where judgement, inference or language is genuinely required.

A good version of this application answers as many questions as possible in the first family, and
saves the second for what only it can do. That isn't just cost control; deterministic answers are
also *auditable*, which is the value this whole project is built on.

---

## 1. Ask and reason

### The chat (this is v1)
Ask a question, get an answer citing wire, net and terminal IDs, with a Sources section. Already
proven.

### Guided troubleshooting
The single most valuable thing on this list.

Not a chat — a **session with state**. The app tracks what has been measured, what has been ruled
out, and what remains. Each answer ends with the next probe to take; the technician enters the
reading; the fault tree narrows. When it converges, you have a diagnosis *and* a record of how you
got there.

We already know the model produces this shape unprompted. Asked about 24 V on net 125, Opus
returned a ranked cause list and a four-step measurement sequence keyed to `TB-0V`, each step
saying what each possible reading would mean. **The model is ahead of the UI here** — the reasoning
already exists and we're currently throwing away its structure by rendering it as prose. Give it
somewhere to live and it becomes a tool instead of a paragraph.

### Live measurement logging
A running table of readings taken: point, expected, actual, time. Feeds the guided session,
becomes the evidence trail in the report, and — over many sessions — becomes a dataset about which
faults actually happen on this machine.

### Voice in, voice out
A technician has a meter in one hand and gloves on. Typing is the wrong interface at the point of
use. Speak the question, hear the answer, hear the next probe. This is the feature most likely to
be *loved* rather than merely used.

### Photo input
Photograph the actual panel. Compare it to the drawing: is that relay seated? Is there a wire off
`TB-120`? Does the installed breaker match the 8 A that CB1 is supposed to be? The extraction
pipeline already establishes that tiled vision over schematics works; pointing vision at the
*physical* panel and diffing it against the netlist is the natural extension, and it closes the
loop between drawing and reality.

### Explain-like-I'm-new vs expert mode
The same fact needs two registers. An apprentice needs "a relay coil energises when there's a
complete path from + to −, and here that path runs through both start buttons in series." A
20-year electrician needs "CR1:11-14 and CR2:11-14, series, 0V return." Same netlist, different
answer.

### Export a work order
A finished diagnosis becomes a service report: symptom, measurements taken, conclusion, parts
required (with part numbers from `components[]`), time spent. This is the feature that makes a
manager pay for the tool.

---

## 2. See the schematic

### Tile viewer
`tiles/tiles.json` already contains everything needed: a 4×4 grid, 400 DPI, each tile carrying its
`pdf_rect` in PDF points and its pixel dimensions. The mapping is `px = pt × 400/72`. Place the 16
tiles absolutely, wrap in one CSS transform for pan and zoom. There is no rendering work to do —
the images exist.

### Component overlay
`components[].location{x, y, zone}` gives coordinates for all 47 components. Markers on the
drawing, clickable.

### Bidirectional citation — the feature that makes everything else click
Answers already cite `CR-BP`, `W048`, `net 120`. Make those citations live:

- Click `CR-BP` in an answer → the drawing pans and highlights it.
- Click a component on the drawing → it fills the question box ("what does CR-BP do?").
- Hover a wire ID → see its colour, gauge and endpoints in a tooltip.

This is cheap to build and it transforms the answer from text you have to translate into a
drawing you can navigate. It's the highest value-per-line-of-code idea in this document.

### Net highlighting
Select net 110 and every one of its member terminals and wires lights up across the whole sheet.
Deterministic, instant, free. For a technician this is the thing they currently do with a
highlighter on a paper print.

### Printable marked-up sheet
Because at some point they *will* print it, and it should come out with the relevant net traced
and the suspect components circled.

---

## 3. Simulate the circuit

This one deserves its own section because it's the most ambitious idea here that is nonetheless
**fully reachable from data we already have**, with no model calls at all.

`nets` (which terminals are common) + `COIL_CONTROLS_CONTACT` (which coil operates which contact)
+ `ACTUATES` + `components[].normal_state` together describe a **solvable boolean network**.
Given the state of every switch and coil, you can propagate potentials and determine what is
energised.

So: toggle the BYPASS switch. Press PB1. Press PB2. Watch net 121 go to 0 V, then net 120, then
CR-BP pick up, then RUN come alive. Watch what happens when you open CB2. Watch the machine
correctly *fail* to run when only one button is pressed.

Why this matters beyond being fun:

- **It teaches.** An apprentice learns a control circuit by operating it, not by reading it.
- **It validates the extraction.** If the simulation can't produce a run state, either the netlist
  is wrong or the circuit genuinely depends on something off-sheet. Both are findings. This is a
  correctness check on `author_circuit_logic.py` that no amount of question-answering provides.
- **It grounds the model.** A future version could let Claude *run* the simulation to check its
  own reasoning rather than inferring the state propagation in prose.
- **It's deterministic and free.** No tokens, no latency, exactly repeatable.

The known limit is honest and interesting: net 130 and CR-SW only complete through the downstream
machine, so the simulation of this sheet alone has a genuinely open boundary. Render it as an open
boundary. That's the truth of the drawing, and showing it is better than hiding it.

---

## 4. Browse deterministically

Every item here is instant, free and repeatable — and every one displaces a paid model call.

- **Component / terminal / net / wire tables.** Filter by class, power domain, net, subsystem.
  Answers a large fraction of the §12 question bank with no model involved.
- **Net explorer.** Pick a net: members, wires, adjacent components, coil/contact relationships,
  nominal voltage, signal type. This alone covers the whole Q44–Q56 class.
- **Knowledge graph view.** sigma.js over the 402 relationships. This is the one thing the
  LightRAG WebUI was still wanted for, and it's a few hundred lines here.
- **Global search.** One box over components, terminals, nets, wires, aliases and descriptions.
  The `aliases` field exists precisely so plain-language terms find the right designator.
- **BOM / spare parts list.** From `part_number` + `manufacturer` + `ratings`. What to keep on the
  shelf; what to order when CR-BP fails.
- **Wire pull-and-label list.** For an electrician doing the install rather than the repair: every
  wire with colour, gauge, both endpoints, and its cable. The drawing notes already specify labels
  1" from the end — generate the label list.
- **Drawing metadata panel.** Title block, ratings, notes, referenced drawings. Free, and it
  answers §12 Q21–Q25 before anyone spends a token.

---

## 5. Grow beyond one sheet

### Master / subordinate linking
This isn't a nice-to-have; it's the fix for a known blind spot. Ask "what energises CR-SW?" and the
correct answer today is *"you can't tell from this sheet — net 130 completes through the downstream
machine."* That's an honest answer, and it's also a dead end.

`PS10115MLC2-2.pdf` — the subordinate machine — is already sitting in
`schematic_extraction/ModLinx/source_docs/`, unextracted. Extract it, link the two, and the
question becomes answerable for the first time. **Cross-sheet reasoning is the single biggest
capability unlock available**, and the input is already on disk.

### Drawing library, grouped by machine
Sheets belong to panels; panels belong to machines; machines sit in a line. Model that hierarchy
and "which machine is stopping the line?" becomes a question you can ask.

### Manuals, with the right architecture
The 4.4 MB *Troubleshooting Mod-Linx Conveyors.pdf* is the obvious next document. The test report
already prescribed the architecture, and it's worth stating plainly because it's counterintuitive
after everything above: **RAG over the manuals, direct file access over the netlist.** Prose in a
big unstructured document is exactly the scale problem retrieval was built for; a 188 KB
structured netlist is not.

One caution to carry: a vendor PDF is *untrusted text entering the model's context*. The moment
manuals land, prompt injection stops being theoretical.

### Component datasheets
Link `part_number` to the manufacturer's datasheet. "What's the coil resistance of that relay?"
isn't on the drawing but is one lookup away.

### Maintenance history and a failure knowledge base
Every resolved session is a labelled example: symptom → measurements → root cause. Accumulate
them and you get *"this fault has been seen three times on this machine; twice it was W052 at
TB-120."* That's the point where the tool becomes more valuable than any individual expert,
because it remembers things no one person witnessed.

---

## 6. Ingest and correct

### Upload a PDF, run the extraction
The wizard: upload → `--stats-only` gate → tile review → author the netlist → validate → done. The
prompts already exist in `HowToUseThisSkill.md` §7b.

Be honest in the design about one thing: **the vision pass is irreducibly interactive.** Step 4 of
the skill is not reproducible by design, and the hardest-won lesson on this drawing — that all 88
small circles were crossover hops, not terminals — is exactly the kind of judgement a fully
automated pipeline gets wrong. Build a wizard with a human in it, not a black box.

### A review-queue UI — **built 2026-08-25, and worked through 2026-09-01**
`geometry.json` already ships **278 flagged review items and 159 low-confidence labels** and there
is currently nothing to triage them with. Show the crop, show the OCR guess, let a human type the
right answer. This is a small feature that directly improves extraction accuracy — the thing every
answer downstream depends on.

*This is the `Review` tab — Session 4 / Phase F of `highlighting_wires_and_nets.md`. It came out as
**664** readings rather than 278, because a conductor's net name is a reading too, and it writes
`label_corrections.json`, the third authored file. One drawing has now been worked end to end: 654
decisions, and the nets with a printed conductor to match against went from **17 of 26 to 24 of
26**. The two ideas below are what that run showed is worth building next, and both of them are
about **drawing number two rather than this one** — so neither should be designed until a second
sheet exists to test the design against.*

### Feed the corrections back into the extractor's lexicon
**The highest-leverage idea in this section, and the cheapest, because the thing to improve is a
word list rather than a model.**

`extract.py` runs tesseract over 600 DPI crops and then applies `correct_token()` — rules plus a
hand-written `LEXICON` of wire colours and domain words, with special cases for the failures a CAD
stroke font produces (the slashed zero, `AVG` → `AWG`, `MDD-LINX` → `MOD-LINX`). Its last line is
`return t, 0.4`, which is why so much of the review queue sits at exactly 0.4: **that confidence
does not mean "I am unsure", it means "no rule of mine recognised this."**

`label_corrections.json` is therefore already a labelled dataset for exactly that word list: every
entry carries `was` (what the machine saw) and `text` (what the paper says), produced by a person,
one drawing at a time.

What to build, when there is a second drawing to justify it:

- a script in `schematic_skills/` that reads every drawing's `label_corrections.json` and reports
  the `was → text` pairs by frequency, split into *the lexicon would have caught this if the word
  were in it* and *this needs a new rule*;
- read the report, hand-edit `LEXICON`. **Keep the human in the loop.** An auto-grown lexicon is a
  guesser, and this project's whole position is that a guesser gets one chance and then a person
  owns it — the same argument that produced the Locate tab.

Keep the corrections **per drawing** and the lexicon **shared**, which is the split the directories
already have: `schematic_skills/` is the reusable half, `schematic_extraction/<drawing>/` is the
per-sheet half. **Not before drawing two**: one sheet's corrections cannot tell a systematic glyph
confusion from this sheet's draughtsman, and the library is the whole point.

### A symbol library, so the vision pass gets cheaper each sheet
The review run surfaced a class the current pipeline has no vocabulary for: ink that is a **symbol**
rather than a string. An oval round three conductors meaning *these are one cable* came back as the
letter `A`; part of a circuit-breaker symbol came back as a hyphen; a 10.8 pt diagonal that is the
bar of a normally-closed contact came back as a *conductor*. **46 of the 149 extracted conductors
are shorter than 15 pt**, which is roughly the scale of symbol strokes rather than wiring.

None of this costs anything today — the vision pass read all of it correctly off the tiles, and
`circuit_logic.json` has the cables, the breakers and the contacts with their classes and ratings.
It costs on **the next sheet**, where a human reads the same symbols again from scratch.

The shape worth exploring: a small library of this drawing style's symbols, matched against clusters
of short strokes, proposing *"that is a normally-closed contact"* / *"that oval groups these three
conductors into a cable"* — **as ranked proposals for the vision pass to confirm, never as
findings.** Same discipline as everything else here.

Two deliberate non-goals, so this does not creep into the wrong screen:

- **Not on the `Review` tab.** That screen answers one question — *what does the ink say here* — and
  a screen that also classifies symbols is a different screen. *Not a label* remains the correct
  and complete answer for a symbol fragment.
- **Not in `label_corrections.json`.** A symbol identification is not a reading, and that file's
  whole claim is that it holds one kind of statement.

### The correction loop
When an answer is wrong, the fix belongs in `author_circuit_logic.py`, then regenerate. Never
hand-patch the JSON. A UI for this — find the misreading, edit the table, re-run, see the diff —
would make corrections routine instead of a Claude session.

### Batch ingest
A plant has hundreds of drawings. Queue them.

---

## 7. Earn trust

This project's distinguishing quality is that it is *auditable*. The UI should amplify that, not
bury it.

- **Sources panel** per answer: which file, which table, which filter.
- **Show the tool activity live.** `Read EXTRACTION_NOTES.md ✓`, `Grep circuit_logic.json ✓`. At
  two minutes per answer this fills the wait, and more importantly it shows the reader the model
  consulted the netlist rather than its own memory.
- **Surface the flagged inferences inline.** `EXTRACTION_NOTES.md` lists seven. When an answer
  rests on one — receptacle pin numbering, terminal-block point numbering, the two ground blocks
  modelled as one net — say so *in the answer*, visibly.
- **A regression tab.** Run the §12 bank (71 questions with expected answers) after any
  re-extraction or prompt change. Archive the reports.
- **Mark an answer as ground truth, or as wrong.** Drift becomes measurable instead of anecdotal.
- **Show cost and latency.** Always. It keeps the economics visible to whoever is paying.

A subtlety worth designing for: the same question can produce different answers across runs,
models and effort levels. In most apps that's a curiosity. Here — in a project built on a
reproducible chain from drawing to answer — it's a first-class concern. Record model, effort, cost
and the transcript path with every answer.

---

## 8. Reach the field

- **Tablet and phone layouts.** The point of use is a shop floor, not a desk.
- **A QR sticker on the physical panel** that opens that drawing's chat. Cheap, and it removes the
  entire "which drawing is this?" problem — which is a real problem, because the sheet size `D`
  gets mistaken for a revision even by careful readers.
- **Offline / edge deployment.** Plants have no internet. This is where the deterministic feature
  family earns its keep: browse, view, net-highlight and simulate all work with no network at all.
  Only the model features need connectivity.
- **Accounts and per-organisation libraries**, when it stops being a demo.

---

## 9. Teach

- **Quiz mode.** Generate apprentice questions from the netlist, with answers checkable against
  it. §12 is a hand-written proof that this works; automate it.
- **Guided circuit tour.** Walk the 115 VAC input to the 24 V bus to the start/stop chain to RUN,
  one step at a time, with the drawing following along.
- **"How does this machine work?"** `EXTRACTION_NOTES.md` contains a hand-written version of
  exactly this for PS20115MLM4-2. It's the most readable thing in the whole artifact set. Generate
  it for every drawing.

---

## If I had to order it

1. **v1 chat** — proven, small, and it's what people can try today.
2. **Deterministic browse + net explorer** — free, instant, and it makes most questions cost
   nothing.
3. **Tile viewer + bidirectional citation** — the highest value per line of code on this list.
4. **Extract the subordinate drawing and link the sheets** — turns a known dead end into a real
   answer, and the PDF is already on disk.
5. **Guided troubleshooting** — the model already produces the reasoning; give it a home.
6. **Simulation** — deterministic, teaches, and independently validates the extraction.
7. **Manuals with RAG** — the hybrid, once there's something worth retrieving over.

Everything else follows demand.

---

## Related documents

- [`webui_v1_plan.md`](webui_v1_plan.md) — what we're actually building first.
- [`direct_file_query_test_PS20115MLM4-2.md`](direct_file_query_test_PS20115MLM4-2.md) — the test
  that established the premise.
- `../schematic_skills/references/HowToUseThisSkill.md` — the pipeline; §7b has the query prompts,
  §12 the 71-question ground-truth bank.
