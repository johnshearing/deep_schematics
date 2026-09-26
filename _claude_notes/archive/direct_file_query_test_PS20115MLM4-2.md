# Test Report: Answering Schematic Questions Directly from the Extraction Artifacts

> **What this document is.** A record of a single test session in which Claude Code answered
> questions about schematic `PS20115MLM4-2` by reading the extraction artifacts directly
> from disk, rather than by querying the LightRAG index through the WebUI. It records the
> motivation, the exact questions asked, the answers given, how each answer was sourced,
> and what the result implies for the schematic-indexing project.

- **Date of test:** 2026-07-29
- **Report written:** 2026-07-30
- **Model under test:** Claude Opus 5 (1M context), via Claude Code CLI
- **Baseline being compared against:** `LLM_MODEL=gpt-4o` querying the LightRAG index via the
  LightRAG WebUI
- **Drawing:** [`PS20115MLM4-2`](https://drive.google.com/file/d/11AbsbKrrYsQ-D_L8lSkdP-A73NAX7YfZ/view?usp=sharing) — Mod-Linx Power Supply Assembly, Master, 4 Drive Cards
- **Related planning document:** [`schematic_indexing_plan.md`](schematic_indexing_plan.md)

---

## 1. Motivation

The motivation was stated by John in `/home/js/LightRAG-Dev/jrs/claude.md`, reproduced here
verbatim:

> Please read /home/js/LightRAG-Dev/jrs/schematic_skills/SKILL.md
> Please read /home/js/LightRAG-Dev/jrs/work/mod_linx/schematic_extraction/PS20115MLM4-2/EXTRACTION_NOTES.md
>
> I had asked you in a previous session to create the skill found at the following:
> /home/js/LightRAG-Dev/jrs/schematic_skills
>
> Then I asked you to use that skill to create the following json representation of the following schematic:
> /home/js/LightRAG-Dev/jrs/work/mod_linx/schematic_extraction/PS20115MLM4-2/custom_kg.json
> /home/js/LightRAG-Dev/jrs/work/mod_linx/mod_linx_data/PS20115MLM4-2.pdf
>
> The json file (custom_kg.json) was indexed by LightRAG and I queried that index using
> LLM_MODEL=gpt-4o via the LightRAG WebUI.
> With this method it was possible to get answers to simple questions like how many wires
> are found in Net 110.
> But more complex questions involving troubleshooting where answered incorrectly.
> So now I am wondering if you would be able to answer both the simple questions and the
> more complex troublshooting questions better than gpt-4o using the LightRAG WebUI.
>
> Please answer my questions and tell me which of the files found in
> /home/js/LightRAG-Dev/jrs/work/mod_linx/schematic_extraction/PS20115MLM4-2 you are using
> to source the answers.

In short: the extraction pipeline is producing artifacts that are good enough for *simple
lookup* questions through the RAG path, but *troubleshooting* questions were coming back
wrong. The open question was whether the fault lies in the artifacts (bad data) or in the
retrieval/reasoning path (good data, insufficient reasoning over it).

---

## 2. Test Setup

### Artifacts available to the model

Everything in
`/home/js/LightRAG-Dev/jrs/work/mod_linx/schematic_extraction/PS20115MLM4-2/`:

| File | Size | Role |
|---|---|---|
| `geometry.json` | 620 KB | Deterministic vector/label extraction from the PDF |
| `tiles/` | — | 16 overlapping 400 DPI annotated renders |
| `author_circuit_logic.py` | 56 KB | Human-read tables + derivation of mechanical edges |
| `circuit_logic.json` | 192 KB | Master artifact: 47 components, 131 terminals, 26 nets, 71 wires, 402 edges |
| `custom_kg.json` | 479 KB | LightRAG custom KG: 693 chunks, 291 entities, 402 relationships |
| `EXTRACTION_NOTES.md` | 6.5 KB | Audit trail, corrections, and a prose "How the circuit actually works" section |

### Method

Direct file access. The model read `SKILL.md` and `EXTRACTION_NOTES.md` for orientation,
then queried `circuit_logic.json` and `custom_kg.json` with small `python3 -c` scripts to
pull the specific nets, wires, components and relationships relevant to each question.

**No LightRAG query was issued.** No vector search, no embedding retrieval, no chunk
ranking. This is the key methodological difference from the gpt-4o/WebUI baseline, and it is
what the results below have to be interpreted against.

---

## 3. Question 1 — Simple Lookup

> **Q:** Please tell me how many wires are found in Net 110.

### Answer given

**4 wires.**

| Wire | Color / Gauge | From | To | Cable |
|---|---|---|---|---|
| W047 | BLUE 18AWG | CR-ON:A2 (ON relay coil return) | TB-110:3 | — |
| W058 | BLUE 18AWG | CR-SW:14 (N.O. contact) | TB-110:1 | — |
| W059 | BLUE 16AWG | INFEED1:1 (infeed interface) | TB-110:2 | CABLE-INFEED1 |
| W060 | BLUE 18AWG | CR-BP:12 (N.C. contact) | TB-110:4 | — |

All four land on terminal block TB-110, which is what makes the net electrically common. The
net spans **8 terminals**: CR-BP:12, CR-ON:A2, CR-SW:14, INFEED1:1, and TB-110:1–4.
Functionally, 110 is the start/stop signal net shared between machines at 24VDC; pulling it
to 0V energizes the CR-ON coil and runs the machine.

### Sourcing

- **`circuit_logic.json`** (primary) — filtered the `wires` table on `net == "110"`, yielding
  exactly 4 of 71 total wires. The `nets` entry for `"110"` supplied the member-terminal list
  and the description.
- **`custom_kg.json`** (cross-check) — confirmed entities W047/W058/W059/W060 exist with
  matching endpoints, and that the `110` net entity carries the same 8 terminals. This is the
  file that was indexed into LightRAG, so it verifies the graph John queried holds the same
  facts.

### Verdict

**Correct**, confirmed by John. Not a discriminating test — the WebUI/gpt-4o path also gets
this one right. Its value is as a control: it establishes that the artifacts contain the
right data and that the RAG path can retrieve it.

### Note on the failure mode this question invites

The answer is **4 wires but 8 terminals**. A model that conflates the two — or that counts
`ON_NET` edges instead of wire entities — produces a plausible wrong number. Worth keeping in
mind when interpreting any future wrong answer from the RAG path on this class of question.

---

## 4. Question 2 — Troubleshooting

> **Q:** I am reading 24 volts on Net 125. Both push buttons are green and BYPASS-CB is in
> the closed position but the machine is not running. What should I suspect is the issue?

### Answer given

**Diagnosis: the CR-BP coil is not energized, and the open circuit is on the 0V return side
of that coil.**

Net 125 is a two-terminal net — CR-BP:A2 and BYPASS-CB:2, joined by wire W048 (BLUE 18AWG).
The other end of the CR-BP coil, A1, is permanently tied to the 24E-1 bus by W025. Reading
24V at net 125 therefore means no current is flowing through the coil.

Two corollaries:

1. **The CR-BP coil itself is almost certainly good.** The 24V is being read *through* the
   winding. An open coil would leave net 125 pulled to 0V via the closed bypass path, not
   sitting at 24V.
2. **This fully explains "not running."** With CR-BP dropped out, its N.O. contact 21-24
   never closes, so the RUN net gets nothing from W055. The only other source for RUN is
   CR-ON:11-14, and CR-ON energizes only when net 110 is pulled to 0V — by CR-SW (whose coil
   return, net 130, completes *only* through the downstream machine) or by an upstream
   infeed machine. On this master sheet the bypass path is the machine's own way to run.

**The return chain — exactly one element of this is open:**

```
CR-BP:A2 ──W048── BYPASS-CB:2 ─[switch]─ BYPASS-CB:1 ──W053── TB-120:3
   TB-120 ──W052── CR2:14 ─[N.O.]─ CR2:11 ──W051── CR1:14 ─[N.O.]─ CR1:11 ──W050── TB-0V:10
```

**Ranked suspects:**

1. **One of the two series N.O. contacts, CR1:11-14 or CR2:11-14, is not making.** These two
   contacts in series are the entire start/stop permissive. Critically: "both push buttons
   are green" does *not* clear them. PB1/PB2 are lighted selectors whose lamps run off
   terminal 1 (24E-1) and terminal 3 (0V) — permanently powered, independent of the load
   path. Green proves the mechanism is in the closed position; it does not prove terminal 4
   is passing 24V out on W040/W043 to the CR1/CR2 coils, and it does not prove the relay
   contacts are making.
2. **BYPASS-CB is closed but not conducting.** Position is not continuity, and this "breaker"
   is being used as a manual switch, so it sees far more operating cycles than a protective
   device ever would.
3. **A broken conductor or loose landing** in W048 / W053 / W052 / W051 / W050, or at TB-120.

**Three-probe isolation procedure** (black lead on TB-0V throughout):

1. **Probe TB-120.** 0V → chain back to 0V is intact, open is between 120 and 125, i.e.
   BYPASS-CB or W053/W048. 24V → open is further back; go to 2.
2. **Probe net 121 (at CR2:11 or CR1:14).** 0V → CR1's contact is making, so CR2:11-14 is
   open (or W052 broken). 24V → CR1:11-14 is open, or the 0V return W050 to CR1:11 is broken;
   probe CR1:11 directly — if not at 0V, the fault is W050/TB-0V:10, not the relay.
3. **Confirm the suspect relay is picking up.** Measure its A1 (should be 24V from PB:4 via
   W040/W043, with A2 at 0V via W045/W046). A1 at 24V but no pull-in → failed coil/relay.
   A1 at 0V → the push button's load contact or its wire is at fault, despite the green lamp.

**Method caveat given:** a high-impedance DMM reads source voltage through a coil across any
open, so the 24V at 125 establishes *that* there is an open, not *where*.

### Sourcing

All from
`/home/js/LightRAG-Dev/jrs/work/mod_linx/schematic_extraction/PS20115MLM4-2/`:

- **`circuit_logic.json`** — used four ways:
  - `nets` table for the membership of 125 (`BYPASS-CB:2`, `CR-BP:A2`), 120, 121 and `0V`;
  - `wires` table for the specific wire IDs, colors and gauges along the return chain
    (W025, W040, W043, W045, W046, W048, W050–W053, W055);
  - `components` table for the `function` text on CR-BP, CR1, CR2, CR-ON, CR-SW, BYPASS-CB
    and PB1/PB2 — including that BYPASS-CB is a breaker used as a manual switch, and that
    the PB lamps are fed from terminals 1 and 3;
  - `relationships` for the `COIL_CONTROLS_CONTACT` edges tying the CR-BP coil to contacts
    21-24 and 11-12.
- **`EXTRACTION_NOTES.md`** — the "How the circuit actually works" section confirmed the
  series CR1→CR2 permissive topology and, critically, that CR-SW's return (net 130) completes
  only through the downstream machine. That is what rules out CR-ON as an alternative run
  source and makes the bypass path the only suspect.

Not needed: `geometry.json`, `custom_kg.json`, the tiles, or any LightRAG query.

### Verdict

**Correct**, confirmed by John: *"That was a complete success."*

---

## 5. Analysis

### The artifacts are not the problem

Both answers came out of `circuit_logic.json` plus `EXTRACTION_NOTES.md` with no recourse to
the PDF, the tiles, or `geometry.json`. Every fact the troubleshooting answer depends on —
net membership, wire endpoints, relay contact designations, the coil-to-contact mapping, the
"breaker used as a switch" domain correction, and the fact that net 130 completes only
off-sheet — was already present and correct in the extracted data.

This is the main finding. **The extraction pipeline described in `schematic_skills/SKILL.md`
is producing data of sufficient quality to support real troubleshooting.** Whatever went
wrong with the gpt-4o/WebUI answers, it was not missing or wrong data.

### Why the troubleshooting question is hard in a way the lookup question is not

Question 1 is a **retrieval** problem: find the wire records whose `net` field is `110` and
count them. A single well-matched chunk answers it.

Question 2 is a **chain-of-inference** problem. Producing the right answer required, in
sequence:

1. Recognizing that net 125 has only two members, one of which is a *coil terminal*.
2. Applying the electrical principle that a voltmeter reads source voltage *across an open* —
   which is domain knowledge, not on the drawing.
3. Inverting that to conclude the coil is intact but its return is broken.
4. Walking a ten-element series path across four nets (125 → 120 → 121 → 0V) and three
   relays to enumerate every candidate.
5. Checking the *alternative* run path (CR-ON) and eliminating it using a fact from a
   different part of the drawing entirely (net 130 completes only through the downstream
   machine) — thereby explaining why the symptom is total, not partial.
6. Noticing that the operator's stated evidence ("both push buttons are green") is *weaker
   than it appears*, because the lamp circuit is wired independently of the load contact.

Steps 4–6 are where a RAG path is structurally disadvantaged. Steps 4 and 5 require holding
several nets, three relays and two candidate run paths in view **simultaneously** — but
retrieval returns a ranked list of chunks scored against the *query*, and the query mentions
net 125, the push buttons and BYPASS-CB. It does not mention net 121, CR1, CR2, net 130 or
CR-SW. Those are precisely the entities needed to solve it, and precisely the ones least
likely to rank highly. Step 6 requires *disbelieving* a premise the user supplied, which is
against the grain of a system optimized to answer the question as asked.

### The likely shape of the gpt-4o failure

Not verified in this session — stated as a hypothesis for a future controlled comparison.
The expected failure mode is that hybrid-mode retrieval surfaces the right *local* facts and
the model stops at "CR-BP is not energized," or names BYPASS-CB alone as the culprit, without
walking the return path back through CR2 and CR1 and without questioning the push-button
evidence. That is a plausible, partially-correct, and operationally useless answer — which
matches John's description of the troubleshooting answers being "incorrect."

### What this test does and does not establish

**Establishes:**

- The `circuit_logic.json` produced for PS20115MLM4-2 is accurate and complete enough for
  non-trivial troubleshooting.
- A model with unrestricted access to that file can perform multi-hop electrical fault
  isolation on it correctly.

**Does not establish:**

- That Claude Opus 5 would outperform gpt-4o *through the LightRAG WebUI*, on equal footing.
  That comparison was not run. The two paths differed in **model** *and* in **access method**,
  and the access method is very likely the dominant variable.
- Which specific retrieval behavior caused the original wrong answers.

---

## 6. Implications and Suggested Next Steps

1. **Run the controlled comparison.** Ask this exact net-125 question through the LightRAG
   WebUI in `hybrid` mode, once with gpt-4o and once with a Claude model, and record both
   answers verbatim. That isolates model-vs-retrieval as the cause. Until then the
   attribution is open.

2. **Consider whether the RAG path is the right tool for troubleshooting queries.** For a
   schematic, `circuit_logic.json` is small (192 KB) and fully structured. Handing the whole
   file to a long-context model is cheap, deterministic, and — as this test shows — works.
   Retrieval exists to solve a scale problem this artifact does not have. A hybrid design is
   plausible: RAG over the *manuals*, direct file access over the *netlist*.

3. **If the RAG path is kept, the retrieval unit may be wrong.** The chunks are per-entity.
   Solving net-125 required assembling roughly a dozen entities spread across the sheet.
   Consider emitting additional *path-level* or *subsystem-level* chunks — e.g. one chunk per
   control loop ("the start/stop permissive chain: 0V → CR1:11-14 → 121 → CR2:11-14 → 120 →
   BYPASS-CB → 125 → CR-BP coil → 24E-1") — so that a single retrieval hit carries the whole
   series path rather than one node of it. This is an addition to the `build_kg.py` step,
   derivable mechanically from the netlist.

4. **Add both questions to the regression set** in `schematic_indexing_plan.md` §8.1, with
   the answers above as ground truth. Question 2 in particular is a good discriminator: it
   has a single correct diagnosis, a checkable suspect ranking, and a documented trap (the
   green push-button lamps).

---

## 7. Appendix — Ground Truth for Regression Testing

**Q:** How many wires are in Net 110?
**A:** 4 — W047, W058, W059, W060. (Distinct from the net's 8 *terminals*.)

**Q:** Reading 24V on Net 125; both push buttons green; BYPASS-CB closed; machine not
running. Suspect?
**A:** CR-BP coil not energized due to an open on its 0V return side. Prime suspect: CR1:11-14
or CR2:11-14 not making. Secondary: BYPASS-CB closed but not conducting. Tertiary: broken
conductor in W048/W053/W052/W051/W050 or a loose landing at TB-120. Must note that the green
push-button lamps do not clear CR1/CR2, because the lamp circuit (PB terminals 1 and 3) is
independent of the load contact (terminal 4). Must explain why no run at all — CR-ON is
unavailable because net 130 completes only through the downstream machine.
