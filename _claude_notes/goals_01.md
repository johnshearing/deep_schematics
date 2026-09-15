# The goals, and what exists against them — 2026-09-15

Written after the user walked `locate_tab_testing/19_tests_coverage_overlay.md` and **rejected the
unclaimed-conductor overlay as a human-facing feature.** This document is the report of that
conversation and the audit it forced. It is the definition of *done* that
`highlighting_wires_and_nets_03.md` plans against.

**Read this before any phase of plan 03.** It is ~15 KB on purpose.

---

## 1. The goal, in the user's words

> *"we are making a WebUI that is supposed to allow a human make any required edits to the
> highlighted wiring, terminals, commoning, paths, nets and other features of the drawing that is
> tracked in the json. If I had made those edits to the file then we lose the opportunity to create
> the use and utility required to make something that other humans will be able to use."*

And the end of it:

> *"The ai model will highlight notes, components, terminals, paths, path_nets, path_cables,
> labels, and symbols as it speaks answers to the user."*

**`conductors` has now been struck from the list twice.** On 2026-09-13, as a thing to *author* — a
conductor is a measurement of the paper, so drawing one would be inventing ink. On **2026-09-15**,
as a thing to *view*, and the second striking is the finding this document exists for:

> *"the conductors are not a true representation of the paths… The ink is what the human can see,
> while the conductors are what the ai thinks the human can see… What the human needs to see
> highlighted when drawing paths, is the paths that have already been created. Then the human will
> notice all the unhighlighted ink and know that these paths have not been created."*

**Do not build a conductor editor, and do not build another view over conductors.**

---

## 2. What the model actually reads — measured 2026-09-15

`server/app/prompts.py:52` instructs it in these words: **"Do NOT read `geometry.json`."**

| It reasons over | `circuit_logic.json` |
|---|---|
| components | 47 |
| terminals | 131 |
| nets | 26 |
| wires | 71 |
| **cables** | **8**, each with `member_wires` |
| subsystems | 7 |
| relationships | 402 |
| notes | `drawing.notes` |

| It never reads | `geometry.json` |
|---|---|
| labels | 515, with bboxes — 99 `wire_spec`, 73 `terminal_number`, 57 `designator`, 16 `net_number`, **9 `note`** |
| symbols | 98 — **88 `terminal_point`, 10 `device_circle`, and no oval** |
| conductors | 149 |

Two consequences run through everything below. **A feature must have an id in `circuit_logic.json`
before the model can cite it**, which is why notes, labels, symbols and cables cannot be
highlighted today. And **a coverage view over conductors measures the extractor's reading of the
paper**, not the JSON the model thinks with.

---

## 3. Why unclaimed-conductor coverage was the wrong denominator

Conductors and ink disagree in three independent ways, all measured:

1. **Ink with no conductor.** 41 lines of ≥6 pt sit on PDF layer `"0"` and never became
   conductors; 16 of them land on placed terminals. `geometry.json` was extracted with
   `--layers SCHEMATIC`.
2. **Conductors that are not wiring.** Roughly 90 of the 149 are leader lines, earth symbols and
   the internal strokes of contact symbols. Nothing will ever claim them, and that is correct.
3. **Ink that is wrong.** The user has found one place on the sheet where the drawing itself is
   drawn wrong.

So *98 of 149 runs are claimed by nothing* is not a measure of the JSON's completeness in either
direction. The error was in the plan: `highlighting_wires_and_nets_02.md` `§2` defined *complete* as
**nothing on the sheet is unaccounted for**, then `§6` substituted *conductors* for *the sheet*.

**The instrument is the user's eye, and the honest thing to paint is what has been authored.** With
every authored route and bus lit at once, the unpainted ink is the queue — read off the paper, which
needs no extractor to be right. Nothing in the app does this today: `LocateTab.tsx:621` paints
`draftRuns(document, paths, targetEntry)`, the armed row's route and nothing else. That is plan 03
`§4`, the next session.

---

## 4. Authoring — what a human can do through the WebUI today

`n/a` means the operation is meaningless for that feature, not that it is missing.

| | Feature | Add | Edit | Delete | Retire | Position | Where, or what is missing |
|---|---|---|---|---|---|---|---|
| 1 | **Notes** | No | No | No | n/a | No | the text is in `author_circuit_logic.py` → `drawing.notes`; `geometry.json` has 9 labels of kind `note` with bboxes and **nothing binds the two**. No screen at all — the only item on this list with no half |
| 2 | **Components** | No | No | No | No | **Yes** | position is `locations.json`: sites, drag, 0.1 pt nudge, label side, several sites per component. Class, description, ratings, part number are Python tables |
| 3 | **Terminals** | No | No | No | No | **Yes** | 131 placed; a pin may hold its own point or borrow its site's. *Whether a pin exists*, its `function` and its `net` are Python tables |
| 4 | **Wires** — the logical connection | **Yes** | **Yes** | **No, by design** | **Yes** | n/a | `Add a wire` stamps `added: true` (`H25`); either end is correctable and keeps `was`; `Retire this wire` writes a tombstone with a reason in words and is reversible. **Delete is deliberately absent** — a wire that existed and does not now is a tombstone, not an absence. A wire has no place of its own: its geometry is its two terminals |
| 5 | **Paths** — a wire along the ink | **Yes** | **Yes** | **Yes** | n/a | **Yes** | lift a ranked run · add a run across a crossover hop · `Trace by hand` · `convertPath` then drag a corner · `Clear` · *no path on this sheet* as an explicit empty state |
| 6 | **Nets** — terminals in common | No | No | No | No | **Label only** | `label_point` and per-member end-label side/hidden are authorable. **Membership is the `net` field per terminal in the Python tables — the sharpest gap**, because net membership is what the highlight paints: a net a reader can see is wrong can only be fixed in a Python file |
| 7 | **Path_nets** — paths in common | — | — | — | — | — | **Derived, and should stay derived.** A net's highlight is already the union of its member wires' runs (`lib/paths.ts:116` `pathsFor`). Authoring a second grouping would be a second draft of connectivity, which is `H18`/`H25`. One defect to fix rather than a feature to build — §6 below |
| 8 | **Labels** | No | **Yes** | **As `null`** | n/a | **End labels yes** | `Review` tab → `label_corrections.json`, 654 decisions; *not a label* is stored as `null`; Reset deletes rather than writes. End labels: which end, which side, hidden — 113 overrides across 56 wires, with one hole left (plan 03 `§5`). **What a label is *about* is unauthorable**: there is no *this `wire_spec` belongs to `W048`* |
| 9 | **Symbols** | No | No | No | n/a | No | 88 `terminal_point` + 10 `device_circle`, extractor-owned. **Authoring one would be inventing ink** — the user's own argument against a conductor editor, unchanged. The real gap is **binding** a symbol to a designator so a highlight can be aimed at it |

**The shape of what is left.** `locations.json`, `wiring.json` and `label_corrections.json` each
have a screen. **`author_circuit_logic.py` — *what each thing is* — has none**, and rows 1, 2, 3
and 6 are all that one file. It wants its own plan (plan 03 `§7`) and it becomes urgent on drawing
number two, where nobody has checked the tables.

---

## 5. Highlighting — what the model can point at while it answers

The loop exists and is one identifier wide: `prompts.py` makes the model spell ids, `Markdown.tsx`
renders them as `Citation`, `Citation.tsx` calls `select(kind, id)` and switches tabs.

| | Target | State | What it needs |
|---|---|---|---|
| 1 | **Notes** | **No** | an id and a bbox bound to it — both missing |
| 2 | **Components** | **Yes** | dot, ring, fly-to, citation |
| 3 | **Terminals** | **Yes** | its own dot, never its parent's |
| 4 | **Paths** | **One at a time, yes. All at once, no** | plan 03 `§4` — the next session |
| 5 | **Path_nets** | **Yes**, one net at a time | the union is published from `wire.net`; §6 below |
| 6 | **Path_cables** | **No** | the grouping already exists — 8 cables with `member_wires` — so `CABLE-POWER-IN` is paintable as `W001`+`W002`+`W003`'s runs today. **The oval has no geometry in the extraction**, so a cable boundary is a shape a person draws: `geometry: "human"`, like `TB-130`'s bus |
| 7 | **Labels** | **Partly** | the app paints the end labels it places itself; a printed label's own bbox is never lit |
| 8 | **Symbols** | **No** | a binding from symbol → designator |

Rows 1, 6, 7 and 8 are the same problem wearing four hats: **no id in `circuit_logic.json`, so
nothing to cite.**

---

## 6. The special case — one wire bridging two nets

The user's question: *do the authoring goals need to know about this, or does what we are already
building take care of it?*

**Measured 2026-09-15. Exactly one wire joins two nets:**

    W019   PS1:-2 (net 0V)  →  TB-GND-B:2 (net GND)   WHITE/BLUE 12AWG

**Nothing needs authoring, and the reason is structural.** A wire's net is **derived from its two
ends and never stored in `wiring.json`** — so there is no field to author, nothing to get wrong, and
nothing that can go stale. The screen already anticipates exactly this case: `NetsAcross`
(`WiringPanel.tsx:700`) prints *"Nets: `0V` at one end, `GND` at the other"* and flags
**`two nets — look at it`** — a flag, and deliberately never a fix. Its own tooltip reads: *"A 0 V-to-
ground bond is a real wire and the two nets are the point of it; so is a wire across a breaker."*

**The generated netlist models it correctly.** `PS1:-2` is a member of `0V` only, `TB-GND-B:2` of
`GND` only, and the bond is carried as a relationship: `CONNECTS_TO PS1:-2 → TB-GND-B:2`. Two
separate nets with one wire crossing between them is the right model, and the model can traverse it.

**One real defect, and it is highlighting rather than authoring.** `/api/paths` publishes its
net → wires map out of `circuit_logic.json`'s single-valued `wires[].net`
(`server/app/drawing.py:332-338`), and `W019.net` is `"0V"`. So **selecting `0V` paints the bond's
route and selecting `GND` does not**, even though the bond lands on a `GND` terminal. The fix is to
build that map from each net's **member terminals** — either end a member means that wire's runs
belong to that net's highlight. It is small, drawing-agnostic, and it makes `path_nets` right
without authoring anything. **Folded into plan 03 `§4`.**

**One open question, not a phase.** None of the 402 relationships joins one net to another, so the
bond is only findable by traversing terminals. A `BONDED_TO` edge from the generator, or a line in
`prompts.py`, would say it outright. Recorded; not planned.

---

## 7. Where the work stands, and what carries it

| # | Item | State | Carried by |
|---|---|---|---|
| 1 | **All authored paths painted at once**, on the Locate tab, one colour, toggled, with *n of m wires have a route* beside it — and `Unclaimed ink` off the toolbar in the same change | **not built** | plan 03 `§4` — half a session, next |
| 2 | **The orphaned end-label rows** — the last hole in an otherwise complete surface; two banners nobody can clear | **not built**, fully specified | plan 03 `§5` — half a session |
| 3 | **The extractor's layer fix**, without re-extracting — re-justified: the candidate list is missing 16 runs that land on placed terminals, which is why six coil wires must be hand-traced | **not built** | plan 03 `§6` — one short session |
| 4 | **A screen for `author_circuit_logic.py`** — notes, component existence, terminal existence, **net membership**. A fifth authored input the generator folds in, with the `H25` treatment | **not built** | plan 03 `§7` — **a plan document, not a session** |
| 5 | **Cables, label and symbol binding, and widening the citation loop** so an answer can paint a note or a cable | **not built** | plan 03 `§8` — **a plan document**, after item 4 |

**Already done, and not to be redone:** per-object highlighting of components, terminals, wires and
nets; the wiring queue (add, correct, retire); the path editor (lift, add a run, trace, drag,
*no path here*); commoning including `Trace by hand`; the `Review` tab's 654 readings; terminal
placement and end-label sides; the sheet hit-test and its three verdicts.

---

## 8. What to read, what not to read, and how to keep a session cheap

**Read:** this file, then `highlighting_wires_and_nets_03.md`, then **only** the reading list of the
phase being executed. Nothing else from `_claude_notes`.

**Do not read:**

| File | Size | Why not |
|---|---|---|
| `geometry.json` | 620 KB | ~150 k tokens. **Never.** Use a `python3 -c` one-liner |
| `circuit_logic.json` | — | generated; never whole. One-liner for any count |
| `change_history.md` | 233 KB | ~58 k tokens |
| `authoring_the_wires.md` | 91 KB | ~23 k tokens; finished |
| `highlighting_wires_and_nets.md` | 99 KB | ~25 k tokens; shipped |
| `highlighting_wires_and_nets_02.md` | ~32 KB | shipped and superseded — plan 03 quotes what still matters |
| `locate_tab_testing/1x_tests_*.md` | 7–30 KB each | **lesson documents are the output of a phase, never its input** |

**The strategy, in one line:** cost ≈ **$0.50 × context in millions × number of calls**, so the
saving is in *not reading*, not in thinking less.

1. **Measure the data, then read only the code that renders it.** Four one-liners answered *how
   many runs, claimed by what, claimed by whom, which nets does a wire cross* for a few hundred
   tokens each on 2026-09-15. The same four questions asked by reading files would have been the
   whole budget.
2. **Read regions, not files** — every reading list in plan 03 gives line ranges.
3. **Batch independent calls into one message**; six greps in one block cost one call's context.
4. **Run the four checks at the start and at the end, not between edits.**
5. **Never re-read a file you just edited** — `Edit` fails loudly if it did not apply.
6. **Every count in this document moves as the user authors.** Recompute; never quote the page.

**Measured on 2026-09-15:** the `§6` implementation ran **$11 at 100 K context over 128 calls**. The
same session's design review, re-planning and three replacement documents took it to **$32 by 190
calls at 129 K** — prose at
full context is not free either, and that is the honest price of a conversation this useful.
