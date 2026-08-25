# Code map — behaviour to the file that owns it

Index: `locate_tab_instruction_and_test_manual.md`.

**This document exists so that troubleshooting does not begin with a search.** It is never needed to
*run* a test. Read it when a test has failed and you need to know where to look.

Symbol names below were verified against the tree on 2026-08-19. Line numbers are deliberately
absent — they rot; names do not.

**Re-verified 2026-08-24, symbol by symbol: every name in every table below is still real and still
in the file it is attributed to.** `model.test.ts` is still exactly the 20 tests §3 claims, and
`showLabels={viewer.percent >= 30}` (H7) is verbatim in both tabs. Four corrections, all of them
additions rather than repairs: the two test-file lists were partial, `DRAG_SLOP` deserves its value
spelled out, and `fold_in_labels` lives in the generator rather than the server. Marked ▲ below.

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
| The file format, and every validation message | `server/app/locations.py` | `parse`, `_sites`, `_site`, `_terminals`, `_labels`, `_end_labels`, `_placed`, `_label_dir` |
| **Which schema versions are read and written** | `server/app/locations.py` | `SCHEMA` = 2, `READABLE` = (1, 2). Both `parse` and `save_locations` accept either — a stale browser bundle sending 1 must not have every save refused, which would be total silent data loss on the machine least likely to notice. The client stamps 2 on load (`locateStore.load`), so the file is upgraded by being written |
| **The end-label overrides** — wire or net id → terminal id → a side, or hidden | `server/app/locations.py` | `EndLabel`, `Locations.end_labels`, `Geometry.end_labels`, `Geometry.end_label`, `END_LABELS_KEY`. Only the exceptions are stored; absent means *the side the viewer computes* |
| Whether a `labels` key on a wire is a label on a pin that wire touches | `server/app/locations.py` | `resolve_geometry`'s `touches` map — the only refusal in the file whose symptom on screen would otherwise be **nothing at all**. See hazard H14 |
| Which provenance words exist | `server/app/locations.py` | `SOURCES` = `("human","seed")`, `PLACEMENT` = `{human→confirmed, seed→seed}` |
| Wire/net label sections and key | `server/app/locations.py` | `LABEL_SECTIONS` = `("wires","nets")`, `LABEL_KEY` = `"label_point"` |
| The precedence, and cross-checks against the netlist | `server/app/locations.py` | `resolve_geometry` |
| Parse cache — **and the bug it can cause** | `server/app/locations.py` | `load_locations` is `lru_cache`d; `save_locations` calls `load_locations.cache_clear()` |
| Writing: atomic, whole-file, four refusals | `server/app/locations.py` | `save_locations`, `LocationsRefused` |
| The empty document a fresh drawing gets | `server/app/locations.py` | `skeleton` |
| Publishing `point`/`rect`/`places`/`placement`/`label_point` | `server/app/drawing.py` | `designator_index`, `_entry` |
| **What a wire or a net is made of** — its member terminals, in order, **undeduped**, each with its own point and `placement` | `server/app/drawing.py` | `_entry`'s `terminal_ids` parameter and `_member`. `[from, to]` for a wire, `member_terminals` for a net. **Not** `members`, which is those terminals' *parent components* — see hazard H12 |
| **Whether `places` is published at all** — and it must be whenever a place carries a `label_dir`, single dot or not, because that field exists nowhere else in the payload | `server/app/drawing.py` | `_entry`, the `len(places) > 1 or any("label_dir" …)` test. This was the 2026-08-19 label-side fault (T-335): 269 of 275 entries are single, and eliding their `places` elided the side a human chose |
| Which ids the extraction invented (`our id`) | `server/app/drawing.py` | `WIRE_IDS_ARE_OURS`, `INVENTED_TERMINAL_PREFIX`, `INVENTED_TERMINAL_PARENTS`, `INVENTED_NET_PREFIX` |
| **What a wire's end label says** — its colour and gauge, as printed | `server/app/drawing.py` | `_wire_spec`, published as `spec`. 69 of 71 have one. It exists because `WIRE_IDS_ARE_OURS`: a label reading `W052` would name something the reader cannot find on the paper |
| The gate — routes registered or not | `server/app/main.py` | `if settings.allow_edits:` inside `create_app` |
| Password check | `server/app/main.py` | `_require_editor`, `_check_editor_password` |
| `GET`/`PUT /api/locations`, `POST /api/editor/unlock` | `server/app/main.py` | `get_locations`, `put_locations`, `editor_unlock` |
| The `problems` list the UI shows | `server/app/main.py` | `_locations_report` (goes through `resolve_geometry`, so it catches netlist mismatches too) |
| Drawing number / page size guards | `server/app/main.py` | `_drawing_identity` |
| Settings | `server/app/config.py` | `allow_edits`, `editor_password`, `editor_name`, `editor_password_required` |

**Server tests** ▲ — all seven files, since the three listed before were only the editor's:
`test_locations.py` (format, precedence, refusals, labels), `test_editor.py` (the gate, the write
path, the cache-clear), `test_extraction_generator.py` (the generated artifact), **`test_api.py`**
(the designator index and every other route — this is where an `_entry` change is tested),
`test_config.py`, `test_invocation.py`, `test_runner.py` (the model child). **117 tests as of Session
2 on 2026-08-24** (was 106), of which the artifact one is red exactly while `locations.json` is ahead
of `circuit_logic.json`.

---

## 3. Client

| Behaviour | File | Symbol |
|---|---|---|
| **The one projection**, both directions | `webui/src/features/drawing/paint.ts` | `pointToCss`, `cssToPoint` |
| Pan, zoom, fly-to | `webui/src/features/drawing/useTileViewport.ts` | `panTo`, `focusScale`, `centreOn` |
| Dots: one per place, filled vs hollow, label side, drag | `webui/src/features/drawing/MarkerLayer.tsx` | `Marker`, `LABEL_SIDE`, `PLACEMENT_NOTE`, `onDragPoint`, `DRAG_SLOP` |
| ▲ **How far a press must travel before it is a drag** | `webui/src/features/drawing/MarkerLayer.tsx` | **`DRAG_SLOP = 3`** CSS pixels of *pointer* travel, in `onPointerMove`: `if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP) return`. Its own comment is the design: *"Small enough that a deliberate nudge works, large enough that a shaky click still selects."* **A minimum-drag threshold therefore already exists** — anyone asked to add one should read this first. Note what it does *not* prevent: once the press has travelled past 3 px the handler fires on every subsequent move with the delta from the press origin, so a press that goes out and comes most of the way back commits the small residual it ended on. That is not a twitch getting through; it is a real drag ending near where it started, and the cure for it is undo, not a bigger number |
| **Which dot was clicked** — `onSelect` carries the `place`, not just the entry | `webui/src/features/drawing/MarkerLayer.tsx` | `onSelect(entry, place)` |
| **Which groups the Drawing tab draws** — **five** independent switches since 2026-08-25 | `webui/src/features/drawing/DrawingTab.tsx` | `Layer`, `LAYERS`, the `layers` memo, `shown`, the `markers` memo. `wires` and `nets` split out of `labels`, and `labels` is now the **text**: it has no markers of its own and gates the end labels |
| **The list down the left of the sheet** | `webui/src/features/drawing/DrawingList.tsx` | `DrawingList`, `filterEntries`, `ListKind`, `LIST_FILTERS`. `filterEntries` is pure: an empty `kinds` means every kind, and the text matches the id **and** the one-line label, case-folded. Nothing here is an allowlist — it is not model output being matched (contrast `lib/designators.ts` `resolve`) |
| **The rows themselves, for both tabs** | `webui/src/components/DesignatorList.tsx` | `DesignatorList`, `STATE`, `STATE_LABEL`, `armedRow`. This was `features/locate/WorkList.tsx` until 2026-08-25 and moved **unchanged**; the Locate tab imports it from here now and `WorkList.tsx` is gone |
| **The row state a reader sees** — from the index, never from a draft | `webui/src/lib/designators.ts` | `readerRowState`, and `RowState` itself, which `features/locate/model.ts` re-exports. This is what lets the Drawing tab's list work with `SWUI_ALLOW_EDITS=false` |
| Which kinds the list is filtered to, what has been typed, and whether it is open at all | `DrawingTab.tsx` (`kinds`, `text`, `toggleKind`, `rows`, `visibleRows`) · `stores/appStore.ts` (`drawingListOpen`, `setDrawingListOpen`) | The split is deliberate: **open/closed is persisted**, the filters are not. See hazard H16 |
| What a click on a row raises | `webui/src/features/drawing/DrawingTab.tsx` | `onRow` — `select(row.kind, row.id)` with the default `'text'` origin, so the sheet flies. The same function a citation calls, and the row's **own** kind (the `onMarker` lesson again) |
| A wire or net turned into something drawable — **its label point, never its route** | `webui/src/features/drawing/DrawingTab.tsx` | `atLabelPoint` (shared by the layer and by `selectedMarker`, so a label dot cannot exist in one path and not the other) |
| What kind a click on the sheet raises | `webui/src/features/drawing/DrawingTab.tsx` | `onMarker` — `marker.kind`, **not** the `'component'` it was hard-coded to before 2026-08-19 |
| Which components the selection card may offer as links | `webui/src/features/drawing/DrawingTab.tsx` | `located` — built from the components group whether or not it is switched on; see hazard H11 |
| **Everything the selection marks**, which for a net or a wire is its member terminals **and nothing else** | `webui/src/features/drawing/DrawingTab.tsx` | `relatedIds` — `entry.terminals[].id` where there are any, `entry.members` otherwise. Changed 2026-08-24: it was the union of both, and ringing the parent components put more than half the marks on places the net does not touch. A component or a terminal still uses `members`, which for a terminal is the one relay it hangs off |
| **Where every wire and net end label goes** | `webui/src/features/drawing/endLabels.ts` | `planEndLabels`, `defaultSide`, `CLOCKWISE`, `DEFAULT_SIDE`, `PlannedLabel`, `Overrides`. Pure, 13 unit tests. Planned over the **whole** index, never over the visible subset — see invariant 9 |
| Which end labels are drawn, and the selection's exemption from the switches | `webui/src/features/drawing/DrawingTab.tsx` | `endLabels` (the plan), `drawnEndLabels` (the subset), `drawable`. Since 2026-08-25 a label needs **two** switches — `Labels` and its own kind — and the selection's own labels need **neither**. `drawable` counts a kind's end labels towards whether that kind gets a button at all, which is why `Wires` and `Nets` are offered on a drawing where no printed name has been placed |
| The text itself, and its side | `webui/src/features/drawing/MarkerLayer.tsx` | `EndLabel` — a `pointer-events-none` span at a dot-sized anchor, through the same `LABEL_SIDE` table as a marker's own id. `data-end-label="<owner>@<terminal>"` is how a test finds one |
| The compass per end, and what *Reset* does | `webui/src/features/locate/TargetPanel.tsx` | `LabelPanel`, `EndLabelRow`, `LabelSide`'s `note`. The row is found by `data-end` |
| **Recording or deleting one end-label decision** | `webui/src/features/locate/model.ts` | `setEndLabel`, `endLabelsOf`. Normalises to nothing and **deletes** — see invariant 10 |
| The member roster on the selection card, and its state words | `webui/src/features/drawing/SelectionCard.tsx` | `MemberRow`; the words come from `lib/designators.ts` `PLACEMENT_LABEL` / `placementLabel` |
| **The three placement words, in one place** — `placed`, `estimate`, `on its component`, and `nowhere` for no placement at all | `webui/src/lib/designators.ts` | `PLACEMENT_LABEL`, `NOWHERE_LABEL`, `placementLabel`. Imported by `WorkList.tsx`'s `STATE` and by the roster, so the editor's list and the reader's card cannot drift into different English |
| *place it* on a roster row — the one place outside the Locate feature that touches `locateStore` | `webui/src/features/drawing/DrawingTab.tsx` | `placeTerminal`, offered only when `health.editing.enabled`. Sets the target; writes nothing |
| **Undo and redo over the draft** | `webui/src/stores/locateStore.ts` | `undoStack`, `redoStack`, `undoNote`, `undo`, `redo`, `UNDO_DEPTH` = 50, `Snapshot`, and the `coalescing` module variable with `endRun` |
| Which mutations are undoable | `webui/src/stores/locateStore.ts` | **all of them**, because `edit` is the only writer. `note` is what the badge will say; `coalesce` makes a run of frames or keypresses one step |
| **The keyboard** — `Ctrl+Z`, `Ctrl+Shift+Z`, `Shift`(+`Alt`)+arrows | `webui/src/features/locate/LocateTab.tsx` | `NUDGE`, `NUDGE_PT` = 1, `FINE_NUDGE_PT` = 0.1, `nudge`, and the third `window` key effect. See hazard **H10** — it applies to this listener too |
| **What a nudge is allowed to move** | `webui/src/features/locate/model.ts` | `draftPoint` — the point the draft's own record holds, **not** `editorPlaces`. Nudging a resolved estimate would turn it into a confirmation |
| Why a `Shift`+arrow does not also pan | `webui/src/features/drawing/useTileViewport.ts` | `onKeyDown`'s first line: a *modified* arrow is declined. Narrowed to `event.key.startsWith('Arrow')` on purpose — `+` needs `Shift` to type, and a blanket guard would stop zooming in |
| **Where the sheet goes, and who asks** | `webui/src/features/locate/LocateTab.tsx` | `flyTo`, `framing`, `at`, `sheetRect` — and see hazard H3 |
| **When the sheet goes nowhere however hard it is asked** | `webui/src/features/locate/LocateTab.tsx` | `FLY_CEILING_PERCENT` (= `FOCUS_ZOOM` × 100, imported, never restated) and the `percent` ref in the flight effect. Above it no flight moves anything: T-115 |
| Which groups the Drawing tab has switched on, visibly | `webui/src/features/drawing/DrawingTab.tsx` | the `LAYERS.map` in the toolbar — `variant={shown[id] ? 'default' : 'ghost'}`, filled meaning on, as on this tab's filters |
| Scrolling the armed — or selected — row into view | `webui/src/components/DesignatorList.tsx` | `armedRow`. Both tabs get it: on the Drawing tab it is what puts the list on the row a citation just selected |
| **Every rule the editor applies** | `webui/src/features/locate/model.ts` | see below |
| The screen, click-to-place, the advance, the overlay | `webui/src/features/locate/LocateTab.tsx` | `LocateTab`, `put`, `aim`, `editable`, `PasswordGate`, `SaveStatus` |
| Leaving placing mode — `Esc`, and the ✕ on the panel | `webui/src/features/locate/LocateTab.tsx` | the `Escape` effect (a `window` listener guarded on `activeTabId`); `TargetPanel.tsx` `Header`. **`isTextField` moved out on 2026-08-19** — it is `webui/src/lib/keys.ts` now, shared with the Drawing tab's Escape. See hazard H10 |
| Which tab is on screen, and the key that changes it | `webui/src/App.tsx` | the `F2` effect (`hasDrawingTab`, bare key only) — `F2` crosses to the Drawing tab from here and back; `tabIds.ts` holds the ids |
| **Where the reader was in the transcript**, across an `F2` round trip | `webui/src/features/ask/AskTab.tsx` | `view` — module state, not a store field: it changes on every scroll event and this component subscribes to the whole of `useChatStore`, so a store write would re-render every message sixty times a second while somebody scrolls. Restored in a `useLayoutEffect`, cleared by *New conversation* |
| **The way back to the card that sent you here** | `webui/src/stores/appStore.ts` | `Selection.from`, set by `select(kind, id, origin, from)` — only from a roster row or a `runs through` chip. `SelectionCard.tsx` `back`/`onBack`; `DrawingTab.tsx` `onBack`. One step, deliberately not a stack |
| Rows and their state words | `webui/src/components/DesignatorList.tsx` | `STATE` |
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
| What may be nudged from the keyboard? | `draftPoint` — a point this target's own record already holds, and nothing resolved |
| What has a person decided about one wire end? | `endLabelsOf`, `setEndLabel` — and `SCHEMA`, which this module owns on the client side |

**Client tests** ▲ — all nine files and their counts, since the four listed before were only this
feature's. **127 tests.**

| File | Tests | |
|---|---|---|
| `features/locate/model.test.ts` | 20 | the rules — pure, no React |
| `features/locate/LocateTab.test.tsx` | 23 | the screen against a stubbed server |
| `features/drawing/DrawingTab.test.tsx` | 26 | markers, provenance styling, wire labels |
| `features/drawing/paint.test.ts` | 14 | the projection, both directions |
| `features/drawing/useTileViewport.test.ts` | 6 | pan, zoom, `focusScale`, `centreOn` |
| `lib/designators.test.ts` | 13 | `placesOf` and the id helpers |
| `components/Markdown.test.tsx` | 13 | |
| `components/UnlockButton.test.tsx` | 4 | |
| `App.test.tsx` | 8 | the tabs, and the `F2` effect |

**After Session 3, 2026-08-25: 192 web tests over 13 files** — seven new in `DrawingTab.test.tsx`
(42), all of them about the list and the seam between it and the sheet, plus the existing switch tests
re-pointed at five switches and every by-name query scoped to one of the two labelled groups (H16). No
new file: the moved `DesignatorList` is exercised by both tabs' suites, which is the point of moving
it rather than copying it.

**After Session 2, 2026-08-24: 185 web tests over 13 files.** New: `features/ask/AskTab.test.tsx`
(3 — the remembered scroll position, which no browser will tell you about), and
`features/drawing/endLabels.test.ts` (13 — the whole label rule as arithmetic, because a label on
the wrong side sits *on the conductor it names*). Grown: `LocateTab.test.tsx` (37),
`DrawingTab.test.tsx` (35), `model.test.ts` (27).

~~**There is no test file for `stores/locateStore.ts`.**~~ **There is one now** — written 2026-08-24
with the undo stack, which is exactly the case that sentence anticipated: 12 tests in
`stores/locateStore.test.ts`, reading the draft document rather than the screen, because the document
is the deliverable. Current counts: **155 web tests over 10 files**, adding those 12, nine keyboard
tests in `LocateTab.test.tsx` (32), five roster tests in `DrawingTab.test.tsx` (31) and two
`draftPoint` tests in `model.test.ts` (22).

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
Small, and it turns silent data loss into a visible refusal. ~~**This is the first thing I would
fix.**~~ **Deferred by the user, 2026-08-24**, and the sentence is struck rather than deleted because
the reasoning behind it was sound and may become right again. Two things changed: a gap in the file's
history that looked like this hazard having fired turned out to be a deliberate deletion, so **H1 has
still never been observed**; and the user works in a single tab, where it cannot fire. What went in
instead is `Ctrl+Z` — undo addresses the loss a person actually suffered (their own last action)
rather than the loss the code makes possible. The day a second editor or a hand-edit habit appears,
this becomes the first thing to fix again. Written up in
`_claude_notes/highlighting_wires_and_nets.md` §9, Phase 0, including why a `rev` counter does **not**
make the system multi-user.

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

### H10 — Two `window` Escape listeners, and only a tab guard between them *(added 2026-08-19)*

Since the Drawing tab got the same key on 2026-08-19, **two components bind `Escape` on `window`**:
this tab's clears the armed target, the Drawing tab's clears the selection. Both are mounted at all
times (`keepMounted`), so the *only* thing keeping them apart is the `if (activeTabId !== …) return`
at the top of each effect. Drop or mistype one of those guards and pressing `Escape` while placing
also clears the reader's selection on the other tab, or worse, the reverse — a hidden tab disarming
the target under a run of placements. If a report says *"`Esc` did something I did not ask for"*,
that guard is the first thing to read.

Three details they deliberately share, held in `webui/src/lib/keys.ts` and in the comment on each
effect:

- **A text field gets the first `Esc`** (`isTextField`, which counts a checkbox as *not* a field —
  the pin chips hold focus but nothing is being composed in them).
- **Neither swallows an `Escape` it has no use for.** With nothing armed and nothing selected the
  event is left alone, so a dialog can still close on it.
- **They clear different things, and neither clears the other's.** `Esc` on this tab leaves the
  Drawing tab's selection card exactly as it was, which is correct — the selection is the reader's
  place in the sheet, not a mode this editor owns — but it does mean "`Esc` did not close the box"
  is a true observation about the *other* tab and not a bug.

### H11 — "Which dots do I want" is not "which components exist" *(added 2026-08-19)*

The Drawing tab's layer switches — **five of them since 2026-08-25, which is five chances to get
this wrong instead of three** — decide what gets **drawn**. Two other things read the same component
list and must not be answered by a switch:

- **`located`**, which decides whether a `runs through` chip on the selection card is a live link or a
  dead one. It is built from the components group **whether or not that group is switched on**. Wire
  it to the visible markers instead and switching Components off silently kills every link on every
  net's card — which looks exactly like the extraction not knowing where those components are.
- **The selection, and anything the selection runs through, shows through a switched-off group.**
  Hiding the thing an answer just pointed at is the one case the overlay must stay visible for. That
  is why `markers` filters *per group* rather than gating one list on a boolean: `layers[id].markers`
  when the group is on, `…filter(m => relatedIds.has(m.id))` when it is off.

If a report says *"the chips went dead"* or *"my citation stopped landing on anything"* and the
person had been pressing toolbar buttons, this is it.

### H12 — `members` is the parents, not the membership *(added 2026-08-24)*

This is the fault Phase A fixed, written down as a hazard because the wrong field is the *plausible*
one and reads correctly at a glance.

A wire's or a net's **`members`** are the **parent components** of its terminals. Its **`terminals`**
are what it is actually made of. Marking `members` is what produced *"clicking `120` marks
Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2"*: CR2 **was** marked, on its coil, because
the net's member is `CR2:14` — CR2's NO contact, 630 pt away on the far left of the sheet. And
`TB-120:1`, `:2` and `:3` share a parent, so **seven members were shown as at most five dots**.

Three consequences to keep straight:

- **`terminals` is undeduped and ordered; `places` is deduplicated.** They answer different
  questions. Two members on one coordinate is one dot and two members, and both facts are published.
  A wire's order is `[from, to]` and that order is content — Session 2's two-ended compass heads its
  controls with those ids.
- **Each member carries its own `placement`.** A net of two placed pins and one nobody has touched
  is three claims, and one `placement` on the net could only lie about two of them.
- **`relatedIds` in `DrawingTab.tsx` must include them**, or two things break at once: the rings go
  back onto parent components, and — because a switched-off group only contributes what is in
  `relatedIds` (H11) — a selected net's pins vanish the moment `Terminals` is off.

### H13 — Undo lives inside `edit`, and three other writers must clear it *(added 2026-08-24)*

`set({ document: … })` appears in **four** places in `locateStore.ts`. One of them, `edit`, is the
user's mutation and pushes a snapshot. The other three — `load`, `save`'s reconciliation, and
`reset` — are not user actions and must **clear** the stack rather than push to it. A stack that
survived a `load` would undo this document's points into the coordinates of the file that was open
before it.

Two more details that are easy to get wrong and hard to notice:

- **`coalescing` is module state**, beside `saveTimer`, and `setState` in a test cannot reach it. A
  run left open leaks into the next thing that edits. Both test suites call `endRun()` in
  `beforeEach` for that reason.
- **A drag calls `edit` on every pointer move**, and a nudge on every keypress. Without a coalescing
  key one gesture pushes dozens of snapshots and shoves the thing you actually wanted off the end of
  a 50-deep stack. If a report says *"undo only moved it back a bit"*, that key is the first thing to
  read.

Whole-document snapshots rather than inverse patches, on purpose: 38 KB × 50 is under 2 MB next to
2.2 MB of tiles already on the page, and a patch scheme that is subtly wrong loses work — which is
the thing being fixed. `_claude_notes/highlighting_wires_and_nets.md` §12 records the fork.

### H14 — A label on a terminal the wire does not touch draws nothing *(added 2026-08-24)*

`labels` in `locations.json` is keyed by terminal id, and the key has to be one of that **wire's two
endpoint terminals** or one of that **net's member terminals**. Anything else is a decision about an
end that does not exist: nothing is drawn, nothing is broken, and on screen it is indistinguishable
from a compass control that does not work.

So `resolve_geometry` builds a `touches` map from the netlist, refuses the override **by name**
(*"puts a label on 'TB-110:1' for W047, which W047 does not touch"*) and drops it. It is the only
refusal in this file whose symptom would otherwise be *nothing at all*, which is why it is checked
against the netlist rather than only for shape.

Two things to keep straight if this moves: the shape check belongs in `parse` (which knows nothing
about this drawing) and the membership check belongs in `resolve_geometry` (which is handed the
netlist). And the **count** in the report says what is *in the file*, so an orphaned override is
counted and reported — the same convention a `label_point` for a wire the netlist does not have has
always had.

### H15 — The end-label plan must see everything, not just what is on screen *(added 2026-08-24)*

`planEndLabels` is handed the **whole** designator index and plans **all 265** labels, and the caller
then draws whichever subset it wants. That looks wasteful and is not optional.

The plan is what decides who gets a contested side: a label whose computed side is already occupied
steps clockwise. Plan only the *visible* labels and that arithmetic changes with every layer switch,
every selection and every zoom past the 30% floor — so pressing `Terminals` would slide an unrelated
wire's label around its pin. A label that wanders when you press something unrelated is a label a
reader stops believing is attached to anything, and the cost of the alternative is one pass over 275
entries in a memo.

The same reasoning is why the reservations include **every** marker's own id label whether or not
that group is switched on.

### H16 — Two rows of buttons with the same words, doing different things *(added 2026-08-25)*

The Drawing tab now carries `Components`, `Terminals`, `Wires` and `Nets` **twice**: once in the
toolbar, where they decide what the *sheet* draws, and once over the list, where they decide what the
*list* shows. That is the design and it is what the screen is for — but it has two consequences worth
writing down before somebody tidies them into one control.

- **They must stay separate in the code.** `shown` (a `Record<Layer, boolean>` in `DrawingTab`) and
  `kinds` (a `Set<ListKind>`) are different shapes over different vocabularies on purpose: `Layer`
  has a `labels` member and `ListKind` does not, because a label is not a row. Anything that "unifies"
  them has to answer what pressing `Labels` should do to the list, and the answer is nothing.
- **They must stay distinguishable to anything that finds a button by its name** — a screen reader, a
  test. Each row is a labelled `role="group"`: **`Layers on the sheet`** and **`Filter the list`**.
  `DrawingTab.test.tsx`'s `group()` and `listFilter()` helpers scope through those labels, and
  dropping either label turns a dozen tests into *"found multiple elements"* — which is the honest
  failure, and better than a test that silently presses the wrong one.

The other half of the split is what is **persisted**: `appStore.drawingListOpen` is (it is a decision
about how much sheet you want to see), and the filters and the search text are not (a list that came
back tomorrow showing only wires reads as a broken index rather than as yesterday's filter).

---

## 5. Invariants — if one of these is violated, that is the bug

1. **A wire's route is never *computed*.** Not in the file, not in the editor, not in the API. A wire
   carries `label_point` and, since 2026-08-24, the sides of its two end labels — and nothing else.
   *(Restated with the §3 amendment the user accepted on 2026-08-23: a route lifted from the PDF's
   own conductor strokes, or traced by a person, becomes legal in Session 5. A route **synthesised
   from its endpoints** never does, and that is what this invariant has always actually guarded. The
   index's §8 now carries the full wording.)* Owner: `LABELLABLE` (`model.ts`), `_labels`
   (`server/app/locations.py`), and ▲ `fold_in_labels` — which is **not** in the server: it is in
   `schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py`, the generator.
   **Nor is one ever drawn.** No dot appears at a wire's or a net's `point` — that is the centre of a
   bounding box, which is usually blank paper — on either tab. `atLabelPoint` in `DrawingTab.tsx`
   returns `null` until somebody has said where the *name* is printed, and the wire/net layer and the
   selected marker both go through it, so neither can grow the behaviour the other lacks.
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
8. **Nothing writes a coordinate a person did not choose.** *(added 2026-08-24 with the keyboard.)*
   A click places, a drag moves, a nudge corrects — and the nudge only ever moves a point the draft
   **already owns** (`draftPoint`), never a resolved seed or a parent fallback. Turning an estimate
   into a `source: human` point one arrow-press away from it would be a `derived` tier by the back
   door, which is invariant 3 in different clothes.
9. **A label's position depends on the points and nothing else.** *(added 2026-08-24 with the end
   labels.)* Not on what is selected, which layer is on, what the zoom is, or the order the payload
   arrived in. Owner: `planEndLabels` in `features/drawing/endLabels.ts`; hazard H15 is the reasoning
   and *"is the same plan however the index is ordered"* is the test.
10. **A default is never written into the file as though a human chose it.** *(added 2026-08-24.)*
   *Reset to default* **deletes** the override, un-hiding deletes it, and `hidden: false` is stripped
   on the way in and refused on the way back out. Owner: `setEndLabel` (`model.ts`) and `_end_labels`
   (`locations.py`) — refused from *both* ends deliberately. This is invariant 3 in a third set of
   clothes: a file that cannot distinguish *nobody has looked at this* from *a person decided this*
   has stopped being a record of who said what, which is the only thing it is for. T-570 walks it,
   and it is the one assertion in that document worth reporting loudly.
