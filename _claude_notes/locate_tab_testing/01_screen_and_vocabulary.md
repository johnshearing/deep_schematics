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
Two separate ideas use the word:

- *which side of a dot* its id is written on — eight compass points, your choice;
- for a wire or a net, *where its name is printed*, which is the only position either of them has.

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

**The counts.** Two numbers that are deliberately not added together:

    3 of 178 placed · 175 to do · 0 of 97 wire and net labels

`178` is components + terminals — the things that **need** a point. `97` is nets + wires, whose
routes are already known from their terminals; their labels are optional polish and are **never**
counted into "to do". A progress bar that can never reach the end is worse than no progress bar.
Hover the counts for that explanation on screen.

**The save badge**, and it is the first thing to read when something seems not to have worked:

| Badge | Means |
|---|---|
| `no changes` | The draft matches what is on disk. |
| `unsaved` | You changed something; a write is scheduled ~0.9 s out. |
| `saving…` | The `PUT` is in flight. |
| `saved` | The server wrote the file and confirmed it. |
| `not saved` | The write failed. The error text sits to the left of the badge. |

**Save** forces the write now. Disabled when there is nothing to write.

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
| **Wire & net labels** | All 97 nets and wires. Their routes are computed; their labels are placeable. |
| **All** | All 275 entries. |

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
zoom, double-click to zoom in, `0` fits, arrows nudge. The cursor is a crosshair whenever a target
is armed, and a hand whenever one is not — so the cursor is the readout for which mode you are in.
`Esc` selects nothing and gives the hand back.

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
- Dots are **draggable here and nowhere else**. The Drawing tab passes no drag handler, so a stray
  drag there pans the sheet and cannot edit the file.
