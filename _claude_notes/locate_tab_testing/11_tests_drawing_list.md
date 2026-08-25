# T-6xx — the Drawing tab's list, and five switches over the sheet

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-08-25** with Phase C of `_claude_notes/highlighting_wires_and_nets.md` (Session 3).

**These are Drawing-tab tests and they need no editor password.** That is not a convenience, it is
the acceptance criterion: **T-650 asks you to restart the server with `SWUI_ALLOW_EDITS=false` and
walk the list again.** Everything here must work for somebody who has the drawing and no editor.

**Nothing in the file format changed.** No server change either — this is a pure client session, so
`locations.json` cannot have moved, `circuit_logic.json` cannot have gone stale, and
`/api/designators` is byte-for-byte what it was yesterday. If any of those *has* changed while you
walked these tests, that is worth a report on its own.

---

## What this session was for

Two complaints, one of them written down as a known issue:

> **`K9`** — *a net cannot be selected from the sheet.* The dots are components, terminals and
> printed names. A net is none of those, so the only route to net `120`'s highlight was a citation
> in an answer — which costs a question, a wait, and a model that happens to mention the thing you
> want.

And the smaller one behind it: the Drawing tab could show you 275 identifiers and give you no way
to **find** one. You could click what you could see, and that was all.

So: **a list down the left of the sheet, all 275 rows, read-only, with a search box.** Plus the
`Wire & net labels` switch splitting into **`Wires`**, **`Nets`** and **`Labels`**, which is three
questions where there was one.

**The sentence to carry through every test below**, because the two rows of buttons look alike and
sit a few pixels apart:

> **The switches above the sheet change what the *drawing* shows. The buttons over the list change
> what the *list* shows. The box narrows the list further. Neither set touches the other.**

---

## T-600 · The list, and what a row says

**Do.** Start the server as in the index §1 and open the **Drawing** tab.

**Expected.** Down the left, a panel headed **`Index 275`**, and under it a search box, four filter
buttons — `Components` `Terminals` `Wires` `Nets` — and a scrolling list of rows. The sheet is to
its right, fitted, exactly as it always was but narrower.

**Do.** Scroll the list from the top.

**Expected.** **Alphabetical by id, numbers in numeric order**, which is the Locate tab's order from
the same collator — so what you learned over there is where things are over here. The first rows on
this drawing are:

    +24V  0V  24E-1  110  111  120  121  125  130  BYPASS-CB  BYPASS-CB:1  BYPASS-CB:2  CB1  CB1:1

and the last is `W071`. A component and its pins arrive **together** — `CR-BP`, `CR-BP:11`,
`CR-BP:12`, `CR-BP:21`, `CR-BP:24`, `CR-BP:A1`, `CR-BP:A2` — because a terminal's id *is* its
component's id plus its pin. That is the whole reason the list is not in the order the server sends
it, which is grouped by kind and puts a relay a hundred rows from its own contacts.

**Do.** Read one row of each kind.

**Expected.** Each row carries an icon, the **id** in monospace, the **one-line description** under
it, and on the right **how well its position is known**, in the same words the Locate tab's list
uses:

| Row | Says | Because |
|---|---|---|
| `CB1` | `placed` | a human confirmed it |
| `110` | `ends known, no path` | its members' points are known and nobody has placed its printed name — and a path is a Session 5 thing |
| `UPSTREAM-MACHINE` | `nowhere` | it is off this sheet |
| any `W###` | `ends known, no path` | as above |

A wire or a net also carries the **`our id`** badge, because every `W###` and the two `NET-…` names
are ids the extraction invented and you will not find them printed on the paper.

**Why the same words.** A reader who learns *on its component* in the editor must meet the same
phrase here. They are spelled in one place in the code (`lib/designators.ts` `PLACEMENT_LABEL`) and
the row itself is now **one component used by both tabs** (`components/DesignatorList.tsx`), so the
two lists cannot drift into different English.

---

## T-605 · Five switches over the sheet, not three

**Do.** Look at the toolbar, top right.

**Expected.** **`Components` `Terminals` `Wires` `Nets` `Labels`** — five independent switches,
**filled when on**, and only `Components` is on. The sheet looks exactly as it did before this
session until you press something.

**Do.** Hover each one.

**Expected.** Each tooltip says how many marks that group has to draw and how many the index holds.
`Wires` and `Nets` draw a *printed name* where one has been placed — on this drawing that is **none
of them**, deliberately (see the index §5a) — plus they **gate the end labels** of their own kind.
`Labels` is the text itself.

**Do.** Press `Wires`. Then `Labels`. Then zoom past 30%.

**Expected.** With `Wires` alone, nothing new appears — there is no wire whose printed name anybody
has placed. With `Labels` **as well**, the ends of every wire that has a colour and gauge say
`BLUE 18AWG` and the like. **Two switches, one mark**, and that is the rule: an end label is a label
*of a wire*, so it needs the text switched on and the thing it names switched on.

**Do.** Press `Nets` as well.

**Expected.** Net ids appear at their member terminals too — 265 strings over 131 pins, which is why
the two kinds have separate switches. Below 30% zoom every label of every kind is hidden (H7); check
the percentage before reporting a missing label.

**Why the split.** `Wire & net labels` was one button over two different questions. *Which conductor
is `BLUE 18AWG`* and *what is on net 120* are asked at different moments, and the Locate tab split
its own filter for the same reason on 2026-08-24.

---

## T-610 · A net, from the sheet, without spending a question — **`K9` is fixed**

**Do.** Type nothing. Click the row for net **`120`** in the list.

**Expected.** Everything T-500 gave you for the price of a question:

1. the sheet **flies to frame the net**;
2. **seven dots are ringed**, one per member terminal, `CR2:14` on CR2's NO contact on the far left
   and the three `TB-120` pins as three separate dots;
3. the card in the corner is the **roster** — `7 terminals`, each with its own state, each a click
   away from being flown to, `runs through` underneath;
4. the row you clicked is **shaded** in the list, and stays shaded while you read.

**Do.** Compare against T-500, if you walked it.

**Expected.** The same highlight, the same roster, the same rings. The only difference is what it
cost: **one click instead of one question.** That is the whole of `K9`.

**Do.** Press `Esc`, then click the row again.

**Expected.** Card and rings gone, then back. Clicking the row you are already on **flies again** —
by then you have usually panned somewhere else, and a silent no-op reads as a broken row.

**Note.** On this tab a row click *always* moves the sheet, and that is deliberately unlike the
Locate tab's 50% ceiling (T-115). Over there you are working on a dot you can already see; here you
have just named something you cannot.

---

## T-615 · A wire row frames the run and labels both ends

**Do.** Type `W052` into the box and click the row.

**Expected.**

- the sheet frames the run — `CR2:14` to `TB-120:1`;
- **no dot appears in the middle of it.** A wire's `point` is the centre of a bounding box and is
  usually blank paper; a dot there would sit on nothing and claim to be the wire. This is invariant 1
  and it holds whatever the switches say;
- **both ends say `BLUE 18AWG`** — not `W052`, which is an id we invented and is printed nowhere —
  and they say it **even though `Wires` and `Labels` are switched off**, because the selection is
  exempt from the layer switches (H11): hiding the thing you just asked for is the one case the
  overlay must stay visible for;
- the card reads **`ends`** and lists `CR2:14` then `TB-120:1`, in that order.

**Do.** Click the row for **`W012`** — one of the two wires on this drawing with no colour and no
gauge (`W015` is the other; `10_tests_end_labels.md` T-590 is the test for them).

**Expected.** The run is framed, the roster names both ends, and **there are no end labels** — there
is nothing printed on the paper to write. A label the reader cannot verify is worse than no label.

---

## T-620 · The list filters the list; the switches filter the sheet

**This is the load-bearing test of the session.** If it fails, the screen is teaching a wrong model
of itself.

**Do.** Press **`Nets`** *over the list* (the lower row of buttons, above the rows).

**Expected.** The list shows **26 rows** and the header reads `Index 26 of 275`. On the sheet:
**nothing whatsoever changes.** The component dots are still there, the `Components` switch is still
filled, and the `Nets` switch in the toolbar is still **off**.

**Do.** Now press **`Nets`** *in the toolbar* (the upper row).

**Expected.** The sheet gains what that group draws. The list is **still those 26 rows** — a switch
over the sheet cannot narrow the list.

**Do.** Press `Terminals` over the list as well, so two filters are on.

**Expected.** **157 rows** — 26 nets and 131 terminals. The filters are **independent and additive**,
not one exclusive choice: *terminals and nets* is an ordinary request. (The Locate tab's filters
*are* exclusive, because over there a filter picks the queue you are working through. Here you are
looking something up.)

**Do.** Press both of them off again.

**Expected.** All **275** rows. **None of them on means everything**, which is why there is no *All*
button to explain — there is no state you can get stuck in.

**Do.** With net `120` selected, switch **`Nets`** off in the toolbar, then `Components` too.

**Expected.** The net's seven rings and its labels **stay** (H11), and every chip under
`runs through` on the card **stays live** — those links are about what the net runs through, not
about which dots you want on screen. A dead chip after pressing a toolbar button would be this
session's most likely bug and it has its own hazard note.

---

## T-625 · Finding a row by typing

**Do.** Type `relay` into the box.

**Expected.** **Five rows** — `CR1`, `CR2`, `CR-ON`, `CR-BP`, `CR-SW`. None of them has the word
`relay` in its id: the box matches the **description** as well, which is the half you need when you
do not know the id. Case does not matter.

**Do.** Clear it and type `120`.

**Expected.** **Sixteen rows.** Five of them have `120` in the id — `120`, `TB-120` and its three
pins — and the rest are the wires and terminals whose description names net 120. That is the search
working: the wire *on* the thing you typed is very often what you were looking for.

**Do.** Type `cr-bp:`.

**Expected.** **Thirteen rows** — the relay itself, its six pins, and the six wires whose
description names one of those pins (`W025`, `W030`, `W048`, `W055`, `W060`, `W061`). Lower case
finds the upper-case ids.

**Do.** Type `zzz`.

**Expected.** **`Nothing here matches “zzz”.`** An empty list with no explanation is the one thing a
search box must not do.

**Do.** Combine: type `cr-bp` and press the `Terminals` filter.

**Expected.** The six pins only. The box and the buttons narrow the same list, in either order.

---

## T-630 · Collapsing the list, and it remembering

**Do.** Press the **‹** chevron in the list header.

**Expected.** The list closes to a **thin rail** with a **›** button and the number **275** under it,
and the sheet takes the space. A panel that vanished entirely would leave you hunting for the way
back; the number is the reason to want one.

If you were at **Fit**, the sheet **re-fits** to the new width and gets bigger. If you had zoomed or
panned, it keeps the scale you chose and simply shows more of the paper — the viewer only re-fits
while the reader has not taken control, which is the rule everywhere in this application, and it is
why collapsing the list mid-inspection does not move what you were looking at.

**Do.** Press `F2` twice — to Ask and back.

**Expected.** Still collapsed. Nothing about the sheet's pan or zoom has changed either.

**Do.** Reload the page (`F5`).

**Expected.** **Still collapsed.** This one is persisted, deliberately: it is a decision about how
much of a 1224 pt sheet you want to see, and re-closing a panel every morning is a screen that is
not listening.

**Do.** Reopen it, set a filter and type something, then reload.

**Expected.** The list is **open**, and the filter and the text are **gone** — that is the deliberate
other half. A list that came back tomorrow showing only wires would read as a broken index rather
than as yesterday's filter.

---

## T-635 · Whatever selects, the list follows

**Do.** With the list scrolled to the top, click a dot on the sheet — `CR-BP`, say.

**Expected.** The card appears **and the list scrolls to `CR-BP`'s row and shades it.** The sheet
does not move (you put a finger on it; nothing flies).

**Do.** `F2` to Ask, ask anything whose answer cites an identifier, and click a citation.

**Expected.** You land on the Drawing tab, the sheet flies, **and the list is sitting on that row.**

**Do.** Select net `120` from the list, then click a roster row — `CR2:14`.

**Expected.** The list moves to `CR2:14`. The card offers **← back to `120`** (T-525), and pressing
it puts the list back on `120`.

**Why.** One selection, one place it is shown. The row is shaded rather than merely scrolled to, so
after a flight you can see *where in the index* you have landed — which is how you notice that the
pin you were sent to has five siblings.

---

## T-640 · Rows are not editing, and there is nothing to place here

**Do.** Look at a row for something with no point at all — `UPSTREAM-MACHINE`,
`DOWNSTREAM-MACHINE`, `MXCS-M9`, `MXCS-M11`, `MXCS-P9`, `MXCS-P11`. Click it.

**Expected.** It reads **`nowhere`**, and clicking it **selects it**: you get its card, and **no dot
and no flight**, because there is nowhere on this sheet to go. Nothing is refused, nothing is
written, and the row is not disabled — being able to read what a thing is does not require it to
have a position. (A roster row on a card *is* disabled in that case, because that row's only offer
was a flight. Two lists, two honest answers.)

**Do.** Look for any control on a row: a compass, a site button, *place*, a text field.

**Expected.** **There are none.** This list points at things; it does not change them. Every one of
those controls is on the Locate tab, behind a password, and this is the same list component with the
editing left out.

**Why it matters that these six rows are here at all.** They are the `K7` six — the two off-page
machines and four referenced drawings that make the editor's *To do* count unable to reach zero. In
a **reader's** list they are not a chore, they are information: *this identifier is real and it is
not on this sheet.*

---

## T-650 · **The acceptance criterion: all of it with the editor switched off**

**Do.** Stop the server. Start it with editing off:

    cd /home/js/schematics/server && SWUI_ALLOW_EDITS=false .venv/bin/python -m app

Reload the page.

**Expected.**

1. **No Locate tab** — the routes are not registered, so it is not offered. That is the flag doing
   its job;
2. **the list is exactly as it was**: 275 rows, the same order, the same state words, the same four
   filters, the same search box, the same collapse;
3. clicking a row still selects, still flies, still rings a net's seven pins;
4. **no *place it* button** on any roster row (T-520), because there is no editor to send anybody to;
5. no red strip, no banner, nothing about a draft.

**Do.** Restart normally afterwards:

    cd /home/js/schematics/server && .venv/bin/python -m app

**Why this is the criterion and not a nicety.** The reader's side of this application is the part
that will be shared — a technician with the drawing, not a password. The row state on this list is
computed from what `/api/designators` publishes (`readerRowState`) and **never** from the editor's
draft, which is why it can be. If any of the five expectations above fails, this session did not
land, however green the tests are.

---

## What it cost

**Nothing in the payload and nothing in the file.** No server change: `/api/designators` is
unchanged, `locations.json` is untouched, `circuit_logic.json` is not stale, and the whole session is
one moved component, one new one, and five switches where there were three. The list of 275 rows is
built in the browser from the index that was already on the page.

*(One number for the record, since the last two sessions each reported this payload's size:
`curl -s localhost:9700/api/designators | wc -c` says **103,902 bytes** today. Session 2 recorded
111.6 KB, which was measured some other way — the two are not comparable and neither is wrong about
this session, because **Session 3 did not touch the endpoint at all.** If a later session needs a
trend, take the `wc -c` figure as the baseline and say so.)*

`git diff` after walking every test above should show **no change to any file under
`schematic_extraction/`.** If it does, something in this session wrote where it should only read,
and that is worth reporting loudly.
