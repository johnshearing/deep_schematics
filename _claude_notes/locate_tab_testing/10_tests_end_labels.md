# T-55x–T-59x — a label at every end, and the file that stays almost empty

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-08-24** with Session 2 / Phase B of `_claude_notes/highlighting_wires_and_nets.md`.

**Both tabs. The reading half needs no password; the compass needs the editor.** Start the server as
in the index §1 and have `git status` handy — half of what these tests check is what did *not* get
written to `locations.json`.

---

## The one idea, and it is worth reading before the first test

Every one of this drawing's **131 terminals has a point a human confirmed.** That is what makes this
session almost free:

- every wire has **two known ends**, all 71 of them;
- every net's members resolve to real coordinates, all 127 of them;
- so an **end label needs no coordinate of its own.** It needs a *side*, relative to a point that
  already exists.

**265 end labels therefore appear on this sheet and none of them was work.** 138 wire labels — 69
wires × 2 ends, the other two having no colour or gauge to print — and 127 net labels. The file
records **none** of them until you overrule one.

That is the payoff of every terminal you placed on 2026-08-20, and it is also the reason the queue
this could have become does not exist. `K7` in the index is the complaint that *"six rows in To do
can never sensibly be finished"*; a screen that asked you to place 265 end labels would have been
that mistake at forty times the scale.

**The rule, in one sentence:** a label sits on the side of its pin that faces **away from** the
wire's other end, or away from the centre of the rest of the net — snapped to one of eight compass
points, and stepped clockwise if something is already written there.

---

## T-550 · The labels appear, and the file stays empty

**Do.** On the **Drawing** tab, zoom past **30%** (labels of every kind are hidden below it — that is
`H7`, and it is the first thing to check in any report here). Press the **Wire & net labels** switch.

**Expected.** Text everywhere: `BLUE 18AWG`, `RED 16AWG`, net numbers like `110` and `120`, each
beside a pin rather than floating in the middle of a run. It is a lot at once, which is why the
switch starts off.

**Do.** Now the important half:

    git diff schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

**Expected.** **Nothing.** Not one line. 265 labels are on screen and the authored file has not
changed, because their positions are a function of the terminal points already in it. If this diff
shows anything, stop and report it — something is writing defaults into the file, which is the one
thing this design must not do.

**Do.** Look at what a **wire's** label says.

**Expected.** Its **colour and gauge** — `BLUE 18AWG` — and never `W052`. Every `W###` is an id the
extraction invented (the `our id` badge in the list says so), so a label reading `W052` would name
something you cannot find anywhere on the paper in front of you. The spec is what is actually
printed beside the conductor and what you can check with your eyes.

**Do.** Look at a **net's**.

**Expected.** The net id itself — `120` — which mostly *is* printed beside the conductor. The
invented ones (`NET-PB1`, `NET-PB2`) show their invented name; that is a known rough edge rather than
a bug, and the list badges them.

---

## T-555 · The side is away from the run, and the same every time

**Do.** Find a wire whose two ends are far apart — `W052` runs `CR2:14 → TB-120:1`, right across the
sheet. Look at both of its labels.

**Expected.** Each sits on the side of its pin that points **away from the other end**: the label on
the eastern pin is east of it, the western one west. Neither sits on top of the conductor it names.

**Why it matters more than it looks.** The whole job of a highlight is *which of these lines is the
one I care about*. A label lying along its own conductor hides exactly the thing you are trying to
see, and on a sheet whose rows are 16 pt apart it can look as though it belongs to the run above.

**Do.** Press **Wire & net labels** off and on again. Press **Terminals** on and off. Select a net,
then clear it with `Esc`.

**Expected.** **No label moves.** Not once. Every side is computed from the points and the authored
overrides alone — never from what is on screen, what is selected or what order the payload arrived
in. A label that wandered when an unrelated switch was pressed would be a label you stop believing is
attached to anything.

**Do.** Reload the page and compare.

**Expected.** Identical, for the same reason.

---

## T-560 · Wires and nets are two filters now

**Do.** Go to the **Locate** tab and look at the filter buttons.

**Expected.** Six: `To do`, `Components`, `Terminals`, **`Wires`**, **`Nets`**, `All`. The single
`Wire & net labels` button is gone.

**Why split them.** It was one button over 97 rows, which was right while the only thing either kind
could carry was a printed name. It is not right now: a wire has exactly two ends and its panel is a
pair of compasses, while a net has up to nine members and its panel is a list. Different work, done
in different sittings — and finding one among the other 96 rows was the cost of the merge.

**Do.** Look at the counts in the toolbar.

**Expected.** `41 of 47 placed · 6 to do · 71 wires · 26 nets · 0 end labels moved by hand`.

**The number that is deliberately absent** is the old `0 of 97 wire and net labels`. That was a
progress bar over something optional, which is the shape of `K7`. There is nothing here to finish:
the last number counts **decisions you have taken**, not labels that are missing, and it stays 0
until you overrule one.

**Do.** Press `Wires` and look at a row.

**Expected.** It reads **`ends known, no path`**. It said *"route from its terminals"* until today,
and that sentence is now false by decision: a wire's route is either lifted from the PDF's own
conductor strokes or traced by hand along the printed conductor, and a path computed from its two
endpoints is the one thing it may never be. (That is §3 of the wires-and-nets plan, and Sessions 5
and 6 are what act on it.) **Nothing about the row's state changed — only a phrase that was teaching
the wrong rule.**

---

## T-565 · A wire has one compass per end, headed with the pin

**Do.** With `Wires` on, pick `W052`. Look at the panel below the list.

**Expected.** Two rows, headed **`CR2:14`** and **`TB-120:1`** — the pin ids, in the netlist's own
`[from, to]` order. Each row has a 3×3 compass, an eye, and the side in force highlighted with the
word **`computed`** beside it.

**Why the ids and not "end 1" and "end 2".** These two ends are 600 pt apart on this sheet. *"This
end"* is not an answer, and the order is content rather than presentation: swapping them would
mislabel both ends of all 71 wires with nothing visible to show it.

**Do.** Note that the compass is **live immediately**, before you have placed anything.

**Expected.** It is. This is **`K4` narrowed**: the eight-way control used to do nothing until a point
existed, because there was nothing to attach a side to. An end label's anchor is a terminal point
that already exists in all 265 cases, so the control works the moment the row is armed. `K4` now
stands only for the old `label_point`.

**Do.** Press a side — north, say — on the first end.

**Expected.** The label on the sheet moves there **immediately**, before the save badge has even said
`saved`. The word beside the compass changes from `computed` to **`by hand`**.

**Do.** Paste the file:

    git diff schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

**Expected.** Exactly one new thing, and it names the terminal:

    "wires": {
      "W052": { "labels": { "CR2:14": { "dir": "n" } } }
    }

**Three things to check in those four lines**, because each is a decision:

1. **the other end is not there.** It is at its computed side, and *not being in the file* is how the
   file says so;
2. there is **no `label_point`** and no `point`. This record says which way a label faces and nothing
   about where the wire goes;
3. the `schema` at the top of the file now reads **2**. That is the whole migration — schema 2 only
   *added* the `labels` key, so a schema-1 file has nothing to convert, and the version is stamped
   the next time anything saves.

---

## T-570 · Reset deletes the override rather than writing the default

**Do.** On the end you just set, press the **↺** button at the right of its row.

**Expected.** The label goes back to its computed side, the word goes back to `computed`, the **↺**
disappears — and the file goes back to **empty**:

    git diff … → nothing at all

**This is the most important assertion in the document.** The tempting implementation is for *Reset*
to write in the side the rule would have chosen, which looks identical on screen. It would mean the
file can no longer distinguish *nobody has looked at this* from *a person decided this* — and that
distinction is the only reason `locations.json` exists rather than a guesser. The server refuses an
empty override for the same reason, so `{"hidden": false}` is not a thing the file can contain.

**Do.** Press `Ctrl+Z`.

**Expected.** The override comes back, and the badge says **`undid: reset W052's label at CR2:14 to
the default`**. Every end-label change is an ordinary document mutation: undoable, announced in
words, autosaved.

---

## T-575 · Hiding one end

**Do.** Press the **eye** on one end.

**Expected.** That label vanishes from the sheet. The row keeps its eye (now crossed out) and the
compass is gone — there is no side to choose for something that is not drawn. The file says:

    "wires": { "W052": { "labels": { "CR2:14": { "hidden": true } } } }

**Do.** Press the eye again.

**Expected.** The label is back and the file is empty again — pressing it off is the same deletion as
*Reset*.

**When you would use it.** One end of one wire in a crowded corner, where three labels on one pin is
one too many. It is per end on purpose: a switch that hid every label is the layer switch on the
other tab, and that already exists.

---

## T-580 · Three labels on one pin, and a side each

**Do.** Find a pin that carries all three: its **own id**, a **wire's** spec and a **net's** number.
`TB-120:1` is one — it is on net 120 and is an end of `W052`. On the Drawing tab, switch on
`Terminals` and `Wire & net labels`, select net `120`, and zoom in on it.

**Expected.** Three separate texts around one dot, on **three different sides**, none on top of
another. The order they take is fixed and not negotiable per pin:

1. the **terminal's own** id keeps its authored side (52 of the 131 have one; the rest sit at the
   default, east);
2. the **wire's** label takes its computed side, stepped clockwise if that one is occupied;
3. the **net's** takes what is left.

**Why fixed.** A rule you cannot predict is worse than a collision. And clockwise rather than
opposite, so two labels on one dot end up adjacent and read as one cluster belonging to one point.

**Do.** Move the pin's own label to another side with its compass on the Locate tab (T-330), then
come back and look.

**Expected.** The wire's and the net's labels have **moved out of the way** — the reservation is by
side, not by luck.

---

## T-585 · A net labels every member, and the crowded case

**Do.** On the Locate tab, press `Nets` and pick `130` — the net with the most members on this sheet.

**Expected.** One compass row per member terminal, in `member_terminals` order, in a list that
**scrolls** rather than truncating. Each is headed with its own pin id.

**Do.** Look at where the labels sit on the sheet.

**Expected.** Each faces **away from the centre of the rest of the net**, which spreads them
outwards rather than piling them into the middle.

**Do.** Find a net whose members share a dot, if there is one, and count the labels.

**Expected.** **One label per dot, not one per member.** Three members on one coordinate is one `120`
and not three copies of the word fanned around it. The roster on the other tab still lists all three,
because the membership is three — that is the undedup rule (`H12`), and the two answer different
questions.

---

## T-590 · A wire with nothing printed on it

**Do.** On the Locate tab, press `Wires` and look for a wire whose panel says it has no colour or
gauge. Two of the 71 are like this.

**Expected.** The panel says so in words, and offers **no compasses** — there is nothing printed to
label its ends with, and its `W###` is an id we invented, which is not on the sheet for anybody to
check. On the Drawing tab, its two ends carry no end label.

**Why nothing rather than the id.** A label the reader cannot verify against the paper is worse than
no label: it looks like a fact about the drawing. The wire is still fully citable, still frames its
run, and its roster still names both ends.

---

## What to report

The block from the index §4, plus one extra line for this document: **paste the `wires` and `nets`
sections of `locations.json`.** Half of what these tests check is what did not get written, and only
the file can say that.

The one to report loudly, whatever else is going on: **`git diff` showing lines you did not ask
for.** A default written into the file as though a person chose it is invisible on screen and
permanent in git.
