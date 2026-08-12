# Change history

What changed, when, and **why** — the reason being the part that is expensive to reconstruct
later. Newest first. One entry per working session, not per commit; `git log` already has the
commits.

Scope is the whole repository: the extraction skill, the server, the WebUI and these notes.
`webui_ideas.md` is the road map (where we are going), `webui_v1_plan.md` is the v1 design
(why the server looks the way it does), and this file is the record of what actually landed.

---

## 2026-08-11 — The drawing is sharp: a canvas at device resolution

Follows the entry below, same day. The user reported that lettering on the sheet was hard to
read and — the diagnostic detail — **magnifying did not help**, while the same drawing opened
through the *Source PDF* link was crisp.

**The tiles were never the problem.** A 1:1 crop straight out of `tile_r3c3.png`, no scaling,
is clean-edged; label text on this sheet has a median height of 4.13 pt, which at 400 DPI is
22.9 px. The resolution was on disk and was being thrown away between the file and the panel,
in three compounding places:

1. **`will-change: transform` on the scaled plane.** It promotes the plane to a composited
   layer, and the browser rasterizes such a layer once and then GPU-stretches the cached
   texture as the transform changes. Zooming magnified a bitmap rasterized at the *old* scale.
   That is what "magnifying does not help" means — it is the signature of this bug and not of
   an insufficient source, which is why the symptom was worth quoting exactly.
2. **Layer size.** At native zoom the plane was 6800×4400 CSS px, past the maximum texture
   size on most GPUs, which forces a reduced-scale rasterization and a stretch back up.
3. **Everything was in CSS pixels.** On a 2× display even a correct rasterization was upscaled
   once more before it reached the panel, and the toolbar's "100%" was already a 2× enlargement
   at the moment it claimed native resolution.

### What replaced it

`TileSheet.tsx` no longer positions 16 `<img>` elements under a CSS transform. It paints them
onto a **canvas whose backing store is sized in device pixels**, re-rasterizing from the source
PNGs every frame. A canvas has no composited-layer cache to go stale, no layer bigger than the
viewport, and no CSS-pixel indirection — all three mechanisms are removed rather than mitigated.

- **`features/drawing/paint.ts`** — new, and pure. `tileDestRect()` projects a PDF-point
  rectangle onto the backing store; `paintSheet()` clears, fills the paper white, sets
  `imageSmoothingQuality = 'high'` (at fit zoom a 2.4 Mpx tile is reduced to ~140 kpx, and the
  cheap filter turns 4 pt lettering into grey mush), and draws the tiles that intersect the
  viewport. No DOM in the file, which is what makes the arithmetic testable — jsdom has no 2D
  context to assert through.
- **Origins are rounded to whole device pixels; sizes are not.** At native zoom a tile's
  destination width is `(x1-x0) × dpi/72` = 2033.33 device px against a PNG the renderer
  rounded up to 2034 — so with the origin snapped, what remains is a third of a pixel of
  resampling in place of a 2× stretch. Rounding the size too would not close that gap and would
  drift the geometry off the point grid the overlay work depends on.
- **`useTileViewport` is device-aware.** It takes `dpi` rather than a precomputed
  `nativeScale`, derives `nativeScale = dpi / 72 / dpr`, tracks the container's CSS size for
  the backing store, and exposes both. A new `useDevicePixelRatio()` re-arms a
  `(resolution: Ndppx)` media query on change, because dragging a window to a monitor of
  different density changes the ratio with no resize and no re-render to notice it.
- **"100%" now means one tile pixel per *device* pixel** — the sharpest these rasters go. On a
  2× display the same fitted view that used to read 11% reads 23%, and the 200% ceiling is a
  genuine 2× enlargement instead of a hidden 4×.
- **Off-screen tiles are skipped.** Worth saying plainly: this saves nothing at fit zoom, where
  the whole sheet is on screen and all 16 are drawn. It is most of them once you zoom in.
- **The `<img>` elements survive as loaders**, hidden and never composited. They are how the
  browser fetches, decodes, caches and reports `load`/`error`; `new Image()` would buy nothing
  and lose the ability to assert on it. Tailwind's preflight carries
  `[hidden]:where(:not([hidden=until-found])){display:none!important}`, which beats its own
  `img{display:block}`, so the container is reliably invisible.

**The point-space seam is untouched.** `tileDestRect` is the same projection the CSS `left`/
`top` used to be, so a marker at `components[].location` or a conductor polyline from
`geometry.json` is still one line of arithmetic. Clickable overlays go in a DOM layer above the
canvas, which is why the canvas is `pointer-events-none`.

### Why not stop at the small fix, and why not go on to pdf.js

The plan offered three tiers. The cheapest — toggle `will-change` during gestures, correct the
DPR — was written up as "do this and measure". **There is no browser in this environment to
measure with**, so shipping a hypothesis and asking the user to re-test was the worse trade:
the canvas tier removes all three mechanisms by construction and its arithmetic can be verified
without a browser, which is exactly what was done.

pdf.js remains the right endpoint and is deliberately not in this change. It is a new
dependency, a CSP change (`worker-src 'self' blob:`) and worker bundling, none of which can be
exercised here — and the 1:1 crop shows 400 DPI is ample for reading this sheet. It stays in
the recommendations below, demoted to job 2 and rescoped from "make it legible" to "do not run
out of zoom".

### Verified

31 web tests (was 22) and 59 server tests pass; `tsc -b` and `ruff` clean; bundle builds.

The load-bearing verification is not the unit tests. `tileDestRect` and `paintSheet` were
**re-implemented line for line in Python and run against the real tiles** at native zoom
(`scale = 400/72`, dpr 1), compositing the four tiles that intersect a 1200×380 viewport
centred on the `GREEN 16AWG` run at (890, 434) pt. The output is crisp, correctly assembled and
seamless — that is the projection the canvas will use, checked against real pixels rather than
asserted about.

Nine new tests in `paint.test.ts` pin the properties that matter: destination size equals the
tile's own pixel count at dpr 1, 2 and 3; origins are integral; off-screen and not-yet-loaded
tiles are skipped; nothing is drawn before the container is measured. `DrawingTab.test.tsx`
gained a test that the canvas backing store is sized in device pixels, and its old assertion on
`<img>` `style.left` is gone with the CSS positioning it described.

`test-setup.ts` stubs `getContext` to return null — a real jsdom gap, and the viewer already
guards against it; the stub only keeps "not implemented" noise out of the output.

**Still not verified by machine: the gestures, and the perceived result.** No browser
automation here. The arithmetic is proven against real pixels; that the text now *looks* sharp
on the user's screen is for the user to confirm.

### One limit that did not improve

The ~169 MB of decoded bitmap is unchanged. The earlier note claimed a canvas would fix it
"since only visible tiles need be held" — that is wrong, and worth correcting rather than
quietly dropping: at fit zoom every tile is visible, so nothing can be released. Cutting it
needs either unloading tiles that leave the viewport when zoomed in, or pdf.js, which holds a
viewport-sized bitmap and nothing else.

**A running server does not pick this up.** The bundle is rebuilt into `server/app/static/`;
restart `python -m app`, or hard-reload if you already have the tab open.

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

# Recommended next jobs

*Written 2026-08-11 after the Drawing tab landed, and rewritten the same day once the blurry
text was fixed. This section is the standing recommendation and gets rewritten, not appended
to. The previous job 1 was "make the drawing legible"; that is done — the entry at the top of
this log records it — and the remainder of it has been rescoped and demoted to job 2 here.*

## 1. Make the answer and the drawing point at each other

This is a capability the application does not have, where job 2 refines something that already
works. Do this one first.

`webui_ideas.md` §2 calls bidirectional citation *"the highest value-per-line-of-code idea in
this document"* and ranks it third overall. It is now also the cheapest thing on the list,
because the three hard parts are already built and paid for: a rendering surface we own, one
coordinate system shared by the tiles, the components and the geometry, and — since the canvas
landed — a projection function, `tileDestRect`, that already turns PDF points into screen
positions for anything that asks.

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
5. **An overlay layer above the canvas** — 47 markers from `components[].location`. A DOM or
   SVG sibling of the `<canvas>` in `TileSheet`, positioned with the same `tileDestRect`
   projection the tiles use, which is why the canvas is `pointer-events-none`: it exists to be
   drawn on top of. Clicking a marker sets `selection` the other way, prefilling the composer
   with *"what does CR-BP do?"*, and closes the loop.

   Markers belong in the DOM rather than painted into the canvas — they need hit-testing,
   focus, keyboard access and tooltips, all of which are free in DOM and hand-rolled in canvas.
   Highlighting a *net*, when that follows, is the opposite call: 149 polylines are cheaper
   painted, and they need no hit-testing.

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

### Files to read for this job

The largest of the jobs here, and the only one crossing the server/client boundary. Read the
data first — the shape of the index falls out of what is actually in `circuit_logic.json`, not
out of the design above.

**The data, and read it before writing any code:**

| File | Why |
|---|---|
| `schematic_extraction/PS20115MLM4-2/extracted_docs/circuit_logic.json` | The index is built from this. Look in particular at `components[].location`, `components[].aliases`, and the id formats of `terminals[]`, `nets[]` and `wires[]` — those four id spaces are what step 4 has to allowlist. |
| `schematic_extraction/PS20115MLM4-2/extracted_docs/EXTRACTION_NOTES.md` | Which identifiers are printed on the sheet and which were invented. That distinction decides what may be made clickable and what has to carry a caveat. |
| `schematic_extraction/PS20115MLM4-2/extracted_docs/geometry.json` | Only if tighter geometry than a single point is wanted: `symbols[].center`, `labels[].bbox`, `boxes[]`, and `conductors[].points` for the net-highlighting follow-on. |

**Server:**

| File | Why |
|---|---|
| `server/app/drawing.py` | Where the designator index belongs, beside `tile_manifest()` and `drawing_summary()`. Its header already says the loader exposes the parsed document precisely so deterministic features like this can be added. |
| `server/app/main.py` | `/api/drawing`, if the index ships as a separate endpoint rather than a new field. |
| `server/tests/test_api.py` | The pattern every new endpoint here is tested against; `tests/conftest.py` for the miniature `extracted_docs` fixture the index will need entries in. |
| `server/app/prompts.py` | The citation rules the clickable spans have to match — read it before assuming what an answer looks like. It is why ids appear in parentheses. |

**WebUI:**

| File | Why |
|---|---|
| `webui/src/stores/appStore.ts` | Where `selection` goes. Read the `activeTabId` comment first: it records why this store must not import the tab registry, and the same rule applies to anything added here. |
| `webui/src/features/drawing/useTileViewport.ts` | `panTo` is the inverse of `zoomAt`; the clamping, the `isFit` bookkeeping and the DPR-aware `nativeScale` it has to respect are all here. |
| `webui/src/features/drawing/paint.ts` | `tileDestRect` is the projection the markers reuse. Read it before writing a second one — there should only ever be one. |
| `webui/src/features/drawing/TileSheet.tsx` | The overlay layer goes in as a sibling of the `<canvas>`. Its header records why the tiles stopped being CSS-positioned `<img>`s, which is context for not reintroducing that pattern for the markers. |
| `webui/src/components/Markdown.tsx` | The `code` hook, and — more importantly — the security reasoning about model output that any new renderer must not undermine. |
| `webui/src/components/Markdown.test.tsx` | Existing coverage of that untrusted-markdown contract; a clickable-citation renderer needs cases added to it, not around it. |
| `webui/src/features/ask/MessageView.tsx`, `webui/src/features/ask/Composer.tsx` | The answer surface that raises a selection, and the composer a drawing click would prefill. |
| `webui/src/api/types.ts` | The wire contract; the index type lands here. |

**Design context:** `_claude_notes/webui_ideas.md` §2 (bidirectional citation, net highlighting,
component overlay) and §7 (why every claim stays traceable to a row of the netlist).

## 2. Render the vector PDF, so zoom does not run out at 400 DPI

**Not urgent, and no longer about legibility.** The canvas now paints the tiles at full device
resolution and a 1:1 crop of the source is crisp, so the sheet reads properly. What is left is
a ceiling: past 100% the viewer is enlarging 400 DPI rasters, and the *Source PDF* tab — which
is the browser re-rasterizing 148 KB of vector at whatever zoom you ask for — does not have
that ceiling. Anyone comparing the two closely at high magnification will still see it.

**The change.** Render the PDF page with pdf.js onto the canvas `TileSheet.tsx` already owns,
at `viewport.scale × devicePixelRatio`, re-rendering when the zoom settles. Keep the tiles as
the instant first paint — they arrive in one frame while the PDF is still being parsed — and as
the fallback for an extraction with no source PDF beside it, which `source_document()` already
reports as `null`. Nothing above the paint layer changes: `paint.ts` projects PDF points onto
the backing store either way, so the overlay seam job 1 depends on is unaffected.

**It is also cheaper than what ships today**, which is the counterintuitive part: 148 KB of
vector instead of 2.2 MB of PNG, and a viewport-sized bitmap instead of the ~169 MB of decoded
raster recorded as a known limit. That limit is the one thing the canvas did *not* fix, because
at fit zoom every tile is on screen and none can be released.

**Two things to know before starting.** The earlier argument against pdf.js was that this PDF
has `has_embedded_text: false` and so yields no text layer — still true, still irrelevant to
rendering quality. And pdf.js parses in a worker, so `CSP_BASE` needs `worker-src 'self'
blob:`; nothing else in the policy moves.

### Files to read for this job

| File | Why |
|---|---|
| `webui/src/features/drawing/TileSheet.tsx` | Owns the canvas, the paint effect and the rAF coalescing. Its header records why the `<img>` plane became a canvas, which is the context for not undoing any of it. |
| `webui/src/features/drawing/paint.ts` | The projection and the draw routine. A pdf.js render lands as another source in `paintSheet`, not as a parallel code path. |
| `webui/src/features/drawing/paint.test.ts` | What is currently guaranteed about that projection. Add to it rather than around it. |
| `webui/src/features/drawing/useTileViewport.ts` | `nativeScale`, `useDevicePixelRatio` and the `size`/`dpr` the render must be sized against. The 400 DPI ceiling that `MAX_OVERZOOM` enforces is the thing being lifted. |
| `webui/src/features/drawing/DrawingTab.tsx` | The zoom readout, its tooltip and the footer line all state the 400 DPI ceiling in words. |
| `server/app/main.py` | `CSP_BASE` gains `worker-src`; `/api/source` becomes a fetch target rather than only a link. |
| `server/tests/test_api.py` | `test_security_headers_are_set` and `test_source_drawing_is_served_inline` both assert on the CSP string. |
| `webui/index.html`, `webui/vite.config.ts` | The CSP meta tag is duplicated into the built bundle and must not drift from the server's; the pdf.js worker needs a bundler entry. |
| `_claude_notes/webui_v1_plan.md` §3.4 | Where the CSP rules come from. Changing them without reading it is how the reasoning gets lost. |

## The two runners-up, and why they are not first

**Deterministic browse and the net explorer** (§4, ranked second in the road map) is the
strongest competing claim: it is free, instant, and every question it answers is a question
nobody pays $0.64 for. It does not depend on anything above and could be built in parallel by
someone else. It is second here only because it does not exploit the surface just built, and
because the designator index in step 3 is half of its groundwork anyway.

*Files to read:*
`schematic_extraction/PS20115MLM4-2/extracted_docs/circuit_logic.json` (the whole thing — the
tables are the feature) and `.../EXTRACTION_NOTES.md`; `server/app/drawing.py` and
`server/app/main.py` for where deterministic endpoints live; `webui/src/tabs.ts` for how a tab
is added — one new file plus one array entry, and note the no-cycle rule in its header;
`webui/src/features/drawing/DrawingTab.tsx` as the worked example of a second tab;
`webui/src/components/DrawingPanel.tsx`, which already answers §12 Q21–Q25 deterministically
and shows the register to write in; `_claude_notes/webui_ideas.md` §4 for the feature list and
§12 of `schematic_skills/references/HowToUseThisSkill.md` for the 71-question bank these
tables are supposed to displace.

**Extracting `PS10115MLC2-2.pdf` and linking the sheets** (§5) is the biggest capability
unlock available — it turns *"you cannot tell from this sheet"* about net 130 and `CR-SW` into
a real answer, and the PDF has been sitting in `ModLinx/source_docs/` unextracted the whole
time. It is not recommended first because it is an extraction job rather than a WebUI job:
step 4 of the skill is deliberately interactive, so it is a session with a human in it, not a
feature. Worth scheduling as its own piece of work rather than deferring indefinitely.

*Files to read:*
`schematic_skills/references/HowToUseThisSkill.md` **first and in full** — §2.1 the artifact
order, §3.2 the exact commands that produced the existing extraction, §3.3 why step 4 cannot be
automated, §6 output locations, §7 the start-to-finish run, §7b the ready-to-paste prompts;
then `schematic_skills/SKILL.md` and `schematic_skills/references/circuit_logic_schema.md` and
`schematic_conventions.md`. The scripts in the order they run:
`schematic_skills/scripts/extract.py`, `render_tiles.py`, `build_kg.py`, `index_schematic.py`.
For the target: `schematic_extraction/ModLinx/source_docs/PS10115MLC2-2.pdf`. Use the completed
extraction beside it as the reference for what "done" looks like —
`schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` above all, since
corrections belong in that script and never in the JSON. On the WebUI side, `server/app/config.py`
is the single `drawing_dir` knob, and nothing else is hardcoded — but note that a second sheet
means the server needs to serve *two* drawings, which is a design change the v1 plan does not
cover.
