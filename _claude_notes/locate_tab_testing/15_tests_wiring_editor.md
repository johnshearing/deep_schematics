# T-10xx — the wiring editor

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-08** with Phases A and B of `_claude_notes/authoring_the_wires.md` (Session 2).

**This is the layer below the path editor.** `14_tests_path_editor.md` was about *which line on the
paper is this wire*. This one is about *which terminal does it actually reach* — and 11 of the 71
are on the wrong one.

---

## What to hold in your head before you start

**Three sentences, and everything below follows from them.**

> The far end of 40 wires was **allocated**, not read: one screw number after another as the `W`
> table was typed. The ink **proposes** and you **decide**. And *I looked and it was right* is a
> decision — which is why the queue reads `0 of 71` on its first run and not `47 of 71`.

### Why 47 correct wires still need a click each

Because until this screen existed the file could not tell them apart from the wires nobody had
opened. `wiring.json` holds 71 records and every one of them says `source: index` — *this is what
the machine guessed*. A screen that only recorded *corrections* would have left 47 right answers
and 71 unexamined ones as the same bytes, and telling **nobody has looked at this** from
**somebody decided this** is the only thing an authored file is for.

It is one glance and one click each. The panel says *agrees with the index* where the ink and the
file already say the same thing, and that is the case for most of what you will see.

### What the census says you are walking into

Measured 2026-09-06, per-wire tables in the plan's §3 so nobody re-derives them:

| | |
|---|---|
| Wires | **71** |
| Right already — a glance and a click | **47** |
| **Wrong, and the ink names the pin** | **11** |
| Only your eyes can settle it | **13** |
| Genuinely missing field wires | **0** |

**Every one of the eleven was already on your own list of thirteen.** Your eye and the ink have not
disagreed once.

### And what this screen measured that the census did not

The shipped proposal settles **48**, not 47. It also chains `W002` and `W003` — `PLG1`'s runs, which
parallel `PLG2`'s onto the same terminal — and `W031`, whose block end the commoning rule reads past
the bus §3.3 said it could not get through. Against that, it **cannot** settle `W047` or `W048`,
which the census counted as confirmed: both land on a relay's coil `A2`, and on this sheet the ink
stops **46 pt short** of those dots. §3.1 names that shortfall for `W048` and did not draw the
conclusion for `W047`. It is the same shape as `W024`/`W025`/`W026` — *"three coil feeds, one bound
landing"* — and it is the ink, not the arithmetic. **Six wires reach a relay coil and none of them
can be settled from the ink.** Expect to use your eyes on those.

---

## Before you start

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

**Editor password `edit-1234`. There is a server change in this session, so you need a restart** —
`server/app/wiring.py` is new and `python -m app` has no reloader. The client is a rebuilt bundle
too. **A rebuilt bundle against an unrestarted server is the dangerous combination**: the new
client would `PUT /api/wiring` at a server that has no such route, and the panel would say the
wiring file did not load.

Four checks, and they should read **228 server · 392 web · ruff clean · tsc clean** before you
touch anything.

---

## T-1000 · The `Wiring` filter, the queue, and the honest zero

**Do.** Open the Locate tab, unlock with `edit-1234`, and press the new **`Wiring`** filter — the
sixth one, between `To do` and `Paths`.

**Expected.** **71 rows**, every wire on the sheet, because nobody has confirmed any of them. In
the toolbar, beside the placement and path counts:

    0 of 71 wires confirmed

**Read that number properly, because it is the whole design.** It is not saying the wires are
wrong; 47 of them are right. It is saying **nobody has looked**. That is decision 4 of the plan,
chosen deliberately over a cheaper option that would have started at 47 by trusting the ink — and
the reason it was rejected is `W042`, four tests down.

**Do.** Compare it with `To do`.

**Expected.** `To do` has six rows in it that can never be finished — the two off-page machines and
four referenced drawings, which have no position on this sheet at all. That is **`K7`**, still
open. **`Wiring` and `Paths` are both queues built the other way round**, and holding the three
side by side is the clearest statement of what the difference costs.

---

## T-1005 · The panel, and what an end slot says

**Do.** Arm **`W067`** (`DISCHARGE1:2 → TB-0V:12`).

**Expected.** Above *Where it runs*, a new section headed **What it joins**, with a badge reading
**`from the index`** and two rows:

    FROM   DISCHARGE1:2      0V        [ Pick from the sheet ]
           from the index
           TB-0V:12  C0105  WHITE/BLUE 18AWG          0.1 pt
           agrees with the index · one run · past the commoning · 0V

    TO     TB-0V:12          0V        [ Pick from the sheet ]
           from the index
           DISCHARGE1:2  C0105  WHITE/BLUE 18AWG      0.1 pt
           agrees with the index · one run · past the commoning · 0V

Then the two ends' nets side by side, and the button.

**Three things about that block:**

1. **`from the index` is provenance, not a rating.** It means the indexing pass said so and nobody
   has checked. It becomes **`you, on 2026-09-08`** the moment you confirm. Those words live in
   `webui/src/lib/designators.ts` beside `PLACEMENT_LABEL` — the same table the placement list's
   `placed` / `estimate` / `on its component` come from — so the editor and the reader cannot drift
   into different English about the same distinction.
2. **The proposal for one end comes from walking the ink that starts at the other.** That is why
   `FROM`'s row names `TB-0V:12` and `TO`'s names `DISCHARGE1:2`: each is *where the conductor goes
   if you leave from the other pin.* Nothing in this screen knows which of a wire's two ends is the
   terminal block, and it must not have to — the next drawing will not be laid out like this one.
3. **`past the commoning` is the tag that makes this correct**, and T-1060 is about nothing else.

---

## T-1010 · **Confirming a wire that was already right** — the acceptance criterion

**Do.** With `W067` armed, press **`I looked and it was right`**.

**Expected, on screen.** The badge changes from `from the index` to **`you, on 2026-09-08`**, both
slot lines change with it, the toolbar goes to `1 of 71 wires confirmed`, and **the row leaves the
`Wiring` filter immediately** — before the save badge has gone green, because the queue reads the
draft and not the server.

A second badge appears in the toolbar reading **`wiring`** and `unsaved`, then `saved`. Two files
are written from this screen and *which one is unsaved* is a question worth being able to answer,
so the wiring draft has its own named badge rather than a second identical one.

**Do.** Wait for it, then look at the file:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 -c "import json;print(json.load(open('wiring.json'))['wires']['W067'])"

**Expected.**

```json
{"from": "DISCHARGE1:2", "to": "TB-0V:12", "source": "human",
 "by": "js", "at": "2026-09-08T..."}
```

**Three things about that, and each is worth a moment:**

1. **The endpoints did not change and the record still exists.** That is the whole phase. `W067` was
   right before you pressed anything; what is new in the file is that a person says so.
2. **There is no `was`.** `was` means *the pair this record replaced*, and nothing was replaced —
   writing one here would have the file claiming you moved something you did not move.
3. **A `stale` banner appears across the top**, and it is a **different banner from the placement
   one**. A saved point leaves the drawing current and only the artifact behind; a saved endpoint
   changes *what connects to what*. So this one names two commands:

       cd schematic_extraction/PS20115MLM4-2/extracted_docs
       python author_circuit_logic.py
       python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

   **Unlike a placement run, this work really needs the second one.** `build_kg.py` emits no
   coordinates at all — that was measured on 2026-09-03 and its output came back byte-identical
   after a placement run — so it only moves when *connectivity* does. This is the work that moves
   connectivity.

---

## T-1015 · Taking it back, without a text editor

**Do.** Press `Wiring`, then `All`, arm `W067` again, and press **`Take it back`**.

**Expected.** The badge goes back to `from the index`, the count drops to `0 of 71`, and the row
returns to the `Wiring` queue. In the file:

```json
{"from": "DISCHARGE1:2", "to": "TB-0V:12", "source": "index"}
```

**The record is still there, and that is deliberate.** It is back to `index` rather than deleted,
because `bootstrap_wiring.py` wrote a record for all 71 and a vanished one would read in `git diff`
as somebody having removed a wire — a much louder claim than *nobody has checked this yet*. This is
the ↺ the Review tab has, in a fourth file.

---

## T-1020 · The ink's proposal, and its five tag words

**Do.** Arm **`W063`** (`INFEED1:3 → TB-120:2`) and read the `TO` slot.

**Expected.** One proposal, **`TB-120:1`**, along `C0091`, RED 16AWG, and underneath the slot a
line in amber:

    the ink does not offer TB-120:2 at all

**That line is the finding.** It is not that `TB-120:1` ranked higher than `:2` — it is that no run
of ink comes anywhere near `:2` from this wire's other end. Measured across all eleven corrections:
**on every one of them the terminal the netlist claims is absent from the proposals for that end.**
That is what makes each of the eleven *provable* rather than *likely*.

**Read the tags, because the ranking is only trustworthy if it says why:**

| Tag | What it claims |
|---|---|
| `one run` | One conductor, end to end, with no join in it |
| `chained` | Two or more, joined across a corner or a **crossover hop** |
| `past the commoning` | The landing was read where the run **leaves** a block's own bus, not where its polyline ends — T-1060 |
| `printed name` | The net name printed beside the ink is the one this terminal is on |
| `corrected name` | …and it is a name **you** read off the paper on the Review tab |
| `agrees with the index` | This is what the file already says. Confirming it is still a decision |

**Do.** Move the pointer over the proposal without clicking.

**Expected.** The conductor lights up on the sheet in **blue** — narrower and more transparent than
an accepted path's orange stripe. A proposal and a decision must never look alike on a drawing where
accepting the wrong one is the failure that matters. Moving off puts the sheet back.

**Why the printed name is carried and not ranked on.** This is the one place the path editor's
reasoning does **not** carry over, and it is worth understanding before you trust the list. On the
path editor the printed name is a weaker signal than the geometry. Here it is an answer to a
*different question*: the name beside a run is its **net**, and every point of a terminal block is
on the same net — so a printed `0V` cannot tell row 3 from row 8. The screw number is printed
nowhere on the paper at all. The only thing that can say which of twelve rows a run lands on is
where the ink stops, against pins **you** placed, on rows 16 pt apart. So the list is ordered by fit
and nothing else, and the names are there for you to read.

---

## T-1025 · The eleven, in order — **and this is the two-minute check**

The plan's §3.2 names eleven wires and the pin the ink puts each on. `wiring.test.ts` asserts all
eleven against the real drawing, so this is you confirming the instrument rather than finding
anything new. Arm each and read the top of the slot the table names.

| Wire | The netlist says | Expected proposal | Conductor |
|---|---|---|---|
| `W014` | `TB-GND-B:2` → `PS1:GND` | **`TB-GND-B:1`** on the `FROM` end | `C0046` |
| `W018` | `PS1:-1` → `TB-0V:1` | **`TB-0V:3`** | `C0001+C0012+C0002` |
| `W019` | `PS1:-2` → `TB-0V:2` | **`TB-GND-B:2`** — *a different block* | `C0056` |
| `W036` | `SPD1:2` → `TB-0V:3` | **`TB-0V:2`** | `C0122` |
| `W037` | `TB-0V:4` → `RECEPT1:4` | **`TB-0V:1`** on the `FROM` end | `C0084` |
| `W039` | `PB1:3` → `TB-0V:5` | **`TB-0V:4`** | `C0031` |
| `W045` | `CR1:A2` → `TB-0V:8` | **`TB-0V:5`** | `C0023` |
| `W046` | `CR2:A2` → `TB-0V:9` | **`TB-0V:7`** | `C0011` |
| `W062` | `INFEED1:2` → `TB-0V:12` | **`TB-0V:10`** | `C0114` |
| `W063` | `INFEED1:3` → `TB-120:2` | **`TB-120:1`** | `C0091` |
| `W069` | `DISCHARGE1:4` → `TB-130:2` | **`TB-130:1`** | `C0117+C0017` |

**`W069` is the one worth a second look.** Its ink is two conductors with a **3.5 pt gap** between
them, and it is tagged `chained`. `C0017` is only 17.2 pt long — shorter than the tolerance a
landing is read within — so an earlier version of the arithmetic reported `TB-130:1` at *both* of
its ends, which made the join impossible and lost the correction entirely. The cure is one clause:
a landing has to be nearer *this* end of a run than the other.

**Do not correct any of them yet if you are only checking the instrument.** Confirming one is a
decision and it is yours; the point of this test is that the list is right before you spend an hour
on it.

---

## T-1030 · **`W042`** — where the ink is wrong and the data is right

**This is the test the whole phase is judged by.**

**Do.** Arm **`W042`** (`PB2:3 → TB-0V:6`).

**Expected.** **Nothing offered, at either end.** Both slots read:

    The ink says nothing about this end. Either no run reaches it, or the run that should stops
    short — which is the drawing's own error on at least one wire of this sheet, and the data is
    right there. Your eyes decide.

**Do.** Press `I looked and it was right` anyway.

**Expected.** It works, and it is the correct answer. `W042` gets `source: human` with the
endpoints unchanged.

**Why this matters more than the eleven.** `PB2:3 → TB-0V:6` is right in the data and wrong on the
paper: the run stops at the **west side of the block** instead of reaching the vertical commoning
line, which is a mistake on the drawing — and **you spotted it before any of this was measured**.
It is the one case in the whole census where a proposal from the ink would have made things worse.
That is why nothing on this screen is ever accepted automatically, and it is why the count starts at
zero instead of trusting the ink for the 47.

**A screen that trains you to accept the proposal is worse than no screen.** `W042` is in this
document by name so that stays true.

---

## T-1035 · `was`, and a correction taken back

**Do.** Arm `W063` and click the **`TB-120:1`** proposal in the `TO` slot.

**Expected.** The slot's terminal becomes `TB-120:1`, the provenance line reads
`you, on 2026-09-08 · was TB-120:2`, and a **`corrected`** badge joins the header. In the file:

```json
{"from": "INFEED1:3", "to": "TB-120:1", "source": "human",
 "by": "js", "at": "...", "was": ["INFEED1:3", "TB-120:2"]}
```

**Do.** Now change your mind: pick the `TO` slot's `Pick from the sheet` and click `TB-120:3`.

**Expected.** `to` becomes `TB-120:3` and **`was` still says `TB-120:2`.** It is *the pair this
record replaced* — the machine's answer — not *the pair it held a moment ago*. Your second thought
must not be able to destroy the original, because the `W` table it came from is hand-maintained and
a later edit there would take it with it. Same meaning as `was` on a label correction.

**Do.** Put it back to `TB-120:2`.

**Expected.** **`was` goes.** The confirmation stays — you did look — but the record stops claiming
a move that did not happen. That is invariant 10 for the fifth time in this project, and it is the
one assertion in this document worth reporting loudly if it is wrong.

**Do.** `Take it back`, so `W063` is `index` again and the sheet is as you found it.

---

## T-1040 · `Pick from the sheet`

For the thirteen only your eyes can settle, and for anything the ink offers wrongly.

**Do.** Arm **`W057`** (`TB-0V:11 → CR-SW:11`) — one of the three that has to be assigned to
`TB-0V:8`, `:9` or `:11` by you. Press **`Pick from the sheet`** in the `FROM` slot.

**Expected.** The button fills and reads **`click a terminal`**, the slot gets an accent border,
**and every terminal on the drawing gets a dot.** Without that last part there would be nothing to
aim at: the `Wiring` filter's rows are wires, so the sheet would hold this wire's own two ends and
nothing else.

**Do.** Zoom in on `TB-0V` and click the dot on row 9.

**Expected.** The slot becomes `TB-0V:9`, the button disarms itself, and the record is written with
`was` holding `TB-0V:11`. **The mode does not outlive the gesture.**

**Do.** Arm a slot again, then click on **bare paper** rather than on a dot.

**Expected.** **Nothing happens.** That guard matters more than it looks: the armed row is a
**wire**, so without it a click on empty sheet would place the wire's `label_point` — writing into
`locations.json`, the *other* authored file, from a click you meant for a dot.

**And `K5` finally works in your favour.** *You cannot place a point under an existing dot* has been
a nuisance since the beginning, because the dot swallows the click. Here the dot **is** what you are
aiming at, so the thing that was in the way is now the mechanism.

---

## T-1045 · `Escape`, and the four things that want it

**Do.** Arm a wire, press `Pick from the sheet`, then press **`Esc`**.

**Expected.** The slot disarms. **The wire stays armed** and the panel stays open.

**Do.** Press `Esc` again.

**Expected.** *Now* the row disarms.

**The escalation, written down rather than discovered:**

    a text field  →  an armed end slot  →  a trace in progress  →  the armed row

Each press takes exactly one thing away, and each step is more recent and more fragile than the one
after it. **The slot goes first among the three modes** because it is the one where *the next click
writes into a different authored file*: leaving it armed while believing it was gone is how an
endpoint gets written by a click meant to place a dot. Hazard `H22` in `06_code_map.md` carries the
reasoning, and there are now **four** `window` key listeners with the `activeTabId` guard (`H10`)
still the only thing keeping the two tabs apart.

**Do.** Arm a slot, then pick a **different** row in the list.

**Expected.** The slot disarms itself. An endpoint written into a wire you are no longer looking at
is the worst shape a silent write can have.

---

## T-1050 · The net-mismatch flag — **`W019`, and it is a flag rather than a fix**

**Do.** Arm `W019` and read the line under the two slots.

**Expected, before you correct it:**

    Nets: 0V at one end, 0V at the other. A wire's net is derived from its ends and not stored,
    so this cannot go stale.

**Do.** Accept the `TB-GND-B:2` proposal.

**Expected.** The line becomes:

    Nets: 0V at one end, GND at the other.   [ two nets — look at it ]

**And that is the finding, not an error.** Corrected, `W019` is a **0 V-to-ground bond** — a real
wire whose whole purpose is that its two ends are on different nets. So is a wire across a breaker,
and so is one across a disconnect. Nothing on this screen picks one of the two, and nothing in the
generator does either: it prints the mismatch and carries on.

**This is decision 5, and this flag is what it bought.** A wire used to *store* its net, which was a
third statement of a fact already held by each of its terminals — and it was the copy that went
silently stale the moment an endpoint moved. Deriving it is what makes this visible at all. If the
net were still stored, correcting `W019` would have left it reading `0V` and the most interesting
wire on the sheet would have looked ordinary.

---

## T-1055 · `path may be stale`

**Do.** Find a wire that has both a route and a correction. `W052` is a good one: it is traced along
`C0109` and its endpoints are right, so first give it a correction you will undo — set its `TO` slot
to some other terminal.

**Expected.** In the panel, in amber:

    path may be stale — its route was accepted against CR2:14 + TB-120:1.

And on the row, wherever that wire appears in a list, the state word changes from **`path traced`**
to **`path may be stale`**.

**What the comparison is.** Every path authored since 2026-09-07 carries `for`: the wire's two
terminals **as they were when the route was accepted**. A path is a claim about *ink*, and the ink
does not move — so correcting an endpoint invalidates no route *unless it moves the end that route
reaches*. This is that one comparison, and it is unordered on purpose: a wire whose `from` and `to`
were swapped has not moved either end.

**Two things it deliberately does not do:**

- **It does not put the wire back into the `Paths` queue.** That count and that filter share one
  predicate (`T-940`), and a corrected endpoint walking the path count backwards mid-run would be
  worse than the word being only a word.
- **It says nothing about a path with no `for` stamp.** All 58 existing paths were back-filled, so
  an absent stamp today means a hand edit — and casting doubt on a route a person authored by hand
  is worse than saying nothing about it.

**Do.** Undo your correction with `Take it back`, and check the row says `path traced` again.

---

## T-1060 · The commoning the proposal already knows about

**This is the one refinement that makes the whole phase correct rather than nearly correct**, and it
is worth ten minutes because Phase C is going to build on it.

A terminal block's own vertical bus is **fused into some wire polylines**, because the extractor
splits a conductor only at a crossover hop and a T-junction is not one. `C0105` is a single
conductor containing `DISCHARGE1:2`'s wire **and** the whole 279.6 pt vertical of `TB-0V`'s
commoning. Its polyline *ends* beside **row 1** while the wire joins the block at **row 12** — 114 pt
and seven landings away.

**Do.** Arm `W067` and look at its `TO` slot's proposal.

**Expected.** `TB-0V:12`, tagged **`past the commoning`**. Not row 1.

**Do.** Now arm `W037` (`TB-0V:4 → RECEPT1:4`) and read the `FROM` slot.

**Expected.** `TB-0V:1`, on `C0084` — and *not* tagged `past the commoning`, because `C0084` is an
ordinary wire that stops at row 1 without running along the bus.

**Do.** Arm anything on `TB-120` and look for `C0092` in the proposals.

**Expected.** **It is never offered, for any wire.** `C0092` is 72.7 pt of vertical joining
`TB-120:1` to `TB-120:2` and nothing else, so it is *nothing but* commoning and it lands on nothing.
That is the plan's §4 q10 finding — *`C0092` is `TB-120`'s commoning and no wire may claim it* — as
running code rather than as a sentence in a document.

**How the rule knows, and why it will work on the next drawing.** A run that passes within 4 pt of
**two or more terminals of one component** is running along that component's bus over that stretch,
and an end of the polyline sitting inside such a stretch is not a landing: the landing is where the
stretch ends. That test is about **shapes**. Nothing in `webui/src/` knows what a `TB-` prefix means,
and nothing should. Handed the real sheet and told nothing, it finds exactly the **8 conductors**
§3.6 lists by hand — `C0105`, `C0086`, `C0010`, `C0008`, `C0060`, `C0077`, `C0092`, `C0041`.

*(One correction to the plan while we are here: §3.6's heading says *8 conductors, 7 blocks* and its
own table has **six** distinct blocks. Six is right.)*

**Reading endpoints naively mis-assigns four wires**, and that is exactly how `07_drawing_facts.md`
came to say `W063` ends on `TB-120:2`. **That row and the `paths.test.ts` fixture built on it are
still uncorrected on purpose** — they go with Phase C's commoning work, and the plan's §4 q10 warns
that both of that test's assertions still hold after the correction, so a careless fix there will
not go red.

---

## T-1065 · The note, and why it is disabled

**Do.** Arm any wire nobody has confirmed and look at the box at the bottom of the section.

**Expected.** Disabled, reading *"confirm the ends first: a note rides on a decision"*.

**Do.** Confirm the wire, then type into it and press `Enter`.

**Expected.** It writes `note` onto the record. Empty it and the key is **deleted**.

**Why it is gated.** A note has to hang off a decision, and inventing the decision to hang it on
would record that a person checked something they did not. Same rule the Review tab's note box
follows and the same reasoning behind it.

**What to use it for.** The connection, not the callout. The plan's own examples are the right
shape: on `W019`, *"a 0V-to-ground bond; the two ends are on different nets and that is correct"*;
on `W042`, *"the run stops at the west side of the block — the drawing's error, not ours"*. The
colour, gauge and cable stay in the `W` table, because those were read off printed callouts, which
is a different claim.

---

## T-1070 · The two banners, and the two files

**Do.** Place a point (any point, on the `To do` filter) and then confirm a wire, and watch the top
of the screen.

**Expected.** **Two** banners, saying different things:

    circuit_logic.json is behind locations.json — re-run `python author_circuit_logic.py` …
    The sheet below is already current — this only affects the file the model reads.

    circuit_logic.json is behind wiring.json — re-run `python author_circuit_logic.py` in the
    extraction directory, and then `build_kg.py`, because an endpoint is connectivity rather
    than geometry.

**The difference is the point.** A saved point leaves the drawing current and only the artifact
behind. A saved endpoint changes *what connects to what*, so the netlist below it is genuinely a
different netlist until the generator runs — and it is the netlist the model answers from.

**Do.** Run the generator and then `build_kg.py`, and look at what moved:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs
    python author_circuit_logic.py
    python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate
    cd /home/js/schematics && git status --short schematic_extraction/

**Expected.** `wiring.json`, `circuit_logic.json`, and — if you corrected an endpoint —
`custom_kg.json`. The generator's own summary line says what it read:

    from wiring.json: 71 of 71 wires have a record, 1 confirmed by a person, 0 retired,
                      0 joining two nets, 0 half-set

And in the artifact, the confirmed wire gains a block that says who:

```json
"endpoints": {"source": "human", "by": "js", "at": "2026-09-08T..."}
```

**That is the whole point of the project in one field.** `CONNECTS_TO PS1:-2 → TB-0V:2` is in
`circuit_logic.json` *and* in `custom_kg.json`, and the model answered from it faithfully when it
was wrong. After the run there will be no unchecked answer left for it to be faithful to.

---

## T-1075 · The reader's copy has no wiring routes at all

**Do.** Set `SWUI_ALLOW_EDITS=false` in `server/.env`, restart, reload, and ask directly:

    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/wiring
    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/paths

**Expected.** **404** and **200**. Not 401 for the first — the route was never registered.

**And that is a stronger version of `H20`'s argument, not a weaker one.** `/api/paths` is free
because *which of these lines is the one I care about* is a reader's question. `wiring.json` is the
opposite end of the scale: it is *what connects to what*, the claim the model answers from, and it
is the one authored file whose contents change the netlist rather than the drawing. There is no
reader's half of it to free.

**Do.** Put `SWUI_ALLOW_EDITS=true` back and restart.

---

## T-1080 · Hand-editing `wiring.json`, and every refusal by name

The editor is the supported way, but the file is a text file and being readable by a person is the
point. **Do it with the server stopped and no editor tab open** (`K2`/`H1` — there are three
whole-document drafts now).

**Do.** Break a record on purpose, restart, and open the Locate tab. Try each of these:

| What you write into a record | What the red strip says |
|---|---|
| no `"from"` key | `wires['W063'] has no 'from'. Use null for an end nobody has set` |
| `"source": "derived"` | `has source 'derived', not one of ('index', 'human')` |
| `"from": "INFEED1"` | `has from 'INFEED1', which is not a COMPONENT:PIN id` |
| `"was": ["INFEED1:3"]` | `has was ['INFEED1:3']: it keeps the two endpoints this record replaced` |
| `"retired": "gone"` beside a `from` | `is retired and still names endpoints; a retired wire joins nothing` |
| `"to": "TB-120:9"` | `lands W063 on 'TB-120:9', which is not a terminal in this netlist` |
| a record keyed `"W999"` | `has a record for 'W999', which is not a wire in this netlist` |
| a `commoning` key `"TB-999"` | `records commoning for 'TB-999', which is not a component in this netlist` |

**Two of those are the interesting ones**, and it is the last three: an endpoint on a terminal that
does not exist, a record for a wire that does not exist, and commoning on a component that does not
exist all have a symptom that would otherwise be **nothing at all**. They are never drawn, never
applied and never mentioned — so they are refused **by name**, checked against the netlist rather
than merely for shape. Same treatment and same reasoning as `H14`'s end label on a pin its wire does
not touch.

**Do.** Now run the generator with the same broken file.

**Expected.** It exits `REFUSED:`, names the file and the wire, and **writes nothing**. That is
`H23`: the server *reports* a broken record into a red strip so you can reach the screen that fixes
it, and the generator *raises* so a netlist is never written around one. Both are right for their
caller, and the asymmetry is one sentence — **a missing point makes a worse drawing, and a missing
endpoint makes a different netlist.**

**The two validators are kept honest by a test**, not by a promise:
`test_the_editor_cannot_write_a_record_the_generator_refuses` puts twelve record shapes through both
and asserts they reach the same verdict, one at a time. `author_circuit_logic.py` cannot import from
`server/` — it is a standalone script that ships inside an extraction directory — so the duplication
is deliberate and the test is the guard on it. If the two ever disagreed, this editor would write
something the generator refuses and nothing else in the project would notice.

---

## T-1085 · The proof, and the four checks

**Do.** With however many wires you have confirmed, run the suite:

    cd /home/js/schematics/server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
    cd ../webui && npx vitest run && npx tsc -b --noEmit

**Expected.** **228 server · 392 web · ruff clean · tsc clean** — and
`test_the_committed_artifact_is_exactly_what_the_generator_writes` **red** until you re-run the
generator, which is `K6` doing its job.

**And since 2026-09-08 its failure says which file is ahead**, by name:

    wiring.json is ahead of circuit_logic.json. Re-run the generator — cd … && python
    author_circuit_logic.py A wiring change also needs `build_kg.py` afterwards, because an
    endpoint is connectivity rather than geometry.

That is **`K12` narrowed**. Two files can make this test red and *"re-run the generator"* is still
one command either way — but a person who has spent an afternoon placing points and then meets a red
test about a wiring change from yesterday has been told the wrong thing about their own work. The
comparison is one file mtime each, and it is best-effort and says so: an mtime is not provenance, a
`git checkout` can reorder them, and it is a hint attached to a failure rather than a fact anything
depends on.

---

## T-1090 · What is deliberately not here

So you do not go looking for it, and so nobody builds it by accident:

| Not built | Why, and when |
|---|---|
| **`Add a wire`** and **`Retire this wire`** | **Phase E.** §3.7 measured **0** genuinely missing field wires, so it is insurance for drawing number two rather than work this sheet needs. The *format* is ready — `from`/`to` may be `null`, a `retired` tombstone is validated and removes the wire's edge, and a record for an id the `W` table lacks is refused by name so the door stays deliberately shut. |
| **Authoring the commoning** | **Phase C.** The `commoning` section of `wiring.json` is parsed, its key is refused by name if it is not a component, and its body is carried through untouched. The proposal already *finds* all eight conductors by shape (T-1060), so Phase C's job is to let you accept them and to union them into a net's highlight. |
| **A net's highlight including the commoning** | **Phase C**, and it is the change you asked for on 2026-09-06. |
| **Clicking a terminal to highlight its wires** | **Phase D**, on the **Drawing** tab, with no password. That is also the feature that makes a missing wire visible by its absence — build it before the run, use it during. |
| **`/api/conductors` losing its password** | **Phase D.** *Is there a wire here* is a reader's question; 149 raw polylines are not. |
| **The `Ask` tab reasoning about highlighted wires** | After Phase D, and it is your own note at the end of the plan. Nothing here forecloses it: `wiring.json` holds designators and no coordinates, so a terminal names the same terminal whichever sheet prints it. |

**And one thing that is not built and never will be:** nothing on this screen accepts a proposal on
its own. Not for the 48 the ink agrees with, and least of all for `W042`.

---

## If something looks wrong

| What you see | Look at |
|---|---|
| No **What it joins** section on an armed wire | is it a **net**? A net is not wired to anything — it *is* the wiring, and there is nothing on it to author |
| *"The wiring file did not load"* | `GET /api/wiring` failed. Is `SWUI_ALLOW_EDITS=true`? **Did the server restart after `wiring.py` arrived?** A rebuilt bundle against an unrestarted server is exactly this |
| The count says `n of 71` and the `Wiring` list disagrees | it cannot: they share one predicate, `wiringModel.ts` `wiringDecided`. If they do, that is a real fault |
| A wire I confirmed is still in the queue | is one of its ends `null`? *Confirmed* and *finished* are two questions and the queue asks the second — a wire somebody started is still work |
| An empty proposal list | **a real answer, and for six wires the expected one.** No run of ink reaches that end. `W042` is the drawing's error; `W047`, `W048`, `W024`, `W025`, `W026` and `W049` are relay coils the ink stops 46 pt short of |
| The proposal at the top is another wire's endpoint | **worth a look, and often correct.** Where two wires land on one pin the nearer run may be the other wire's — eleven of this sheet's endpoints are that case (`PLG1`/`PLG2`, `CR-ON:14` beside `CR-BP:24`). The list is **not** patched to prefer whatever the file already says, because a proposal that agreed by construction would be no proposal. The one that agrees is tagged instead |
| A proposal names a pin on the wrong row of a block | worth a report, with the wire id and the pin you expected. `features/locate/wiring.ts` is the whole of it, and `wiring.test.ts` pins all eleven corrections against the real drawing |
| `C0092` offered as a candidate for anything | that is a real fault. It is `TB-120`'s commoning and `isCommoning` should exclude it — T-1060 |
| `Esc` cleared my row when I meant to disarm a slot | the slot had already gone. text field → slot → trace → row, and each press takes one thing. `06_code_map.md` §H22 |
| A click on the sheet placed a wire's label point | that is a real fault: while a slot is armed, bare paper does nothing. `LocateTab.tsx`'s `onClick` guard |
| The two nets flag on a wire I think is fine | look twice, then trust your eyes. It is a flag and never a fix — `W019`, `DISC1` and `CB1` are all legitimately across two nets |
| `path may be stale` on a wire I did not correct | did an endpoint move at either end? Check `path.for` against the record's `from`/`to`. If they match, that is a real fault — `wiringModel.ts` `pathStale` |
| The red strip names an id I do not recognise | a record keyed on a wire, an endpoint on a terminal, or commoning on a component that is not in this netlist. Refused by name, because its symptom would otherwise be nothing — T-1080 |
| The generator exits `REFUSED:` | deliberate, and the message names the file and the wire. `H23`. Falling back to the `W` table would regenerate the artifact the model answers from using the guesses this project measured as wrong |

---

## What this session cost, and what §14 now costs you

**One new server module, two new routes, two new pure client modules, one new panel.**
`server/app/wiring.py` is the fourth authored file's validator with the same three-layer split
`locations.py` has; `features/locate/wiring.ts` is the ink's proposal, pure, with the
commoning-aware landing rule and 23 unit tests including the whole-drawing acceptance criterion;
`features/locate/wiringModel.ts` is the document's rules with 27; `WiringPanel.tsx` is the screen.
**44 new server tests and 72 new web tests.**

**§14's estimate is unchanged: about 100 gestures, 45–75 minutes**, in one or two sittings. What
this session changes about it is only that the sittings are now on a screen. Two notes on where the
time will actually go:

- **the 47 are faster than the estimate** — the panel says `agrees with the index` and you press one
  button;
- **the six coil wires are slower** — the ink stops 46 pt short of a relay's `A2` and offers
  nothing, so those are `Pick from the sheet` and your judgement. `W024`, `W025`, `W026`, `W047`,
  `W048`, `W049`.

**Do not start the run yet.** The plan's §13 stopping point for Session 2 is *you can confirm all 71
wires*, and it says explicitly to wait: **Phase C changes what a net looks like on the sheet**, and
you will want to see the commoning while you work.
