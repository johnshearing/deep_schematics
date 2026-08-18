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
| **Every rule the editor applies** | `webui/src/features/locate/model.ts` | see below |
| The screen, click-to-place, the advance, the overlay | `webui/src/features/locate/LocateTab.tsx` | `LocateTab`, `put`, `aim`, `editable`, `PasswordGate`, `SaveStatus` |
| Rows and their state words | `webui/src/features/locate/WorkList.tsx` | `STATE` |
| Sites, pins, the compass, the wire/net panel | `webui/src/features/locate/TargetPanel.tsx` | `ComponentPanel`, `TerminalPanel`, `LabelPanel`, `LabelSide` |
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
| Site naming | `nextSiteId` (`main`, `site-2`, …), `renameSite` (refuses empty/colliding) |
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

### H3 — Picking the same row twice does not re-fly *(index K1)*

The fly effect is keyed `[measured, target?.id]`. Same id, no effect, no flight. The Drawing tab
solved the identical problem with a `nonce` on the selection; the Locate target has none. Fix: add a
counter to the target and include it in the dependency list.

### H4 — Controlled inputs driven off the document *(index K3)*

The site-name box's `value` is the document's, and `renameSite` refuses empty or colliding names by
returning the document unchanged — so the box snaps back and looks frozen. Fix: local input state,
committed on blur or Enter.

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
