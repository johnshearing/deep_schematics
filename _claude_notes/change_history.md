# Change history

What changed, when, and **why** — the reason being the part that is expensive to reconstruct
later. Newest first. One entry per working session, not per commit; `git log` already has the
commits.

Scope is the whole repository: the extraction skill, the server, the WebUI and these notes.
`webui_ideas.md` is the road map (where we are going), `webui_v1_plan.md` is the v1 design
(why the server looks the way it does), and this file is the record of what actually landed.

---

## 2026-08-11 — One way to the drawing, and it is a tile viewer we own

The sheet moved from a full-screen PDF overlay into a **Drawing tab** that renders the 16
extracted tiles under one pan-and-zoom transform. Two duplicate buttons became none: the tab
itself is the control.

### Why there were two buttons, and why the answer was zero

They looked identical and were not. `AskTab.tsx`'s prominent *Show the drawing* lived inside
`Intro`, which renders only while `messages.length === 0` — it vanished at the first question,
which is precisely when a reader wants the drawing. `DrawingPanel.tsx`'s small *Drawing* was
always there but easy to miss. Keeping the prominent one would have kept the one that
disappears; keeping the small one would have kept the one nobody sees.

A tab trigger is both: persistent and prominent, and it costs no extra control. So both
buttons are gone, along with the full-screen overlay they opened. In their place the intro
carries one sentence — *"The sheet itself is in the Drawing tab above"* — which is text, not a
third button, and it only appears when the tab does.

### Why not a new browser tab

This was the user's question and the instinct was right, though not for the stated reason.
Same-origin browser tabs **can** talk to each other — `window.open()` returns a handle, and
`postMessage`, `BroadcastChannel` and `localStorage` events all work between them. Messaging
was never the obstacle.

The obstacle is that in a new tab (and in the old iframe) the thing drawing the schematic is
the browser's own PDF viewer, which is opaque: no DOM, no coordinate system, nothing to draw
on, no way to ask it where `CR-BP` currently is. That rules out the three highest-ranked ideas
in `webui_ideas.md` §2 — bidirectional citation, net highlighting and the component overlay —
all of which require owning the rendering surface. Hence the tiles.

The raw PDF is still one click away, as a link in the Drawing tab toolbar, for the two jobs it
is genuinely better at: printing, and a second monitor.

### The coordinate system was already there

The data audit that decided the approach, because it made the viewer cheaper than the road map
assumed. Three artifacts, one coordinate space — **PDF points, top-left origin, 1224×792**:

| Source | What it holds |
|---|---|
| `tiles/tiles.json` | 16 tiles, 4×4, each with its `pdf_rect` |
| `circuit_logic.json` | `components[].location{x,y}` — populated for **47 of 47** |
| `geometry.json` | 149 conductor polylines, 515 label bboxes, 98 symbols |

So the manifest is passed through to the browser **unconverted**, in points, and `scale` — the
one number that turns points into screen pixels — is the only conversion anywhere. A marker at
a component's location, or a highlighted conductor, becomes a sibling of the tiles needing no
registration step. A composite built offline at the fit scale, using exactly the arithmetic
`TileSheet.tsx` uses, reproduces the sheet seamlessly; the 30 pt tile overlap paints identical
pixels over itself and leaves no seams.

Also settled, in passing: `geometry.json` records `has_embedded_text: false` — every label is
OCR of stroked glyph geometry. So pdf.js would yield no text layer here either, which removes
its main advantage over the rasters. Tiles first was the right call, not merely the cheap one.

### What landed

**Server.**

- `drawing.tile_manifest()` reads `tiles/tiles.json` and normalises it: page size, DPI, grid,
  and per tile the `pdf_rect` in points plus pixel dimensions. Returns `None` unless the
  manifest parses, declares a positive page size, and names at least one PNG **that is on
  disk** — a half-rendered tile directory has to mean "no viewer", not "a viewer full of
  broken images". Tiles missing from disk are dropped individually.
- `/api/drawing` gained a `tiles` field carrying that manifest, so tab availability and the
  viewer's geometry arrive in the page load that was already happening. No second fetch, no
  loading state, ~2 KB.
- `GET /api/tiles/{name}` serves the PNG. `drawing.tile_file()` will only return a path the
  manifest itself lists, so the manifest is the allowlist and the filename in the URL cannot
  select anything else on disk. Verified: `tiles.json`, `../circuit_logic.json` and an
  unlisted `tile_r9c9.png` all 404.
- **The CSP exception is gone.** `/api/source` used to answer with `frame-ancestors 'self'` so
  the PDF could be framed. There is no iframe any more — the PDF is a link to a new tab, which
  framing rules do not touch — so `CSP_FRAMEABLE` and `FRAMEABLE_PATHS` were deleted and the
  policy is one blanket string again. Removing a live security exception the moment its reason
  expires is worth the five minutes.

**WebUI.**

- `features/drawing/useTileViewport.ts` — the pan/zoom engine. The viewport is three numbers,
  `screen = point × scale + offset`, held as an explicit transform rather than a scroll
  position, because "pan to `CR-BP`" cannot be expressed against a scroll position. Wheel zoom
  about the cursor, drag to pan, two-finger pinch, double-click, `+`/`-`/`0`/arrows, and
  auto-fit that survives a window resize until the reader takes control. It is a hook, not a
  component, because the tile layer and the overlay layer that comes next need the same
  transform and only one of them can own it.
- `features/drawing/TileSheet.tsx` — the 16 PNGs, absolutely positioned in points, under one
  `translate3d`/`scale`. No rendering code, as §2 promised.
- `features/drawing/DrawingTab.tsx` — toolbar (zoom, fit, live zoom percentage, tile-load
  progress, source-PDF link) and the viewport.
- The tab is `keepMounted`, so pan and zoom survive a trip back to Ask — but it therefore
  mounts at first paint, and 2.2 MB of rasters must not land on someone who never opens it.
  So the tiles are **armed on first activation**: nothing is fetched until the tab is opened
  once, and nothing reloads afterwards.
- Deleted: `components/SourceDrawing.tsx` and its test, and `sourceOpen` from the store.

**The zoom percentage means something specific.** 100% is one tile pixel per CSS pixel — the
sharpest the rasters go — so it is a percentage of the extraction's own resolution rather than
of anything arbitrary. Overzoom is capped at 200%; below 50% of the fit scale you cannot go.

### An import cycle, found by the new test and fixed rather than worked around

`App.test.tsx` has warned since day one that `tabs → AskTab → appStore → TABS` is a real cycle
surviving on the order modules happen to be evaluated in. Adding a second tab collected on it:
`DrawingTab.test.tsx` imports the component first, so `tabs.ts` built its registry mid-cycle
and produced `{id: undefined, Component: undefined}` — a blank screen with no error.

Reordering the test's imports would have hidden it. Instead the cycle is gone: `appStore` no
longer imports the registry. It used `TABS` for two things — an initial `activeTabId` and a
hydrate-time check that a persisted id still exists — and `App.tsx` already had to reconcile
the id against the *enabled* tabs regardless (the Drawing tab is disabled when there are no
tiles). `activeTabId` now starts empty, `App` resolves it in one place, and `tabs.ts` carries
the rule as a comment: it imports tab components and nothing imports it back. A tab that needs
its own id declares the constant itself, which is why `DRAWING_TAB_ID` lives in
`DrawingTab.tsx`.

### Verified

59 server tests (was 50) and 22 web tests (was 19) pass; `ruff` clean; `tsc -b` clean; the
production bundle builds. Against the real drawing on a scratch port 9702: `/api/drawing`
reports 16 tiles, 4×4, 400 DPI, 1224×792 pt; `/api/tiles/tile_r1c1.png` returns 146,715 bytes
of `image/png` at 1867×1267 with an hour of cache; the traversal cases 404.

New server tests cover the point-not-pixel contract, a tile absent from disk, a manifest with
no page size (which is exactly the shape
`test_source_drawing_follows_the_tile_manifest` writes), and five traversal attempts. New web
tests cover the three failures that are silent in a browser: fetching 2.2 MB before the tab is
opened, tiles positioned in the wrong units, and a missing `tiles` field producing a tab full
of 404s instead of no tab.

**Not verified by machine: the gestures.** There is no browser automation in this environment,
so wheel-zoom-at-cursor, drag-pan and pinch have unit tests around the maths but no end-to-end
proof. They want a human with a mouse and, ideally, a tablet.

### Known limits, recorded rather than fixed

- **~169 MB of decoded bitmap.** The 16 tiles total 42.1 megapixels, and at fit zoom every one
  of them is on screen, so viewport culling would save nothing in the default view. Fine on a
  desktop, plausibly a problem on a phone. The real fix is a downscaled overview image swapped
  for the tiles above a zoom threshold — which means the extraction emitting one.
- **Softness past 100%.** The rasters are 400 DPI and that is the ceiling; the source-PDF link
  is the answer for anyone who needs more.
- **`geometry.json` net labels are OCR and not quite `circuit_logic.json` net ids** — `LI-A`
  for `L1-A`, `OV.` for `0V`, `130.` for `130`. Joining them needs a normalisation pass, and
  every conductor that fails to match is a finding about the extraction. This matters for net
  highlighting, not for this change.

**A running server does not pick this up.** Restart `python -m app` to get `/api/tiles`.

---

## 2026-08-10 — Claude stops naming things the user cannot see

One file changed: `server/app/prompts.py`. `PROMPT_VERSION` → `v1.1`.

**The problem.** The extraction had to invent identifiers for things the drawing never names —
above all the 71 wire ids `W001`–`W071`, which appear nowhere on the sheet. The prompt then
*instructed* the model to use them: *"Cite identifiers for every claim: wires as `W047`."* So
answers came back in a private vocabulary. An electrician holding a printed sheet could read
"W047" and have no way to find it.

A second concern was raised alongside it — that the user does not know these entities exist and
so cannot ask about them. It dissolves once the first is fixed: if the invented names never
lead, there is nothing the reader needs to learn in order to ask a good question. That is why
this landed as one prompt change and not as a naming-glossary tab, which was designed and then
deliberately dropped.

**What the prompt now says.**

- A new `# Names that are not on the drawing` section, a five-row table of the *kinds* of id
  that are ours: `W###`, terminal-block point numbers, the inferred `RECEPT1`/`INFEED1`/
  `DISCHARGE1` pin numbers, `CABLE-*`/`SUB-*`, and the `NET-PB1`/`NET-PB2` renames. Five rules
  cover every invented id on this sheet, which is what lets the citation rule work with no new
  artifact beside the drawing.
- `# Citation` rewritten. Printed ids may still be cited bare. An invented id may never lead
  and never stand alone: colour, gauge and both endpoints first, ours in parentheses — *"the
  blue 18AWG wire from `CR-BP:A2` to the BYPASS 5A breaker (extraction id `W048`)"*. Terminal
  points are described positionally; connector pins are flagged as inferred on first use.
- The troubleshooting-path example carried a bare `W048` and would have contradicted the new
  rule on the one output shape most likely to be read at 2 a.m. The arrow now carries the
  spec: `CR-BP:A2 →[BLUE 18AWG, W048]→ BYPASS-CB:2 ─[BYPASS 5A]─ BYPASS-CB:1 → net 120`.

**Why the id survives in parentheses rather than being suppressed.** Three reasons, and the
first is the one that decided it. The `## Sources` rule and "a sentence that names no identifier
is an opinion" both depend on a claim being retraceable to a specific row of `wires[]`; removing
the ids loosens the thing the whole epistemics design rests on. Second, all 71 wires do have
unique `(from_terminal, to_terminal)` pairs — so a *complete* description is a unique key and
the id is strictly redundant — but prose compresses, and "blue 18AWG on the 24E-1 bus" matches
seven wires. The id is insurance against the model's own abbreviation, not against ambiguity in
the data. Third, it is the natural anchor for click-a-citation-to-highlight later, and it keeps
`acceptance.py`'s `re.findall(r"W\d{3}")` checks working unchanged.

**Two wrong facts caught while writing the prompt,** both worth recording because a wrong
example in a prompt teaches a wrong fact. `W047` is `CR-ON:A2 → TB-110:3` on net 110 — the
CR-BP-to-BYPASS wire is `W048`. And `RECEPT1:3` is the **black** RUN conductor: blue is pin 3
in the standard M12 cordset code, but this drawing's pin numbers are drawing order, so the
standard colour does not apply.

**Verified.** 50 server tests pass, `ruff` clean, rendered prompt inspected in full. Acceptance
run against v1.1 on Sonnet: `_claude_notes/webui_acceptance/20260811T001556Z-sonnet.md`,
4 passed / 2 failed, $0.39. Run on a throwaway loopback instance on port 9701 with
`SWUI_DEMO_PASSWORD=` and `SWUI_RATE_LIMIT_ENABLED=false`, because `acceptance.py` sends no
password header and the 3-per-10-minutes limit cannot pass a six-case run.

**Both failures are false negatives in the checkers, not regressions.** The answers are right;
the probes miss the wording:

- `net-125-troubleshoot` / *is not fooled by the green lamps.* The answer says the lamps
  *"do **not** prove the CR1 or CR2 relay contacts downstream actually closed"* — correct, and
  it names the trap explicitly. The check looks only for `does not prove` / `proves nothing` /
  `doesn't prove`, so plural "do not prove" slips past it.
- `breaker-ratings` / *does not call them protection.* The answer says *"they protect nothing;
  they just make/break a control path"* — correct. `_no_unnegated_protection()` scans 90
  characters after the match for a negation, and its list has no `nothing`; the window also cuts
  off just before the word. The function's own docstring warns about precisely this failure
  direction — marking a correct answer wrong — and it has now done it.

Left unfixed deliberately: loosening a test oracle to make a run go green is a judgement about
acceptance criteria, not a detail of this change. The two needle lists are the fix if wanted.

**The change itself is doing its job**, visible in the net 110 answer: terminal-block points
now read *"3rd point on the 110 terminal block (`TB-110:3`)"*, and connector pins carry the
warning — *"infeed connector pin 1 (`INFEED1:1`; pin numbering is inferred, not printed)"*.

One gap to watch. In a **table**, the model still puts the bare id in the leading `Wire`
column, with colour, gauge and endpoints in adjacent columns. Everything findable is on the
row, so it reads fine — but it is not what "never lead with an identifier" literally says. If
this matters, the rule should say tables are exempt when colour, gauge and both endpoints are
adjacent columns, rather than being left ambiguous.

**A running server does not pick this up.** Restart `python -m app` to load the v1.1 prompt.

---

## 2026-08-10 — Light theme, the source drawing, and a readable intro

Three user-experience changes to the WebUI, plus this file.

**Light theme.** `webui/index.html` no longer sets `class="dark"` on `<html>`, and it now
declares `<meta name="color-scheme" content="light">` so the browser's own furniture — form
controls, scrollbars — comes up light rather than dark. The `.dark` palette in `index.css` is
untouched and still complete: adding a toggle later means putting that one class back on
`<html>`, nothing more.

One palette value had to move with it. `--warning` and `--success` are used as *text* colours
at 11px (the "no revision" badge, the spend line), and the dark theme's bright amber and green
sit at roughly 2:1 contrast on a near-white background. Both are darkened in the `:root` block
only; the `.dark` block keeps its brighter values, because there they are correct.

**You can now see the source schematic.** `webui_ideas.md` §2 asks to see the drawing, and the
answer to "is this right?" was previously "open the PDF yourself, out of band". Added:

- `GET /api/source` — serves `source_docs/*.pdf` inline. Free, static, no model call.
- `drawing.source_document()` resolves which PDF that is: the name in `tiles/tiles.json`
  first, then a filename matching the drawing number, then a lone PDF. With several unrelated
  PDFs and nothing to disambiguate them — which is exactly the state of
  `ModLinx/source_docs/` — it returns `None` rather than guessing, and the endpoint 404s.
- `/api/drawing` gained a `source` field (`{name, bytes, media_type}` or `null`) so the UI can
  decide whether the button exists at all. Optional on the client type, so an older server
  degrades to no button instead of a broken one.
- `components/SourceDrawing.tsx` — a *Show the drawing* button in the intro and a compact
  *Drawing* button in the always-visible drawing bar, both opening one full-screen overlay
  with the PDF in an iframe. Escape closes it; there is an "Open in a new tab" escape hatch.

Two decisions worth keeping:

*The browser's PDF viewer, not the tiles.* The 148 KB source is vector, so it out-zooms the
400 DPI rasters and costs no rendering code. The tile viewer in `webui_ideas.md` §2 — 16 tiles
under one CSS transform, component overlays, bidirectional citation — is still the right thing
to build, and this does not stand in its way; it becomes "show me the real drawing,
unannotated" once the tile viewer is a tab.

*One CSP exception, deliberately narrow.* The blanket `frame-ancestors 'none'` is enforced on
the **framed** document, so leaving it on the PDF response would have shown a blank rectangle
with a console error and no obvious cause. `/api/source` alone answers with
`frame-ancestors 'self'`; every other directive is unchanged, and the policy is now one
`CSP_BASE` string in `main.py` so the two variants cannot drift. A test asserts both halves.

**The intro reads as four things instead of one grey wall.** The block above the composer ran
the drawing title, what the model reads, and what it does when the sheet has no answer
together as consecutive muted paragraphs — three independent ideas with nothing separating
them. Now the 20-word all-caps title sits in its own card under a "Drawing PS20115MLM4-2"
label, and the two notes are separate dashed-border sections headed *What it is reading* and
*When the sheet has no answer*. Same words, four distinct blocks.

Tests: 50 server and 19 web tests pass; `ruff` clean. Four of the web tests are new
(`SourceDrawing.test.tsx`) and cover the two quiet failures — a button that opens an empty
overlay, and an absent `source` producing a button that 404s. Verified `/api/source` against the
real drawing on a scratch port — 151,164 bytes, `application/pdf`, `inline`,
`frame-ancestors 'self'`.

**A running server does not pick this up.** The bundle is rebuilt into
`server/app/static/`, but `python -m app` has no reloader — restart it to get `/api/source`.

---

## Before this log

Summarised from `git log` and the notes, for continuity. Detail lives in the plan documents.

- **2026-08-07** — `schematic_skills/` extraction pipeline, the first indexed drawing
  (`PS20115MLM4-2`), and `webui_ideas.md` + `webui_v1_plan.md`. Later that day: the skill got
  its own venv, an MIT licence with the vendor PDFs carved out, and three corrections to the
  plan where it claimed a reproducibility the OCR does not have.
- **2026-08-09** — the server and WebUI of `webui_v1_plan.md`: FastAPI over headless Claude
  Code, NDJSON answer streaming with real cancellation, the free deterministic drawing panel,
  spend ceiling and rate limits, and a tab registry built so the road map's tabs are additions
  rather than rewrites. Then the demo password and the Unlock control in the header.
- **2026-08-10** — documentation brought in line with the shipped code.

---

# Recommended next job

*Written 2026-08-11, after the Drawing tab landed. This section is the standing recommendation
and gets rewritten, not appended to.*

## Make the answer and the drawing point at each other

`webui_ideas.md` §2 calls bidirectional citation *"the highest value-per-line-of-code idea in
this document"* and ranks it third overall. It is now also the cheapest thing on the list,
because the two hard parts are already built and paid for: a rendering surface we own, and one
coordinate system shared by the tiles, the components and the geometry.

Today an answer says *"the blue 18AWG wire from `CR-BP:A2` to the BYPASS 5A breaker"* and the
reader has to find `CR-BP` on a D-size sheet by eye. That is the gap. Closing it turns the
answer from text you translate into a drawing you navigate — and it is the difference between
the Drawing tab being a nice thing to have looked at once and being the thing you keep open.

**Do it as one job, not three.** A component overlay on its own is 47 dots nobody clicks;
clickable citations on their own have nothing to point at. Together they are the unlock.

### The shape of it

1. **`selection` in `appStore`** — `{kind: 'component' | 'net' | 'wire' | 'terminal', id} |
   null`, plus a nonce so clicking the same citation twice re-pans. This is the seam, and it
   is the piece to get right: put it in the store, never inside the viewer. Net highlighting,
   the net explorer, guided troubleshooting and simulation all eventually read the same field.
   If it lives in the viewer, every one of them has to reach inside.
2. **`panTo(rectPt)` on `useTileViewport`** — animate the transform so a point in PDF space
   ends up centred at a readable zoom. The maths is already there; this is the inverse of
   `zoomAt`, about twenty lines.
3. **A designator index on `/api/drawing`** — every component id, terminal id, net id and wire
   id, plus `components[].aliases`, each with a point location where one exists. Needed
   because an answer is prose and we have to know which tokens are real identifiers before
   making them clickable. Deterministic, free, roughly 10 KB, and it is the same index the
   global search in §4 wants later.
4. **A `code` renderer in `Markdown.tsx`** — the prompt already requires citations in
   backticks (`` `CR-BP` ``, `` `W048` ``, `` `TB-110:3` ``), and `code` is the one element
   that file does not currently override, so the hook is free. A backtick span whose text is
   in the index becomes a button that sets `selection`; everything else renders exactly as it
   does now. **Keep it strictly an allowlist lookup** — no pattern matching on model output.
5. **An overlay layer in `TileSheet`** — 47 markers from `components[].location`, as siblings
   of the tiles in point space. Clicking one sets `selection` the other way, which prefills the
   composer with *"what does CR-BP do?"* and closes the loop.

### Two cautions

`components[].location` is a **single point, not a bounding box** — fine for a marker and for a
pan target, not for drawing a box around a component. Tighter geometry exists in
`geometry.json` (`symbols[].center`, `labels[].bbox`, `boxes[]`) if it turns out to be wanted.

And the citation rule from the 2026-08-10 prompt change means invented ids appear *in
parentheses, after* the description — `(extraction id W048)`. The clickable target is that
parenthesised span, not the leading phrase. Do not "fix" the prompt to put the id first; the
reason it is second is that an electrician cannot find `W048` on the sheet.

### What this sets up

Net highlighting (§2) is the direct follow-on and becomes mostly free: `selection` already
exists, and `geometry.json` has 149 conductor polylines to draw. Its one prerequisite is a
normalisation pass joining the OCR'd conductor `net_label`s to `circuit_logic.json` net ids —
`LI-A`→`L1-A`, `OV.`→`0V`, `130.`→`130` — and every conductor that will not join is a finding
about the extraction, which is worth having on its own.

## The two runners-up, and why they are not first

**Deterministic browse and the net explorer** (§4, ranked second in the road map) is the
strongest competing claim: it is free, instant, and every question it answers is a question
nobody pays $0.64 for. It does not depend on anything above and could be built in parallel by
someone else. It is second here only because it does not exploit the surface just built, and
because the designator index in step 3 is half of its groundwork anyway.

**Extracting `PS10115MLC2-2.pdf` and linking the sheets** (§5) is the biggest capability
unlock available — it turns *"you cannot tell from this sheet"* about net 130 and `CR-SW` into
a real answer, and the PDF has been sitting in `ModLinx/source_docs/` unextracted the whole
time. It is not recommended first because it is an extraction job rather than a WebUI job:
step 4 of the skill is deliberately interactive, so it is a session with a human in it, not a
feature. Worth scheduling as its own piece of work rather than deferring indefinitely.
