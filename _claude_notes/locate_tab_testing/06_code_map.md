# Code map — behaviour to the file that owns it

Index: `locate_tab_instruction_and_test_manual.md`.

**This document exists so that troubleshooting does not begin with a search.** It is never needed to
*run* a test. Read it when a test has failed and you need to know where to look.

Symbol names below were verified against the tree on 2026-08-17. Line numbers are deliberately
absent — they rot; names do not.

---

## 1. The data flow, end to end

    ┌── authored by a human ───────────────────────────────────────────────┐
    │  author_circuit_logic.py     the netlist: what connects              │
    │  locations.json              the geometry: where it is drawn         │
    └──────────────────────────────┬───────────────────────────────────────┘
                                   │ python author_circuit_logic.py
                                   ▼
                          circuit_logic.json          ← fully generated, never hand-edited
                                   │
                                   │ load_circuit_logic()   + load_locations()
                                   ▼
                        resolve_geometry()             ← THE ONLY PLACE THAT DECIDES
                                   │                      where anything is
                                   ▼
                        designator_index()  →  GET /api/designators
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
              Drawing tab                    Locate tab
              (read only)                    (draft + PUT /api/locations)
                                                   │
                                                   └─→ save_locations() → locations.json

Two things to hold on to:

- **`resolve_geometry()` is the only precedence.** Terminal's own point → the site claiming that
  pin → its parent component's point (flagged `parent`) → nothing. Anything that appears to apply a
  different order is either a client-side bug or `editorPlaces` diverging.
- **The editor is a whole-document draft.** It loads once, mutates in memory, and PUTs everything.
  That is the source of hazard H1 below.

---

## 2. Server

| Behaviour | File | Symbol |
|---|---|---|
| The file format, and every validation message | `server/app/locations.py` | `parse`, `_sites`, `_site`, `_terminals`, `_labels`, `_placed`, `_label_dir` |
| Which provenance words exist | `server/app/locations.py` | `SOURCES` = `("human","seed")`, `PLACEMENT` = `{human→confirmed, seed→seed}` |
| Wire/net label sections and key | `server/app/locations.py` | `LABEL_SECTIONS` = `("wires","nets")`, `LABEL_KEY` = `"label_point"` |
| The precedence, and cross-checks against the netlist | `server/app/locations.py` | `resolve_geometry` |
| Parse cache — **and the bug it can cause** | `server/app/locations.py` | `load_locations` is `lru_cache`d; `save_locations` calls `load_locations.cache_clear()` |
| Writing: atomic, whole-file, four refusals | `server/app/locations.py` | `save_locations`, `LocationsRefused` |
| The empty document a fresh drawing gets | `server/app/locations.py` | `skeleton` |
| Publishing `point`/`rect`/`places`/`placement`/`label_point` | `server/app/drawing.py` | `designator_index`, `_entry` |
| Which ids the extraction invented (`our id`) | `server/app/drawing.py` | `WIRE_IDS_ARE_OURS`, `INVENTED_TERMINAL_PREFIX`, `INVENTED_TERMINAL_PARENTS`, `INVENTED_NET_PREFIX` |
| The gate — routes registered or not | `server/app/main.py` | `if settings.allow_edits:` inside `create_app` |
| Password check | `server/app/main.py` | `_require_editor`, `_check_editor_password` |
| `GET`/`PUT /api/locations`, `POST /api/editor/unlock` | `server/app/main.py` | `get_locations`, `put_locations`, `editor_unlock` |
| The `problems` list the UI shows | `server/app/main.py` | `_locations_report` (goes through `resolve_geometry`, so it catches netlist mismatches too) |
| Drawing number / page size guards | `server/app/main.py` | `_drawing_identity` |
| Settings | `server/app/config.py` | `allow_edits`, `editor_password`, `editor_name`, `editor_password_required` |

**Server tests:** `server/tests/test_locations.py` (format, precedence, refusals, labels),
`server/tests/test_editor.py` (the gate, the write path, the cache-clear),
`server/tests/test_extraction_generator.py` (the generated artifact).

---

## 3. Client

| Behaviour | File | Symbol |
|---|---|---|
| **The one projection**, both directions | `webui/src/features/drawing/paint.ts` | `pointToCss`, `cssToPoint` |
| Pan, zoom, fly-to | `webui/src/features/drawing/useTileViewport.ts` | `panTo`, `focusScale`, `centreOn` |
| Dots: one per place, filled vs hollow, label side, drag | `webui/src/features/drawing/MarkerLayer.tsx` | `Marker`, `LABEL_SIDE`, `PLACEMENT_NOTE`, `onDragPoint`, `DRAG_SLOP` |
| **Which dot was clicked** — `onSelect` carries the `place`, not just the entry | `webui/src/features/drawing/MarkerLayer.tsx` | `onSelect(entry, place)` |
| **Where the sheet goes, and who asks** | `webui/src/features/locate/LocateTab.tsx` | `flyTo`, `framing`, `at`, `sheetRect` — and see hazard H3 |
| Scrolling the armed row into view | `webui/src/features/locate/WorkList.tsx` | `armedRow` |
| **Every rule the editor applies** | `webui/src/features/locate/model.ts` | see below |
| The screen, click-to-place, the advance, the overlay | `webui/src/features/locate/LocateTab.tsx` | `LocateTab`, `put`, `aim`, `editable`, `PasswordGate`, `SaveStatus` |
| Leaving placing mode — `Esc`, and the ✕ on the panel | `webui/src/features/locate/LocateTab.tsx` | the `Escape` effect (a `window` listener guarded on `activeTabId`), `isTextField`; `TargetPanel.tsx` `Header` |
| Rows and their state words | `webui/src/features/locate/WorkList.tsx` | `STATE` |
| **The order of every list on the left**, and so the order the advance walks | `webui/src/features/locate/LocateTab.tsx` | the `entries` memo, `BY_ID` (an `Intl.Collator`, `numeric`) |
| Sites, pins, the compass, the wire/net panel | `webui/src/features/locate/TargetPanel.tsx` | `ComponentPanel`, `TerminalPanel`, `LabelPanel`, `LabelSide` |
| The site-name box: local text, one write, visible refusal | `webui/src/features/locate/TargetPanel.tsx` | `SiteName` — and see hazard H4 |
| Draft, debounced autosave, unlock, load | `webui/src/stores/locateStore.ts` | `edit`, `place`, `save`, `load`, `unlock`, `SAVE_DEBOUNCE_MS` = 900 |
| Re-reading the index after a save | `webui/src/stores/appStore.ts` | `refreshDesignators` |
| Whether the tab exists | `webui/src/tabs.ts` | `isEnabled: tilesAvailable && editingEnabled`; `editingEnabled` from `health.editing.enabled` in `App.tsx` |
| Wire contract | `webui/src/api/types.ts` | `Designator`, `Place`, `Placement`, `LocationsDocument`, `StoredSite`, `StoredLabel` |
| The three HTTP calls | `webui/src/api/client.ts` | `editorUnlock`, `getLocations`, `putLocations` |

### `model.ts`, by question

Everything here is pure and has no React in it, which is why 20 unit tests cover it. If a rule is
wrong, it is wrong here.

| Question | Symbol |
|---|---|
| Which kinds need a point? | `PLACEABLE` = component, terminal |
| Which kinds have only a label? | `LABELLABLE` = wire, net |
| What does this row say? | `rowState`, and `draftPlacement` for the draft's half |
| Where are this entry's dots? | `editorPlaces` |
| What do the toolbar counts mean? | `coverage` — returns `placeable/confirmed/remaining` **and separately** `labellable/labelled` |
| What does the advance pick next? | `nextUnplaced` (skips `LABELLABLE`, wraps once) |
| What does a click write? | `place` → `setSitePoint` \| `setTerminalPoint` \| `setLabelPoint` |
| Which site holds this pin? | `siteClaiming` (first claim wins) |
| Pin assignment | `assignTerminal` (strips the pin from every other site first) |
| Site naming | `nextSiteId` (`main`, `site-2`, …), `renameSite` (refuses empty/colliding), `canRenameSite` (the same rule, asked before typing is committed) |
| Removing things | `clear`, `removeSite` — both drop the parent record when it empties |
| Rounding and provenance stamping | `signed` (private) — one decimal place, `source: human`, `by`, `at` |

**Client tests:** `webui/src/features/locate/model.test.ts` (the rules),
`webui/src/features/locate/LocateTab.test.tsx` (the screen against a stubbed server),
`webui/src/features/drawing/paint.test.ts` (the projection, both directions),
`webui/src/features/drawing/DrawingTab.test.tsx` (markers, provenance styling, wire labels).

---

## 4. Known hazards, with reasoning

### H1 — Whole-file save, no version check *(index K2, test T-440)*

The editor loads the document **once** per mount and PUTs the whole thing. There is no version,
etag or merge, so **the last save wins and silently discards everything it never saw.** Two ways to
hit it: two browser tabs, or hand-editing the file while a tab is open.

Compounded by the fact that `load()` runs once: the guard in `LocateTab`'s effect is
`if (ready || loading) return`, and the tab is `keepMounted`, so nothing re-reads the file for the
life of the page.

*Why it is like this:* whole-file means no patch protocol to get wrong, and the file stays something
a person can open. *The fix:* a monotonic `version` (or the file's mtime) in the document; the server
refuses a `PUT` whose version is not the current one, with a message telling the editor to reload.
Small, and it turns silent data loss into a visible refusal. **This is the first thing I would fix.**

### H2 — `load_locations` is cached

`lru_cache` on the parse, keyed by directory. Any writer **must** call `cache_clear()` or it saves a
point and is handed the old one back. `save_locations` does. If a new write path is ever added
elsewhere, this is the trap. `test_a_saved_point_is_visible_to_the_very_next_read` fails without it.

### H3 — A flight inferred from the target — **fixed 2026-08-19** *(index K1)*

The fly effect used to be keyed `[measured, target?.id]`, and three separate complaints came out of
that one line, all of them because **the row's id is not enough to say where to go, and "the target
changed" is not the same question as "the user wants to be taken there"**:

- arming `CR-BP`'s NO contact flew to its coil, because the id names three dots and the effect took
  the first;
- arming the same site twice did nothing, because the id had not changed *(K1)*;
- dragging a dot belonging to another row flew the sheet away mid-gesture, because the drag
  retargets as a side effect.

Now every call site asks: `flyTo(rect)` bumps a nonce and the effect flies to it, and `framing`
decides what the rectangle is — a named site's dot, the **whole sheet** for a row drawn in more than
one place, one point, or the server's estimate rectangle. `flyTo(null)` is "stay where you are", and
it is what the drag, a rename, and a site with no point yet all pass. The nonce is load-bearing:
`entry.rect` is the same array object on two picks of the same row, so without it React would bail
out of the state change and the second ask would be silent.

The effect is still an effect rather than a direct call, because a row can be picked before the
container has been measured — the flight is remembered and made when the sheet has a size.

### H4 — Controlled inputs driven off the document — **fixed 2026-08-18** *(index K3)*

It was two faults that looked like one. The box's `value` was the document's, and `renameSite`
refuses an empty or colliding name by returning the document unchanged, so the box snapped back and
looked frozen; and a rename that *was* accepted changed `site.id`, which is the site row's React
key, so the input was unmounted between keystrokes and the focus went with it. Either way: one
character per trip to the mouse.

Now `TargetPanel.tsx` `SiteName` holds its own text and calls `renameSite` **once**, on `Enter` or
blur. `model.ts` `canRenameSite` is the same rule asked in advance, so a refusal is shown with its
reason instead of reverting silently, and the panel cannot drift from what `renameSite` will accept.
Two details worth knowing before changing it: the commit reads a **ref**, not the state, because the
blur that follows `Esc` can be dispatched before React has re-rendered with the reverted text; and a
successful rename **retargets** (`onTarget`) when that site is the armed one, or the next click on
the sheet would write a second site under the old name.

*The general lesson, which still applies elsewhere:* any input whose `value` comes from a document a
pure function may refuse needs local state. `PasswordGate` and the Ask composer are fine — nothing
refuses their intermediate values.

### H5 — The compass needs the point to exist first *(index K4)*

`setLabelDir` looks the target up and returns the document unchanged when it is not there, so the
control silently does nothing before a point is placed. Fix: create-on-set, or disable the control.

### H6 — A dot swallows the click *(index K5)*

`MarkerLayer`'s markers stop pointer events so a press on one never starts a pan. The side effect is
that you cannot place a new point *underneath* an existing dot by clicking it — the click retargets
instead. Workarounds: zoom in, or drag the existing dot. Whether this should change is a design
question, not a bug.

### H7 — Labels hidden below 30% zoom

`showLabels={viewer.percent >= 30}`. Reads as "labels are broken". Always confirm the zoom
percentage in a report about labels.

### H8 — Browser clock

`at` comes from `new Date().toISOString()` in the browser, not the server. A wrong workstation clock
puts a wrong timestamp in an authored file. Not worth fixing; worth knowing.

### H9 — `circuit_logic.json` goes stale *(index K6, test T-450)*

By design, and now enforced: `test_the_committed_artifact_is_exactly_what_the_generator_writes` is
red until the generator is re-run. Not a bug.

---

## 5. Invariants — if one of these is violated, that is the bug

1. **There is no way to author a wire's route.** Not in the file, not in the editor, not in the API.
   A wire carries `label_point` and nothing else. Owner: `LABELLABLE`, `_labels`, `fold_in_labels`.
2. **There is exactly one projection.** Every screen coordinate goes through `paint.ts`. A second
   one would eventually disagree with the tiles.
3. **There are three placements and no fourth.** `confirmed`, `seed`, `parent`. Nothing derives a
   coordinate; that was built once and rejected. `derived` is a *rejected* value in `SOURCES`, and
   `test_a_bad_field_costs_that_field_and_nothing_else` uses it as its example of one.
4. **A pin belongs to a site explicitly.** Never inferred from `function` — `CR-BP` has two `common`
   pins at different sites.
5. **Nothing refused is silent.** Every rejected value lands in `problems` and the UI shows it.
6. **Generated files stay generated.** `circuit_logic.json` is only ever written by
   `author_circuit_logic.py`.
7. **A terminal nobody placed has no location in the generated artifact** — not its parent's.
   The substitution happens at read time and is labelled `parent`.
