# Funding / API Credit Application — Deep Schematics

*Draft answers written to be copy-pasted into an application form. Sections are labeled by
the question they answer, since different programs (Anthropic Startup Program, Claude for
Open Source, NLnet) phrase the same questions differently. Trim to fit whichever form you use.*

---

## Project name
Deep Schematics

## One-line description
An open-source system that turns an electrical schematic PDF into an auditable, queryable
netlist, then lets an AI answer troubleshooting questions in plain English — pointing to the
exact wire, terminal, or component on the actual drawing as it explains.

## Link
https://github.com/johnshearing/deep_schematics

---

## What are you building, and why?

Industrial controls electricians troubleshoot failures against paper or PDF schematics —
often hundreds of pages, for equipment that may be decades old, with the one person who
understood the system's quirks long retired. When something fails at 2 a.m. in a factory or
sort center, the bottleneck usually isn't skill, it's time spent tracing wires across sheets
by hand.

Deep Schematics converts a schematic PDF into a structured, human-audited netlist —
components, terminals, nets, wires, and the relationships between them — and then lets an AI
answer questions about the circuit *from that netlist*, not from re-reading the drawing every
time. Every component ID the AI cites in its answer is a clickable link that jumps to that
exact location on the rendered drawing, and every located component on the drawing can be
clicked to ask about it. The electrician gets an explanation and a pointer to look at, at the
same time, instead of a wall of text they have to re-translate onto the page themselves.

I looked for an existing system that does this combination and didn't find one. AI schematic
tools I found either (a) do one-shot design review for catching errors before manufacturing,
or (b) are generic vision-based diagram chatbots that re-interpret the image on every
question with no audit trail and no link back to a location on the drawing. Deep Schematics
is deterministic where it can be (the geometry is extracted from the PDF's vector layer by
script, not guessed by a model) and only asks an AI to interpret the parts that require
judgment (symbol meaning, label reading) — with a human reviewing that interpretation before
it becomes part of the permanent record. The AI that later answers questions is restricted to
`Read`, `Grep`, and `Glob` against that audited file — it cannot invent facts about the
circuit, and it cannot execute anything.

## Current status / proof it works

- The extraction pipeline is complete and has been run end-to-end on a real industrial
  drawing: 47 components, 131 terminals, 26 nets, 71 wires, 402 relationships extracted and
  human-audited.
- The query server and web UI are built and working: streaming, cited answers, click-to-locate
  on the drawing, a password gate, and a hardened permission model (verified with a canary
  test that the AI's sandbox can't reach files or tools outside the drawing directory).
- It passes a 6/6 acceptance test suite built from real troubleshooting questions, using
  Claude Sonnet, at $0.04–$0.12 per question.
- 46 automated tests on the server, 15 on the frontend (7 specifically covering XSS in the
  answer renderer).
- It is currently reachable on a local network for real-world testing.

## What you need funding/credits for

I've spent a little over $1,000 in Claude Code tokens on development so far. I expect to need
a few thousand dollars more in tokens to take the system from "works on one drawing I've
hand-audited" to "works on any schematic a controls electrician throws at it" — this means:

- Generalizing the extraction pipeline across different drawing styles, CAD tools, and
  conventions (the first drawing had no selectable text at all — every label had to be read
  visually — and I expect that kind of surprise to recur with other vendors' drawings).
- Indexing a library of schematics rather than a single drawing, so the system is useful
  across a whole facility, not one machine.
- Extending and re-running the acceptance test suite against the larger, more varied library
  to keep the audit trail meaningful as scope grows.

This is exploratory, iterative work — a lot of Claude Code sessions spent reading tiles,
writing and re-running extraction scripts, and correcting the audit trail — which is why the
token cost is the actual bottleneck on progress right now, not engineering time.

## Who this helps

Controls electricians and maintenance technicians in factories, warehouses, and sort centers
— anyone who has to troubleshoot industrial electrical systems against schematics they didn't
draw, for equipment that predates them. This isn't a guess at a market: I spent two years as
Lead Troubleshooter for Controls & Automation at an Amazon sort center, leading a controls
team through exactly this kind of troubleshooting, and I built a narrower, single-system
version of this idea (an AI expert trained on one conveyor's manual) while there. Deep
Schematics generalizes that into a pipeline that works from the schematic itself, for any
drawing. The pipeline and code are MIT licensed, so any electrician, integrator, or plant can
point it at their own drawings.

## Team / maintainer background

I'm an automation electrician, machinist, millwright, and welder with over a decade of hands-on
industrial troubleshooting experience, and — critically for this project — I've already built
and deployed the two halves of what Deep Schematics does, separately, in a live production
environment.

Most recently I was **Lead Troubleshooter for Controls & Automation at an Amazon sort center
(CDW5, via JLL, April 2020–April 2022)**, leading the controls team on electrical, electronic,
and software troubleshooting, and personally handling the site's AI, machine vision, and deep
learning work. There I:

- Developed a neural network that controlled the site's package sorting machines, and wrote
  the software that automatically collected and labeled its training images — eliminating the
  most labor-intensive part of training the model.
- Built and trained a machine-vision system that catches bunched-up packages on a conveyor
  (a condition standard industrial sensors can't detect) and diverts them before they cause a
  jam — demonstrated here: https://www.youtube.com/watch?v=1CsTgYwEgZ0 (0:00–1:13).
- Wrote a full troubleshooting manual for a complex conveyor system, then used it to build a
  Retrieval-Augmented-Generation AI expert that helps technicians troubleshoot that exact
  system — shown in the same video from 1:13 onward, with the code at
  https://github.com/johnshearing/LightRAG/blob/main/lightrag_webui/src/features/SanitizeData.tsx

In other words, "an AI expert that helps a technician troubleshoot a specific piece of factory
equipment from a grounded, human-written source document" is not a new idea for me — I built
one, on the job, at exactly the kind of facility (an Amazon sort center) that this proposal
names as a beneficiary. Deep Schematics is the next iteration of that same idea: instead of
one hand-written manual for one conveyor, a pipeline that can turn *any* schematic into that
kind of grounded source automatically.

Before Amazon, I spent years as a maintenance electrician and millwright at industrial
facilities — Bell Container (Newark, NJ, night-shift maintenance electrician, 2015–2019:
PLCs, VFDs, instrumentation, live 480VAC troubleshooting, electrical cabinet design and
build) and Silgan Containers (Edison, NJ, millwright/industrial electrician, 2014–2015). I
fabricate and wire electrical cabinets and program Allen Bradley PLCs and HMIs, and I've
completed Allen Bradley's PLC Fundamentals, Troubleshooting, and ControlLogix training
through Turtle & Hughes. That background is where the troubleshooting checklist and safety
material below came from — and where the eventual users of Deep Schematics will be standing.

I'm also an FAA Certified Ground Instructor with an advanced rating (Certificate #3665155),
which I mention because it reflects formal training and certification in teaching a subject
where lives are at stake — the same stakes apply to a technician troubleshooting a live
industrial electrical cabinet, which is exactly the situation Deep Schematics is meant to
support safely and accurately.

That domain background shows up directly in my open-source work:

- **[Control Technician's Troubleshooting Checklist](https://github.com/johnshearing/ControlTechniciansTroubleshootingCheckList)**
  and **[Electrical Safety Talk for Factory Electricians and Control Technicians](https://github.com/johnshearing/ElectricalSafety)**
  — written from my own troubleshooting experience, for the same audience Deep Schematics
  targets, and used to train my own controls technicians.
- **[Machine Control by Object Detection](https://github.com/johnshearing/MachineControlByObjectDetection)**
  — the object-detection and data-collection code behind the Amazon conveyor project above.
- **[Deep Avatar](https://github.com/johnshearing/deep_avatar)** — earlier work on getting an
  AI model to reason faithfully from a specific, grounded source rather than its own general
  knowledge, the same design principle behind Deep Schematics' audited-netlist approach.

On the open-source maintenance side: I maintain 34 public repositories, one of which
(**[PrivateKeyVault](https://github.com/johnshearing/PrivateKeyVault)**, an air-gapped
hardware wallet build) has 71 stars and 11 forks — real usage and community trust, not just a
personal archive. I mention that because Deep Schematics itself is young (0 stars) and I want
to be upfront that the low star count reflects the project's age, not my track record as a
maintainer who ships and supports working open-source tools.

## Anything else worth knowing

The repository is early — 0 stars, single maintainer — because it's young, not because it's
unused: the working demo, the audit trail, and the test suite are further along than the star
count suggests. Happy to walk through the live system or the acceptance report on request.

---

*Program-specific notes:*
- *For Anthropic Startup Program: emphasize the "novel product" framing above; mention no VC
  funding requirement applies to you if asked.*
- *For Claude for Open Source: emphasize maintainer status, MIT license, and the test suite as
  evidence of real, ongoing maintenance work.*
- *For NLnet: emphasize the deterministic/auditable design philosophy — they favor rigor and
  reproducibility over hype, and your "geometry.json vs circuit_logic.json" separation is a
  good fit for that framing.*
