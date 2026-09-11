# T-12xx — adding a wire, and taking one away

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-10** with Phase E of `_claude_notes/authoring_the_wires.md` (Session 4).

**Written to be worked without reading a word of explanation.** Every test is **Do** and
**Expected** first and short. Under some of them is a ***Why*** paragraph in italics — those are
**skippable**.

---

## Before you start

**Commit what you have first.** This document writes a wire into your real `wiring.json` and then
takes it out again, and **T-1250 puts the file back with `git checkout`** — which would also throw
away anything else you have not committed.

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

**There is a server change this session, so restart it.** The client is a rebuilt bundle too.
Editor password `edit-1234`; all of this needs it.

Four checks, before you touch anything: **261 server · 458 web · ruff clean · tsc clean**.

### What is new, in four lines

- **`Add a wire`** sits above the queue on the `Wiring` filter. It gives you `W072`.
- **`Retire this wire`** sits at the bottom of an armed wire's panel. It wants a reason in words.
- **Neither reaches `circuit_logic.json` until you run the generator**, and the screen says so.
- **An id is never reused**, so a wire you add and then withdraw does not hand its number back.

**None of this is repair.** The census found **0** genuinely missing field wires on this sheet, so
you should not need either control during your authoring run. It is here for drawing number two,
and for the day the sheet shows something the index has not got.

---

## T-1200 · Add a wire

**Do.** Locate tab → unlock → `Wiring`. Look above the list.

**Expected.** A row that was not there before:

    [ + Add a wire ]   only if the sheet shows one the index has not got — the census found none

**Do.** Press it.

**Expected.**

- a new row, **`W072`**, armed, with the panel open;
- both end slots read **`nobody has set this end`**;
- the badge beside *What it joins* reads **`you added it`**;
- the count in the toolbar goes from `n of 71 wires confirmed` to **`n of 72`**;
- the `wiring` save badge goes `unsaved` → `saved`.

> ***Why it is above the list and not in the panel (skippable).*** Adding a wire is not something
> you do *to* the wire you are looking at. Put in the panel it would mean arming some unrelated
> row first, just to reach it. It sits over the queue it adds to.

> ***Why `W072` and not the first gap (skippable).*** The id counts past everything the netlist or
> the file has ever held, **including retired wires**. 58 of your routes are keyed on a `W###`, so
> a recycled id would quietly reattach one of them to a different wire and nothing on the screen
> would look any different.

---

## T-1205 · It is not in the netlist yet, and it says so

**Do.** With `W072` armed, read the line under the badges.

**Expected.**

    Not in the netlist yet. It appears there — and on the Drawing tab, and in anything the
    model reads — after author_circuit_logic.py.

**Do.** Go to the **Drawing** tab and look for `W072` in the list.

**Expected.** **It is not there.**

**Do.** Come back to the Locate tab and press the **`Paths`** filter.

**Expected.** `W072` is **not** in that queue either.

> ***Why (skippable).*** Every other row on this screen comes from `circuit_logic.json`. This one
> comes from the wiring draft, because the netlist has not been written since you added it. A
> route is ranked against the ink reaching a wire's two published pins, so the `Paths` queue
> cannot have it until it is published — it joins that queue when you run the generator.

---

## T-1210 · Give it its two ends

**Do.** `Wiring` → `W072` → press **`Pick from the sheet`** on the `from` slot, then click a
terminal dot — `PB2:3` will do.

**Expected.** The slot fills. **No `corrected` badge**, and no `was` anywhere.

**Do.** Do the same for the `to` slot with `TB-0V:9`.

**Expected.** The wire leaves the queue — the count stops going up and `W072` disappears from the
`Wiring` list. There is **no `I looked and it was right`** to press: you picked both ends yourself.

**Do.** Look at the file:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 -c "import json;print(json.dumps(json.load(open('wiring.json'))['wires']['W072'],indent=2))"

**Expected.**

```json
{
  "from": "PB2:3",
  "to": "TB-0V:9",
  "source": "human",
  "added": true,
  "by": "js",
  "at": "2026-09-10T..."
}
```

> ***Why there is no `was` (skippable).*** `was` means *the pair this record replaced*, and this
> record replaced nothing. Without the guard your first click would have written
> `was: [null, null]` and the panel would have shown `corrected` over an answer nobody ever gave.

> ***Why there is no `Take it back` on this one (skippable).*** *Take it back* writes
> `source: index`, which means *the indexing pass's own answer* — and the indexing pass never saw
> this wire. Saying otherwise would put a guess in the file that nothing ever guessed. The way out
> of a wire you added is to retire it, which says what actually happened.

---

## T-1215 · Run the generator, and the wire arrives

**Do.**

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 author_circuit_logic.py

**Expected**, in the last few lines:

    wires         72
    from wiring.json: 71 of 71 wires have a record, ... , 1 added by hand
      W072 is a wire you added; it has no printed colour or gauge

**Do.** Look at what it wrote:

    python3 -c "import json;d=json.load(open('circuit_logic.json'));print([w for w in d['wires'] if w['id']=='W072'])"

**Expected.** A wire with `from_terminal`, `to_terminal`, a `net` derived from its two ends, and
**`color`, `gauge`, `cable` and `description` all `null`** — plus an `endpoints` block saying
`"added": true`.

**Do.** Reload the browser and click `W072` on the **Drawing** tab.

**Expected.** It is in the list now, and the *not in the netlist yet* line is gone from the Locate
tab's panel.

> ***Why it has no colour (skippable).*** Colour, gauge and cable are **readings of a printed
> callout**, and there is no callout for a wire the indexing pass never saw. Inventing one would
> be the same mistake as the allocated screw numbers this whole plan exists to undo: a blank
> presented as a reading. If you ever want to give one a spec, add its row to the `W` table at the
> id it already has **and take `"added"` off its record in the same edit** — the script's header
> says so, and doing only half of it is refused by name.

---

## T-1220 · Retire a wire, and the reason is not optional

**Do.** `Wiring` (or `All`) → arm any wire — `W019` is a good one to practise on because you can
see it. Scroll to the bottom of the panel.

**Expected.** **`Retire this wire`**, quiet and grey.

**Do.** Press it.

**Expected.** A box opens:

    Why does W019 not exist? It is kept forever, in place of the two ends. The id is never
    given to anything else.
    [                                                    ]  read twice; W014 is this run
    [ Retire it ]  [ Cancel ]

and **`Retire it` is disabled** until you type something.

**Do.** Type `read twice; W014 is this run` and press `Retire it`.

**Expected.** The panel changes to:

    What it joins   [ retired ]
    read twice; W014 is this run
    Its two ends went with the tombstone …
    [ Take it back ]

The wire leaves the `Wiring` queue and the count goes **up**, because it is dealt with.

**Do.** Look at the file.

**Expected.** `"W019": { "retired": "read twice; W014 is this run", "by": "js", "at": "..." }` —
**and no `from` or `to`.**

> ***Why a reason is required (skippable).*** A wire is rarely retired for being absent. It is
> retired for being a duplicate, or for being one run somebody read as two. Six months later
> *"read twice; `W014` is this run"* is the whole of what a reader needs, and there is nowhere
> else for it to live.

> ***Why the endpoints go (skippable).*** Saying where a wire goes while saying it does not exist
> is two claims at once. Both validators refuse a record that makes them.

---

## T-1225 · A retired wire leaves the netlist and keeps its id

**Do.** Run the generator again and read the output.

**Expected.**

    wires         71
    ... 1 retired ...
      W019 retired: read twice; W014 is this run

**Do.** Check that nothing moved into the gap:

    python3 -c "import json;d=json.load(open('circuit_logic.json'));print(sorted(w['id'] for w in d['wires'])[-3:])"

**Expected.** The last ids are unchanged apart from `W019` being gone. **Nothing was renumbered.**

**Do.** Back in the editor, press `Add a wire` again.

**Expected.** It offers **`W073`**, not `W072` and not `W019`.

---

## T-1230 · Take a retirement back

**Do.** `All` → `W019` → **`Take it back`**.

**Expected.** The wire comes back **unconfirmed** — `from the index`, both ends filled from the
netlist, and back in the `Wiring` queue.

**Do.** Do the same on a wire you retired *and* had already regenerated for.

**Expected.** It comes back with **two empty slots**, and the panel warned you it would:

    The netlist has already dropped it, so taking it back gives you two empty slots.

> ***Why it comes back unconfirmed (skippable).*** A tombstone holds a reason and no endpoints, so
> there is nothing in the file to put back — and a wire whose retirement you have just reversed is
> exactly a wire to look at again.

---

## T-1235 · Retiring does not delete your route

**Do.** Press the `Wires` filter and find a row that reads **`traced`**. Arm it, press
`Retire this wire`.

**Expected.** Above the reason box:

    This wire has a route you authored. Retiring it leaves the route in locations.json —
    nothing here deletes your work.

**Do.** Retire it, run the generator, and reload.

**Expected.** A red strip at the top of the Locate tab:

    locations.json has a route for 'W0xx', which is not a wire in this netlist — a retired wire
    keeps its id but loses its entry, and its route is still here

**That strip is correct and it is yours to act on.** Either take the retirement back, or delete
the route on the `Paths` filter.

> ***Why nothing is deleted for you (skippable).*** A route lives in `locations.json`, a different
> document in a different store. Reaching across to delete one would be the coupling `H18` exists
> to forbid — and it would destroy authored work on the strength of a decision you might reverse
> in the next press.

---

## T-1240 · The two refusals, if you ever hand-edit the file

You should not need these, but they are the reason the door is only as wide as it is.

**Do.** Add a record by hand at an id the `W` table does not have, **without** `"added": true`:

    "W099": { "from": "PS1:-1", "to": "TB-0V:1", "source": "human" }

then run the generator.

**Expected.** It refuses and writes nothing:

    REFUSED: wiring.json has a record for 'W099', which is not a wire in the W table and does
    not say it is one somebody added. … a typo here would invent a connection.

**Do.** Now write `"added": false` on any record.

**Expected.** Refused too: *it is written only on a wire a person put there, and only as true.*

**Do.** Put the file back before going on.

> ***Why (skippable).*** Absent is how this file says *no*, the same way `was` is absent where
> nothing was replaced. A key that can be present and mean nothing would have to be checked twice
> at the exact place where the answer decides whether an unknown id is a wire or a typo.

---

## T-1250 · Put your file back

**Do.**

    cd /home/js/schematics
    git checkout -- schematic_extraction/PS20115MLM4-2/extracted_docs/wiring.json
    cd schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 author_circuit_logic.py
    python3 ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate
    cd /home/js/schematics && git status --short

**Expected.** **Empty.** Nothing you did in this document survives.

**If it is not empty**, that is the finding — tell me which file, and `git diff` it.

---

## T-1255 · What is deliberately not here

| Not built | Why |
|---|---|
| **A spec on an added wire** | Colour, gauge and cable are readings of a printed callout, and there is no callout. The `W` table is still their home — T-1215's *Why* says how to give one a row |
| **Deleting a wire outright** | An id is never reused. 58 routes key on a `W###`, and a hole somebody later filled would reattach one of them in silence |
| **Retiring several at once** | Each tombstone carries its own reason, and a reason typed once for five wires would be true of none of them |
| **Adding a wire from the Drawing tab** | That tab is the reader's. It has no password and writes nothing, and Phase D's whole argument was keeping the two apart |
| **Anything that renumbers** | Decision 3, and §3.4 proved it cannot even be the fix |

---

## If something looks wrong

| What you see | Look at |
|---|---|
| No `Add a wire` row | It only appears on the **`Wiring`** filter, and only once the wiring file has loaded. If the panel says the wiring file did not load, that is the reason |
| The new row reads `nowhere` | Correct until it has an end with a placed dot. A wire's position is its terminals' and nothing else |
| The count says `of 72` but the Drawing tab still says 71 | Correct. Run the generator — T-1215 |
| `Add a wire` offered an id that already exists | A real fault, and the serious kind. `wiringModel.nextWireId`, and see `06_code_map.md` §H25 |
| The generator refuses with *One id, two different wires* | You added a row to the `W` table at an id something already claimed as added. Take `"added"` off that record, or move the wire — the message says both |
| A retired wire still in the netlist | You have not re-run the generator since retiring it |
| `Retire it` will not press | There is no reason typed. That is the rule, not a bug |
| A retired wire is still in the `Wiring` queue | A real fault — a tombstone is *decided about*. `wiringDecided` |

---

## What this session cost, and what is left of §14

**One word in the file format, and two controls.** `server/app/wiring.py` and the generator both
learned `added`; `wiringModel.ts` gained `nextWireId`, `addWire`, `retireWire`, `unretire` and
`draftWireEntries`; `WiringPanel.tsx` gained `RetireBox`; `LocateTab.tsx` gained the button and
the union list that lets a wire exist on screen before it exists in the netlist. **16 new server
tests and 25 new web tests.**

**§14's estimate is unchanged, and this phase adds nothing to it.** The census measured **0**
missing field wires, so the expected number of times you press either control during your
authoring run is **zero**. That is the honest answer and it is why this phase was last.
