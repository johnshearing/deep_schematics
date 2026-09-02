# Review tab questions — answers

*Written 2026-09-01, in answer to the 23 questions in `claude.md`. No code was written and nothing
was changed. Every number below was measured against the shipped files today, not remembered.*

**What I read to answer these:** `locate_tab_testing/locate_tab_instruction_and_test_manual.md`
(whole), `highlighting_wires_and_nets.md` (whole), `server/app/ink.py`,
`server/app/label_corrections.py`, `webui/src/features/review/ReviewTab.tsx` and `model.ts`,
`server/app/prompts.py`, `EXTRACTION_NOTES.md`, `schematic_skills/scripts/extract.py` and
`build_kg.py`, plus targeted `python3 -c` queries against `geometry.json`, `circuit_logic.json`,
`locations.json` and `label_corrections.json`. I did not read `geometry.json` or
`circuit_logic.json` whole.

---

## 1. Five facts that answer most of the twenty-three

Nearly every question below is a version of *"does it matter?"*, and five facts decide almost all of
them. They are worth having in front of you before the individual answers, because most of the
answers are short once these are in place.

### Fact 1 — the netlist was never read by OCR

`EXTRACTION_NOTES.md`, correction 1:

> **The PDF contains no text.** … Every label here was read visually from the tiles; **the OCR in
> `geometry.json` was a cross-check only.**

The 47 components, 131 terminals, 26 nets and 71 wires in `circuit_logic.json` were read by a vision
pass off the 400 DPI tiles by a person working through `author_circuit_logic.py`, and cross-checked
against the *vector* geometry. **No OCR mistake in `geometry.json` has ever reached
`circuit_logic.json`.** That is why §2 of the wires-and-nets plan could say the nine misread net
labels *"never became entities"*.

And `circuit_logic.json` is what the model reads. `prompts.py` names four files and rules
`geometry.json` out by name: *"Do NOT read `geometry.json`. It is 608 KB of raw vector and OCR
extraction. It will not answer a netlist question and it will fill your context with noise."*

**So: for every question of the form "the OCR got this wrong — does the model's answer suffer?", the
answer is no.** The model has never seen the wrong reading and never will.

### Fact 2 — exactly one thing will ever consume these readings, and it is Session 6

`label_corrections.py` ends with a function whose docstring says what it is for:

```python
def corrected_text(readings) -> dict[str, str]:
    """Every id whose ink now reads as something, after corrections — id → string.
       **This is the function Phase E's matcher reads** …"""
```

Phase E (Session 6) ranks candidate conductors for a wire by comparing **a run's printed net name**
against **that wire's net id**. That comparison — and nothing else in the system — reads the review
screen's output.

**So a reading matters if and only if it is one of two things:**

1. **a conductor's net name** (all 149 runs), or
2. **a label that some conductor's net name is read from** (70 labels of the 515 — the ones the
   Review tab badges `net name`).

That is **219 rows of the 664**. The other 445 — the notes, the title-block strings, the terminal
markings, the symbol fragments — are *bookkeeping*. Correcting them is not wrong and it is not
wasted (see Fact 5), but nothing downstream reads them, and nothing is planned that will.

This is the single most useful filter to hold in your head while working the queue: **the `net name`
badge is the whole game.**

### Fact 3 — `kind` is not authored anywhere; it is computed from the text

`schematic_skills/scripts/extract.py` has one function, and it is a pure function of the corrected
string:

```python
def classify_label(text: str) -> str:
    """Classify a corrected label into the role it plays on a wiring diagram."""
    ...
    if NET_NUMBER_RE.match(t):
        # Relay contact and plug pin markings are one or two digits; printed net
        # designators on this drawing style are three or four.
        return "terminal_number" if len(t) <= 2 else "net_number"
```

`net_number`, `voltage`, `wire_spec`, `designator`, `terminal_number`, `note`, `text`, `empty` —
every one of them falls out of the string. And `ink.py` says out loud what the server does with it:

> The extractor's guess at what sort of string this is … **A hint for the reader, never a filter this
> server applies.**

**So there is nothing to redefine.** Questions 2, 7, 12, 13 and 18 all ask for a way to correct the
`kind`; the honest answer is that `kind` is a *consequence* of the text, the text is already
correctable, and no code anywhere branches on `kind`. The only real defect is cosmetic: the Review
tab prints the badge from the *extraction-time* `kind`, so after you correct `125,` → `125` the badge
still says `text` when a re-run of the classifier would say `net_number`. That is a two-line fix
(recompute the badge from the settled text) and I would fold it into a later session rather than
make a phase of it.

### Fact 4 — the ring you see on a run is the box round its two endpoints, not its shape

This is the answer to questions 16, 17, 21 and 22, and it is deliberate rather than a limitation.
`ink.py`:

```python
class Conductor:
    """`points` is deliberately **absent**. It is the polyline Phase E will lift a wire's path
    from, it is half the weight of geometry.json, and nothing in Phase F draws a route — so it
    is not read here yet. `endpoints` is enough to frame the run on screen …"""

    @property
    def rect(self):          # min/max over the *endpoints*
```

The full polyline is in `geometry.json` and always has been: 149 conductors, **50 of them
multi-segment, up to 5 segments**. `C0002`, which you asked about, is three segments with two right
angles:

```
[954.38, 298.66] → [763.20, 298.66] → [763.20, 83.67] → [748.38, 83.67]
```

The Review tab draws the box round `[954.38, 298.66]` and `[748.38, 83.67]`, which is a 206 × 215 pt
rectangle over a quarter of the sheet. The ink is a thin L inside it. **Nothing is missing from the
data; the review screen just is not a route viewer.** Phase D — *the session you have queued up
next* — adds `polylineToDevice`/`paintRuns` to `paint.ts` and paints real polylines on the sheet;
Phase E is where `ink.py` gains the conductor `points` themselves, for `/api/conductors`.
*(Corrected 2026-09-02: an earlier draft of this paragraph put the `points` load in Phase D. Phase D
reads authored paths out of `locations.json` and never opens the ink loader.)*

### Fact 5 — a "confirmed" reading is worth storing even when nothing reads it

`label_corrections.py`, and this is the one place in the whole project that deliberately stores
something agreeing with a computed value:

> **the same string it already was** — *I looked, and the machine was right.* This is deliberately
> **kept** … Nothing produces *confirmed* but a person. A low-confidence read that somebody has
> checked is new information, and the queue's whole job is to get smaller.

So the 249 confirmations in your file are not busywork. They are the record that a person went and
looked at 249 pieces of ink. When the extraction is re-run — and it will be, for drawing number
two — every one of them is still auditable against its `was`.

---

## 2. One thing that needed attention before Session 6 — **done 2026-09-02**

> **Applied at your request, 2026-09-02.** All 29 run names in the table below are back, plus
> `C0086` = `24E-1` and `C0059` = `110` from questions 21 and 18 — **31 entries**, written straight
> into `label_corrections.json` with the server stopped, in the same shape and key order
> `setCorrection` writes, with each row's original `was` preserved (`C0002` still records `OV.`,
> `C0061` still records `C4E-1`). Every one carries a `note` saying what it is and why, so the batch
> is findable later. The file parses with **no problems** and now holds **654** entries.
>
> **A second batch of three followed** — `C0054`, `C0114` and `C0034` from §4 item 7, each verified
> against its endpoints before being written, and a fourth (`C0115`) refused. **34 entries in all.**
>
> | | before the review run | after it | now |
> |---|---|---|---|
> | Nets with ≥1 printed conductor | 17 of 26 | 22 of 26 | **24 of 26** |
> | Runs with a usable net name | 70 | 36 | **70** |
>
> Back to 70 named runs — the same count the extraction started with, but a different 70: the seven
> partial reads that were never names (`4`, `U`, `+4`, `A`, `YY`, `50`, `PBL`) are gone, and seven
> real ones a person supplied are in.
>
> **The two nets still unmatched are `NET-PB1` and `NET-PB2` — which is `K10`, not a reading.** The
> sheet prints `PB1`/`PB2` and the netlist prefixed them; **both of those names are now on a run**,
> so every net on this drawing becomes reachable the moment `K10` is answered. `K10` in the manual's
> §7 has been updated to say so.
>
> Nothing else changed. `circuit_logic.json` was not touched, no generator was run, and the file is
> uncommitted and yours to commit.

### The original finding, kept as written

I would not be doing my job if I buried this. **Your review run is 653 decisions over 664 readings —
essentially the whole queue — and it has done far more good than harm.** Measured against the
netlist:

| | Before your review | After it |
|---|---|---|
| Nets with at least one printed run carrying their name | **17 of 26** | **22 of 26** |
| Nets gained | — | `111`, `121`, `IINSP1`, `IINSP2`, `L1`, `L1-A`, `L1-A1` |
| Nets lost | — | `125`, `130` |

Seven nets that the matcher could not have reached now have a printed run. That is exactly the
outcome Phase F was built for, and §2 of the plan predicted five of those seven by name.

**But 36 runs that had a correctly-bound net name were marked *not a label*, and for a run that
button means something specific.** The code comment beside it says so:

> **not a label**, meaning there is no text here / **no net name printed on this run**.

`corrected_text()` drops a `null` — deliberately, so *"a matcher must not compare against a string
somebody said was not a name"*. So each of those 36 rows now tells Session 6 *this run has no
printed net name*, and the count of runs the matcher can use went **70 → 36**, with the unnamed pool
growing **79 → 113**.

`C0001` is the clearest case, and it is the one you photographed. Your own screenshot
`_claude_notes/paint/C0001.jpg` shows `0V` printed above the run and `WHITE/BLUE 12AWG` below it. The
extraction read `0V` and bound it correctly. The file now says that run has no printed net name.

I think I know how this happened, because question 21 says it in your own words: *"I have no way to
describe what it is on the Review tab. So I marked this as not a label. In that way we can find it
again later."* Used as a bookmark it is free on a label row and expensive on a run row. That is a
wording problem on my side as much as anything — the ✖ button's tooltip talks only about labels, and
on a run row it should say *"no net name is printed on this run"*.

**The 36, with what I would put in each box instead.** *Reset* (the ↺ button) deletes the decision;
typing the name and pressing `Enter` is the better move where the name is real.

| Run | Machine read | I would type | |
|---|---|---|---|
| `C0001` | `0V` | `0V` | net |
| `C0002` | `OV.` | `0V` | net |
| `C0004` | `24E-1` | `24E-1` | net |
| `C0008` | `24E-1` | `24E-1` | net |
| `C0020` | `0V` | `0V` | net |
| `C0029` | `GND` | `GND` | net |
| `C0031` | `0V` | `0V` | net |
| `C0039` | `GND` | `GND` | net |
| `C0043` | `N` | `N` | net |
| `C0056` | `"GND` | `GND` | net |
| `C0061` | `C4E-1` | `24E-1` | net |
| `C0076` | `110` | `110` | net |
| `C0079` | `125` | `125` | **the only run carrying net `125`** |
| `C0081` | `120` | `120` | net |
| `C0082` | `24E-1` | `24E-1` | net |
| `C0083` | `DIR` | `DIR` | net |
| `C0084` | `0V` | `0V` | net |
| `C0088` | `RUN` | `RUN` | net |
| `C0089` | `DIR` | `DIR` | net |
| `C0093` | `130.` | `130` | net |
| `C0095` | `RUN` | `RUN` | net |
| `C0099` | `24E-1` | `24E-1` | net |
| `C0105` | `OV.` | `0V` | net |
| `C0110` | `SPD` | `SPD` | net |
| `C0117` | `130` | `130` | **with `C0093`, the only runs carrying net `130`** |
| `C0118` | `N` | `N` | net |
| `C0122` | `OV.` | `0V` | net |
| `C0123` | `24E-1` | `24E-1` | net |
| `C0134` | `RUN` | `RUN` | net |
| `C0025` | `4` | *leave as not-a-label* | partial read, not a name |
| `C0034` | `U` | *leave* | partial read |
| `C0067` | `+4` | *leave* | partial read |
| `C0072` | `A` | *leave* | partial read |
| `C0126` | `YY` | *leave* | partial read |
| `C0127` | `50` | *leave* | partial read |
| `C0054` | `PBL` | `PB1` — see note | the `K10` case |

Twenty-nine to put back, six correctly left alone, and one judgement call. `C0054`'s `PBL` is almost
certainly the sheet's printed `PB1`; the netlist calls that net `NET-PB1` because the sheet also has
a *push button* called `PB1`. That is **`K10`**, it is a known open issue, and the fix belongs in
`author_circuit_logic.py`, not here — **type what the ink says (`PB1`) and let `K10` be solved where
it lives.** The plan's §7 note on `K10` says exactly this: *"a correction says what the **ink** says
… what differs is the **netlist's** name for that net"*.

**On the label side you got it exactly right.** Five labels that a run's net name is read from were
marked *not a label*: `T0202 '4'`, `T0212 '50'`, `T0213 'YY'`, `T0257 '+4'`, `T0285 'A'`. Those are
five of the seven the plan §2 predicted — *"partial reads of things that are not net names at all"*.
No action.

**And one more, unrelated to the above.** 653 corrections are in the working tree and **90 are in
git**. `label_corrections.json` is authored content that nothing can regenerate. It deserves the same
treatment `locations.json` gets: commit it when a run of review ends.

---

## 3. The questions, one at a time

### 1a. Does a script need to be run for the model to know about Review tab changes?

**No, and that is guaranteed by a test rather than by a convention.**

Your premise about the Locate tab is right: `author_circuit_logic.py` reads `locations.json` and
folds the placed points into `circuit_logic.json`, which is why `circuit_logic.json` goes stale after
every save (`K6`) and why one server test goes red until you re-run it.

The Review tab is deliberately the opposite. `author_circuit_logic.py` does not read
`label_corrections.json` and **must not start**:
`test_the_generator_output_is_byte_identical_with_and_without_a_corrections_file`. That is
**T-740**, and the manual lists *"the artifact test went red after a review run"* under symptoms with
the note **"that is a bug, not `K6`"**. The footer of the Review tab says the same thing on screen.

The honest corollary, which you should have in plain words: **the model does not learn anything from
your corrections either.** It reads `circuit_logic.json`, and `circuit_logic.json` was already right
— it was read off the tiles by eye, not by OCR. Your corrections feed **Session 6's path matcher**,
and today that is their only consumer. Nothing to run, and nothing gained by the model.

**Two smaller things about the model's files, while we are here.** `EXTRACTION_NOTES.md` says the
full recipe is *"`python author_circuit_logic.py`, then `build_kg.py`"*. `custom_kg.json` is derived
from `circuit_logic.json` by `build_kg.py`, and it is dated **2026-08-03** while `circuit_logic.json`
is **2026-08-25** — so `custom_kg.json` is stale by a placement run. `prompts.py` ranks it fourth and
tells the model to use it *"only to cross-check something surprising, never as the primary source"*,
so the exposure is small, but it is a real staleness that `K6` does not cover and nothing tests.
Worth a line in the manual and one command when convenient.

### 1b. `T0350` reads `LSMLM4-` and is really `PS20115MLM4-2`. Does it matter?

**No.** It is the drawing number, printed vertically in the title-block border. Three reasons it is
free:

- The drawing number is already in `circuit_logic.json`'s `drawing.drawing_number`, read by eye, and
  it is the primary key of the whole extraction directory.
- `T0350` is not bound to any conductor. `net_name` is false. Nothing downstream reads it.
- Your screenshots show the real problem, and it is not the text: `WholeLable.jpg` shows the whole
  string, `T0350.jpg` shows the box, and the box (`1187.5 → 1192.3` x, `519.6 → 545.9` y) covers about
  a third of it. The OCR read what was inside the box correctly-ish. The **box** is wrong.

**Should you mark it *not a label*?** You already did, and I would leave it. It is not a label in the
sense this file means — it is not a name of anything on the circuit. But the correction you had
typed first (`PS20115MLM4-2`) was also perfectly defensible and would have cost nothing. Either is
fine; this row is not load-bearing.

### 2. `T0463` — you fixed `125,` → `125` but could not say it is a net label. Does it matter?

**It does not matter here, for a reason worth knowing, and the general answer is Fact 3: there is
nothing to redefine.**

Two specifics:

- **Why it read 0.4.** `correct_token()` tries `NET_NUMBER_RE = ^\d{1,4}$` and awards 0.9 on a match.
  `125,` has a trailing comma, so it falls through every rule to the last line — `return t, 0.4`. The
  confidence is not an opinion about the ink; it is *"no rule in my lexicon recognised this"*. Your
  correction to `125` is exactly right, and `classify_label('125')` would now return `net_number`.
- **Why it changes nothing anyway.** `T0463` is a *second printed instance* of the `125` name, at the
  far right end of the run. Net `125`'s run is `C0079`, and `C0079` binds its net name from **`T0455`**
  (`'125'`, confidence 0.9, at the left end) — the extraction already had a clean source. `T0463` is
  bound to no conductor, which is why it carries no `net name` badge.

**Should we be able to redefine labels?** Not the `kind`, for the reason in Fact 3. What you *can*
already do is the thing that matters — say what the string is — and the Review tab already shows you
which strings a run depends on. The one change I would make is the cosmetic one in Fact 3:
recompute the badge from the corrected text so a fixed `125` stops calling itself `text`.

### 3. `T0341` merges two text blocks into one. Does it matter? Should we be able to redefine `kind` and the bounding box?

**It does not matter, and the reason is decisive: the split you want is already in the netlist, in
better words than the sheet uses.**

```
INFEED1     "Infeed interface #1, female 6-pin mini receptacle. Conductors: 110 blue 16AWG,
             0V green 16AWG, 120 red 16AWG, 130 orange 16AWG, IINSP1 black 16AWG,
             IINSP2 white 16AWG."
DISCHARGE1  "Discharge interface #1, male 6-pin mini cable. Conductors: 111 blue 16AWG,
             0V green 16AWG, 120 red 16AWG, 130 orange 16AWG, DINSP1 black 16AWG,
             DINSP2 white 16AWG."
```

Two components, correctly separated, female receptacle and male cable, each with its six conductors
— which is more than the two printed captions say. The vision pass read the sheet properly. `T0341`
is the OCR's clumsy transcription of a caption whose content is already curated, and it is bound to
no conductor.

**Should we be able to move and re-dimension boxes?** See question 6 for the full answer; the short
form is that a label's bbox is read by exactly one thing — the ring you look at while reviewing —
and Phase E's ranking never touches it. A bbox editor buys a nicer ring and nothing else. I would
not build it.

### 4. `T0343` and `T0344` capture fragments of the same text. Does it matter?

**No, and their real interest is diagnostic.** Look at the boxes:

```
T0343  'NF EE)'  bbox [501.54, 510.86, 508.78, 510.86]   ← zero height
T0344  '1E I'    bbox [525.31, 510.86, 526.35, 510.86]   ← zero height, ~1 pt wide
```

Both are **degenerate**: `y0 == y1`. These are not misreads of a caption, they are stroke-clustering
debris — the glyph clusterer produced a "line" with no vertical extent and tesseract was handed a
sliver. `T0341` is the real reading of that caption and it covers the whole span (`496 → 654` x).

So `T0343`/`T0344` are noise on top of a caption that does not matter (question 3). *Not a label* is
the right decision and you have made it. **Nothing is lost.** If you want a rough gauge of how much
of the queue is this kind of debris, that is a one-line count of degenerate boxes; I did not run it
because no answer changes what we do next.

### 5. `T0021` captures only part of a text block and jumbles the word order

**No, it does not matter.** `T0021` reads `VAC 1 PHASE FLA 1I5VAC` at `[64.6, 45.9, 97.2, 55.4]`, and
its neighbours are `T0019` (blank), `T0020` (blank) and `T0022` (`60HZ`). The title-block note about
the supply got chopped into four boxes and two of them read as nothing.

The content is already curated and correct in two places: `circuit_logic.json`'s drawing title —
*"24VDC 20AMP OUTPUT, 115VAC-1 PHASE INPUT"* — and `PLG1`'s ratings block
(`{"voltage": "115VAC", "phase": "1", "frequency": "60Hz", "pins": 3}`). The model reads both. The
OCR fragment is bound to no conductor and reaches nothing.

### 6. There are many more like these. Do we need to move boxes and type text?

**Type text: you already can, and it is the half of decision 3 that made `All readings` load-bearing.
Move boxes: I would not, and here is the reasoning rather than the verdict.**

Ask what reads a bounding box.

| Reader | What it uses the box for | Consequence of a wrong box |
|---|---|---|
| The Review tab's ring | frame the ink beside the row you are on | you look at the wrong ink, *while you are looking at the sheet anyway* |
| Phase E's ranking | **nothing** — it reads run `net_label`, `spec_label`, and endpoint bindings to `terminal_point` symbols | none |
| `author_circuit_logic.py` | nothing | none |
| The model | nothing — it never sees `geometry.json` | none |

A label's bbox is a **viewing aid** and nothing else. It is wrong in the cheapest possible place: the
one place where a person is already looking at the paper and can see past it.

Against that, the cost of a box editor is not small, and it is mostly conceptual rather than
mechanical:

- **`geometry.json` is generated.** It is the deterministic output of `extract.py`, and the whole
  directory rests on the split *this file is generated, those two are authored*. Hand-editing boxes
  in it would be erased by the next extraction and would break the rule the project is organised
  around.
- **So it would be a fourth authored file** — geometry corrections keyed on extraction ids, with its
  own schema, validator, save path, cache, undo story and lock — or a new section in
  `label_corrections.json` that makes it two claims in one file, which is exactly the argument
  `label_corrections.py`'s docstring makes against folding into `locations.json`.
- **And it would need a drawing surface** with rubber-band handles on the sheet, which is a bigger UI
  than the whole Review tab is today.

That is a session and a half of work whose entire payoff is a better ring. **My recommendation: no.**

**The exception, and it is where I would spend the effort instead:** where the box being wrong means
a *reading* is missing, you can already fix the reading. `T0338` (question 18) is the model case, and
it is worth reading that answer as the general reply to this question.

### 7. `T0242` — move the box, redefine the kind, in `geometry.json` or `label_corrections.json` or elsewhere?

`T0242` reads `X PBI / ST0P` at `[1001.5, 330.0, 1019.1, 339.6]`. Its neighbours are `T0240`
(`'CR1'`, designator, 0.9) and `T0241` (blank, `[981.3, 330.0, 1001.0, 345.1]`). So the sheet's
legend there reads roughly *"CR1: MODLINX PB1 START / STOP, 1N.O."* — which is quoted verbatim in
`CR1`'s description in the netlist:

> "Control relay CR1. Legend on the drawing: **'CR1: MODLINX PB1 START / STOP, 1N.O.'** Coil
> terminals A1/A2; one normally-open contact 11-14."

The leading `X` is symbol ink caught in the box; `PBI` is `PB1` (capital I for the digit); `ST0P` is
`STOP` (slashed zero for O — `extract.py`'s comment about CAD stroke fonts describes this exact
failure).

**Where would the correction go?** In `label_corrections.json`, by typing `PB1 / STOP` and pressing
`Enter`. Not in `geometry.json` — that file is generated. Not a `kind` — Fact 3.

**Does it matter?** No. The legend is already curated into `CR1`. This is a *nice to have* and it
costs one keystroke sequence, so type it if you are passing; do not go looking for its siblings.

### 8. `T0008` is an oval around 3 wires meaning they are one cable, read as `A`. Is the cable recorded?

**Yes, fully, in `circuit_logic.json` — there are eight cables and each one names its member wires.**

```json
{"id": "CABLE-POWER-IN",
 "description": "POWER IN 115VAC cable to plug PLG1 (LEV2611): black 10AWG line,
                 white 10AWG neutral, green 10AWG ground.",
 "member_wires": ["W001", "W002", "W003"]}
```

`T0008`'s box is `[217.6, 38.7, 225.8, 89.8]` — top-left of the sheet, 51 pt tall, three conductor
rows. `W001` and `W002`'s label points, when they existed, were at `(231.1, 50.5)` and
`(231.4, 66.9)` — right beside it. **That oval is `CABLE-POWER-IN` and its three wires are already
grouped in the netlist.** The model can answer "which conductors are in that cable" today, by name
and by colour and gauge.

Reading the oval as `A` is the glyph clusterer treating a closed curve as a letter, and
`classify_label('A')` filed it as `terminal_number`. Marking it *not a label* is correct and you
have. Nothing further to do.

### 9. `T0023` is a hyphen over part of a circuit-breaker symbol

`T0023` reads `-` at `[468.2, 47.5, 476.4, 47.5]` — another **zero-height** box, like `T0343`. It is
symbol ink, not text.

**Is the fact recorded elsewhere?** Yes: the breakers are components in the netlist with their class,
rating and function, and `prompts.py` carries the domain rule about them — *"A circuit breaker
DIN-rail-mounted and used as a manual switch is a switch, not protection. On this drawing REVERSE 5A
and BYPASS 5A are switches; only CB1 and CB2 are genuine over-current protection."* That is more than
a symbol identification.

**Should there be a way to re-define the entity as a symbol?** No — see question 19, where this
becomes the interesting version of the question. *Not a label* is the right answer for this row.

### 10. Could corrections be fed back so the OCR does better on new, unseen drawings?

**Yes — and cheaply, because the correction step is a hand-written lexicon rather than a model.**
This is the best question in the list, and it is the one that pays off across the library.

`extract.py` runs tesseract over 600 DPI crops and then applies `correct_token()`, which is rules
plus a word list:

```python
LEXICON = WIRE_COLORS + ["TERMINAL", "TERMINALS", "TERMINAL'S", "CIRCUIT", "BREAKER",
                         "AMP", "POWER", "SUPPLY", "SPEED", "CONTROLLER", "RECEPTACLE",
                         "INTERFACE", "DISCHARGE", "INFEED", "CABLE", "CABLES", …]
```

with special cases for the failures a CAD stroke font produces — the slashed zero (`OV` → `0V`,
handled), `AVG` → `AWG`, `MDD-LINX` → `MOD-LINX`. **The last line of `correct_token` is
`return t, 0.4`** — which is why so much of your queue is at exactly 0.4. It does not mean *"I am
unsure"*, it means *"no rule of mine recognised this"*.

So the feedback loop already has a slot to plug into, and `label_corrections.json` already has the
data: 653 entries, each with `was` (what the machine saw) and `text` (what the paper says). That is a
labelled training set for a lexicon, produced by a person, one drawing at a time.

**What I would actually build, when the time comes — and it is not now:**

- A small script in `schematic_skills/` that reads every drawing's `label_corrections.json` and reports
  the `was → text` pairs by frequency, split into *the lexicon would have caught this if the word were
  in it* and *this needs a new rule*. Read the report; hand-edit `LEXICON`. **Keep the human in the
  loop** — an auto-grown lexicon is a guesser, and this project's whole position is that a guesser
  gets one chance and then a person owns it.
- Keep the corrections **per drawing** and the lexicon **shared**. That matches the existing shape:
  `schematic_skills/` is the reusable half, `schematic_extraction/<drawing>/` is the per-sheet half.

**When.** After the second drawing, not before. One sheet's corrections cannot tell a systematic
glyph confusion from this sheet's handwriting, and the whole point of the library is that drawing
number two is where a rule proves itself. Note this in `webui_ideas.md` and leave it.

### 11. Should we revisit everything marked *not a label*? Should there be a filter, or a new category?

**Revisit: yes — but only the runs, and §2 above is the list.** Twenty-nine rows, ten minutes,
and it puts nets `125` and `130` back and hands Session 6 twice the matched runs.

**A filter for *not a label*: yes, and it is small.** The Review tab has a scope (`Flagged` /
`All readings`) and one filter (`Net labels`). A third scope — `Decided: not a label` — is a
predicate over data already in the payload (`stored.text === null`) and would have made this whole
section a five-minute job instead of a database query. I would add it in the same sitting as the
badge fix from Fact 3. **What I would *not* add is a search box** — `reviewStore.ts` explains why, and
the reasoning holds: `T0247` means nothing to anybody, so the way in is the order and the scope.

**A new category for *"needs its box moved"*: no.** Three reasons: it would be a queue over a repair
we have decided not to build (question 6), a category nobody can act on is `K7`'s exact shape, and
the thing you actually want to record — *why this row is odd* — already has a home. See question 23.

**"Is important information being lost?"** I checked, and the answer is reassuring. Everything you
flagged in these 23 questions turned out to be already recorded in `circuit_logic.json`, usually in
better form than the sheet prints it: the cable groupings (Q8), the infeed/discharge split (Q3), the
supply ratings (Q5), the CR1 legend (Q7), `TB-DIR` (Q15), `TB-120` (Q14), the breaker semantics (Q9).
That is Fact 1 doing its work — the vision pass read the paper properly, and the OCR layer is a
cross-check that is allowed to be wrong.

### 12. `T0259` is `voltage` — should it also be a net name?

**It is genuinely both, and the classifier had to pick one.** `classify_label` tests `VOLTAGE_RE`
before `NET_NUMBER_RE`, and `0V` is special-cased into `voltage` at the top. Meanwhile `0V` is one of
the 26 nets in the netlist, with **25 member terminals** — the second-biggest net on the sheet.

The important point is that **the badge that matters is not `voltage`, it is `net name`, and it is
computed rather than declared.** A row gets the `net name` badge when some conductor's net name is
read from it. `T0259` does not have it, because no conductor binds `T0259` — the runs on the `0V`
net read their name from other printed instances (`C0001` from `T0062`/`T0075`, for example). There
are many `0V` strings on this sheet and only some of them are a run's source.

So: nothing to change, and no way in which a `kind` of `voltage` costs anything. Your confirmation of
`0V` on that row was the right decision, and it is stored as a confirmation.

### 13. `T0330` is marked both `net_number` and `net name`. What is the difference?

They are two different claims from two different layers, and it is worth being precise because it
resolves questions 12, 14 and 18 as well.

| Badge | Where it comes from | What it asserts |
|---|---|---|
| `net_number` | `classify_label()` in `extract.py`, at extraction time | **a guess about the shape of the string.** Three or four digits with nothing else → probably a printed net designator. One or two digits → a relay contact or plug pin marking |
| `net name` | `ink.net_label_sources()`, computed live by the server on every request | **a fact about the wiring of the data.** Some conductor's `net_label` is read from this label, so correcting it corrects that run |

`T0330` has both: it reads `110` (three digits → `net_number`) **and** conductor `C0098` reads its net
name from it. The Review tab tells you which run, in the row: *reads `110` via `T0330`*.

`T0378` (question 14) shows the difference cleanly: it is also `110`-shaped — `net_number`, `'120'`,
0.9 — and it has **no** `net name` badge, because no conductor binds it. Same kind, different
consequence.

**Which one should you care about?** The blue one. `net name` is Fact 2 in a badge.

### 14. `T0378` is a net number and also the terminal block's name. That is not shown. Does it matter?

**No — it is recorded, one layer up, in the file that is read.**

```
TB-120  "Three-point terminal block marked 120 carrying the start/stop permissive net …"
```

The netlist has nineteen `TB-*` components and every one of them names the marking it carries:
`TB-L1`, `TB-N`, `TB-GND-A/B`, `TB-24E1-A/B`, `TB-0V`, `TB-SPD`, `TB-DIR`, `TB-RUN`, `TB-110`,
`TB-120`, `TB-130`, `TB-IINSP1/2`, `TB-DINSP1/2`, `TB-PB1SP`, `TB-PB2SP`. The relationship between
"the printed `120`" and "the block marked 120" was made by a person reading the tiles, and it is in
`circuit_logic.json` where the model reads it.

What the Review tab cannot show is that association — and it is right not to. The Review tab is
about **one layer**: what does the ink say here. Teaching it to also say *"and this string is the name
of that component"* would be teaching one screen two vocabularies (extraction ids and designators),
which is exactly the argument `label_corrections.py` makes for being a separate file in the first
place.

### 15. `T0137` reads `TERMINAL` and the `DIR` below it was not picked up

**Gently: it was.** `DIR` is `T0144`, its own row in your queue:

```
T0137  'TERMINAL'  1.00   bbox [633.5, 167.3, 656.2, 171.4]   centre x 644.9
T0144  'DIR'       0.40   bbox [641.6, 175.3, 648.9, 179.4]   centre x 645.3   ← 8 pt below
```

Two labels, both read, vertically stacked and centred on each other. The OCR missed nothing. What is
absent is the **association** — *this `TERMINAL` and that `DIR` are one legend* — and an association
between two boxes is not a reading, so it could not live in this file even if we wanted it to.

**And the association is already recorded:** `TB-DIR`, *"Single-point terminal marked DIR carrying the
direction signal."* Which is your own conclusion in the question — you wrote *"the ai model seems to
know where all the terminal blocks are and what net they are a part of anyway."* It does, and Fact 1
is why: a person read that pairing off the tiles in 2026-07-26 and wrote it into the netlist.

`DIR` at 0.40 is the `correct_token` fallback again — three characters, `TERMINAL_TOKEN_RE` does not
match `DIR` (it wants one or two letters), so it drops through to `return t, 0.4`. The text is right;
the confidence is the lexicon shrugging. Confirming it is worth doing and costs one keystroke.

**No box moving needed.** Twenty labels on this sheet read `TERMINAL` and every one of them has its
net name in a neighbouring box, already read.

### 16. `C0001`'s box stops where the wire crosses another. Do we need a more precise way to define runs? Is that D, G or E?

**Yes to precision, and yes — it is Phase D, which is the session you have queued next.** Two separate
things are going on and both are already handled by the plan.

**The box.** Fact 4: the ring is `min/max` over the run's **two endpoints**, because `ink.py`
deliberately does not load `points`. Fifty of the 149 conductors are multi-segment, up to five
segments — the plan calls `C0008` *"a real 4-corner orthogonal route"*. **The corners are in the file
and always were.** Phase D builds the machinery that draws a polyline on the sheet (`paintRuns`);
Phase E is what loads the conductor `points` and lets you pick one.

**The stop at the crossover.** That is not a defect either, and I measured it. `C0001` ends at
`(728.42, 83.67)`; `C0002`'s third vertex is `(763.20, 83.67)` running to `(748.38, 83.67)`. Between
`728.42` and `748.38`, at the same y, there is a ~20 pt gap. **That gap is the hop arc** — the
semicircle the drawing puts where a horizontal run crosses a vertical trunk, meaning *no connection*.
`EXTRACTION_NOTES.md` correction 5 calls this *"the single most important thing a vision pass has to
catch here"*, and there are 88 of them.

So the extractor splits a conductor at every hop, on purpose, and the plan's schema is built for it:

> **`path`** — `runs` is a **list of polylines**, not one, because a crossover hop is a real gap in
> the ink and a path spanning two conductors should show the gap rather than close it.

And Phase E's editor gives you *"multi-select to assemble a path from several conductors across a
hop"*. Your `C0001` and `C0002` are precisely the case that shape was designed for: one physical wire
run, two conductor records, joined by you in Session 6, drawn with the hop visible.

**Nothing to add to the plan.** This question is answered by Sessions 5 and 6 as written.

### 17. `C0002`'s box covers a huge area and many runs. Does D, G or E fix it?

**Yes — same answer, and your instinct that something is wrong is right; it is just wrong in the
viewer rather than in the data.**

```
C0002  points  [954.38, 298.66] → [763.20, 298.66] → [763.20, 83.67] → [748.38, 83.67]
       endpoints              [954.38, 298.66]      and      [748.38, 83.67]
       ring drawn = the 206 × 215 pt box round those two
```

The ink is a thin three-segment L; the ring is the rectangle it fits inside. Every crossing run you
see inside that rectangle is unrelated to `C0002`.

**On the sheet, after Phase D, you will see the L** — for any wire whose `path` has been authored
from those runs. `paintRuns` in `paint.ts`, routed through the same `tileDestRect` arithmetic as
`pointToCss` so the stroke can never disagree with the tiles, drawn under the DOM markers in the same
rAF pass. (Session 5 ships no path editor, so the way to see one is the worked hand-edit its lesson
document is required to include.)

**On the Review tab the ring stays a box until Phase E**, and that is item 5 of the small batch in
the plan's §13. `ink.py` gains the conductor `points` when `/api/conductors` needs them — its own
docstring says *"it adds them **here**, named, behind the same cache"* — and that is Phase E. Phase D
reads authored paths out of `locations.json` and never opens the ink loader, so there is nothing to
reuse in Session 5.

**And a correction to note about this row specifically:** `C0002` read `OV.` — the slashed zero plus
a trailing ink speck, which the plan's §2 table lists by name as *"`130.`, `OV.` → `130`, `0V` —
trailing ink taken for a full stop"*. It is currently marked *not a label*; it should read `0V`. It is
in the §2 table above.

### 18. `T0338` was "nothing read" and is really net label `110`. There was no way to say it is a net label

**This is the most consequential question in the list, and the answer is: the correction you made is
right, it does not reach the run, and the run itself is the row to correct.** It is also the general
answer to question 6.

The geometry, measured:

```
T0330  '110'   bbox [743.8, 478.0, 749.5, 482.1]   → bound to C0098 (y 483.58)   ✔ has a source
T0338  ''      bbox [743.8, 494.5, 749.5, 498.6]   → bound to nothing
C0059  net_label: None, spec BLUE 16AWG, y 499.59, x 445.4 → 779.8, label_ids ['T0340']
T0353  '110'   bbox [743.8, 525.5, 749.5, 529.6]   → bound to C0111 (y 530.4)    ✔ has a source
```

A column of `110` net labels at x ≈ 746, each sitting ~4 pt above its run. The one at y ≈ 496 came
back blank, and the run 3 pt below it — `C0059`, a real BLUE 16AWG conductor 334 pt long — is one of
the 79 with no net name bound. **`T0338` is `C0059`'s missing `110`.** You read it right.

Now the mechanism. `conductors_of(label_id)` requires `label_id in conductor.label_ids` — the
binding is made at extraction time, and a blank label was never bound to anything. So typing `110`
into `T0338` fixes the row and reaches **no run**, forever. There is no `kind` you could set that
would change that; it is not a classification problem, it is a missing edge.

**But the system already has the answer, and it is the second half of Session 4's design:**

> A correction on the run itself still wins, and **is the only thing available for the 79 runs with
> no name bound at all** — which is more than the 30 misreads.

So: **find `C0059` in the queue and type `110` into it.** That is one row, it goes straight into
`corrected_text()`, and Session 6's matcher reads it. Your correction on `T0338` is still worth
keeping — it records that a person read the paper at that spot — but `C0059` is the row that does
work.

**And that is the general shape of the answer to question 6.** Where a box being wrong means a
reading is missing, the repair is *not* to move the box; it is to correct the **run**, which you can
already do, and which is strictly better because it says the thing the matcher needs in the place the
matcher looks. This is exactly why marking runs *not a label* costs so much: it is the one row type
where your keystrokes have leverage.

There are **113 runs** with no net name right now (79 originally + the 34 the review run removed).
Working the run rows is the highest-value thing left on this screen by a wide margin.

### 19. Many "nothing read" items I marked *not a label* were symbols. Do we need a way to describe them?

**Not for the model, and not for Phase E — but there is a real idea in here, and it is bigger than
this screen.**

What symbol recognition would buy, and who wants it:

- **The model:** nothing. The 47 components are already classed (`relay`, `push_button`,
  `circuit_breaker`, `connector_receptacle`, `cable_plug`, …) with ratings, function, `normal_state`
  and `power_domain`. A symbol identification on this sheet is a fact already known in better words.
- **Phase E:** nothing. Its ranking is net name, spec, endpoint bindings, length.
- **The simulator on the roadmap** (`webui_ideas.md` §3): also nothing — the boolean network is
  solved from the netlist, and the plan §5 is explicit that *"paths are display geometry"*.
- **Drawing number two:** *this* is where symbol recognition would pay. A symbol library that can
  propose *"that is a normally-closed contact"* is how the vision pass gets cheaper on the next
  sheet, and it is the same argument as question 10's lexicon.

So the honest place for it is not a category on the Review tab; it is a line in `webui_ideas.md`
under "what would make drawing two cheaper than drawing one", beside the lexicon feedback. **The
Review tab's job is one sentence — *what does the ink say here* — and a screen that also classifies
symbols is a different screen.**

For now, *not a label* on a symbol fragment is exactly right and it is what those rows mean.

### 20. `T0412` correctly boxes an entire note but was "nothing read". Does it matter?

`T0412` is `[945.1, 582.2, 1175.1, 625.1]` — 230 × 43 pt, `ocr_status: "skipped_graphic"`,
`orientation: "graphic"`. The extractor did not fail to read it; it **declined** to, because
`ocr_lines()` treats a region of that shape as artwork rather than text.

**Does it matter?** Not for anything in the current plan — it is bound to no conductor and carries no
net name. But it is the one row on your list where content might genuinely be absent rather than
duplicated, because the notes on a schematic carry installation instructions that no netlist
represents. `circuit_logic.json` has a `notes` array, and `EXTRACTION_NOTES.md` records that the
vision pass read the sheet's notes; the note at (945, 582) is very likely already among them, but
that is the one thing in this document I have *not* verified box-for-box.

**What I would do:** zoom to that box on the Review tab, read the note off the paper, and if it says
something the netlist's `notes` do not, tell me and I will put it in `author_circuit_logic.py` where
notes belong. Typing 230 pt of prose into a one-line correction box is the wrong home for it — the
Review tab records net names and short strings, not paragraphs.

### 21. `C0086` is a vertical box over all the terminals of the left 24E-1 block, marked *not a label*

**This one is a find, and it is not a box artefact at all. `C0086` is the 24E-1 bus itself.**

```
C0086   [61.31, 168.07] → [61.31, 695.56]   527 pt, one segment, no net_label, no spec
        endpoint 0 binds to symbol S0016 (terminal_point) at 1.71 pt

locations.json, placed by you:
  TB-24E1-A:1  [61.5, 166.4]      TB-24E1-A:5  [61.2, 414.4]
  TB-24E1-A:2  [61.3, 182.9]      TB-24E1-A:6  [61.3, 497.1]
  TB-24E1-A:3  [61.4, 199.6]      TB-24E1-A:7  [61.5, 679.0]
  TB-24E1-A:4  [61.5, 298.6]      TB-24E1-A:8  [61.3, 695.5]
```

The conductor runs from `TB-24E1-A:1` to `TB-24E1-A:8` and passes through all eight — it is the
vertical trunk that makes the left-hand 24E-1 block one net. `24E-1` is the whole DC bus
(`EXTRACTION_NOTES.md`: *"24VDC → PS1:+ → CB2 (20A) → net `24E-1`, the whole DC bus"*) with **25
member terminals**, the largest net on the sheet.

Your reading of it as *a box over the terminals* is exactly right and I would have read it the same
way — a 527 pt sliver over a column of terminals looks like a bounding box because it is drawn like
one. It is a conductor.

**What to do:** `C0086` is currently the one item in your list with no decision at all. Type `24E-1`
into it and press `Enter`. Ten of the 149 runs read `24E-1` originally and five still do after the
review run; this is the one that ties the block together, and it is a run Session 6 will want.

**And take the general lesson from it:** on a run row, *not a label* is a claim about the paper — *no
net name is printed on this run*. It is not a bookmark. Question 23 is where the bookmark lives.

### 22. `C0107` boxes a normally-closed contact but misses terminals 11, 14 and the name `CR-BP`

**The box is not around the contact — `C0107` *is* a stroke of the contact symbol, mistaken for a
conductor.**

```
C0107   [717.93, 525.93] → [711.41, 534.54]     length 10.8 pt, diagonal
        endpoint 0: no symbol; nearest label T0349 'CR-BP' at 7.03 pt
        flagged: missing net_label, spec_label, unbound_endpoints:[1]
```

A 10.8 pt **diagonal** on an orthogonal schematic is not wiring. It is the slanted bar of the contact
symbol, picked up by `trace_conductors` because it is a short stroke like any other. That is why it
has no net name, no spec and a loose end — all three, which is what got it onto the review queue.

**Does it matter?** No, and pleasingly it matters in the *right direction*: a false conductor that
Session 6 might otherwise offer as a candidate is one you have marked as carrying no net name, which
is true and which will keep it out of the ranking. Your *not a label* on this row is correct — this
is the one conductor in the 36 where the decision was right for the right reason, and I would leave
it exactly as it is.

**And the contact itself is fully recorded:** `CR-BP` is a component with three drawn sites (its NC
and NO contacts are in different circuits — that is why it has sites at all), its terminals `11`/`14`
are in the 131, and `COIL_CONTROLS_CONTACT` is one of the authored relationships that the netlist
carries precisely because it is not derivable from connectivity.

If you find more short diagonals flagged this way, treat them the same. A quick census of *runs under
15 pt with no net name and no spec* would tell us how many symbol strokes are in the conductor list;
say the word and I will count them in a one-liner, but I do not think the number changes anything.

### 23. Could I put an asterisk in the text box and describe the problem there?

**Please do not put it in the text box — but the field you want exists, and it is one line of UI
away.**

The text box is a claim about the ink: *this is what the paper says here*. `corrected_text()` feeds
Session 6's matcher from it, and it filters on truthiness — so `* box is wrong` would go into the
matcher as a printed net name and would be compared against wire net ids. It would also be indelible
in a way the rest of the file is not: `""` is refused **by name** for exactly this reason, because
one string cannot carry two different claims.

**`note` already exists.** It is in the schema, it is parsed, it is validated, and the client
deliberately preserves it through an edit:

```ts
// Carried through rather than dropped: this server does not write a `note`, and a
// hand-written one is the only kind there is.
if (typeof previous?.note === 'string') correction.note = previous.note
```

```json
"T0104": { "text": null, "was": "YY", "note": "not a net label", "by": "js", "at": "…" }
```

So today a note can only get in by hand-editing the file with the server stopped — which works, and
which the plan already asks you to do once in Session 5, but which is not a workflow.

**What I would build, and it is small:** a second, wider input on each row, placed under the reading,
that writes `note`. It needs no schema change (schema stays 1), no new validator (`note` is already
checked as an optional string), and no migration. Rows with a note get a mark so they can be found,
and the `not a label` scope from question 11 gives you the second way back to them. That is perhaps
an hour, and it turns *not a label* back into what it should be — a claim about the paper — by
giving the bookmark somewhere honest to live.

**I would do this at the head of a later session rather than now**, because Session 5 is Phases D and
G and the plan is explicit that a session builds its phase and stops.

---

## 4. What I would actually do, in order

*Status added 2026-09-02, after you asked for 1, 2, 5 and 6 and for the census in §5.*

1. ~~**Put the 29 run net names back**~~ — **done.** §2 has the outcome: 24 of 26 nets matched.
2. ~~**Type `24E-1` into `C0086`** and `110` into `C0059`~~ — **done**, in the same batch.
3. **Commit `label_corrections.json`.** **Yours, and only yours** — 654 entries in the working tree
   against 90 in git. It is authored content git cannot regenerate, and it is now the only
   uncommitted thing in the extraction directory.
4. **Then Session 5 — Phases D and G**, as `claude_next_phase.md` has it queued. That is what fixes
   questions 16 and 17, by building the thing they are asking for.
5. ~~**Small items for a later sitting, in one batch**~~ — **recorded**, 2026-09-02, in
   `highlighting_wires_and_nets.md` §13 as **"Between Sessions 5 and 6 — the small batch"**, with the
   file and symbol for each and the reasoning for why it goes before Phase E rather than after. Six
   items now rather than five: the fifth is *frame a run with its polyline instead of the box round
   its endpoints*, and it belongs with **Phase E** rather than Phase D — `ink.py` gains the conductor
   `points` when `/api/conductors` needs them, and Phase D reads authored paths out of
   `locations.json` without opening the ink loader at all.
   The four rejected ideas from this document are recorded beside them, struck through with reasons,
   so they do not creep back. The plan's opening progress note points at both.
6. ~~**For the roadmap**~~ — **written**, 2026-09-02, into `webui_ideas.md` §6 *Ingest and correct*:
   **"Feed the corrections back into the extractor's lexicon"** and **"A symbol library, so the vision
   pass gets cheaper each sheet"**, both gated on drawing number two and both carrying the
   *proposals, never findings* discipline. The existing *A review-queue UI* entry is marked built and
   worked through, with the 17 → 24 number on it.
7. **Four more runs from §5's census — three written 2026-09-02, one refused.**

   You asked me to write these if I judged they would help. Before writing I checked each against
   evidence the census had not used: **do the run's own endpoints land on terminals that are members
   of the net I would be claiming?** Three passed and one failed, which is the reason the check was
   worth running rather than a formality.

   | Run | Spec | Endpoint 0 | Endpoint 1 | Verdict |
   |---|---|---|---|---|
   | `C0054` | BLACK 22AWG | `PB1:4` @ 13.6 pt ✔ | `CR1:A1` @ 4.4 pt ✔ | **written `PB1`** |
   | `C0114` | GREEN 16AWG | `TB-0V:10` @ 0.2 pt ✔ | `INFEED1:2` @ 1.0 pt ✔ | **written `0V`** |
   | `C0034` | BLACK 10AWG | `PLG2:B` @ 1.5 pt ✔ | `TB-L1:1` @ 1.8 pt ✔ | **written `L1`** |
   | `C0115` | BLUE 16AWG | `INFEED1:1` @ **71 pt** ✘ | same point as endpoint 0 ✘ | **refused** |

   ✔ = a member terminal of the claimed net. The three that passed each match a specific wire as
   well: `C0054` is `W040` (`PB1:4 → CR1:A1`, the only wire on that net), `C0114` matches
   `W062`/`W067` (the green 16AWG 0V conductors of the two interface cables), `C0034` is `W004`
   (`PLG2:B → TB-L1:1`).

   **`C0115` is not a conductor at all.** Its two endpoints are 0.4 pt apart and it is a
   75.6 × 105.8 pt rectangle — **the outline of the INFEED1 connector box**, enclosing the whole
   six-way legend (`0V`/`GREEN 16AWG`, `120.`/`RED 16AWG`, `130`/`ORANGE 16AWG`, `TINSP1`/`BLACK
   16AWG`, `TINSP2`/`WHITE 16AWG`). Its `BLUE 16AWG` spec is a false binding to `T0357` *inside* the
   box, and the blank `T0351` the census matched at 3.5 pt is the legend's own `110`, printed inside
   the table rather than beside a run. **You had already marked it *not a label*, and that is
   correct** — as is your `C0116`, the sheet's only other closed loop. Naming it would have handed
   Phase E a box outline as a candidate net-110 conductor, which is precisely the *"a wrong line is
   worse than no line"* failure §3 of the plan exists to forbid.

   `C0054` is the one that moves something: the ink 3.8 pt away reads `PB1`, not the `PBL` the
   extractor bound. With `PB2` already printed on a run, **both `NET-PB1` and `NET-PB2` now have a
   printed conductor waiting under their sheet names**, so `K10` is the only thing between the
   matcher and **26 of 26**.

   `C0086`, written earlier in the day, was re-checked against the same failure mode and holds: one
   segment, no second parallel edge, all eight `TB-24E1-A` points within 0.19 pt of its x and all
   eight members of net `24E-1` — and the block's outline is recorded separately in `boxes` at
   `[50.7, 155.7, 70.8, 700.8]`, so `C0086` is the bus running down the middle of it.

**What I would not build:** a bounding-box editor (question 6), a `kind` editor (Fact 3), a symbol
classifier on this screen (question 19), or a "needs repair" category (question 11).

---

## 5. What I did not verify

Said plainly, so nobody treats this document as more certain than it is:

Three of the four items here were settled on 2026-09-02 by the census you asked for. They are struck
through rather than deleted, so the reasoning stays traceable.

- ~~**Whether every one of the 84 blank labels sits over a real reading**~~ — **run.** See below.
- ~~**`C0054`'s `PBL`**~~ — **settled by the census.** The ink 3.8 pt from that run is `T0214`,
  reading `PB1`. I still have not put the ring on it and looked, and it is one of the four rows in
  §4 item 7 that are yours to press rather than mine to write.
- ~~**How many of the 149 conductors are symbol strokes rather than wiring**~~ (question 22) —
  **46 are under 15 pt**, and 78 of the 82 unnamed runs carry no colour or gauge at all. It changes
  nothing, exactly as I guessed, but it is now a number rather than a guess.

### The census — blank labels sitting over unnamed runs

The first pass looked alarming and was mostly noise: **35** of the 82 still-unnamed runs have a blank
label within 10 pt. But almost all of those blanks were ones you had already decided about, and the
few carrying a correction carried things like `11` and `B` — terminal and plug-pin markings, not net
names, because a blank *near* a run is not the same as a blank *belonging to* one.

The second pass is the one that matters. **Split the 82 unnamed runs by whether they carry a
`spec_label`** — a colour and gauge printed beside them — because that is what separates a real wire
run from a symbol stroke the tracer picked up:

```
runs with no net name                                   82
  ...carrying a spec (a real wire run)                   4
  ...carrying nothing at all                            78
  ...shorter than 15 pt (symbol strokes, like C0107)    46
```

**Four.** And every one of the four has its net name printed within 4 pt — they are the table in §4
item 7. So the honest summary is:

- **`T0338`/`C0059` was not the tip of an iceberg.** It was one of five, and four of the five are now
  identified by name with the evidence beside them.
- **78 of the 82 unnamed runs carry nothing at all, and 46 are under 15 pt.** Those are the class
  `C0107` belongs to — symbol strokes that `trace_conductors` collected because they are short
  strokes like any other. They have no net name because they are not wiring, and *not a label* is the
  true answer for them. This also retires my own open item about censusing them: the number is 46 and
  it changes nothing, exactly as I guessed.
- **After the four, this seam is exhausted.** There is nothing further to be had from the review
  screen for Phase E; what is left is `K10` and the path editor itself.

### Still not verified

- **The note in `T0412`** (question 20). I confirmed the box, the `skipped_graphic` status, and that
  `circuit_logic.json` has a `notes` array; I did not read the note off the tiles and compare it
  line by line. That one needs your eyes on the paper, and it is the only place in these 23 questions
  where content might genuinely be absent rather than duplicated.
