# Narrated walkthrough, 01: a self-driving tour of the `Drawing` and `Ask` tabs

*Written 2026-09-26 in a planning session. Nothing here is built yet. The building session starts
with "read `_claude_notes/narrated_walkthrough_01.md` and execute the requests" and nothing else,
so this file has to be enough on its own.*

*Amended 2026-09-26, the same day, per `talkthrough_01.md` §11. **This plan is second in the queue
and stands on the talkthrough, which is built first** (§3.8): the voice, the draggable card and
identifier pronunciation now come from there, and the Ask tour's climax is no longer scripted
citation by citation. The Ask tour replays the recorded answer and then **presses `Talk me through
it` on it**. If the talkthrough is not built, stop.*

---

## §0 How to use this document

1. **Read §0 to §3 and §13 to §14 first.** They are the rules. The phases (§4 to §8) each carry
   their own reading list, and **§9 is the script itself.** It is the half the user cannot write
   and the half that decides whether any of this is worth watching.
2. **Ask §15's questions at the start of the session, in one batch**, before opening a code file.
3. **Say at the start whether the funded budget covers the phase you are about to run** (§12).
   Since the amendment the whole plan costs **$26–40**. The user has said the widened scope will go
   over the original funding. **What is not optional is the cost strategy** (§13). §12 shows how to
   split it.
4. Phases run in order. Each ends green and leaves nothing half-installed. **Phase 0 (the
   recording) is the cheapest phase and it removes the most risk**, so it comes first even if
   nothing else is funded.
5. **Plans are documents first.** If a phase uncovers a design question this file does not
   answer, write the question down and stop. Do not improvise a second plan inside a building
   session.

---

## §1 Why this plan exists

### 1.1 In the user's words

> **I want to show this to people who have never seen it.** A panel on the screen with a button on
> it, and pressing that button starts a walkthrough that **speaks to the visitor while it moves the
> application** — switches tabs, presses the switches, selects a component, asks a question on the
> `Ask` tab, and points at what the answer lights up. The two tabs I want shown are **`Ask` and
> `Drawing`**, and that is deliberate: **they are the two that need no password**, so a visitor can
> be handed the URL and nothing else.

> **The only purpose of the walkthrough is to show the user where all the controls are and what
> they are for.** It should teach a human user briefly what the system is, what it does, and how to
> use its controls and features. At some point in the future we will make **another** walkthrough,
> one used for **selling** our services — but there is much more development required before we
> are ready to sell the service.

### 1.2 What that decides

- **It is a tour of controls, not a pitch.** Every switch, filter and card gets named, pressed,
  and its effect said out loud. The tour does not argue that the system is good and does not
  explain the extraction pipeline. That belongs to the later sales walkthrough.
- **One moment may impress, because it is also the most instructive:** *an identifier inside an
  answer is a button*, and pressing it flies the sheet to the thing named. A visitor cannot guess
  this. It is the loop the whole project was built around.
- **It may arm, select, switch and highlight. It may not author.** No Locate tab, no Review tab, no
  `PUT`, and no control that writes a byte of the four authored files. The rule has never moved
  (§14.3), and a tour that wrote the user's data to make a point would break it.

### 1.3 Why the user needs it

There are five tabs, thirteen switches and filters, two cards that can be open at once, and a click
whose meaning depends on the tab. **None of that is discoverable by someone handed only the URL.**
The user has twice asked for a control that turned out to have shipped nine days earlier. A
walkthrough is the cheapest remaining way to make the work usable by people who were not in the
room while it was built.

### 1.4 The thing being copied, which already works

`/home/js/aiken/ranger/Multi_CIP_Simulator.html` is the user's own and does exactly this. **It is
114 KB, so grep it and never read it.** The upper-left panel is headed `Guided tutorials` and has
two buttons, *Start here* and *The mission*. The measured parts worth lifting are listed in §3.5.
**The shape to copy is the two-button launcher:** one tour that covers every control, and one tour
that makes a single argument. Here those are the **Drawing tour** and the **Ask tour**.

---

## §2 The goal test

The work is done when **a person who has never seen the application** can do all of the following
with no password:

1. Open `http://localhost:9700/webui/`, see a **`Guided tours`** panel, and press **`▶ Start here —
   the Drawing tab and every control`**.
2. Watch and hear it name and press all five layer switches, the list, its search box and four
   filters, the zoom and fit controls, and `Source PDF`. It selects a component, a wire and a net,
   shows the net's way-back link, and says what `Esc` and `F2` do.
3. Press **`▶ Ask a question — and follow the answer onto the sheet`**. The recorded question
   appears in the composer and the answer **types itself out**. **The screen says plainly and
   continuously that it is a recording**, with the date, model and prompt version, and that
   nothing is being asked or spent.
4. Watch the tour point at **`Talk me through it`** under the recorded answer and hand over to
   the talkthrough. Its palette speaks the answer sentence by sentence and flies the sheet to each
   identifier just before it is named: `CR-BP`'s coil, `BYPASS-CB`, `PB2`/`CR2`, `PB1`/`CR1`, and
   the shut door through `CR-SW`/net `130`. The tour then ends on **net `RUN` lit at
   `RECEPT1:3`**, whatever order the answer used.
5. Press `Esc` at any point to leave the tour, and find the application exactly as usable as
   before. The pay-off selection is left on screen.
6. Afterwards, find any of those controls again unaided. That is the real test, and the user
   applies it by handing the URL to someone.

**And the negative half, which is the same rule every optional thing in this project follows:**
with the walkthrough file absent there is **no panel and no button**, and nothing else changes.

---

## §3 What exists that this reuses (measured 2026-09-26)

### 3.1 The server

- **Routes** (`server/app/main.py`, found with `grep -n '@app\.'`): `/api/health`, `/api/drawing`,
  `/api/designators`, `/api/paths`, `/api/conductors`, `/api/source`, `/api/tiles/{name}`,
  `/api/questions`, `/api/unlock`, `POST /api/ask` (line ~621), and
  `POST /api/turns/{turn_id}/cancel`. The editor routes are registered inside
  `if settings.allow_edits:` (line ~398). **The walkthrough adds two public routes and registers
  both outside that `if`.**
- **`/api/questions` is the precedent** for "a JSON-shaped thing the server serves":
  `server/app/questions.py`'s `STARTER_QUESTIONS`. The walkthrough differs on purpose. Its script
  is **a file read on every request**, not a Python table, so a sentence can change without a
  restart (decision 3, §3.6).
- **Settings** (`server/app/config.py`): `drawing_dir` (line 37) is the single knob for the drawing.
  `log_dir = SERVER_DIR / ".state" / "turns"` (line 89). `allow_edits` (line 73).
  `effort_for(model)` (line 111).
- **The turn archive** (`server/app/claude_runner.py`):
  - `_open_archive` (line ~636) writes a first line
    `{"type":"_meta","turn_id","session_id","model","effort","prompt_version","drawing_dir"}`.
  - `_emit_line` (line ~569) then appends **every raw CLI stream-json line, verbatim**.
  - **These are not the client's events.** They are the CLI's `system` / `stream_event` /
    `assistant` / `user` / `result` objects.
  - **The archive contains no question text and no timestamps.**
- **`translate(event, cwd, stats)`** (line ~255) turns one CLI object into zero or more client
  events: `init`, `text` (only from `content_block_delta` text deltas), `status` (thinking,
  **never its text**), `tool`, `tool_result`, `denial`.
  - **`start` and `done` are not made by `translate`.** `ClaudeRunner.run` produces them from
    `TurnStats` after the stream ends (`stats.cost_usd`, `duration_ms`, `is_error`, …). A replay
    has to synthesise those two the same way.
  - **Reuse `translate`. Do not write a second translator.**
- **What is on disk:** 90 archived turns in `server/.state/turns/`, 273 B to 305 KB. **The newest
  twelve all have `prompt_version: v1.2`, `model: sonnet`, `effort: low`.** Measured by reading
  line 1 of each. A typical answer is ~300 lines, ~290 of them `stream_event`. **No `v1.3` turn
  exists. `v1.3` is current, so the recording must be made fresh** (Phase 0).
- **`server/.state/` is gitignored** (`.gitignore`, with the comment "visitor text … stay local").
  **So a recording has to be copied out of it to be committed**, and the server must never serve a
  turn straight out of `.state`: that directory is other visitors' questions.

### 3.2 The client stores: what a driver calls

`webui/src/stores/appStore.ts`, all existing:

| action | what it does | used by the tour for |
|---|---|---|
| `setActiveTab(id)` | switches tab; ids in `webui/src/tabIds.ts`: `'ask'`, `'drawing'` | every tab change |
| `select(kind, id, origin='text', from?)` | selection with a `nonce`; **`origin:'text'` makes the Drawing tab fly** to it | every component, wire, net and terminal |
| `clearSelection()` | nothing selected | the `Esc` step and resets |
| `setDrawingListOpen(open)` | the list pane (persisted) | the list steps |

`webui/src/components/Citation.tsx` is **exactly** the gesture the talkthrough repeats. On click it
calls `select(entry.kind, entry.id)` and then `setActiveTab(DRAWING_TAB_ID)`, and renders as
`button.cite` containing a `<code>`. **The tour calls those same two actions. It never synthesises
a click.**

`webui/src/stores/chatStore.ts`:

- `setComposerText(text)` puts a question in the composer. `StarterQuestions` already does exactly
  this.
- `reset()` aborts and clears the conversation.
- `send(question, model)` holds the event handling **inside a closure (`onEvent`)**. That is the
  one thing Phase 2 has to lift out, so that a replay feeds the same handler (§6).
- `sessionCostUsd` is the "This conversation: $x" line in `AskTab.tsx`.
- `Message` has `status`, `tools`, `costUsd`, `model`. `MessageView.tsx` renders `model` as a
  `Badge` (line ~91) and `formatUsd(costUsd)` (line ~93). **That is where the "recorded" badge
  goes.**

### 3.3 The gap: three pieces of Drawing-tab state are not in a store

Measured in `webui/src/features/drawing/DrawingTab.tsx`:

- `const [shown, setShown] = useState<Record<Layer, boolean>>` (line ~191) holds **the five layer
  switches**. Initial state: `components: true`, the other four false.
- `const [kinds, setKinds] = useState<ReadonlySet<ListKind>>` (line ~209) holds the list's four
  filters.
- `const [text, setText] = useState('')` (line ~210) holds the list's search box.
- The zoom and fit controls are `viewer.zoomIn`, `viewer.zoomOut` and `viewer.fit` from
  `useTileViewport`, inside the component.

**Decision 2 ("drive the stores") therefore needs one lift first.** Move `shown`, `kinds` and
`text` into `appStore` **as non-persisted fields** (keep them out of `partialize`, so a reload
still resets them as the existing comments demand), and add a `fitNonce` that the tab watches. That
is Phase 2's first half.

**The path card is deliberately not lifted.** `onPath` (line ~454) is set by a click on painted ink.
The tour spotlights a painted run and invites the visitor to click it themselves (step D12). That
is honest and teaches the gesture.

### 3.4 Where the controls are, for spotlighting

- Tabs: shadcn `TabsTrigger` in `webui/src/App.tsx` (~line 86).
- Layer switches: inside `role="group" aria-label="Layers on the sheet"` (DrawingTab ~line 800),
  each with `aria-pressed`.
- Zoom: `aria-label="Zoom out"` and `"Zoom in"`.
- Fit and `Source PDF` have no aria-label, and neither do the list's filters, search box and
  collapse control in `DrawingList.tsx`, the composer, the starter questions, the tool strip, the
  cost line and `New conversation`. **These get `data-tour="…"` attributes** (Phase 3, §7.3).
- Existing aria-labels are used as they are. Nothing is renamed.

### 3.5 The simulator's engine: what to lift, by line

Measured 2026-09-26 in `Multi_CIP_Simulator.html`. Use `sed -n` only.

| lines | what | lift |
|---|---|---|
| 1127–1145 | the engine's header comment: what it was adapted from, and what it had to change | the honest shape of this port's own header comment |
| 1146–1200 | `TOUR_SCRIPTS`: each step is `{title, body, targets[], highlight[], actions[{kind,…}], cardPosition, holdMs}` | **the schema, nearly verbatim** (§5.2). `targets`/`highlight` become CSS selectors, and `actions` become store calls |
| 1686–1740 | `speechSupported` guard, `pickVoice()` (preferred natural voices, then any `en-*`), `onvoiceschanged` cache reset, `stepNarrationText` (title + flattened body), `stopSpeaking`, `narrateStep` resolving on speech end **or** after `holdMs` when muted or unsupported | **already ported** by the talkthrough as `lib/speech.ts` (`webSpeaker`, `timedSpeaker`). Reuse it; do not read these lines |
| 164–232 | CSS: transparent dim layer, card, `⠿` drag handles on the counter and title, `.tour-pulse` keyframes, `.tour-spotlight` z-lift, `#tour-autoplay.playing`, `#tour-exit { margin-left:auto }`, mobile fallback | the pulse and spotlight only, as Tailwind plus one keyframe; dragging is the talkthrough's `lib/useDraggable.ts` |
| 249–252 | launcher: `<h3>Guided tutorials</h3>`, two buttons, a hint | the `Guided tours` panel |

The narration comment at ~1688 is worth quoting in the port: *"Voice plays only while autoplay
("▶ Play") is running. It is 100% client-side (window.speechSynthesis) — no server, no API key,
nothing leaves the browser."* **The same holds here, and it keeps the two public tabs
permissionless.**

### 3.6 The three decisions already made. Do not re-open them.

1. **The Ask tab replays a recorded turn and never asks live.** A live question costs up to $1.50
   against a daily ledger every visitor shares, and it can fail in front of an audience.
2. **Drive the stores, not synthesised clicks.** Every action is named per step in §9.
3. **The script is a JSON file the server serves**, because a sentence in a narration is exactly
   the kind of thing that changes after watching somebody struggle, and in this project a thing
   worth changing should not need a rebuild.

### 3.7 Every identifier the climax cites resolves (measured 2026-09-26)

All 43 of the following are in `/api/designators` with a `point`, so each renders as a clickable
`Citation` and each flies. Checked with `designator_index(settings.drawing_dir)` from the server's
venv:

- components: `CR-BP`, `BYPASS-CB`, `CR1`, `CR2`, `PB1`, `PB2`, `CR-ON`, `CR-SW`, `INFEED1`,
  `DISCHARGE1`
- terminals: `CR-BP:A1`, `:A2`, `:21`, `:24`, `BYPASS-CB:1`, `:2`, `CR1:11`, `:14`, `CR2:11`,
  `:14`, `TB-120:3`, `TB-0V:9`, `TB-RUN:1`, `TB-24E1-A:7`, `RECEPT1:3`
- wires: `W025`, `W040`, `W043`, `W048`, `W050`, `W052`, `W053`, `W054`, `W055`, `W056`
- nets: `24E-1`, `125`, `120`, `121`, `RUN`, `0V`, `110`, `130`

`/api/paths` publishes 71 wires, and nets including `125`, `120`, `121`, `RUN`, `110` and `130`. So
**selecting any of those nets paints it along the ink.**

### 3.8 What the talkthrough built, which this plan now stands on

`talkthrough_01.md` runs first (the user's queue, 2026-09-26). **Everything below is a plan's
promise, not a measurement, so verify every name with one batched `grep -n 'export'` before relying
on it:**

- `webui/src/lib/speech.ts` exports `Speaker`, `webSpeaker` and `timedSpeaker`. **It is the only
  code that touches `speechSynthesis`.**
- `webui/src/lib/useDraggable.ts` drags by a handle, clamps to the window, and resets on
  double-click.
- `webui/src/lib/speakId.ts` gives generic identifier pronunciation (the user accepted *generic
  only*). `features/talkthrough/buildTalk.ts` turns markdown into sentences, each with `say` text.
- `features/talkthrough/talkStore.ts`:
  - `start(message)`, `exit()`, and a `phase` that ends in `'done'` or returns to `'idle'`
  - it exits on `chatStore.reset()`/`send()` and pauses when the Ask tab is shown
  - its `Esc` is a capture-phase listener that calls `preventDefault()`
- `TalkPalette` is mounted in `App.tsx`, with a default position of **top right**.
- The **`Talk me through it`** button sits in `MessageView`'s footer and shows only on `done`
  messages.
- Probably the RECEPT1:3 recording, already in `walkthrough/turns/`. The talkthrough's Phase 4 was
  told to ask the question live and copy the turn there (its §15 Q1, accepted).

**What changes here because of it:**

- The climax is one hand-over to the talkthrough, not nine `cite` steps.
- The voice port, the drag, the `pronounce` map, the `cite` action and its test all drop out.

If a name differs, adapt this plan's calls to the real one. **If the talkthrough is not built, stop:
this plan no longer carries its own voice or drag.**

---

## §4 Phase 0: record the turn, and read it before anything is built

**This phase decides whether the Ask tour is possible. It costs about $6–9: $4–6 of session plus
one to three questions at up to $1.50 each. It costs about $2–4 if the talkthrough already made the
recording (§4.1).**

### 4.1 Steps

**First, look for an existing recording.** Run `ls -l
schematic_extraction/PS20115MLM4-2/walkthrough/turns/` and `head -1` each file there. If one has a
`prompt_version` equal to the current `PROMPT_VERSION` (`grep -n PROMPT_VERSION
server/app/prompts.py`), skip steps 1–3 and 5 and go straight to step 4. **Reading it against §4.2
is still required.** The talkthrough session listened to the answer; it did not grade it.

1. **Start from green** (§14.1, the four checks), then start the server.
2. On the `Ask` tab, with the model the user chose at the start (§15 Q1), paste **exactly** this
   question. It is the user's wording, to be used verbatim:

   > *Assuming that the machine is not connected to any upstream or downstream machines via the
   > infeed interface or the discharge interface, please explain the entire chain of events that
   > must occur in order to energize the "Run" wire which connects to terminal RECEPT1:3.*

3. When it finishes, the newest file in `server/.state/turns/` is the recording
   (`ls -t server/.state/turns | head -1`). Confirm with `head -1` that its `_meta` says
   `prompt_version: v1.3`.
4. **Read the answer before building anything around it.** Get the text alone with a one-liner
   that runs the server's `translate` over the file and joins the `text` events. That is also the
   exact function Phase 1's route will use, so this doubles as its first test. Do not `cat` the
   jsonl.
5. **Stop the server** in the same turn (§14.1).

### 4.2 The answer has to contain this chain. The netlist says so.

| # | what happens | identifiers the answer should cite |
|---|---|---|
| 1 | +24 V reaches `CR-BP`'s coil high side | `24E-1`, `TB-24E1-A:7`, `W025`, `CR-BP:A1` |
| 2 | the coil's low side leaves on net `125` | `CR-BP:A2`, `W048`, `BYPASS-CB:2` |
| 3 | **`BYPASS 5A` closed** joins `125` to `120` | `BYPASS-CB:1`, `W053`, `TB-120:3` |
| 4 | net `120` reaches `CR2`'s open contact | `W052`, `CR2:14` |
| 5 | **press `PB2`**: `CR2` pulls in, closing `14`–`11` | `PB2`, `W043`, `CR2:A1`, `W046` |
| 6 | net `121` carries it to `CR1`'s open contact | `CR2:11`, `W051`, `CR1:14` |
| 7 | **press `PB1`**: `CR1` pulls in, closing `14`–`11` | `PB1`, `W040`, `CR1:A1`, `W045` |
| 8 | `CR1:11` is on `0V`, so **`CR-BP`'s coil circuit is complete** | `TB-0V:9`, `W050`, `CR1:11` |
| 9 | **`CR-BP`'s NO contact `21`–`24` closes and `RUN` is live** | `CR-BP:21`, `CR-BP:24`, `W055`, `TB-RUN:1`, `W056`, `RECEPT1:3` |

**And the shut door, in the same answer:** the normal path is `CR-ON:14` (`W054`). `CR-ON`'s coil
returns on net `110`, which reaches `0V` only through `CR-SW:14` or `INFEED1:1`. `CR-SW`'s coil
sits on net `130`, which completes only through the downstream machine. With both interfaces
disconnected, the normal path cannot close.

### 4.3 Acceptance, which is a gate

- **Pass:** the answer finds the bypass path through `CR-BP`, puts `CR1`'s and `CR2`'s contacts
  **in series** (so both buttons are required), ends on `RUN` energised at `RECEPT1:3`, and names
  the `CR-ON`/`CR-SW`/`130` path as blocked, with the reason. Minor wording differences are fine.
  So is a missing wire number in the middle, provided most of the chain's identifiers are present
  **in backticks**, because those are what the talkthrough flies to. Count them with
  `buildTalk(...).items.length` over the answer text and write the number down.
- **Fail:** the answer misses the bypass, gets the series pair wrong, stops at *cannot be
  determined*, or cites an identifier the index does not hold. **Then say so and re-ask. Do not
  script around it.** If a second attempt also misses the bypass, `server/app/prompts.py` wants a
  one-line hint about the bypass relay and a bump to **`v1.4`**. **Ask the user before making that
  change.** It is a server-only change (restart, no rebuild), and it also changes the Ask tab for
  every visitor.
- **Never narrate over a wrong answer.** If no attempt passes within the budget the user set, stop
  and write up what the model said. The Drawing tour does not depend on this phase.

### 4.4 Keeping the recording

Copy the passing file, preserving its mtime (`cp -p`), to
`schematic_extraction/PS20115MLM4-2/walkthrough/turns/<turn_id>.jsonl`. **Why there, and not inside
`extracted_docs/`: see trap W1.** Then name the file in the end-of-session list of things to
commit (the user owns git, §14.4).

---

## §5 Phase 1: the server. Serve the script and replay a recording. Restart, no rebuild.

**About $5–7.**

### 5.1 Where the files live

```
schematic_extraction/PS20115MLM4-2/
  extracted_docs/          ← drawing_dir, the model's cwd. The walkthrough is NOT here (trap W1)
  walkthrough/
    walkthrough.json       ← the script (§5.2)
    turns/<turn_id>.jsonl  ← recordings, copied from server/.state/turns
```

- **A new setting, `walkthrough_dir: Path | None`**, defaults to `drawing_dir.parent /
  "walkthrough"`. It is drawing-specific data in the drawing's own tree, and the server only knows
  the shape (§14.4 rule 1).
- **Not editable through the WebUI.** It is not the user's drawing data, and every authoring
  surface in this project exists because the data is the user's. The user edits the file. **The
  route reads it on every request (no `lru_cache`)**, so an edited sentence is live on the next
  page load with no restart and no rebuild. That is decision 3 kept.
- **Absent means absent.** No directory or no `walkthrough.json` → `GET /api/walkthrough` returns
  **404** → the client draws no panel and no button. Malformed JSON → **404 plus one
  `log.warning`**. A broken script must not break the app.

### 5.2 The schema: the simulator's step object, adapted

```jsonc
{
  "version": 1,
  "tours": [
    { "id": "drawing", "label": "▶ Start here — the Drawing tab and every control",
      "steps": [ /* Step[] */ ] },
    { "id": "ask", "label": "▶ Ask a question — and follow the answer onto the sheet",
      "steps": [ /* Step[] */ ] }
  ],
  "recordings": {
    "<turn_id>": { "question": "Assuming that the machine …", "recorded": "2026-09-2x",
                   "replay_seconds": 25 }
  }
}
```

**No `pronounce` map.** A card's narration is the `say` text of `buildTalk(body, byToken,
hasViewer)`. So a backticked identifier on a card is spoken by the same generic `speakId` rule as in
a talked-through answer (talkthrough §4.3).

A **Step** is `{ "title", "body", "highlight": [css selector], "actions": [Action], "card":
"top-right" | "top-left" | "center", "holdMs" }`:

- `body` is **markdown**, rendered by the app's existing markdown renderer, **not HTML**. That
  means no `dangerouslySetInnerHTML` surface, and **a backticked identifier in a card is itself a
  live `Citation`**. That is the tour's lesson made concrete.
- `holdMs` is the fallback duration when voice is muted or unsupported. This is the simulator's
  rule.
- `card` never takes the **bottom corners**. Bottom-left belongs to the selection card and
  bottom-right to the path card (trap W9).

An **Action** is a closed allowlist. An unknown `kind` is refused by name (a warning, then skipped)
and is never evaluated:

| kind | fields | calls |
|---|---|---|
| `tab` | `id` | `appStore.setActiveTab(id)` |
| `layer` | `layer`, `on` | `appStore.setLayer(layer, on)`, new in Phase 2 |
| `layersDefault` | none | `appStore.resetLayers()`, new: components on, the rest off |
| `listOpen` | `open` | `appStore.setDrawingListOpen(open)` |
| `listKind` | `kind`, `on` | `appStore.setListKind(kind, on)`, new |
| `listText` | `text` | `appStore.setListText(text)`, new |
| `fit` | none | `appStore.requestFit()`, new: bumps `fitNonce`, and DrawingTab's effect calls `viewer.fit()` |
| `select` | `kind`, `id`, `from?` | `appStore.select(kind, id, 'text', from)` and then `setActiveTab('drawing')`, exactly Citation's pair |
| `clear` | none | `appStore.clearSelection()` |
| `talk` | none | **hands the screen to the talkthrough**: after the card's narration ends, `talkStore.start(message)` on the last assistant message, then the step waits until `talkStore.phase` is `done` or `idle` (trap W5) |
| `compose` | `text` | `chatStore.setComposerText(text)` |
| `resetChat` | none | `chatStore.reset()` |
| `replay` | `turn` | `chatStore.replay(…)` with the events from `GET /api/walkthrough/turns/{turn}`, new in Phase 2. **Resolves when the replayed message is `done`**, because `talk` needs a finished answer |
| `wait` | `ms` | a pause |

Actions in one step run **in order**, and `wait` is how they are spaced. The exception is `talk`,
which always runs **after** the card has been narrated, so two voices never overlap.

### 5.3 The two routes

- **`GET /api/walkthrough`** returns the parsed JSON, or 404. No password. It is registered outside
  the `allow_edits` `if`.
- **`GET /api/walkthrough/turns/{turn_id}`**:
  - `turn_id` is validated against a UUID pattern, so there is no path traversal.
  - The file must exist in `walkthrough_dir/turns/`, never `log_dir`, **and** be listed in
    `walkthrough.json`'s `recordings`. Otherwise 404.
  - It reads line 1 as `_meta`, then feeds every later line through **`translate(event,
    Path(meta["drawing_dir"]), stats)`** and collects the client events.
  - It **synthesises `start`** (with no `session_id`, see trap W10) and **`done`**, from the same
    `TurnStats` fields `run()` uses. `done`'s `cost_usd` is the recorded cost, which the client
    labels and does not add up (§6.2).
  - Response: `{ "meta": {turn_id, model, effort, prompt_version, current_prompt_version,
    recorded}, "question", "events": [...] }`. `question` and `recorded` come from the
    `recordings` entry, because the archive holds neither (§3.1).
  - `thinking` text never appears. `translate` already reduces it to `{"t":"status"}`.

### 5.4 Reading list (and nothing else)

- `server/app/main.py`: the route table (`grep -n '@app\.'`), `/api/questions` (~366), the
  `allow_edits` block's first 5 lines (~394–400), and the `ask` route's calls into the runner
  (~621–705), to see how `start` and `done` are made.
- `server/app/claude_runner.py`: `TurnStats` (~line 75–95), `translate` (~255–352), and where
  `run()` builds `start` and `done` (grep `"t": "start"` and `"t": "done"`).
- `server/app/config.py`: lines 30–120.
- One existing route test file, to copy its fixture style: `ls server/tests/`, then grep for
  `questions`.

### 5.5 Acceptance

- New tests in `server/tests/test_walkthrough.py`:
  - 404 when the directory is absent.
  - 404 on malformed JSON.
  - 200 with the parsed file.
  - An edit to the file is visible on the next request with no restart.
  - Replay: 404 for an id not in `recordings`, for a malformed id, and for a file that exists only
    in `log_dir`.
  - **The events equal what `translate` yields line by line**, built from a small synthetic
    archive written by the test.
  - `start` first, `done` last.
  - No `text` event contains thinking.
- **Two tests over the committed files, each skipped when the directory is absent**, like `K6`'s
  artifact test:
  1. **Every recording's `prompt_version` equals `PROMPT_VERSION`.** This goes red after any
     change to `prompts.py`, **which is the re-record reminder the user asked for**, written as a
     test so it cannot be forgotten. The failure message says *re-record: see
     narrated_walkthrough_01.md §4*.
  2. **The recording's answer is non-empty and did not end in error** (no `done.error`). What it
     cites is graded by a person in Phase 0, not by a test. The climax no longer scripts
     citations; the talkthrough flies to whatever the answer cites.
- Restart the server. `curl -s localhost:9700/api/walkthrough | head -c 200` and one replay `curl`
  both return the expected shape. Then stop the server.

---

## §6 Phase 2: the store seams. Client only: rebuild, no restart.

**About $7–10.**

### 6.1 `appStore`: lift the Drawing tab's view state

- New fields: `layers: Record<Layer, boolean>`, `listKinds: ReadonlySet<ListKind>`,
  `listText: string`, `fitNonce: number`.
- New actions: `setLayer`, `toggleLayer`, `resetLayers`, `setListKind`, `setListText`,
  `requestFit`.
- **None of these go into `partialize`.** The two comments in `DrawingTab.tsx` (~line 200) and on
  `appStore.drawingListOpen` explain why a reload must reset them. **Move those comments with the
  state.** Do not delete them.
- The `Layer` and `ListKind` types move to where the store can import them without importing a
  feature. **`lib/` and `stores/` may not import from `features/`** (§14.2 trap 22). Check the
  current import direction first.
- `DrawingTab` swaps its three `useState`s for store selectors, and adds one effect:
  `useEffect(() => { if (fitNonce) viewer.fit() }, [fitNonce])`.
- **This is a refactor with no visible change.** The existing `DrawingTab.test.tsx` (switches
  T-190, list T-600–T-650) must stay green **unchanged**, apart from a `beforeEach` that resets the
  new fields (trap W6).

### 6.2 `chatStore`: one event handler, and a `replay`

- **Lift `onEvent` out of `send` into a module function `applyEvent(set, get, event)`.** `send`
  calls it, so its behaviour is identical, and the existing `AskTab.test.tsx` stays green.
- New action: **`replay(question, meta, events, {seconds})`**:
  - It pushes the user message and a streaming assistant message **exactly as `send` does**, with
    `busy: true` so the composer cannot send mid-replay.
  - It feeds `events` through `applyEvent` on a timer. `text` events are spaced so the whole
    answer takes `seconds` (default 25, taken from `recordings`). `tool`/`tool_result` events get a
    fixed ~400 ms. There are no timestamps to honour (§3.1), so the timing is set by the replay and
    not by the original turn.
  - `start` **does not set `sessionId` or `turnId`** (trap W10).
  - `done` sets the message's `costUsd: 0` and **does not change `sessionCostUsd`**. The recorded
    cost goes on the badge instead.
  - It is cancelable. `stop()` and `reset()` clear the timer (a module variable beside
    `controller`, the same idiom).
- New optional `Message.recording?: { recorded, model, effort, promptVersion, costUsd, stale }`.
  `stale` is `promptVersion !== current_prompt_version`.
- **The honesty, in the message itself:** `MessageView` renders a badge on a `recording` message,
  beside the model badge:

  > **Recorded answer — replayed, not live.** Asked on 2026-09-2x · sonnet · prompt v1.3 · it cost
  > $0.19 then and nothing now. A new question starts a fresh conversation.

  If `stale`, it adds: *"The prompt has changed since — this answer may differ from a live one."*
  **The badge stays after the tour ends**, so a visitor who scrolls back up is never left to
  believe the answer was live.

### 6.3 Reading list

- `webui/src/stores/appStore.ts` and `chatStore.ts`, whole. They are short, and this phase edits
  both.
- `DrawingTab.tsx`: lines 1–60 (imports and types), 186–230 (the state), and every use of
  `shown`/`setShown`/`kinds`/`text` (`grep -n 'shown\|setShown\|kinds\|setKinds\|\btext\b'`).
- `DrawingList.tsx`: its props interface only.
- `MessageView.tsx`: lines 80–100.
- `DrawingTab.test.tsx` and `AskTab.test.tsx`: the `beforeEach` and harness helpers only
  (`grep -n 'beforeEach\|function stubServer\|setState'`).

### 6.4 Acceptance

- All existing web tests pass with no assertion changed.
- New tests:
  - `appStore` `setLayer`/`resetLayers`/`requestFit`, plus the persisted snapshot **not**
    containing them.
  - `DrawingTab` repaints when `setLayer` is called from outside, and fits on `requestFit`.
  - `chatStore.replay` with fake timers produces the same final `Message.text` and `tools` as
    feeding the same events through `send`'s path; it leaves `sessionId` null and
    `sessionCostUsd` unchanged; `stop()` mid-replay ends `cancelled`.
  - `MessageView` renders the recorded badge, and the stale line when versions differ.

---

## §7 Phase 3: the tour engine and the panel. Client only.

**About $9–13.** It was $12–18 before the talkthrough supplied the voice and the drag, and it is
still the biggest phase.

### 7.1 Files

A new `webui/src/features/tour/`:

- `types.ts`: the §5.2 schema as TS types.
- `tourStore.ts`: `script`, `active: {tourId, index} | null`, `playing`, `muted`. `load()` fetches
  `/api/walkthrough` once from `App`; a 404 leaves `script: null`.
- `actions.ts`: `run(action)` implements **exactly** the §5.2 table, and nothing that could author
  (trap W8).
- `narration.ts` is **a thin wrapper, not a port.** `narrate(step)` speaks the title plus the joined
  `say` text of `buildTalk(step.body, byToken, hasViewer)`. It uses `lib/speech.ts`'s `webSpeaker`,
  or `timedSpeaker` when muted or unsupported, and treats `holdMs` as a floor.
- `TourCard.tsx`: the card, dragged by its title with the talkthrough's `lib/useDraggable.ts`, step counter `3 / 14`, title, markdown body, and controls
  `◀ Back`, `Next ▶`, `▶ Play` / `❚❚ Pause`, `🔊` / `🔇`, `✕ Exit`.
- `Spotlight.tsx`: adds `.tour-spotlight` + `.tour-pulse` to each `highlight` selector's element
  and removes them on step change. **No arrow layer in v1.** The simulator's arrows are
  SVG-computed and cost more than they teach here, where the pulse sits on the control itself. Say
  so in the header comment.
- `ToursPanel.tsx`: the launcher (7.4).

### 7.2 Behaviour

- **Entering a step:** clear the old spotlight, run the step's actions in order, apply the new
  spotlight, then narrate if `playing` and not `muted`. The step advances when narration resolves
  (speech end, or `holdMs`).
- **Manual (`Next`/`Back`) is the default.** `Back` re-runs the previous step's actions from a
  **reset baseline**, so steps must be idempotent: each step sets the layers and list it needs
  rather than relying on the one before. The script in §9 is written that way.
- **`Esc` exits.** The listener is registered **in the capture phase** and calls
  `preventDefault()`, so the Drawing tab's own `window` Escape (which returns early on
  `defaultPrevented`, `DrawingTab.tsx` ~line 600) does not also clear the selection (trap W4).
  **While a talkthrough is running, its `Esc` wins.** The tour's handler returns early if
  `event.defaultPrevented` **or** `talkStore.getState().phase !== 'idle'`, so the first `Esc` ends
  the talk and a second ends the tour (trap W15).
- **On exit:** `resetLayers()`, clear the list's filters and search, stop speech, cancel any replay
  or talkthrough **only if still running**, and **leave the selection and transcript**. The pay-off stays on the
  screen and the recorded answer keeps its badge.
- The tour refuses to start while `chatStore.busy`, because a live question is running. If the Ask
  tour starts with an existing conversation, its first step's `resetChat` is preceded by a
  `confirm()`: *"The tour replaces this conversation with a recorded one."* (§15 Q5.)

### 7.3 `data-tour` attributes: the one edit list to get right

Add `data-tour="…"` (kebab-case) to:

- DrawingTab: fit button (`fit`), `Source PDF` (`source-pdf`), the layer group (`layers`), the help
  paragraph (`drawing-help`), the sheet container (`sheet`).
- DrawingList: each filter (`list-filter-component` … `-net`), search box (`list-search`), collapse
  (`list-toggle`), the list itself (`list`).
- App: each `TabsTrigger` (`tab-ask`, `tab-drawing`).
- AskTab: intro notes (`ask-intro`), cost line (`ask-cost`), `New conversation` (`ask-new`).
- Composer (`composer`), StarterQuestions (`starters`), ToolStrip (`tool-strip`), the model picker
  if it exists (grep `setModel` in `features/ask/`).
- SelectionCard (`selection-card`).
- The talkthrough's `Talk me through it` button in `MessageView` (`talk`) and its palette
  (`talk-palette`).

**Grep each component's props and outer element before editing. This is §14.2 trap 10's three-edit
shape, once per component.** Layer switches are addressed by their existing `aria-label` group plus
the visible label text (the engine accepts `[data-tour=layers] button:nth-of-type(n)`), so they need
no new attributes.

### 7.4 The panel

- **`Guided tours` sits at the top of the Ask tab's intro**, above the starter questions, where a
  visitor lands. It has the two tour buttons (the simulator's `tour-launch-1` / `tour-launch-2`
  styling: solid accent, then outlined) and a one-line hint: *"Cards appear on screen and the
  controls they describe pulse; press ▶ Play to let it drive and speak, or Next to go at your own
  pace."*
- **And a compact `▶ Tours` button in the tab bar** (`App.tsx`, beside the triggers), which opens
  the same panel as a popover. The intro vanishes after the first message, and a visitor must still
  be able to start the tour.
- Both render only when `tourStore.script` is non-null.

### 7.5 Voice

- **Use `lib/speech.ts`, and never touch `speechSynthesis` directly.**
- **The tour is silent while a talkthrough runs.** It must not `speak` or `cancel` then, because
  `cancel()` is global and would cut the talk off mid-word (trap W16).
- Speak only while `playing`. The `▶ Play` press is the user gesture browsers require before
  `speechSynthesis.speak`.
- `🔇` cancels at once, and unmuting takes effect from the next step. This is the simulator's rule.
- In jsdom there is no speech, so tests inject a fake `Speaker` (the talkthrough's pattern) and
  run on `holdMs`. That is intended.

### 7.6 Reading list

- The simulator's `TOUR_SCRIPTS` (1146–1200) and CSS (164–232) by `sed -n`, re-grepping
  `TOUR_SCRIPTS\|tour-card` first if they have moved. **Not** its voice lines: `lib/speech.ts`
  replaced them.
- The talkthrough's public surface only: `grep -n 'export' webui/src/lib/speech.ts
  webui/src/lib/useDraggable.ts webui/src/features/talkthrough/*.ts`.
- `App.tsx`: lines 1–120.
- `AskTab.tsx` `Intro` (~line 140–190).
- `webui/src/components/Markdown.tsx`: its props only.
- `webui/src/index.css`: a grep for `@keyframes` (to see if one exists).
- The outer elements named in 7.3, by batched `grep -n 'return (' -A3`.

### 7.7 Acceptance: `features/tour/Tour.test.tsx`, a new file

- No script (404) → no panel, no `▶ Tours`.
- Script → both buttons render, and pressing one opens the card at `1 / n`.
- `Next` runs a step's actions: a `layer` step flips the switch's `aria-pressed`; a `select` step
  sets the selection **and** the active tab.
- An unknown action `kind` is skipped with a warning and does not throw.
- `Esc` exits **and the selection survives** (trap W4).
- Exit resets layers.
- `Play` with no speech advances after `holdMs` (fake timers).
- The `talk` hand-over:
  - it starts the talkthrough only after the card's narration ends, and only on a `done` message
  - `Play` does not advance past it until the talk reports `done`
  - `Next` during it exits the talk and advances
  - the first `Esc` ends the talk and leaves the tour open
- **Selector resolution:** load the real committed `walkthrough.json` (read from disk in the test,
  **skip if absent**), render the app with the suite's existing `stubServer` fixtures, and assert
  every `highlight` selector matches an element on
  its tour's tab. **This is the guard against §14.2 trap 16:** a renamed control breaks the tour
  silently, and this test makes that loud.

---

## §8 Phase 4: the script file, and the documents. Data only: no rebuild, no restart.

**About $5–8.**

1. Write `walkthrough/walkthrough.json` from §9. It is transcription, and each step's `actions` are
   already named there.
2. Load the app, then walk both tours once manually and once on `▶ Play`, with the server running.
   Listen to at least three steps for pronunciation. A poor spoken identifier is a fix to
   `speakId`'s **generic** rules, never a per-drawing override (talkthrough §4.3). **Stop the
   server.**
3. Documents, **in one call**, written from notes taken while doing 1–2:
   - `_claude_notes/locate_tab_testing/29_tests_the_walkthrough.md`, or the next free file number
     (`ls` first; the talkthrough took `28_`). Use the next free T-numbers after the highest in
     `28_tests_talkthrough.md` (**grep for the highest T-number there, never read the
     file**, and do not reuse or renumber, §14.3). One *do this, expect that* row each for: no-file
     → no panel; both tours; `Esc`; the recorded badge and its stale line; the re-record test; and
     editing a sentence in the JSON then reloading, with no restart.
   - One row in `locate_tab_instruction_and_test_manual.md`'s index table, in the style of the
     `27_` row. Its last cell says: *"Needs no password. Phases 1: restart; 2–3: rebuild; editing
     the script: neither."*
4. **Say which files want committing:** `walkthrough/` (script and recording), the server and
   client changes, and the two documents.

---

## §9 The script, written to be read aloud

*This is the text the walkthrough speaks and shows. Card text and narration are the same prose.
Backticked identifiers render as live citations on the card, and the talkthrough's generic
`speakId` rule decides how they sound. Each step lists its actions and spotlights, so Phase 4 is transcription.*

*Two tours, as in the simulator: one covering every control and one making a single argument. The
Drawing tour runs about three minutes. The Ask tour runs about two minutes plus however long the
answer takes to hear.*

### Tour 1: `▶ Start here — the Drawing tab and every control`

**D1 · What this is**
*actions:* `tab drawing` · `clear` · `layersDefault` · `listOpen true` · `listText ""` · `fit` ·
*highlight:* `[data-tour=tab-drawing]` · *card:* center · *hold* 12 s

> This is an electrical schematic that you can talk to. The sheet is a real drawing. Every
> component, terminal, wire and net on it has been indexed, so the application knows what each
> mark is and can show you where it is. This tour takes about three minutes. It names every control
> on this tab and presses each one, so you can find them yourself afterwards. Press Next to go at
> your own pace, or Play to let it drive.

**D2 · Moving around the sheet**
*actions:* `fit` · *highlight:* `[aria-label="Zoom out"]`, `[aria-label="Zoom in"]`,
`[data-tour=fit]` · *card:* top-left · *hold* 11 s

> Drag to pan and scroll to zoom. Double-click zooms in on the place you clicked. These three
> buttons zoom out, zoom in, and fit the whole sheet to the window. The zero key does the same as
> Fit, and the arrow keys nudge the view.

**D3 · The Components switch**
*actions:* `layersDefault` · *highlight:* `[data-tour=layers] button:nth-of-type(1)` · *hold* 10 s

> Above the sheet are five switches, and each one draws a different kind of mark. The first,
> Components, is the only one that starts on. Each dot is a component the drawing names: a relay, a
> breaker, a push button, a terminal block. A switch that is filled in is on.

**D4 · Terminals**
*actions:* `layersDefault` · `layer terminals on` · *highlight:* `…nth-of-type(2)` · *hold* 11 s

> Terminals draws a dot for every screw a wire lands on. A hollow dot means nobody has placed that
> terminal's own point yet, so it borrows its component's position. The tooltip on every switch
> says how many of each kind have a point to draw.

**D5 · Wires, and their labels**
*actions:* `layersDefault` · `layer wires on` · `layer labels on` · *highlight:* `…nth-of-type(3)`,
`…nth-of-type(5)` · *hold* 13 s

> Wires marks both ends of every wire. The words are a separate switch, Labels, so you can have the
> dots without the text. Each label gives the wire's colour and gauge, because the wire numbers are
> ours and are not printed anywhere on the sheet. Labels hide themselves below thirty percent zoom,
> so zoom in if you cannot see them.

**D6 · Nets, and turning it all back off**
*actions:* `layersDefault` · `layer nets on` · `layer labels on` · `wait 4000` · `layersDefault` ·
*highlight:* `…nth-of-type(4)` · *hold* 12 s

> Nets writes the net's name at every terminal on it. A net is everything that is electrically the
> same point. The five switches are independent. Turn on whichever ones you need to compare, and
> turn them all off to look at the drawing itself.

**D7 · The list**
*actions:* `layersDefault` · `listOpen true` · `listText "CR-BP"` · *highlight:* `[data-tour=list]`,
`[data-tour=list-search]` · *hold* 11 s

> Down the left is a list of every designator on the sheet. Type in the search box to narrow it.
> Here it has found the bypass relay, `CR-BP`. Click any row to select that thing on the sheet.

**D8 · The list's filters filter the list, not the sheet**
*actions:* `listText ""` · `listKind wire on` · `wait 3500` · `listKind wire off` ·
*highlight:* `[data-tour^=list-filter]` · *hold* 12 s

> These four buttons filter the list: components, terminals, wires and nets. They change only the
> list and never the sheet. The switches above the sheet change only the sheet and never the list.
> With none of these four pressed, the list shows everything.

**D9 · Selecting a component**
*actions:* `select component CR-BP` · *highlight:* `[data-tour=selection-card]` · *hold* 12 s

> Selecting something flies the sheet to it and rings it. A card opens in the lower left saying
> what it is. This is `CR-BP`, the run bypass relay, and the card lists its terminals and what
> each one is connected to.

**D10 · Selecting a wire**
*actions:* `select wire W048` · *highlight:* `[data-tour=selection-card]` · *hold* 12 s

> A wire is highlighted along the drawing's own ink, the actual line on the paper, and not a
> straight line between its ends. Its name appears at both ends, even with the Wires and Labels
> switches off. This is `W048`, from the bypass relay's coil to the bypass breaker.

**D11 · Selecting a net, and the way back**
*actions:* `select net 125` · `wait 4500` · `select terminal BYPASS-CB:2 from net 125` ·
*highlight:* `[data-tour=selection-card]` · *hold* 15 s

> A net lights up every wire it is made of, all at once. Its card lists every terminal on it, and
> each row flies to that pin. Here is net `125`. Pressing a row takes you to one of its terminals,
> `BYPASS-CB:2`. The link at the top of the new card takes you back to the net you came from.

**D12 · Your turn: click the ink**
*actions:* `select net 125` · *highlight:* `[data-tour=sheet]` · *hold* 12 s

> Try this yourself after the tour. Click any highlighted run of ink, and a card in the lower right
> names the wire it belongs to. Clicking ink that belongs to no path does nothing. That silence is
> deliberate: it means that stretch has not been traced yet.

**D13 · Escape, F2, and the original**
*actions:* `clear` · *highlight:* `[data-tour=source-pdf]`, `[data-tour=tab-ask]` · *hold* 13 s

> Escape clears the selection and closes the cards. F2 switches between this tab and the Ask tab
> from anywhere, even while you are typing, so you can read a line of an answer, look at the sheet,
> and go straight back. Source PDF opens the original drawing, which stays sharp at any zoom.

**D14 · That is every control**
*actions:* `layersDefault` · `fit` · *highlight:* `[data-tour=drawing-help]` · *card:* center ·
*hold* 10 s

> That is every control on this tab. The line under the sheet repeats all of this in writing. The
> second tour asks the drawing a question and follows the answer back onto this sheet.

### Tour 2: `▶ Ask a question — and follow the answer onto the sheet`

**A1 · The Ask tab**
*actions:* `tab ask` · `resetChat` · *highlight:* `[data-tour=ask-intro]` · *card:* top-left ·
*hold* 13 s

> This is the Ask tab. You type a question about the drawing in plain words. The model answers by
> reading the indexed data (the notes, then the component, terminal, net and wire tables) and cites
> every identifier it used. It is read-only and it only knows this one drawing.

**A2 · Questions it can and cannot answer**
*actions:* `tab ask` · *highlight:* `[data-tour=starters]` · *hold* 13 s

> These are starter questions. Pressing one puts it in the box for you. Some are traps on purpose.
> A question the sheet cannot answer should get the reply *cannot be determined from this sheet*.
> When that happens the system is working correctly.

**A3 · The composer, and what a question costs**
*actions:* `compose <the recorded question>` · *highlight:* `[data-tour=composer]` · *hold* 14 s

> The question goes here. A live question costs real money, up to a dollar and a half, from a daily
> budget everyone who visits shares. So instead of asking live, this tour replays an answer we
> recorded earlier. Here is the question it was asked.

**A4 · A recording, replayed**
*actions:* `replay <turn_id>` · *highlight:* `[data-tour=tool-strip]` · *hold* 26 s

> What you are watching now is a recording, not a live answer. It was asked on
> {recorded} with the {model} model, and it is replaying word for word as the model wrote it.
> Nothing is being asked and nothing is being spent. The strip at the top shows which files the
> model opened, so you can see it checked the data instead of answering from memory. The badge
> under the answer says the same thing and stays there after the tour ends.

*(`{recorded}` and `{model}` are filled from the replay's `meta`. Only these two placeholders exist,
so no template language is needed.)*

**A5 · Talk me through it**
*actions:* `tab ask` · *highlight:* `[data-tour=talk]` · *card:* top-left · *hold* 14 s

> Every identifier with a box around it in this answer is a button. Pressing one switches to the
> drawing and flies to the thing named. But you do not have to press them one at a time. This
> button, Talk me through it, reads the whole answer aloud on the drawing and lights up each
> identifier as it is named. It works on any answer, not only this one.

**A6 · The talkthrough drives**
*actions:* `talk` · *highlight:* `[data-tour=talk-palette]` · *card:* top-left · *hold* 8 s

> The palette at the top right is the talkthrough. It pauses for a moment at each item so you can
> find it on the sheet. Its buttons step back and forward by sentence or by item, change the pause
> and the speed, or mute the voice and keep the captions. Drag it by its title bar if it is in the
> way. Press Escape once to stop it.

*(The card is narrated first. Then `talk` starts the talkthrough on the recorded answer, and the step
waits until it reports `done` or the visitor exits it. While it runs, the tour is silent (trap
W16).)*

**A7 · The run wire is live**
*actions:* `select net RUN` · `wait 4000` · `select terminal RECEPT1:3` · *card:* top-left ·
*hold* 16 s

> That was the whole chain. With the bypass breaker closed, pressing both push buttons together
> energises the bypass relay, and its contact puts twenty-four volts on the run wire. Here is net
> `RUN`, and here is where it arrives, `RECEPT1:3`. The normal route through the neighbouring
> machines stays shut, which is exactly why this machine has a bypass relay.

*(This step is why the tour ends on `RUN` energised whatever order the answer used.)*

**A8 · Your turn**
*actions:* none (the `RUN` highlight stays) · *highlight:* `[data-tour=tab-ask]` · *card:* center ·
*hold* 10 s

> That is the loop: ask a question, then press any identifier in the answer to see it on the
> drawing, or press Talk me through it to hear the whole answer on the sheet. F2 brings you back to
> the line you were reading. Press Escape to end the tour, then ask a
> question of your own.

### 9.1 Two notes on this script, for whoever edits it next

- **A7 states the chain's conclusion in the tour's own voice**, so it must agree with the recorded
  answer. Phase 0's reading is what licenses it. If the answer phrases the conclusion differently,
  **change the card to match the answer, never the other way round.**
- **The Drawing tour uses `CR-BP`, `W048` and net `125` on purpose.** They reappear in the climax,
  so a visitor who takes both tours meets them twice.

---

## §10 Deliberately not in this plan

- **The sales walkthrough.** It comes later and is a separate document, as the user said.
- **Asking live during the tour**, or any control that spends money.
- **Editing the script through the WebUI.** It is not the user's drawing data (§5.1).
- **The Locate and Review tabs.** They need the password, and the tour may not author.
- **Driving the path card.** Its state stays in the component, and the tour invites the click
  instead (D12, §3.3).
- **Arrows.** The pulse sits on the control itself. The simulator's SVG arrows can come later if
  watching someone shows they are needed.
- **A recording UI.** A recording is an ordinary question asked on the Ask tab, then one `cp -p`.
- **Adding the question text to the archive's `_meta`.** It would be a one-line improvement to
  `_open_archive`. But `server/.state/` holds visitor text and the user has not asked for more of
  it, so the question lives in `walkthrough.json`.
- **Server-side speech, video export, other languages.**
- **Scripting the climax citation by citation.** The amendment retired it: the talkthrough does
  this for any answer.

---

## §11 Order

**Prerequisite: `talkthrough_01.md` is built** (§3.8). Then **Phase 0 → 1 → 2 → 3 → 4.**

- 0 comes first because it can kill the Ask tour, and it costs almost nothing.
- 1 comes before 2 because 2's replay needs 1's payload shape.
- 3 needs 2's store actions.
- 4 needs everything.

**Install rules per phase** (§14.1 trap 3): 1 is **restart only**; 2 and 3 are **rebuild only**; 4
is **neither**, because the script is read on every request.

---

## §12 Budget

| phase | estimate | notes |
|---|---|---|
| 0 record and read | **$2–4** if the talkthrough recorded it, else **$6–9** | the reading against §4.2 is never skipped |
| 1 server | **$4–6** | two routes, one setting, ~9 tests (the `cite` test is gone) |
| 2 store seams | **$7–10** | refactor with a green-before-and-after proof, plus `replay` |
| 3 engine and panel | **$9–13** | the voice and the drag come from the talkthrough |
| 4 script and documents | **$4–7** | §9 is shorter, with one walk and two documents in one call |
| **total** | **$26–40** | was $35–52 before the amendment |

**The user has said going over the original funding is expected (2026-09-26), so price each sitting
before starting it.** If it is to be split:

- **A. Phase 0 alone (~$2–9).** It proves the recording is right before a line of the engine is
  written, and it is useful even if nothing else is ever funded. **Recommended as the next
  session.**
- **B. Phases 1 + 2 (~$12–17)** as a second sitting. That lands the routes and the seams, with
  nothing visible yet. Both leave the app exactly as usable.
- **C. The Drawing tour only**: Phase 1 without the replay route, Phase 2 without `replay`, Phase
  3, and §9's Tour 1. **About $16–22.** A visible deliverable for less than the whole, and the Ask
  tour follows as a second slice of about $10–15.

**Sanity marks:** at 60 calls, $3–6. Past half a phase's estimate before its tests are written
means the reading list grew. Stop and cut.

---

## §13 The token strategy

- **Do not read:** `geometry.json` (606 KB), `circuit_logic.json`, `custom_kg.json`,
  `_claude_notes/highlighting_wires_and_nets*.md`, anything in `_claude_notes/archive/`, any
  `locate_tab_testing/*_tests_*.md` lesson document (a lesson document is a phase's output, never
  its input), a whole archived turn (`head -3` at most), or `Multi_CIP_Simulator.html` whole.
- **Measure data with a one-liner.** The designator check in §3.7 was one `python -c` in the
  server venv. The recorded answer's text is one `python -c` over `translate`.
- **Re-locate each phase's reading list in one or two batched `grep -n` calls**, not one call per
  line number.
- **Write tests from the fixtures the suite already has** (`stubServer` and friends in
  `DrawingTab.test.tsx` and `AskTab.test.tsx`). Compute rather than guess, because each guess costs
  a test run.
- **Run the four checks twice per session, at the start and the end**, backgrounded and in
  parallel.
- **Every edit is an exact-string replacement.** Do not re-read a file after editing it.
- **Write each document in one call**, from notes taken while working.
- **Cost ≈ $0.50 × context (M tokens) × calls.** The call count is the lever.

---

## §14 Standing rules. Every one of these has cost a session.

### 14.1 Running it, checking it, and the two things that are easy to get wrong

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is the user's.**

The four checks:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

- **Background them in parallel, but a worker error is not a red test.** If `vitest` dies with
  `ERR_IPC_CHANNEL_CLOSED` or a similar worker error beside pytest, re-run `npx vitest run` on its
  own before reporting anything. Only a named failing test is a failure.
- **Start from green, and read the counts off your own run.** They stood at 263 server and 513 web
  on 2026-09-19 and they move.
- The one known exception is `test_the_committed_artifact_is_exactly_what_the_generator_writes`,
  which goes red when `locations.json` or `wiring.json` is ahead of `circuit_logic.json`. Clear it
  with the generator (§14.3) before starting, so your breakage and the user's stay separate.
- A red check in a session that has written no code means something else is wrong. Say so loudly.

**The two things that are easy to get wrong:**

1. **`SWUI_ALLOW_EDITS`** gates the Locate and Review tabs. It is `true` in `server/.env` and the
   editor password is `edit-1234`. With it false those routes are never registered, which is
   deliberate. **The walkthrough's two tabs need no password, which is the point.** Test the tour
   once with `SWUI_ALLOW_EDITS=false` to prove it (the `11_tests_drawing_list.md` precedent).
2. **The client is a built bundle and `python -m app` has no reloader.**
   - A change under `webui/src/` needs `cd webui && npm run build`.
   - A change under `server/app/` needs a restart.
   - **A rebuilt bundle against an unrestarted server is the dangerous combination.**
   - A new route is server-only, a panel is client-only, and a field added to a published payload
     is both.

Two venvs: `server/.venv` runs the app and its tests. `/home/js/schematics/.venv` is the only one
with `pymupdf`. This plan does not need it.

### 14.2 The traps. W-numbers are this plan's. The rest are the project's that apply here.

- **W1. The walkthrough must not live inside `drawing_dir`.** `extracted_docs/` is the model's
  working directory, and it has Read, Grep and Glob there. A recorded answer or a narration in
  that directory could be found and quoted by a live answer. The walkthrough lives in the sibling
  `walkthrough/` directory, and a test asserts `walkthrough_dir` is not under `drawing_dir`.
- **W2. `server/.state/` is gitignored and holds other visitors' questions.** Copy the recording
  out (`cp -p`). Never serve a turn from `log_dir`.
- **W3. The archive is raw CLI stream-json, not client events.** Replay through `translate`. Do not
  write a second translator. `start` and `done` are built by `run()`, not `translate`, so
  synthesise them from `TurnStats` the same way.
- **W4. `Esc` has two listeners now.** The tour's must be capture-phase and must call
  `preventDefault()`. `DrawingTab`'s Escape honours `defaultPrevented`, and otherwise leaving the
  tour would also clear the pay-off selection. (Project trap 31: read the top of the handler.)
- **W5. The `talk` step waits on another engine.** It resolves when `talkStore.phase` becomes
  `done` or `idle` (subscribe; do not poll). It may start only once the replayed message is `done`,
  which is why `replay` resolves on completion. `talkStore` refuses a streaming message by design,
  so starting too early fails **silently**: nothing opens.
- **W6. Lifted state leaks between tests.** A store field survives across renders where a
  `useState` did not. Reset `layers` / `listKinds` / `listText` / `fitNonce` in the Drawing tests'
  `beforeEach`, or T-190 and T-600 will see one another's switches.
- **W7. Selectors in a JSON file break silently when a control changes.** Phase 3's
  selector-resolution test is the guard. Keep `data-tour` names stable, and grep for them before
  renaming anything (project trap 16: a control is documented in three places, and the third is
  prose).
- **W8. The action table is closed.** No `eval`, no "call any store action by name", nothing that
  reaches `locateStore`, `wiringStore` or `reviewStore`. The tour may arm, select, switch and
  highlight, and it may not author.
- **W9. The bottom corners are taken.** `bottom-3 left-3` is the selection card and `bottom-3
  right-3` is the path card (project traps 18 and 26). **The top right is the talkthrough palette's
  default**, so the tour card defaults to **top-left**, and it is draggable.
- **W10. A replay is not a session.** It must not set `sessionId` or `turnId` or touch the ledger.
  So a visitor's next real question starts a fresh conversation (the badge says so), and `stop()`
  never posts a cancel for a turn that does not exist.
- **W11. No `lru_cache` on the script route.** The whole reason the script is a served file is
  that editing a sentence needs no restart.
- **W12. Speech needs a user gesture and loads voices asynchronously.** Speak only after `▶ Play`.
  `lib/speech.ts` already handles voices. jsdom has no `speechSynthesis`, so tests use a fake
  `Speaker` or `timedSpeaker`, as the talkthrough's tests do.
- **W13. Re-record after any change to `prompts.py`.** `v1.3` is current as of 2026-09-26. The
  `_meta` line's `prompt_version` is how you tell, the Phase 1 test enforces it, and the badge's
  stale line is the visitor's warning.
- **W14. A recorded turn can end `is_error` at the $1.50 per-question cap** with a partial answer.
  Check `done.error` in Phase 0. A truncated answer fails acceptance.
- **W15. Two `Esc` listeners in the capture phase, and their registration order is unknown.** The
  tour's handler returns if `event.defaultPrevented` **or** a talkthrough is running. Together those
  two checks make *the first `Esc` ends the talk, the second ends the tour* hold, whichever listener
  fires first.
- **W16. `speechSynthesis.cancel()` is global.** A tour that cancels or speaks while the talkthrough
  is talking cuts it off. The tour is silent from the moment `talk` starts until it resolves, and
  its `Next` and `Exit` call `talkStore.exit()` rather than cancelling speech themselves.
- Project **trap 3**: the install rules above. Project **trap 10**: a panel's plumbing is three
  edits (props interface, the render, the call site), so assume that shape in every `data-tour`
  edit. Project **trap 11**: tests for a panel are not named after it; the Drawing tab's are in
  `DrawingTab.test.tsx`. Project **trap 22**: `lib/` may not import from `features/`. Project
  **trap 4**: never assert an absolute count against an authored file. A count on a card comes
  off the payload.

### 14.3 What not to do

- **Do not author anything** in `locations.json`, `label_corrections.json`, `wiring.json` or
  `author_circuit_logic.py`. Do not hand-edit `circuit_logic.json` or `custom_kg.json`; both are
  generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

- **Do not renumber anything**, and do not reuse a T-number. Spent numbers stay spent, including
  demoted ones.
- **Do not auto-accept anything**, and do not add a control that writes.
- **Do not change `prompts.py` without asking** (§4.3), and bump `PROMPT_VERSION` if you do.

### 14.4 Git, files, and reporting

- **The user does all git work. Do not commit and do not push.** Read git freely. At the end, name
  the files that want committing.
- Build for generality:
  - **No drawing identifiers in `server/app/` or `webui/src/`.** `CR-BP` and `RUN` live only in
    `walkthrough.json`.
  - The route knows a directory and a schema. A second drawing gets a tour by getting a
    `walkthrough/` directory, and gets none by not having one.
- **End the session in the write-up, not a conversation.** Say what it cost, measured from the
  session transcript:

  ```
  ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
  # sum message.usage: input ×$5, output ×$25, cache_creation ×$6.25, cache_read ×$0.50, per 1M
  ```

- **Tell the user which files on the reading list did not earn their tokens, and which files you
  needed that were not named.** Say it even when the answer is *the list was right*.

---

## §15 Questions to ask at the start of the building session, in one batch

*The talkthrough's own six questions were answered on 2026-09-26, with every recommendation
accepted. Do not re-ask them. That settled this plan's pronunciation question (generic `speakId`
only), so it is no longer here.*

1. **Which model records the answer?** The server default is `sonnet` at effort `low`, which is
   what a visitor gets. *Recommended: record with the default first, because the tour then shows
   what a visitor would actually receive.* Escalate to `opus` only if two attempts miss the bypass
   path, and only with the user's say-so, because that changes what the recording is evidence of.
2. **Which slice is funded?** §12 A, B, C, or more money for the whole.
3. **Launcher placement:** at the top of the Ask intro **and** a `▶ Tours` button in the tab bar
   (§7.4)? Or only one of them?
4. **Voice:** speak only while `▶ Play` runs, as in the simulator (*recommended*), or also on
   manual `Next`?
5. **Starting the Ask tour over an existing conversation:** confirm and then replace it
   (*recommended*), or refuse to start until `New conversation` is pressed?
