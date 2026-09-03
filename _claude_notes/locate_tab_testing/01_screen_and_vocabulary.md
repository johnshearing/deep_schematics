# The Locate screen, and the words it uses

Index: `locate_tab_instruction_and_test_manual.md`. Read that first.

This document is the instruction half of the manual: what every region of the screen is, what
every badge means, and the four words you need before the tests make sense. No tests here.

---

## The words

**Point** — a coordinate in **PDF points**, top-left origin, on a 1224 × 792 pt sheet. The same
space as the tiles and as everything in `geometry.json`, which is why no registration step exists
anywhere. One point is 1/72 inch. **Conductor rows on this sheet are 16 pt apart**, which is the
number that makes accuracy matter: 8 pt of error is half a row and can name the wrong circuit.

**Site** — one place a component is drawn. `CR-BP` has **three** on this sheet: its coil, its
`11`/`12` NC contact, and its `21`/`24` NO contact, each in a different circuit. So a component
owns a *list* of sites and the length of that list is a fact about this drawing, not a constant.
Anything shaped like "a coil point and a contact point" is wrong on arrival.

**Pin** — the bare name printed on a terminal: `A1`, `11`, `24`, `3`. A terminal's full id is
`PARENT:PIN` — `CR-BP:A1`. Pins are assigned to a site **explicitly, by you**, never inferred from
what the pin does: `CR-BP` has two pins whose function is `common` (`11` and `21`) at different
sites, so no rule over function could tell them apart.

**Label** — the *text* of an identifier as written on the sheet, as opposed to the thing itself.
**Three** separate ideas use the word, and keeping them apart is most of understanding this screen:

- *which side of a dot* its id is written on — eight compass points, your choice;
- for a wire or a net, *where its printed name sits* on the run — `label_point` in the file, optional,
  and never counted as missing;
- since 2026-08-24, an **end label**: the wire's or net's name at **each of its ends**.

**End label** *(new 2026-08-24)* — one per wire end and one per net member terminal: **265 of them on
this sheet**, all of them drawn without anybody placing anything. Their position is not stored,
because it does not need to be — the anchor is a terminal point you already placed, and the *side* is
computed: away from the wire's other end, away from the centre of the rest of the net, snapped to one
of the eight, stepped clockwise past anything already written there.

So `locations.json` holds **only the exceptions**. A side you chose, or an end you hid. Nothing else,
and in particular never the side the rule would have chosen anyway — *Reset to default* deletes the
record rather than writing that value in, because a default stored as though a person chose it makes
the file stop being able to tell you what anybody actually decided.

**What an end label says** is worth knowing before it surprises you: a **wire** shows its colour and
gauge (`BLUE 18AWG`) and never `W052`, because every `W###` is an id the extraction invented and is
printed nowhere on the paper. A **net** shows its own id. `10_tests_end_labels.md` is the whole of it.

**Path** *(new 2026-09-02)* — where a wire **actually runs on the paper**, and the one thing on this
screen that is a line rather than a point. It is a *list* of polylines, not one, because the
extractor splits a conductor at every crossover hop — 88 of them on this sheet — and a path across a
hop must show the gap rather than close it with a segment nobody drew.

A path is **never computed.** It is *lifted from the ink* — a conductor polyline out of
`geometry.json`, which is the PDF's own vector strokes rather than a reading of them — or *traced by
a person* along the printed run. It records which, forever, on two axes:

| | | |
|---|---|---|
| `geometry` | `extracted` | the polyline is the PDF's own stroke |
| | `human` | somebody drew it, and it says so everywhere it appears |
| `attribution` | `printed` | the net name printed beside that conductor matches this wire's net |
| | `human` | a person said this run is this wire's |

`derived` is a **rejected** word on both, refused by name: a straight line between a wire's two pins
is not a rough path, it is a different claim. `W068`'s chord is 312 pt across the middle of the
sheet and its ink is 644 pt going the long way round.

**A net has no path of its own** — its highlight is the union of its wires', so tracing one wire
improves every net it is on. `13_tests_paths_highlight.md` is the whole of it, and until Session 6
the only way to author one is a hand edit.

**Highlight** *(new 2026-09-02)* — the translucent orange stripe along a selected wire's or net's
path. 5 pt wide **in points**, so it thickens with the drawing rather than staying a fixed number of
pixels; never thinner than 3 device pixels, so it survives the 11% fit; and translucent, because you
are deciding *which* line this is and a highlight that hid the line would remove the evidence. **One
wire or one net at a time.**

---

## Provenance: the three states, and there is no fourth

Every point the system shows you is one of these, and the screen never blurs them:

| State | Shown as | Means |
|---|---|---|
| **confirmed** | **filled** dot · row says `placed` | A person put it there. This is the only state that is knowledge. |
| **seed** | **hollow** dot · row says `estimate` | The vision pass's own guess, made while looking at the pixels. Out by ~11 pt on this sheet. |
| **parent** | **hollow** dot · row says `on its component` | A terminal being shown at its component's point, because nobody has placed the pin. The *absence* of an answer. |

Hover any dot and the tooltip says which in words — *"the component's point, not this pin's — not
confirmed"*. There is deliberately no `derived` state: nothing in this system computes a
coordinate. That was built once and rejected.

---

## The screen, region by region

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ⌖ Locate   3 of 178 placed · 175 to do · 0 of 97 wire and net labels              │
│                                    [no changes] [Save] [−] 11% [+] [Fit]          │  ← toolbar
├───────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ circuit_logic.json is behind locations.json — re-run …                          │  ← stale banner
├───────────────────────────────────────────────────────────────────────────────────┤
│ locations.json places 'CR-GHOST', which is not in circuit_logic.json               │  ← problems
├──────────────────────────┬────────────────────────────────────────────────────────┤
│ [To do][Components]      │                                                        │
│ [Terminals][Wire & net   │                                                        │
│ labels][All]             │                                                        │
├──────────────────────────┤                  the sheet                             │
│ ⃝ CR-BP        estimate  │            (click to place · drag a dot)                │
│   relay — Run bypass…    │                                                        │
│ ⃝ CR-BP:11   on its comp │            (rows in alphabetical order)                 │
│ ⃝ CR-BP:A1   on its comp │                                                        │
│ ✓ TB-110:4       placed  │                                                        │
│   …                      │                                                        │
┝━━━━━━━━━━━━━━━━━━━━━━━━━━┥  ← accent edge, shaded ground: the panel is in front of │
│ CR-BP  [site main]       │     the list, not the end of it                         │
│ ┌ main   861, 679  ⌖place│                                                        │
│ │ A1 A2 11 12 21 24      │  ← the target panel                                    │
│ │ label  ▦▦▦             │                                                        │
│ └ [+ Another site]       │                                                        │
├──────────────────────────┤                                                        │
│ ☐ Move to the next unplac│  ← off by default                                      │
└──────────────────────────┴────────────────────────────────────────────────────────┘
  Pick a row, then click the sheet to place it · drag any dot to correct it · …
```

### Toolbar

**The counts**, as of 2026-08-24:

    41 of 47 placed · 6 to do · 71 wires · 26 nets · 0 end labels moved by hand

`47` here is the placeable rows still outstanding plus the placed ones — components and terminals,
the things that **need** a point, and the only work on this screen. The wires and nets are counted as
what they are: things in the index.

**The last number counts decisions, not gaps.** All 265 end labels already exist; this says how many
of them you have moved or hidden by hand. It starts at 0 and there is nothing to finish.

*What used to be there was `0 of 97 wire and net labels`, and it was removed on purpose.* A wire with
no printed-name position is not incomplete — every citation of it already frames the right run — so
that number was a progress bar over something optional, which is exactly the complaint `K7` records
about the *To do* filter. Hover the counts for the short version on screen.

**The save badge**, and it is the first thing to read when something seems not to have worked:

| Badge | Means |
|---|---|
| `no changes` | The draft matches what is on disk. |
| `unsaved` | You changed something; a write is scheduled ~0.9 s out. |
| `saving…` | The `PUT` is in flight. |
| `saved` | The server wrote the file and confirmed it. |
| `not saved` | The write failed. The error text sits to the left of the badge. |

**Save** forces the write now. Disabled when there is nothing to write.

**And, since 2026-08-24, a line to the left of the badge saying what `Ctrl+Z` just did** —
*"undid: moved `BYPASS-CB:1`"*, *"undid: renamed CR-BP's site main to Coil"*, *"redid: …"*. It is
there because a document mutation reverted silently on a 275-row file is indistinguishable from a key
that did nothing at all. It clears on the next change. T-470.

**Zoom.** `100%` is one tile pixel per *device* pixel — the sharpest these rasters go, not an
arbitrary percentage. `Fit` shows the whole sheet, which is about `11%` on a 1× display.

### The stale banner

Appears after your first successful save and stays. `locations.json` is now ahead of
`circuit_logic.json` — the file the model reads. The sheet you are looking at is already current;
only that artifact is behind. Fix it when you stop placing:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py

The editor deliberately will not run Python for you. See `05_tests_save_and_recover.md` T-450.

### The problems strip

One red line per coordinate the server **refused**, quoting its reason. Validation is per field, so
one bad value costs that value and nothing else — and it is published rather than dropped, because
a coordinate you typed and the server silently ignored is the worst outcome available here.

### The filters

| Filter | Shows |
|---|---|
| **To do** *(default)* | Components and terminals nobody has placed. This is the work queue. |
| **Components** | All 47, placed or not. |
| **Terminals** | All 131. |
| **Wires** | All 71. Two ends each, each with a label already; a compass per end. |
| **Nets** | All 26. One label per member terminal, up to nine of them. |
| **All** | All 275 entries. |

**`Wires` and `Nets` were one button** — `Wire & net labels` — **until 2026-08-24.** One button over
97 rows was right while the only thing either kind could carry was a printed name. It stopped being
right when each end got a label of its own: a wire has two ends and a pair of compasses, a net has up
to nine members and a list, and they are worked on in different sittings. **T-560.**

A row leaving *To do* the moment you place it is correct, and is the single most common "it
disappeared" report.

**The list scrolls itself to the armed row.** Whenever the target arrives from somewhere other than
a click in the list — a dot on the sheet, the advance, a site button — the list brings that row into
view, so the green highlight is never somewhere you have to hunt for. A row already on screen does
not move (T-180).

### The list

One row per designator: a state icon, the id in monospace, its one-line description, an optional
`our id` badge, and the state in words on the right.

**In alphabetical order by id, under every filter.** The index arrives from the server grouped by
kind — 47 components, then 131 terminals, then the wires and nets — which is the order the
extraction happened to walk and no order at all when you are looking for one row among 275. Sorted
by id, a component and its pins arrive together, because a terminal's id *is* its component's id
plus its pin: `CR-BP`, `CR-BP:11`, `CR-BP:12`, `CR-BP:A1`. Numbers sort as numbers, so pin `3`
comes before pin `21`. This is also the order the advance walks — "the next one" means the next one
down the list you are reading.

| Row says | Icon | Meaning |
|---|---|---|
| `placed` | ✓ green | confirmed — you put it there |
| `estimate` | ⃝ amber | seed — the vision pass's guess |
| `on its component` | ⃝ amber | parent — the pin has no point of its own |
| `route from its terminals` | 🔗 grey | a wire or net, route known, **label not placed** |
| `label placed` | 🏷 green | a wire or net whose name you have placed |
| `nowhere` | ⊘ grey | no position at all — the two off-page machines and the four referenced drawings |

**`our id`** means the extraction invented that identifier and you will not find it printed on the
sheet: every `W###`, the `TB-…:<n>` point numbers, and the `RECEPT1`/`INFEED1`/`DISCHARGE1` pin
numbers.

### The target panel

Appears under the list when a row is picked, and is **visibly set apart from it**: a 2 px edge in
the ring colour, a filled grey ground, and a shadow cast upward over the list, because the panel is
in front of the list rather than the end of it. It always names the target out loud, because the
next click writes a coordinate into an authored file and there must never be doubt about which id it
lands on.

**✕ at the right of its header** is the way back to nothing selected — no red dot, no crosshair,
the hand back on the sheet. `Esc` does the same from anywhere on the tab, and a text field gets
the first `Esc` for itself (it only loses focus, so half a typed site name survives). Being armed
is a mode, and this is the way out of it; see T-165.

**For a component** — one block per site:

- the **site name**, editable a whole word at a time. Nothing is written while you type; the name
  lands on `Enter` or when you click away. A name that is empty, or one another site already has,
  is refused **on screen** — red edge, reason underneath, what you typed left there to fix. `Esc`
  puts the stored name back. (This was K3.)
- the **coordinate**, or `unplaced`.
- **place / placing** — aims the next click at *this* site, **and takes the sheet there**.
  `placing` means it is armed, and pressing it in that state is how you fly back to the site you
  are working on after panning away. These buttons are the only thing on screen that names one
  site of several, so they are also how you *find* one (T-215).
- **🗑** — removes this site entirely.
- **the pin chips** — every pin the netlist gives this component. Click one to say it is drawn at
  this site. A pin already claimed by another site shows struck through; clicking it **moves** it.
- **label ▦▦▦** — the eight sides plus a centre dot for "let the viewer decide" (east). Only shown
  for the armed site, and only effective once the point exists (K4).
- **+ Another site** / **Place this component** — arms a new site. The site is *not* created until
  you click the sheet, because a site with no point would be refused by the server and reported as
  a problem.

**For a terminal** — says where it currently sits (`its own point`, `site <id>`, or `unplaced`),
the eight sides, and **Unplace** once it has a point of its own.

**For a wire or a net** — says `label placed` or `label not placed`, the eight sides, **Remove the
label point**, and one sentence you should read once: its route is not placed here **and never will
be**. That is not a missing feature. See `04_tests_labels.md`.

### The advance checkbox

*Move to the next unplaced after each click.* **Off by default** — tick it when you sit down to
walk the list. It is what turns 131 placements into a run instead of 131 decisions about what to do
next, and it is also the only control on this screen that moves the target without being asked,
which is why it is opt-in: with it off the sheet stays exactly where you put it. It advances in
**list order**, which is alphabetical. Placing a wire or net **label** never advances, on or off.

### The sheet

Same viewer as the Drawing tab — the same tiles, the same one projection. Drag to pan, scroll to
zoom, double-click to zoom in, `0` fits, **bare arrows pan the sheet**. The cursor is a crosshair
whenever a target is armed, and a hand whenever one is not — so the cursor is the readout for which
mode you are in. `Esc` selects nothing and gives the hand back.

**`Ctrl+Z` and `Shift`+arrows** (2026-08-24), which are the two halves of one answer to *"a marker
moved and I cannot put it back"*:

| Key | Does |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | undoes the last change to the document — a point, a drag, a rename, a pin, a label side, an unplace. Fifty deep, in memory, cleared when the file loads. It says what it undid in the toolbar and arms the row it changed |
| `Ctrl+Shift+Z` | redoes it. A new edit after an undo drops the redo |
| `Shift`+arrow | moves the armed point **1.0 pt**, in the direction the arrow points, y down the page |
| `Shift`+`Alt`+arrow | **0.1 pt** — the finest thing `locations.json` can record |

Three things about them worth knowing before you need them. **The step is in points, not pixels**, so
a nudge is the same correction at 11% as at 400% — against 16 pt conductor rows, one point is a
sixteenth of a row wherever you are standing. **A whole run is one undo:** ten arrow presses, or one
drag however many frames long, goes back in a single `Ctrl+Z`. And **only a point the file already
holds will move** — a row reading `on its component` has a dot on screen and no point of its own, and
nudging it would turn *"we guessed"* into *"a human confirmed"*, so the keys do nothing there.
Placing is a click and stays a click. T-470–T-490.

**Undo is not cross-session.** The stack dies with the page, deliberately; git is still the only
recovery beyond it, which is why a run of placement should end in a commit.

**`F2` leaves for the Drawing tab, and `F2` brings you back** (2026-08-19). Worth knowing mid-run,
because the answer to *"is that dot really on the right conductor row?"* is on the other tab: your
armed target, the panel, the unsaved draft and this sheet's pan and zoom all survive the trip, and
the two tabs hold their pan and zoom separately. T-425 is that test. The key is bound
application-wide in `App.tsx`, not by this tab, so it also works while the caret is in a site-name
box — where it does nothing to the text.

**And the Drawing tab shows the same groups this filter does** (2026-08-19, later the same day).
`Components`, `Terminals` and `Wire & net labels`, in its own toolbar, in those words. Until then it
drew components only, so `F2` could check a component from the reader's side but never a **pin** — and
the pins are the 131 placements. One difference, and it is deliberate: over there they are
**independent switches**, not one exclusive choice, because a reader's question is a comparison
(*is that pin on the same row as its relay?*) and both halves have to be visible at once. T-190 and
T-360 are those tests. Since 2026-08-19 (third change of the day) those switches are **filled when
they are on**, the same way this tab's filter buttons are: with every combination legal, "which
filters are in effect" has to be readable on all of them at once.

**Five of them since 2026-08-25**, when `Wire & net labels` became **`Wires`**, **`Nets`** and
**`Labels`** — the same split this tab made a day earlier, plus a switch for the *text*. An end label
now needs its own kind's switch **and** `Labels`, because it is a label of a wire. **T-605.**

**Past 50% zoom, picking a row leaves the sheet exactly where it is** (2026-08-19). Below that
nothing has changed — the sheet flies and lands at 50%, which is T-110. But 50% is also where a
flight *lands*, so from anywhere closer every flight is a zoom out, and past it you are normally at
a magnification you chose in order to work on one dot: it is already on screen and the pointer is
beside it. So above the ceiling neither the magnification nor the position moves, for a row, the
advance, a site button or a dot alike. **T-115** is that test, and the footer under the sheet says
so. Zoom back out to 50% or less and every flight works as it always did.

---

## Dots on the sheet

- **Filled** = confirmed. **Hollow** (white with a coloured inner ring) = seed or parent.
- The **armed target** is red and larger. Everything else is blue.
- Ids appear next to dots **only at 30% zoom or above**. Below that they are a grey fog and are
  hidden. If you cannot see any labels, check the zoom before reporting anything.
- Only what the current **filter** shows gets a dot. On *To do* you will not see dots for things
  already placed — switch to *Components* or *All* to see everything.
- A wire or net gets a dot **only once its label point exists**. Before that there is nothing
  honest to draw: its `point` is the midpoint of a bounding box, which is usually blank paper.
- **End labels are text, not dots** *(2026-08-24)*. Arm a wire or a net and its name appears at each
  of its ends — hanging off pins that already have dots, with nothing new to click and nothing to
  drag. They obey the same 30% floor as every other piece of label text, and the ends of the armed
  row bring their pins' dots onto the sheet with them whatever the filter says, because a label with
  no dot beside it is a label whose side you cannot check.
- **A highlight is not a dot either** *(2026-09-02)*. Select a wire or a net that somebody has
  traced and its run is painted along the ink — on the tile canvas, under every dot, and **through
  the same projection**, so it cannot drift off the conductor it names. It is read off the selection
  (or, here, off the armed row) and off nothing else, so it stays lit through every layer switch and
  goes out when you select something else. Nothing to click and nothing to drag: the editor for it
  is Session 6.
- Dots are **draggable here and nowhere else**. The Drawing tab passes no drag handler, so a stray
  drag there pans the sheet and cannot edit the file.
- The **Drawing tab draws the same dots, by the same rules** — one per place, filled versus hollow,
  the label side you chose — but which ones it draws is its own five switches rather than this
  filter. Same `MarkerLayer`, same one projection; only the question "which of these do I want to
  see" is answered separately, because the two screens are being read for different reasons.
  *"The label side you chose" was a claim and not a fact until 2026-08-19:* a dot that is the only
  one its designator has — which is 269 of 275 — reached that tab without its side and came out
  east. **T-335** is the test that keeps it honest.

---

## The other screen's list *(added 2026-08-25)*

Not this tab either, and the closest thing to it in the application — so the words are deliberately
this tab's words.

The Drawing tab now has **a list of all 275 designators down its left**, in **this list's order**,
from the same collator: `+24V`, `0V`, `24E-1`, `110`, … `W071`, with a component and its pins
together. Every row shows the same id, the same one-line description, the same `our id` badge and the
**same state words** — `placed`, `estimate`, `on its component`, `nowhere`, `ends known, no path`,
`label placed`. It is literally the same component (`components/DesignatorList.tsx`), which is what
makes that promise keepable.

What is different is everything about *editing*:

| | This tab's list | The Drawing tab's list |
|---|---|---|
| A row click | **arms** the row — the next click on the sheet writes | **selects** it — the sheet flies to it and the card names it |
| The state | the unsaved **draft** first, the server's answer second | the published index, always. No draft exists there |
| Filters | `To do` `Components` `Terminals` `Wires` `Nets` `All`, **one at a time** | `Components` `Terminals` `Wires` `Nets`, **any combination**, none of them meaning all |
| A search box | none — the filters plus the advance are the way through 275 rows | **yes**, matching the id and the description |
| A password | required | **none**. It works with `SWUI_ALLOW_EDITS=false`, which is the point |

**The one sentence to remember about that screen**, because two rows of similar buttons sit a few
pixels apart on it: *the switches over the sheet change what the drawing shows; the buttons over the
list change what the list shows; neither touches the other.* **T-600–T-650**, and `K9` — *a net
cannot be selected from the sheet* — is what it fixed.

---

## The other screen's card: a roster *(added 2026-08-24)*

Not this tab, but this tab's vocabulary, and the words have to be the same ones.

Selecting a **net** or a **wire** on the Drawing tab now marks **the terminals it is made of** rather
than their parent components, and the card lists them — one row per member, in the netlist's order,
undeduped. Each row says how well **its own** point is known, in this tab's three words:

    CR2:14        placed
    TB-120:1      placed
    DISCHARGE1:3  placed
    CB1:2         nowhere

`placed`, `estimate`, `on its component`, `nowhere` — the same four the list on the left uses, from
one place in the code, so a reader who learned "on its component" here meets the same phrase there.
Clicking a row flies to that pin. On a server with an editor, a row that is not `placed` also carries
a small **place it** button, which arms that pin over here and switches tabs.

**Why it matters to this tab.** It is the pay-off of the 131 terminals: a net highlight is only as
good as its members' points, and the roster is where somebody notices that one of them has none.
`09_tests_net_membership.md`, T-500–T-530.

**Two corrections to that card, later the same day** (2026-08-24), both asked for after walking it:

- **the parent components are no longer marked** on the sheet. They are still *named* on the card
  under `runs through`, which is a different claim — net 120's seven pins were bringing five extra
  rings and five forced labels with them, and *"this adds clutter and confusion to the drawing"* is
  the right verdict. **T-530.**
- **a card reached from a roster row carries `← back to 120`**, which puts the roster back and frames
  the net again. One step, not a history. **T-525.**
