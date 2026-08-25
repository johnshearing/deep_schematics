# T-5xx — what a net is made of, and where its highlight goes

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-08-24** with Phase A of `_claude_notes/highlighting_wires_and_nets.md`.

**These are Drawing-tab tests, and they need no editor password.** Everything here is on the
reader's side of the application — which is the point: the fault they fix was reported by someone
reading an answer, not by someone placing points.

---

## The fault, in the words it was reported in

> *"Clicking `120` marks Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2."*

It was real, and it was **two faults wearing one coat**. `CR2` was in the highlight set all along
and a dot **was** drawn for it — on CR2's **coil**, in the right-hand column of the sheet. The
terminal actually on net 120 is `CR2:14`, its NO contact, and on this drawing that is
**(236.1, 563.4)** while the coil is **(861.0, 381.3)** — most of a sheet apart. So the mark was
in a place the net does not touch, which reads exactly like a missing mark.

Why: a net's highlight was `entry.members`, and `members` is the **parent components** of its
terminals. Net 120's real membership is seven *terminals*:

    BYPASS-CB:1   (381.4, 663.7)
    CR2:14        (236.1, 563.4)   ← CR2's NO contact, not its coil
    DISCHARGE1:3  (602.7, 563.6)
    INFEED1:3     (563.6, 563.5)
    TB-120:1      (300.1, 563.3)
    TB-120:2      (300.1, 639.6)
    TB-120:3      (300.1, 663.7)

Five components, seven terminals — and the three `TB-120` pins collapse onto one component, so
**seven members were being shown as at most five dots**. The same disagreement, quieter, put
`DISCHARGE1`'s ring on the component rather than on `DISCHARGE1:3`.

The fix is not about paths. It is that a net is highlighted as **the terminals it is made of**,
each carrying its own point and its own provenance.

---

## T-500 · Seven terminals, not five components

**Do — and note this costs one question.** On the **Ask** tab, ask something whose answer will name
the net in backticks; *"Which terminals are on net 120?"* on the cheap model is enough. Then click
the `120` in the answer.

**Why a question.** Today a citation is the only way to select a net from the reader's side: dots on
the sheet are components, terminals and label points, and nothing else raises a net. **Session 3
removes this** — the Drawing tab gets a list of all 275 designators you can just click — so if you
would rather walk T-500 then instead of spending a question now, that is a reasonable choice and
nothing later depends on having done it early. `110` is the other worked net in
`07_drawing_facts.md` if you would rather use it.

**Expected.** The sheet flies to frame the net, and:

1. **seven dots are ringed**, one per member terminal, each labelled with its **own** id —
   `CR2:14`, `TB-120:1`, `TB-120:2`, `TB-120:3` and the rest;
2. `CR2:14`'s ring is on the **NO contact on the far left**, not on CR2's coil;
3. `TB-120:1`, `:2` and `:3` are **three separate dots**, about 24 pt and 76 pt apart in y —
   zoom in if they look like one;
4. **the components CR2, TB-120 and the others are *not* marked.** Their dots are on the sheet
   because the `Components` group is switched on, not because the net highlighted them — switch that
   group off and they go, while the seven pins stay (T-530).

**Amended 2026-08-24, the same day.** The first version of this test expected the parent components
to be ringed as well, on the reasoning that a relay drawn in two places is genuinely part of the net
in both. The user's answer, after walking it: *"the components are also marked and this adds clutter
and confusion to the drawing. Please show only terminals when displaying a net."* They are right, and
the reasoning that put them there confused **saying** something with **marking** it — the card still
names all five under `runs through` (T-510). See T-530.

**Do.** Hover each ringed terminal.

**Expected.** The tooltip names the terminal and says how well its point is known — on this sheet
every one of the 131 terminals has been placed, so all seven should say **"placed by hand"** and all
seven should be **filled**. A hollow one would mean it is showing its *component's* point, and it
would say so in words.

**Why this is the test worth walking first.** Every terminal on this drawing is placed, so the fault
now shows up as a **ring in the wrong place** rather than as a missing dot. That is harder to notice
and easier to believe, which is why it is asserted in code as well
(`server/tests/test_api.py::test_a_net_names_every_member_terminal_in_order_with_its_own_placement`).

---

## T-505 · The frame still contains everything it rings

**Do.** With net `120` selected, look at the whole sheet without panning.

**Expected.** **Every ringed dot is on screen.** The rectangle the viewer flies to is the bounding
box of the member terminals' points — for net 120 that is `[236.1, 563.3, 602.7, 663.7]` — so a
ringed dot cannot be off screen after the flight.

**Why it is a test rather than an assumption.** The frame and the membership are computed from the
same list *today*. They are two separate fields in the payload, and a later change to either could
quietly put a marked dot outside the view with nothing on screen to say so. There is a code test
that walks every net and wire and checks it
(`test_every_member_a_net_rings_is_inside_the_rectangle_it_frames`).

---

## T-510 · The card is a roster

**Do.** Look at the card in the bottom-left corner with net `120` selected.

**Expected.** Under the heading, **`7 terminals`**, and then one row per member — in the netlist's
own order, undeduped, so all three `TB-120` pins are listed. Each row carries:

- the terminal id, in monospace;
- **how well its own point is known**, in the same three words the Locate tab's list uses:
  `placed`, `estimate`, `on its component` — or `nowhere` if there is no point at all. The words are
  spelled in one place in the code so the two screens cannot drift into different English.

Below the roster, the old chips remain, headed **`runs through`** — the components, demoted to what
they are.

**Do.** Select a **wire** instead (any `W###`).

**Expected.** The heading reads **`ends`** rather than a count, and there are exactly two rows:
`from` then `to`, **in that order**. That order is content, not presentation — Session 2's two-ended
compass heads its controls with these ids, and swapping them would mislabel both ends of every wire
on the sheet with nothing visible to show it.

**Do.** Select a net with many members — `130` has the most on this sheet.

**Expected.** The roster **scrolls** inside the card. It does not truncate: a roster that quietly
stopped at six rows would under-report the net, which is the thing it replaced.

---

## T-515 · A roster row flies to its pin

**Do.** Click a terminal id in the roster — say `CR2:14`.

**Expected.** The sheet flies to that pin and the card becomes **that terminal's** card. It is the
same selection a citation in an answer raises, through the same one function, so the two entry
points cannot drift apart.

**Do.** Find a row that reads `nowhere` and try to click it.

**Expected.** It is **not clickable**, and its tooltip says so. There is nowhere to fly to. It is
still listed, because dropping it would under-report the net.

**Do.** Press `Esc`.

**Expected.** No card, no rings, and the sheet stays where it is.

---

## T-525 · Back to the roster, without paying for another question

*Added 2026-08-24, asked for after walking T-515.*

**Do.** With net `120` selected, click a roster row — `CR2:14` — and land on that pin.

**Expected.** At the **top of the pin's card**, above its id, a small **← back to `120`**.

**Do.** Press it.

**Expected.** You are back on net `120`: the roster is on screen with all seven members, and the
sheet has **framed the net again** rather than staying zoomed into the one pin you flew to. That is
deliberate — you left the roster by flying somewhere, so the way back is the view you left, with the
next row you want one click away.

**Do.** Look at net `120`'s own card.

**Expected.** **No back link.** Nothing sent you there — a citation and a click on a dot are both
arrivals from nowhere — and a button that goes nowhere is worse than no button.

**Do.** From the net's card, click a component chip under `runs through` instead.

**Expected.** The same thing: that component's card offers **← back to `120`**.

**Why this exists.** Walking a net means visiting its members one at a time, and until this landed
the only ways back to the net were a citation in an answer — which costs a question — or hunting it
down. It is **one** step and deliberately not a history: a back button that sometimes goes two places
is worse than one that always goes one.

---

## T-530 · A net marks terminals, and nothing else

*Added 2026-08-24. This is the amendment to T-500 point 4, as its own test.*

**Do.** With net `120` selected, count what is marked on the sheet, then press **Components** in the
toolbar to switch that group off.

**Expected.** The five component dots **disappear**. The seven ringed pins stay exactly as they were,
and so does the card.

**Why that is the interesting assertion.** Before this change the components were in the highlight
set, and the one visible consequence of that was this: a switched-off group still draws anything the
selection marks (H11), so the component dots *stayed* — and there was no way to get them off the
screen while reading a net. Now they are ordinary dots on an ordinary layer.

**Do.** Switch `Components` back on and look at the labels.

**Expected.** The five components are drawn plainly — small dots, no ring, and **no id written
beside them** below 30% zoom. A marked dot forces its label on at any zoom, so ringing five
components also wrote five names on the sheet on top of the seven that belong to the net.

**Do.** Select a **terminal** instead — `CR2:14` on its own.

**Expected.** Its parent component `CR2` **is** ringed, quietly. That is one dot saying *this is the
relay whose pin you are looking at*, which is context rather than clutter, and it is the case
`members` is still used for.

---

## T-520 · *place it* — from noticing to fixing, without hunting

**Do.** Select a net and look for a member row that does **not** read `placed`.

On `PS20115MLM4-2` today there is not one: all 131 terminals are placed, so every roster row on
every net reads `placed`. **To see this control, make one.** Arm a terminal on the Locate tab and
press **Unplace**, then `F2` to the drawing and select a net it belongs to. `CR2:14` on net `120` is
a good one to borrow — and put it back with `Ctrl+Z` afterwards (T-470), which is the neatest
possible demonstration of why undo went in first.

**Expected.** That row now reads **`on its component`** and carries a small **place it** button.
Rows that read `placed` do **not** — there is nothing to go and do about them.

**Do.** Press **place it**.

**Expected.** You land on the **Locate** tab with **that pin already armed** — the target panel
names it, the list has scrolled to its row, and the next click on the sheet places it. Nothing was
written by pressing the button.

**Do.** Now check what the round trip cost the file:

    git diff schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

**Expected.** **Nothing.** The unplace was saved and the undo was saved, and the undo restored the
whole previous document — the same coordinate, the same `by`, the same original `at`. So the file
comes back byte-identical and `circuit_logic.json` does not need regenerating. If `git diff` shows
anything at all, that is worth a full report: it would mean undo is restoring a *reconstruction* of
the old point rather than the old point.

**Do.** Restart the server with the editor switched off and repeat:

    cd server && SWUI_ALLOW_EDITS=false .venv/bin/python -m app

**Expected.** The roster is **exactly the same** — every row, every state word, every flight —
and there is **no place it button anywhere**, because there is no editor to send anybody to. The
reader's side of this application must not depend on the editor existing. Restart normally
afterwards.

**Why this button exists.** The roster is where you *notice* that a pin has no point of its own —
that is the whole value of publishing each member's own provenance rather than one word for the
whole net. Making you then find that row again in a 275-entry list on another tab is precisely the
searching this project exists to remove.

---

## What this cost, said out loud

Publishing the membership grew `/api/designators` from **90.0 KB to 110.1 KB** — 269 small objects,
about 20 KB, or 22%. It is fetched once per page load and again after each save, against 2.2 MB of
tiles on the same page. Recorded here because "it is only a few fields" is how a payload doubles
over six sessions, and because the next person to add one should know what the last one cost.

**Session 2 added 1.5 KB to that** — `111.6 KB` — which is the 69 wires that have a colour and a
gauge each carrying it as a `spec` string. The end labels themselves cost **nothing** in the payload:
they are computed in the browser from points that were already there.
