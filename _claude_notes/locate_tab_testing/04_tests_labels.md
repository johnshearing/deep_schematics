# T-3xx — wire and net labels, and the eight sides

Index: `locate_tab_instruction_and_test_manual.md`. Ids and coordinates: `07_drawing_facts.md`.

Two different things share the word *label*, and keeping them apart is most of understanding this
file:

- **T-31x, T-32x — a wire's or net's label point.** Where its *name* is printed on the sheet. This
  is the only position either of them has.
- **T-33x — the label side.** Which of eight compass directions a dot's id is written on. Applies
  to every kind, not just wires.

---

## The one thing that cannot be placed, and why it is not a missing feature

A wire's **route** is its two endpoint terminals. That is not a simplification — it is the claim the
whole netlist rests on. If a human could author a path, the system would be able to draw a line
between two terminals that no conductor on the sheet actually joins, and every route it displayed
would become an assertion nobody had checked.

So `locations.json` has **nowhere** to say where a wire goes. What it has is `label_point`: where
`BLUE 18AWG` is printed. The key is named that way on purpose, so nobody reading the file later
mistakes it for the wire's location.

Consequence worth knowing before T-310: **placing the 131 terminals gives all 71 wires their routes
for free.** Wire labels are polish on work that is already complete, which is why they are counted
on their own line and never as "to do".

---

## T-300 · Wires and nets are in the list, and are not work

**Amended 2026-08-24 (Session 2).** Three things in this test changed and the point of it did not:
wires and nets are still not work. `10_tests_end_labels.md` T-560 is the current version of the
first two steps and is the one to walk; this is kept because the *reason* is still the reason.

**Do.** Filter **To do**. Look for `W047`.

**Expected.** Not there. Nor any net number.

**Do.** Filter **Wires**, then **Nets**. *(One button, `Wire & net labels`, until 2026-08-24.)*

**Expected.** 71 `W###` and 26 nets between the two. Every one reads **`ends known, no path`** in
grey — *"route from its terminals"* until 2026-08-24, and that phrase is now false by decision: a
route is lifted from the sheet's own conductor strokes or traced by a person, never computed from the
two ends. **All 71 wires** carry the `our id` badge, because `W###` appears nowhere on the printed
sheet; only two nets do (`NET-PB1` and `NET-PB2`, printed as `PB1` and `PB2` and renamed during
extraction to avoid colliding with the push-buttons of those names).

**Do.** Read the toolbar counts.

**Expected.** `… · 71 wires · 26 nets · 0 end labels moved by hand`. **Not** `0 of 97 wire and net
labels`, which is what this test used to expect: that was a progress bar over something optional,
which is `K7`'s shape, and it was removed. The "to do" number still does not include them, which is
what this test has always been for.

---

## T-310 · Placing where a wire's name is written

**Do.** Pick **`W047`**. Read the panel before clicking.

**Expected.** Header badge says `label not placed`. Two paragraphs: one telling you to click where
the name is written, and one saying its route *"is not placed here and never will be"*. **There is
no place/placing button and no site block** — a wire has neither.

**Also expected:** the sheet flies to frame `W047`'s **run** — from `CR-ON:A2` to `TB-110:3` — and
there is **no dot**. Correct: before a label point exists there is nothing honest to put a dot on,
because a wire's `point` is the midpoint of a bounding box and that is usually blank paper.

**Do.** Find the blue conductor between those two terminals and click on or beside it.

**Expected.**

- A filled dot appears there, labelled `W047`.
- The row changes to **`label placed`** with a green tag icon.
- Counts go to `1 of 97 wire and net labels`.
- The panel now reads `label placed` with the coordinate.
- **The target does not advance**, even with the advance checkbox on — being thrown to an unrelated
  terminal after tidying a wire's name is not a run.

In `locations.json`:

```json
"wires": { "W047": { "label_point": [x, y], "source": "human", "by": "js", "at": "..." } }
```

**Check this specifically:** the key is `label_point`, and there is **no** `point` key on that
entry. If you see `"point"` on a wire, that is the bug this whole design exists to prevent — report
it immediately and quote the block.

---

## T-320 · A net label, and the section it lands in

**Do.** Pick net **`110`**. Place its label beside the conductor carrying it.

**Expected.** In the file it lands under **`nets`**, not `wires`:

```json
"nets": { "110": { "label_point": [x, y], "source": "human", ... } }
```

Two sections rather than one because a person reads this file, and `"wires"` beside `"nets"` is how
you would have written it.

**Do.** Note the coordinate. Then look at where the sheet framed the net before you placed it.

**Expected.** Net `110` touches eight terminals across a wide area, so framing it zooms **out**. The
label point you placed is a single specific spot inside that region, and the two are independent —
`rect` still frames the whole net after you place the label. That is the point of the separate field.

---

## T-330 · The eight label sides

This applies to **every** kind, not just wires. Use a component whose id is long enough to see —
`TB-PB2SP` is ideal.

**Do.** Pick `TB-PB2SP`, place it, and zoom to **at least 30%** (below that ids are hidden — see
`01_screen_and_vocabulary.md` §Dots). Note which side of the dot the text sits on.

**Expected.** East — to the right of the dot — which is the default.

**Do.** In the panel's `label ▦▦▦` control, click the top-left square (`nw`).

**Expected.** The id moves **above and to the left** of the dot. The dot itself does **not** move —
that is the whole reason this control exists rather than the label being dragged. The file gains:

```json
"label": { "dir": "nw" }
```

**Do.** Click each of the eight squares in turn, then the centre dot (`·`).

**Expected.** The text moves to that side each time; the centre dot removes the setting and returns
it to east, and `"label"` disappears from the file.

**Known issue K4 — you will hit this if you try it in the wrong order.** The control does **nothing**
on a designator whose point does not exist yet. Place first, then choose the side. Logged, do not
report.

**Why eight sides and not free dragging.** Offered; you chose eight. So there is no offset form in
the file and no drag gesture for text. If eight ever proves too coarse, that is a change, not a bug.

---

## T-335 · The side you chose reaches the Drawing tab (2026-08-19, not yet walked)

**This is the fault that was reported**, in the reporter's words: *"I placed DISC1:L1, DISC1:L2 and
DISC1:L3 with their labels oriented to the west, but on the Drawing tab the labels are east of the
terminal — the default, rather than what I selected."*

**Do.** Pick a terminal that is the **only** dot its designator has — any pin with its own point:
`DISC1:L1` is the reported one. Set its label side to `w` (T-330) and confirm on **this** tab, at
30% zoom or more, that the id sits to the **left** of the dot.

**Do.** `F2` to the **Drawing** tab, press `Terminals`, and find that same dot. (Zoom to 30% or more
or ids are hidden — that is H7, not this.)

**Expected.** The id is on the **west** side there too, at any zoom, on either tab. Try two or three
sides and check each; then check a dot you have never set a side on and confirm it is **east**, which
is the default and must stay the default.

**Where the fault was, because it is a good example of a whole class.** Nothing was wrong with the
viewer. The index publishes a `places` array only when it says something the flat `point` and
`placement` fields cannot — and "a single dot" used to be taken as "says nothing", which is true of
the coordinate and false of the label side, because `label_dir` lives **only** in `places`. So 269
of the 275 entries dropped it on the way out of the server and the viewer applied its default. Both
halves of that sentence looked correct in isolation: the editor wrote the file properly, the file
held `"label": {"dir": "w"}`, and the viewer honoured every `label_dir` it was given.

**Extended 2026-08-24: the same round trip for an *end* label.** Arm a wire on the Locate tab, set
one end's side with its compass, and check that end on the Drawing tab with `Wires` **and** `Labels`
switched on (one switch, `Wire & net labels`, until 2026-08-25 — T-605). It is the same class of fault in a different field — `label_dir` on a **member** of a
wire or net this time, published by `_member` in `drawing.py` — and it has the same one-line failure
mode: a side that is not in the payload is a side the reader cannot see. The difference is what the
default means. A terminal's own label defaults to east *because there is nothing better to say*; an
end label's default is **computed** from the wire's other end, so "it came out east" is a real
symptom here rather than a plausible one. See `10_tests_end_labels.md` T-565.

**If it is still east.** Look at the API before the UI:
`curl -s localhost:9700/api/designators | python -m json.tool | grep -A3 'DISC1:L1'` — if there is
no `places` array on that entry, it is `_entry` in `server/app/drawing.py`; if there is one and it
carries `label_dir`, it is `LABEL_SIDE` in `MarkerLayer.tsx`. And remember a server change needs a
restart (index §1).

---

## T-340 · Removing a label point

**Do.** Pick a wire whose label you placed, and click **Remove the label point**.

**Expected.** The dot disappears, the row returns to `ends known, no path`, and the id is **gone from
the `wires` object** in the file — not nulled. If it was the only one, `"wires"` is left as `{}`.

**One exception since 2026-08-24:** if that wire also has an **end-label** override, the record stays
and keeps only its `labels`. The two are answers to different questions — where the printed name sits,
and which way each end faces — and removing one must not silently take the other with it.

**And confirm the route survived.** Switch to the **Drawing** tab and select that wire: it still
frames the run correctly and rings its two endpoint components. Removing a label must never affect a
route, because the route was never stored in the first place.

---

## T-350 · A wire label on the Drawing tab

The point of all this is what a *reader* gets, so check it from the other side.

**Do.** Place a label point for `W048` (`CR-BP:A2 → BYPASS-CB:2`, blue 18AWG). Switch to the
**Drawing** tab. Ask a question whose answer cites `W048`, or select it any way you can, and click
through.

**Expected.** The viewer flies to the run **and puts a red marker labelled `W048` on the printed
text**, where you placed it.

**Then do.** Remove the label point (T-340), rebuild nothing, just reselect `W048` on the Drawing
tab.

**Expected.** It frames the run and rings the two endpoint components, with **no `W048` dot at all**.
That is the honest fallback: without a label point there is no place on the sheet that *is* the wire.

**If the Drawing tab shows an old state.** It re-reads the index after every save — but if it is
stale, that is `appStore.refreshDesignators`, covered by T-420 in
`05_tests_save_and_recover.md`.

---

## T-360 · Every label at once, without a citation (2026-08-19, not yet walked)

T-350 checks one label, reached the way a reader reaches it — through an answer. This checks the
**set**, which is the question a person placing them actually has: *which names have I done?*

**Do.** Place label points for two or three wires and a net. Switch to the **Drawing** tab and press
**`Wires`** and **`Nets`** in the toolbar. *(One button, `Wire & net labels`, until 2026-08-25; see
T-190 for the five groups and `11_tests_drawing_list.md` T-605 for what each does now.)*

**Expected.** Every label point you have placed gets a dot, all at once, **on the printed text** —
and nothing else does. The ones you have not placed are simply absent. Press the button again and
they all go.

**Expected, and this is the invariant.** A wire's `point` — the midpoint of its bounding box — gets
**no dot, ever**, in this group or any other. That midpoint is usually blank paper, and a dot there
would sit on nothing and claim to be `W048`. Likewise a net's centroid. If you see a dot on empty
paper carrying a wire's or a net's name, that is the bug this whole design exists to prevent, and it
is worth a report on its own.

**Expected.** Clicking one selects it as a **wire** or a **net**, and the card names it as such with
its `runs through` chips live for the endpoints. Not as a component.

**Do.** Before you have placed any, look at the toolbar.

**Expected.** `Wires` and `Nets` are offered anyway — **because of their end labels**, which are
text hanging off pins and count as something to draw even with no printed name placed anywhere. A
group with *nothing at all* still gets **no button**: a switch that changes nothing when pressed
reads as broken, where an absent switch reads as *there is none of this on the sheet*. (Before the
end labels landed on 2026-08-24 this drawing had no such button at all, and the note here said so.)

**If the count looks wrong.** The tooltip on the button says `n of m` — how many have a label point
against how many wires and nets exist. That is the same pair the Locate toolbar reports as
`n of m wire and net labels`; if the two disagree, the Drawing tab is one save behind and that is
T-420.

**If not.** `DrawingTab.tsx` `atLabelPoint` — the one function that turns a wire or a net into
something drawable, shared with the selected-marker path so a label dot cannot appear in one and not
the other.
