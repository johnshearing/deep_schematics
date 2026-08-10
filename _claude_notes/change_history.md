# Change history

What changed, when, and **why** — the reason being the part that is expensive to reconstruct
later. Newest first. One entry per working session, not per commit; `git log` already has the
commits.

Scope is the whole repository: the extraction skill, the server, the WebUI and these notes.
`webui_ideas.md` is the road map (where we are going), `webui_v1_plan.md` is the v1 design
(why the server looks the way it does), and this file is the record of what actually landed.

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
