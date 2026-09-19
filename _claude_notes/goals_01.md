# The goals, and what exists against them — 2026-09-15, revised 2026-09-17 (twice: `§4A` shipped, and §6A found) and 2026-09-19 (`§4B` shipped)

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
needs no extractor to be right. **Built 2026-09-15 and walked**: `Authored paths` on the Locate tab
paints all 68 authored runs over the sheet, from the published `/api/paths`, with the armed row's own
route still on top.

**And walking it found the other half of the same error.** The field answers *where is the work*;
neither **click** does. On the Drawing tab a click on the ink still answers *what conductor is this*
— the third view over conductors, and the user has now struck it three times. On the Locate tab a
click on a painted run could not reach the row that owns it at all, so the queue was worked by
reading a name off the paper and hunting the list. **Those two clicks were plan 03 `§4A` (built
2026-09-17) and `§4B` (built 2026-09-19)**, and the rule behind both is one sentence: *a mark on the
paper should lead to the record that owns it, and to nothing else.*

---

## 4. Authoring — what a human can do through the WebUI today

`n/a` means the operation is meaningless for that feature, not that it is missing.

| | Feature | Add | Edit | Delete | Retire | Position | Where, or what is missing |
|---|---|---|---|---|---|---|---|
| 1 | **Notes** | No | No | No | n/a | No | the text is in `author_circuit_logic.py` → `drawing.notes`; `geometry.json` has 9 labels of kind `note` with bboxes and **nothing binds the two**. No screen at all — the only item on this list with no half |
| 2 | **Components** | No | No | No | No | **Yes** | position is `locations.json`: sites, drag, 0.1 pt nudge, label side, several sites per component. Class, description, ratings, part number are Python tables |
| 3 | **Terminals** | No | No | No | No | **Yes** | 131 placed; a pin may hold its own point or borrow its site's. *Whether a pin exists*, its `function` and its `net` are Python tables |
| 4 | **Wires** — the logical connection | **Yes** | **Yes** | **No, by design** | **Yes** | n/a | `Add a wire` stamps `added: true` (`H25`); either end is correctable and keeps `was`; `Retire this wire` writes a tombstone with a reason in words and is reversible. **Delete is deliberately absent** — a wire that existed and does not now is a tombstone, not an absence. A wire has no place of its own: its geometry is its two terminals. **The hole found 2026-09-17: a correction keeps `was` but takes no reason in words**, while a retirement demands one — so *the printed table said `:1` and the ink lands on `:3`, and I looked* cannot be written down (§6A, plan 03 `§4C`) |
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
| 4 | **Paths** | **Yes — one at a time, all at once since 2026-09-15, and clickable on both tabs since 2026-09-19** | the field is built and so is the whole **way back**: on the Drawing tab a click on a painted run names its owner in a card and highlights it (`§4A`), and on the Locate tab it **arms that row for editing** (`§4B`). Nothing is left on this line |
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

## 6A. The second special case — the record and the paper disagree about **which screw**

Found by the user on **2026-09-17**, minutes after walking `§4A`, and it is the first fault the new
click caught: they clicked `RECEPT1:4` on the Drawing tab, followed the card's link to `W037`, read
its record and said *"of course I can see with my own eyes that this is not true."* Same for `W018`,
armed on the Locate tab.

**Both observations reproduce a measurement made on 2026-09-08, to the screw.**

    W018   netlist TB-0V:1   →  the ink lands on TB-0V:3
    W037   netlist TB-0V:4   →  the ink lands on TB-0V:1
    W036   netlist TB-0V:3   →  the ink lands on TB-0V:2

For the **40** wires landing on a multi-point block the far end was **allocated rather than read** —
one screw after another down the page — so **11 of 71 are on the wrong screw, 13 more cannot be
settled from the ink, and 47 are right.** `authoring_the_wires.md` `§3.2` and `§3.5` are the
per-wire tables. **Grep that file; never read it.**

**Nothing needs authoring that is not already authorable, and the remedy is a one-end correction.**
Not a retirement — `Retire this wire` is for a wire that does not *exist*, and a tombstone would
delete a real connection. Not a new wire — `Add a wire` stamps `added: true` (`H25`), which would
claim the user put it there. **A correction keeps `was`**, which is the whole record of what the
machine guessed, and every record still reading `source: index` is a wire nobody has looked at yet.
That screen shipped 2026-09-08.

**The block is rotated, so it cannot be worked one wire at a time**: moving `W018` onto `:3` while
`W036` still claims `:3` is a transient double-claim. `§3.5`'s twelve rows are the whole rotation.

**Three real holes, and they are plan 03 `§4C`.** The ink's verdict is **already on the screen** —
`proposalsFor` walks the ink from the trustworthy end and `EndSlot` renders it — but (1) there is no
way to **find** the eleven except by arming all 71, (2) a correction **cannot say why**, because
`wiringStore.edit` takes no note while `Retire` demands a reason, and (3) a record the ink
*contradicts* looks like one the ink *confirms*. The first is a filter, the second is a field, and
the third is a colour. **Nothing is ever auto-accepted** — `W042` and `TB-0V:6` are why: there the
run stops short and the netlist's claim is the right one.

**What this vindicates, and it is worth saying plainly.** `§4A` and `§4B` were justified as *the way
back, from a mark on the paper to the record that owns it.* Within an hour of `§4A` shipping, that
way back found two wrong records. **The click is an instrument, not a convenience.**

---

## 7. Where the work stands, and what carries it

| # | Item | State | Carried by |
|---|---|---|---|
| 1 | **All authored paths painted at once**, on the Locate tab, one colour, toggled, with *n of m wires have a route* beside it — and `Unclaimed ink` off the toolbar in the same change | **built 2026-09-15**, walked | plan 03 `§4` · `20_tests_all_paths_overlay.md`, T-1450–T-1459 · `H28` |
| 1a | **Clicking the ink on the Drawing tab answers *whose path is this***, in a card at the lower right, with the path highlighted — and **says nothing at all** where there is no path, which is how the reader learns one is needed. The conductor card joins the conductor overlay as a diagnostic | **built 2026-09-17**, awaiting the walk | plan 03 `§4A` · `21_tests_clicking_a_path.md`, T-1500–T-1507 · `H29` |
| 1b | **Clicking a painted path on the Locate tab arms that wire's row** and highlights it, so the drawing is the index into the queue rather than the list. `Authored paths` is the mode, so with the field off every click still means *place* | **built 2026-09-19**, walked | plan 03 `§4B` · `21_tests_clicking_a_path.md`, T-1520–T-1526 · `H30` |
| 1c | **Finding the eleven wires whose far end the ink disagrees with, and saying *why* you corrected one** — the verdict is already computed per end; what is missing is a filter, a reason field and a colour | **not built**, specified 2026-09-17 | plan 03 `§4C` — half a session, **second**; its two *defects* are small enough to ride with `§5` · §6A above |
| 2 | **The orphaned end-label rows** — the last hole in an otherwise complete surface. **Three banners nobody can clear on 2026-09-18, a fourth coming**, and the authoring run is what creates them: correcting a wire's far end orphans any end-label override on the old terminal | **not built**, fully specified | plan 03 `§5` — half a session, **next**, moved up 2026-09-18 |
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
| `authoring_the_wires.md` | 91 KB | ~23 k tokens; finished. **A grep target, not a read** — its `§3.2` and `§3.5` name which screw the ink lands on for all eleven wrong wires, and one `grep -n` fetches the rows for ~200 tokens (§6A) |
| `highlighting_wires_and_nets.md` | 99 KB | ~25 k tokens; shipped |
| `highlighting_wires_and_nets_02.md` | ~32 KB | shipped and superseded — plan 03 quotes what still matters |
| `locate_tab_testing/1x_tests_*.md` | 7–30 KB each | **lesson documents are the output of a phase, never its input** |

**The strategy, in one line:** cost ≈ **$0.50 × context in millions × number of calls**, so the
saving is in *not reading*, not in thinking less.

0. **Grep the documents on the do-not-read list; do not read them.** They are large because they
   are finished, and a finished document is a lookup table. The whole of §6A came out of one
   `grep -n "W018\|W037"` over 91 KB, for ~200 tokens, against a PDF measurement otherwise.
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
