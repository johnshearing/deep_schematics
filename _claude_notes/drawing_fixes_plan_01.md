# Drawing fixes 01 — where things are, and who says so

Planning document, 2026-08-13. Discussion only; no code was written for it. It follows the
session recorded in `change_history.md` under *"2026-08-12 — The answer and the drawing point at
each other"*, and answers the three faults reported against that work plus a fourth found while
investigating them.

## Context

1. **`TB-PB2SP`'s dot is on the wrong conductor.** Authored at (196, 382); the terminal it names
   is the dot at (154.5, 348.3) — one and a half rows up, on the `PB2-SP` white 22AWG run.
   Evidence: `geometry.json` conductor `C0142`, printed net label `PB2-SP`, runs at y = 348.3 from
   x = 143.6 to 252.6, with terminal point `2` at (154.5, 348.3). The authored point is on the
   `PB2` black 22AWG row at y = 381.4 instead.
2. **A marker never says what was clicked.** Selecting `CR-ON:A2` rings the *component* `CR-ON`
   and labels it `CR-ON`, because `MarkerLayer` renders component markers only and shows
   `entry.id` of the component. `CR-ON:A1` and `CR-ON:A2` therefore produce an identical dot.
3. **Contacts land on the coil.** `CR-SW:14` flies to (861, 704) — `CR-SW`'s coil — because
   `designator_index()` gives a terminal its parent component's point, and this sheet draws
   `CR-SW`'s contact at (569, 473), about eight inches away.
4. **A labelled marker does not sit on its own point.** `MarkerLayer.tsx` positions the dot and
   the label as one flex box centred on the point (`-translate-x-1/2`), so with the label visible
   the *dot* is pushed left by about half the label's width. Two effects: the dot jumps when
   labels appear at the 30 % zoom threshold, and the displacement grows with the length of the
   id — `TB-PB2SP` is pushed ~28 CSS px further left than `PB2`. In `CR-ON.jpg` the dot appears
   to be exactly on A1; it is there **by coincidence**, being `CR-ON`'s coil-centre point shifted
   left by the width of the word `CR-ON`. Fixing the anchoring moves that dot right, and only
   then does a real A1 point put it back.

Fault 1 is not a one-off. Screening the 41 located components against every wire endpoint,
terminal dot and junction in `geometry.json`: median distance 11 pt, **17 over 15 pt, 10 over
25 pt**, `TB-PB1SP` showing the same error as `TB-PB2SP`. The authored locations came from a
vision pass and are approximate everywhere; on a sheet whose conductor rows are 16 pt apart,
approximate means "wrong row".

Faults 2 and 3 are one missing concept. A component is not drawn at one place. `CR-SW` is drawn
twice (coil, contact); **`CR-BP` is drawn at least three times** — coil, the `11`/`12` NC
contact, the `21`/`24` NO contact — and `geometry.json` corroborates with three printed `CR-BP`
occurrences plus a `24` beside the one at (592, 223). Any schema that says "coil point and
contact point" fails on the second drawing it meets. **Component shape is per-drawing data, not a
constant.**

**The decision that shapes everything below, and it is the user's:** a human confirms every
point, and the tool for doing so is part of the system, because the goal is a library of related
schematics and a derived point is a guess with no owner. So this plan spends no model tokens
guessing coordinates. It builds the place where a person puts them, and makes the deterministic
geometry work for that person by pre-filling candidates and ranking the worst first.

Prose linking is fixed at the cause instead: the model is told to write full identifiers, rather
than the client learning to pattern-match model output — which the citation seam exists
specifically to avoid.

### The two questions asked alongside

- **Nothing about questions or answers is cached.** `/api/ask` sends `Cache-Control: no-store`
  (`main.py:340`); sessions are in-memory only, kept solely so `--resume` has something to
  resume (`sessions.py`, LRU + TTL, "deliberately not persisted"); the client persists only
  `{model, activeTabId}` (`appStore.ts:151`) and `chatStore` persists nothing. `lru_cache` is on
  the `circuit_logic.json` parse and the settings object, nothing else. Asking the same question
  twice costs twice — which, as the user noted, is what keeps the demo honest for a visitor.
- **Same-session follow-ups are cheaper than new sessions**, because the `claude` CLI applies
  Anthropic prompt caching to the stable prefix (system prompt, tools, prior turns) within its
  ~5-minute window. That is a discount on re-reading context, not on the answer.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Geometry is authored in **`locations.json`**, not typed into `circuit_logic.json` | `author_circuit_logic.py` rewrites `circuit_logic.json` on every re-run and would erase human work. Netlist ("what is connected") and layout ("where it is drawn") also change at different times, by different tools, with different authority. |
| D1a | **`locations.json` is a second *authored input*, and the generator folds it in** — not a server-only sidecar | Keeps the rule established at the start of this project: hand-maintained files are the source, everything else is generated. The authored tier becomes two files with one job each; `circuit_logic.json` stays fully generated and still knows where everything is, so the artifact the model reads does not lose the geometry. |
| D2 | A component has **N sites**, N discovered per drawing | `CR-BP` needs 3. A fixed coil/contact pair is wrong on arrival. |
| D3 | A terminal belongs to a site **explicitly**, never by function heuristic | `CR-BP` has two `common` terminals (`11`, `21`) in different sites; function cannot disambiguate. |
| D4 | The editor is gated by a **second password**, separate from the demo password | Spending tokens and editing the drawing are different permissions. Also off entirely unless the server is started in editing mode. |
| D5 | Derived candidates are **suggestions**, marked as such in the UI until confirmed | A hollow dot that admits it is a guess is worth more than a solid one that isn't. Same principle as the existing *our id* marking. |
| D6 | No vision pass, no client-side prose pattern-matching | Both were on the table; human confirmation replaces the first, the prompt fix replaces the second. |
| D7 | **The dot is anchored on the point; the label is laid out around it** | Fault 4. A marker whose position depends on how long its name is has no position. |
| D8 | **Label side is derived, human-overridable, never mandatory** | `geometry.json` already measures every conductor, box and printed label, so the emptiest side can be chosen deterministically. A human nudges the few that are wrong instead of placing 60 labels per drawing. |

## Job A — Fix prose linking at the cause (`prompts.py`)

The answer read *"CR-ON's coil (A1/A2) energizes when…"*. Nothing there is clickable because
nothing is a backticked full identifier — and the current prompt **permits** that: its "Names
that are not on the drawing" section lists `A1`, `A2`, `11`, `14` as printed, and its Citation
section says printed ids "may be cited bare".

In `server/app/prompts.py`, Citation section (around the existing *"Printed identifiers need none
of this"* line), add two rules:

- **Always write a terminal as `` `PARENT:PIN` `` in backticks.** Never a bare pin — `A1` alone
  names nothing; there are ten `A1`s on this sheet.
- **Backtick a component the first time a sentence names it**, so `` `CR-ON` `` rather than
  CR-ON.

Say *why* in the prompt, one clause: a backticked identifier is what the reader can click to find
the thing on the sheet. Cost is ~60 input tokens per turn.

Then extend the server test that asserts on prompt content (`server/tests/test_invocation.py`
covers prompt assembly) so the rules and the identifier table cannot drift apart silently.

**Not doing:** scanning rendered text for identifiers in `Markdown.tsx`. Aliases in this
extraction include English phrases ("switch relay", "run bypass relay"), three of which are
already ambiguous between two components, and `Citation.tsx`'s allowlist-not-pattern rule is
load-bearing.

## Job B — The `sites` model and the locations file

**New file, one per drawing:** `<drawing>/extracted_docs/locations.json`. Hand-maintained (by the
editor in Job C), read by `author_circuit_logic.py`, and unharmed by re-running it.

```jsonc
{
  "drawing_number": "PS20115MLM4-2",
  "schema": 1,
  "page_size_pt": [1224, 792],          // guards against a re-render at a different size
  "components": {
    "CR-BP": {
      "sites": [
        { "id": "coil",  "point": [861, 679], "terminals": ["A1", "A2"],
          "label": { "dir": "e", "source": "derived" },   // side the marker's text sits on
          "source": "human", "by": "js", "at": "2026-08-13T12:00:00Z" },
        { "id": "nc",    "point": [714, 520], "terminals": ["11", "12"], "source": "derived",
          "evidence": "printed CR-BP label at (714,520)" },
        { "id": "no",    "point": [592, 223], "terminals": ["21", "24"], "source": "derived",
          "evidence": "printed CR-BP label at (592,223); terminal number 24 at (602,236)" }
      ]
    },
    "TB-PB2SP": {
      "sites": [ { "id": "block", "point": [154.5, 348.3], "terminals": ["1"],
                   "source": "human", "by": "js", "at": "..." } ]
    }
  },
  "terminals": {                         // only where a terminal needs its own point
    "CR-ON:A2": { "point": [870, 468], "source": "human", "by": "js", "at": "..." }
  }
}
```

Notes on the shape: site `id` is a short slug, unique within the component, and is what the UI
shows ("`CR-BP` — no contact"); `terminals` holds bare pin names, so it reads the same as the
sheet; `source` is `human | derived | authored`; anything with `source: "human"` is never
overwritten by re-derivation. `label.dir` is one of the eight compass points and is optional at
every level — absent means "let the client decide", which is a real state and not an error.

**The generator reads it (D1a).** `author_circuit_logic.py` gains one loader near the top and
writes what it finds into the objects it already emits: `components[].location` becomes the
confirmed point of the component's first site, plus a new `components[].sites[]`, and
`terminals[]` gain `location`. The `comp(..., x=, y=)` arguments stay as the *seed* for anything
`locations.json` has not confirmed yet, so the script still runs on a drawing that has no
locations file. Its docstring already says "Re-run after correcting any reading" — this adds the
second authored file to that sentence and to the provenance paragraph above it.

Consequence worth planning for: after the editor writes, `circuit_logic.json` is stale until the
script is re-run. The server reads `locations.json` directly, so the *viewer* is never stale, but
the artifact the model reads is. The editor shows a plain banner — *"circuit_logic.json is behind:
re-run author_circuit_logic.py"* — and does not try to run Python itself.

**Server (`server/app/drawing.py`)** — one new resolver used by `designator_index()`, with a
strict precedence and no cleverness:

1. `locations.json` terminal entry, if present;
2. the site that claims that terminal;
3. the component's authored `location` in `circuit_logic.json` (today's behaviour);
4. nothing — the entry stays in the index, unclickable, as the six unlocated ids do now.

Index entries gain `points` (every site, ordered) and `placement: "confirmed" | "derived" |
"parent"`, keeping `point`/`rect` as they are so nothing existing breaks. A component with three
sites publishes three points and a `rect` framing all of them; selecting `CR-BP` then zooms out
to show all three, exactly as selecting a net already does. Load the file with `lru_cache` keyed
on the directory like `load_circuit_logic`, and **invalidate it on write** — the editor mutating a
cached parse is the one stale-cache bug this design can have.

**The derivation that seeds it** — a read-only script in `server/scripts/`, reusable per drawing:
for each terminal, take the conductors in `geometry.json` whose *printed* `net_label` matches that
terminal's net in the netlist, and offer the nearest terminal dot on one. Printed-label-must-agree-
with-the-netlist is what makes a candidate safe to show a human. Measured coverage on this
drawing: 109 of 131 terminals get a candidate, 67 within 40 pt of their parent; it reproduces
`TB-PB2SP` correctly (y = 348.3) which is the evidence that it works. **It never writes a point as
confirmed** — output is candidates plus a worst-first ranking (distance from the nearest anchor,
unlocated first).

The same pass picks each site's **label side** (D8): score eight candidate boxes (~60 × 12 pt at a
reference scale, offset from the point) against the conductor polylines, `boxes[]` and printed
label bboxes in `geometry.json`, take the emptiest, break ties in a fixed order (`e`, `w`, `ne`,
`nw`, `se`, `sw`, `n`, `s`) so the result is repeatable. Pure arithmetic over an already-parsed
file, so it is unit-testable without a browser — the same reason `paint.ts` exists.

## Job C — The Locate tab

New feature folder `webui/src/features/locate/`, plus a second gate.

**Gate (`server/app/config.py`, `main.py`).** New settings: `editor_password: str = ""` and
`allow_edits: bool = False`. `/api/health` publishes `editing: {enabled, password_required}` so
the UI knows whether the tab exists at all. New `POST /api/editor/unlock` mirroring `/api/unlock`
(same tight `5/minute` bucket), returning a scope the client holds **in memory only** — the demo
password is already handled that way (`client.ts:20`) and an edit credential deserves no less.
`PUT /api/locations` requires that scope; with `allow_edits` false the routes are never
registered, so a public demo has no write surface to attack. Writes are whole-file, atomic
(temp file + `os.replace`), and rejected if the payload's `drawing_number` disagrees with the
loaded drawing.

**Screen.** Two panes: designator list left, the existing tile viewer right — reusing
`useTileViewport`, `TileSheet`, `paint.ts`'s `pointToCss` and `MarkerLayer`. There is exactly one
projection in this application and this adds none. Flow: pick a row → the sheet flies to the
candidate → click the sheet to set the point → it saves and advances to the next unconfirmed row.
Keyboard: `Enter` accepts the candidate, `Esc` clears, `↑/↓` moves the row, `Shift+↑↓←→` nudges
the *label* to another side (D8). A row can *add a site* — this is how `CR-BP`'s third site gets
created — or drop one, and can assign terminals to sites with checkboxes. Header shows coverage:
*"47 components · 12 confirmed · 26 candidates · 9 unplaced"*, which is the number a librarian
needs per drawing.

**Cost model for the library:** accepting a candidate is one keystroke; only the wrong ones cost a
click. This drawing is ~50–60 placements for full site coverage.

## Job D — Make the marker say what was clicked

`webui/src/features/drawing/MarkerLayer.tsx` and `DrawingTab.tsx`:

- **Anchor the dot, then hang the label off it (fault 4, D7).** The dot alone gets
  `-translate-x-1/2 -translate-y-1/2` at `pointToCss(point)`; the label becomes an
  absolutely-positioned sibling placed by `label.dir` (default `e`), so the dot is on its point
  whether the label shows or not, and a long id no longer drags it sideways. This is the one
  change in the plan that improves every existing marker with no new data.
- **A dedicated selection marker.** Render the current selection at its own point(s), labelled
  `entry.id` — so `CR-ON:A2` reads `CR-ON:A2`, and once Job B lands it sits on A2. Component
  markers go back to being blue dots labelled with their own ids; today a terminal selection
  borrows its parent's marker, which is the whole reason the label reads wrong.
- **Multi-site components draw one dot per site**, keyed `${id}@${site}`, tooltip naming the site.
- **Honesty for unconfirmed points** (D5): `placement: "parent"` renders hollow, with a tooltip
  saying the point is the parent component's and not the terminal's; `"derived"` renders dashed.
  Nobody should be told we know where `CR-BP:12` is while being shown a guess.
- `DrawingTab.tsx` computes `selectedId` as `entry.kind === 'component' ? entry.id : null` —
  that ternary is fault 2 in one line, and it goes.

## Job E — Correct `TB-PB2SP` now

Its first entry in `locations.json`, `source: "human"` — the green arrow in `TB-PB2SP.jpg` is the
same authority the editor will carry — at (154.5, 348.3), the terminal dot on the `PB2-SP`
conductor. This exercises the whole path on the one case that can be checked by eye today.

`TB-PB1SP` and the other 16 screened candidates are **not** edited blind; they go into the
editor's worst-first queue.

## Job F — Teach the extraction skill about the second authored file

`schematic_skills` gains: emit a seed `locations.json` (candidates and flags, never confirmed) as
part of extracting a new drawing; teach `SKILL.md` that the authored tier is now **two** files —
the netlist script and the locations file, the second owned by the human and the editor; and add
a line to `EXTRACTION_NOTES.md` on what a human still owes the drawing. This is what makes drawing
number two cheap, and it is the part that serves the library goal directly.

## Sequencing

**A** (prompt, independent) and **D's anchoring fix** (fault 4, no new data, improves all 47
markers today) → **B** (format + generator fold-in + resolver + tests) → **E** (one entry, proves
the path end to end) → the rest of **D** (selection marker, sites, honesty states) → **C** (the
editor) → **F** (the library).

## Verification

- `cd server && .venv/bin/python -m pytest -q`; `cd webui && npm test`; `npx tsc -b`; `ruff check`.
- New server tests: resolver precedence (terminal > site > parent > none); a multi-site
  component's `points` and framing `rect`; a locations file naming an unknown component or
  terminal is ignored rather than fatal; a page-size mismatch is refused; `PUT` without the editor
  scope is rejected; the edit routes are absent when `allow_edits` is false.
- New web tests: **the dot's CSS position equals `pointToCss(point)` exactly — label shown, label
  hidden, and with a long id** (the regression for fault 4, and the test that would have caught
  the coincidence in `CR-ON.jpg`); the label renders on the side `label.dir` names; a terminal
  selection renders its own id (fault 2); a three-site component renders three dots; a `"parent"`
  placement renders hollow; the Locate tab is absent when health says editing is disabled.
- New generator tests: with no `locations.json`, output is byte-identical to today's; with one, a
  confirmed site point reaches `components[].location` and a confirmed terminal point reaches
  `terminals[].location`; a site naming a terminal that does not exist is reported, not silently
  dropped.
- Against the real extraction: run the seeder and check that `TB-PB2SP` resolves to y ≈ 348.3 and
  `CR-SW:14` no longer resolves to (861, 704).
- **By eye, in a browser** — that `CR-ON:A2` lands on A2 and `CR-SW:14` on the contact is not
  something this environment can confirm. Restart `python -m app` after a build; it has no
  reloader.

## Not in this plan, and why

- **A vision pass to read coordinates off the tiles.** It was the alternative to the editor and it
  costs tokens to produce a guess a human then has to check anyway.
- **Client-side pattern-matching of prose for identifiers.** See Job A.
- **Blind correction of the 16 other screened components.** They are candidates, not findings.
- **`pdf.js`.** Still the right endpoint for "do not run out of zoom", still not needed here.
