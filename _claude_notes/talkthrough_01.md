# Talkthrough, 01: *"Talk me through it"*, an answer spoken aloud on the Drawing tab while it lights up every identifier it cites

*Written 2026-09-26 in a planning session. Nothing here is built yet. This is **first in the
queue**. `narrated_walkthrough_01.md` is second and reuses what this builds (§11). The building
session starts with "read `_claude_notes/talkthrough_01.md` and execute the requests" and nothing
else, so this file has to be enough on its own.*

---

## §0 How to use this document

1. **Read §0 to §3 and §13 to §14 first.** They are the rules. Each phase (§4 to §7) carries its
   own reading list and acceptance criteria.
2. **Ask §15's questions at the start of the session, in one batch**, before opening a code file.
3. **Say at the start whether the funded budget covers the phase you are about to run** (§12). The
   user has said the scope has widened and going over budget is expected. **What is not optional
   is a cost strategy** (§13), so price each phase before it starts and report what it cost.
4. Phases run in order. Each ends green and leaves nothing half-installed.
5. **Plans are documents first.** If a phase uncovers a design question this file does not answer,
   write the question down and stop. Do not improvise a second plan inside a building session.

---

## §1 Why this plan exists

### 1.1 In the user's words

> 1. While on the "Ask" tab, the user submits a question such as the following, but it could be any
>    question: *Assuming that the machine is not connected to any upstream or downstream machines
>    via the infeed interface or the discharge interface, please explain the entire chain of events
>    that must occur in order to energize the "Run" wire which connects to terminal RECEPT1:3.*
> 2. You (the ai model) generate an answer as usual.
> 3. The user has the option of:
>    1. Simply reading the answer while using the hyperlinks provided to look at the items on the
>       drawing and then using the F2 key to flip back to the "Ask" tab to read more of the answer.
>       That is what the user does now.
>    2. Pressing a **"Talk me through it"** button in which you switch to the "Drawing" tab and
>       **speak the narrative you have already written while highlighting the items you have
>       already created hyperlinks for** in your narrative.
>
> There should be controls that allow the user to **pause the speech as a new item is highlighted**
> so as to have time to understand what is being shown. There might be other controls on the same
> pallet that allow the user to **step back or step forward** in the talkthrough to the next
> sentence and or the next/previous highlighted item. **The pallet should be movable** so that if it
> obstructs the user's view of the drawing it can be moved out of the way.

### 1.2 What that decides

- **Nothing new is generated.** The talkthrough reads the answer already on the screen, and
  highlights exactly the identifiers that are already links in it. There is no second model call,
  no server change, and nothing sent anywhere. Voice is the browser's `window.speechSynthesis`.
  **This is a client-only feature: rebuild the bundle, never restart the server.**
- **"The items you have already created hyperlinks for" has a precise meaning in this code.** A
  backticked span becomes a link only if `resolve(byToken, text)` finds it in the designator index
  **and** it has a `point` (`Citation.tsx`). **The talkthrough highlights exactly that set and
  nothing else.** It uses the same parser, the same `resolve` and the same test, so the spoken
  answer and the read answer can never disagree about what is a link.
- **The option in 3.1 stays exactly as it is.** The talkthrough is a button beside the answer. It
  changes nothing about reading, clicking or `F2`.
- **It highlights and never authors.** It calls `appStore.select` and `setActiveTab`, which are the
  two actions a `Citation` click calls, and nothing else. The standing rule (§14.3) holds: a
  feature may arm, select, switch and highlight, and may not write a byte of the user's data.

### 1.3 Why it is worth building first

The whole project aims at one sentence in `goals_01.md` §1: **the model highlights things on the
drawing *as it speaks its answer*.** Today it writes the answer, and the reader does the
highlighting by hand, one `F2` round trip per identifier. A chain-of-events answer like the
RECEPT1:3 one cites 20 to 40 identifiers, which is 20 to 40 round trips. **The talkthrough is the
first version of *as it speaks*.** It is honest about being a replay of text already written,
and it needs no model change to exist.

---

## §2 The goal test

The work is done when all of the following hold:

1. On the `Ask` tab, after **any** answer finishes streaming, a **`Talk me through it`** button sits
   in the answer's footer beside `Copy markdown`.
2. Pressing it switches to the `Drawing` tab, opens a **palette** at the top right, and starts
   speaking the answer **sentence by sentence**. The palette shows the sentence being spoken as a
   caption.
3. **Just before each linked identifier is spoken, the sheet flies to it and highlights it**, as a
   click on that link would: a component is ringed, a wire or net is painted along the ink, and
   the selection card names it. With **`Pause at each item`** on, the speech then waits for the
   dwell the reader chose (a few seconds, or *until I press ▶*) before saying the name and going
   on.
4. The palette's controls work at any moment:
   - **play/pause**
   - **previous/next sentence** and **previous/next item**
   - the **pause-at-each-item** setting
   - **speed**
   - **mute** (captions only)
   - **exit**
5. **The palette can be dragged anywhere by its title bar**, stays inside the window, and is still
   where the reader left it after a reload.
6. `Esc` or `✕` ends the talkthrough and **leaves the last item selected**. `F2` back to the Ask tab
   pauses it, and `▶` resumes on the Drawing tab. Sending a new question or pressing `New
   conversation` ends it.
7. **It works with any answer**, including tables, lists and headings, and including an answer with
   no links at all (it simply speaks). **It works in a browser with no voice**, as timed captions.
   **It works with `SWUI_ALLOW_EDITS=false`**, because it needs no password.

---

## §3 What exists that this reuses (measured 2026-09-26)

### 3.1 The answer and how it becomes links

- **`webui/src/stores/chatStore.ts`.** `Message { id, role, text, status: 'streaming' | 'done' |
  'cancelled' | 'error', tools, costUsd, model, … }`. **`text` is the answer's full markdown.**
  `reset()` clears the conversation; `send()` appends a new user and assistant pair.
- **`webui/src/components/Markdown.tsx`** renders the answer with `react-markdown` 9 and
  `remarkPlugins={[remarkGfm]}`, with no raw HTML. Its `code` override treats a span as **inline**
  unless it has a `language-…` class or contains a newline, and renders inline spans as
  `<Citation>`. **Inline code is mdast's `inlineCode` node.** Parsing the same text with
  `remark-parse` + `remark-gfm` therefore yields exactly the spans the screen turned into links.
- **`webui/src/components/Citation.tsx`**:

  ```ts
  const entry = resolve(byToken, textOf(children))
  if (!entry || !entry.point || !hasViewer) return <code>{children}</code>
  // on click:
  select(entry.kind, entry.id)          // origin defaults to 'text' → the Drawing tab flies
  setActiveTab(DRAWING_TAB_ID)
  ```

  **That is the whole highlight gesture, and the talkthrough repeats it, never a synthesised
  click.** `hasViewer` is `!!s.drawing?.tiles?.count`.
- **`webui/src/lib/designators.ts`.** `resolve(byToken, token): Designator | null` (line ~249)
  accepts an exact id or alias, and also `NET 110`-style forms. `Designator` has `kind`, `id`,
  `label`, `point`, `on_sheet`. `byToken` lives in `appStore` (built once in `loadAll`).
- **Measured on 2026-09-26: all 43 identifiers in the RECEPT1:3 chain resolve with a point.** These
  are the components `CR-BP`, `BYPASS-CB`, `CR1`, `CR2`, `PB1`, `PB2`, `CR-ON`, `CR-SW`, `INFEED1`
  and `DISCHARGE1`, their terminals, the wires `W025` through `W056`, and the nets `24E-1`, `125`,
  `120`, `121`, `RUN`, `0V`, `110` and `130`. So the user's example question lights up on every
  identifier it should.

### 3.2 The parser is already installed

`webui/package.json` declares `react-markdown ^9.0.3` and `remark-gfm ^4.0.0`. **`unified`,
`remark-parse`, `mdast-util-to-string` and `unist-util-visit` are present in `node_modules` as
transitive dependencies.** Phase 1 declares the two it imports (`unified`, `remark-parse`) in
`package.json` **at the versions already installed** (`npm ls unified remark-parse` first). Relying
on a transitive import is trap T9. No new download is expected.

### 3.3 The stores a driver calls

`webui/src/stores/appStore.ts`:

- `select(kind, id, origin = 'text', from?)` bumps a `nonce`, so re-selecting the same id re-flies.
- `clearSelection()`.
- `setActiveTab(id)`, with ids from `webui/src/tabIds.ts`: `ASK_TAB_ID = 'ask'` and
  `DRAWING_TAB_ID = 'drawing'`.
- `activeTabId`, `byToken`, `drawing`.
- It uses zustand `persist` with `partialize` (model, active tab, list open). **The talkthrough's
  own settings get their own persisted store**, not fields in this one (§5.3).

**The Drawing tab flies on `selection.nonce` when `origin !== 'drawing'`**
(`DrawingTab.tsx` ~line 578–581), and it is `keepMounted` (`webui/src/tabs.ts`), so it flies even
while the Ask tab is showing. Selecting a wire or net paints its runs from `/api/paths`, and the
selection card opens `bottom-3 left-3`.

### 3.4 Where the button goes

`webui/src/features/ask/MessageView.tsx`. The assistant message's footer row (~line 88–105) holds
the model `Badge`, `formatUsd(costUsd)`, `formatDuration(durationMs)` and a ghost `Copy markdown`
button with `ml-auto`. **`Talk me through it` goes immediately before `Copy markdown`**, uses the
same `variant="ghost" size="sm" className="h-6 px-2"` and a lucide `Volume2` icon, and renders only
when `message.status === 'done'` and the built talk has at least one sentence.

### 3.5 The corners and keys already taken

- `bottom-3 left-3` holds the selection card **and** the conductor card, and `bottom-3 right-3`
  holds the path card (project traps 18 and 26). **The palette defaults to the top right** and is
  draggable anyway.
- `Escape`: the Drawing tab has a `window` keydown listener (`DrawingTab.tsx` ~599) that **returns
  early on `event.defaultPrevented`** and otherwise clears the selection.
- `F2` (`App.tsx` ~59) shuttles between Ask and Drawing from anywhere.
- **Arrow keys nudge the sheet** (`useTileViewport`'s key handler, which declines some keys when
  focus is in a text field; read its guard, trap T6). `0` fits.

### 3.6 Speech, from the user's own working code

`/home/js/aiken/ranger/Multi_CIP_Simulator.html` (114 KB: **grep it, never read it**), lines
~1686–1740, measured 2026-09-26:

- a `speechSupported` guard: `'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window`
- `pickVoice()`, which prefers `Google US English`, `Microsoft (Aria|Jenny|Guy|Michelle|Zira|David)`,
  `Samantha` and `English (United States)`, falls back to any `en-*`, then to `voices[0]`, and
  caches the choice
- `onvoiceschanged`, which resets the cache
- `stopSpeaking()`, which calls `speechSynthesis.cancel()`
- `narrateStep`, which resolves on the utterance's end **or** after a fallback hold when muted or
  unsupported

Its comment is worth keeping: *100% client-side, no server, no API key, nothing leaves the
browser.* **The draggable card** comes from the same file's CSS (~164–232): `⠿` handles on the
title and `cursor: move`. Port the idea, not the CSS.

---

## §4 Phase 1: turning an answer into something to speak. Pure functions, no UI.

**About $5–7.**

### 4.1 The data shape

```ts
// webui/src/features/talkthrough/buildTalk.ts
export interface Cite { kind: DesignatorKind; id: string; token: string }  // token = as written
export interface Segment { show: string; say: string; cite?: Cite }       // cite fires BEFORE say
export interface Sentence { segments: Segment[]; block: 'p' | 'li' | 'h' | 'row' }
export interface Talk { sentences: Sentence[]; items: { s: number; g: number }[] }  // items = every cite, in order
export function buildTalk(markdown: string, byToken: Map<string, Designator>, hasViewer: boolean): Talk
```

### 4.2 The rules, each one a test

1. **Parse** with `unified().use(remarkParse).use(remarkGfm).parse(markdown)`. This is the same
   grammar `Markdown.tsx` renders with. Parse once, then walk block by block.
2. **Blocks spoken:** paragraphs, list items (each item its own block), headings, and table rows.
   **Fenced code blocks and HTML are skipped** and neither spoken nor captioned. Blockquotes are
   walked for their paragraphs.
3. **Tables:** skip the header row. Speak each body row as one sentence, joining its cells with
   commas. **Inside a row the header is not re-spoken.** Keeping a row short and cell-shaped is
   what makes a chain-of-events table listenable. §15 Q5 asks whether to go further.
4. **A link is an `inlineCode` node that `resolve` finds with a `point`, and only when
   `hasViewer`.** This is `Citation`'s test, character for character, and a fixture asserts both
   agree over a real answer (4.4). An `inlineCode` that does not resolve is spoken as plain text
   and highlights nothing, the same way the screen renders it as plain `<code>`.
5. **Sentences** are split with `Intl.Segmenter('en', { granularity: 'sentence' })`. It handles
   `e.g.` and decimals better than a regex, and it exists in every target browser and in Node for
   the tests. **Before segmenting, each `inlineCode` is replaced by a private-use placeholder
   (`` + index)**, so no identifier (`TB-0V:9`, `CR-BP:A1`) is ever split or read as a
   sentence end. The placeholders are restored afterwards.
6. **Segments:** a sentence is cut **immediately before each link**. Segment 0 is the text before
   the first link. Every later segment starts with its link and carries it as `cite`. Playing
   segment *k* therefore means: *highlight its `cite` → dwell → speak it*. **The eye reaches the
   sheet just before the ear hears the name**, and the pause the user asked for falls on a
   boundary, never mid-word.
7. **Repeats:** a link identical to the previous `cite` in the same sentence keeps its segment but
   drops the `cite`. Re-flying to the thing already on screen is noise.
8. **`show`** is the segment's text as written, with the identifier as written. **`say`** is the
   same text with each identifier replaced by its spoken form (4.3), and with markdown emphasis
   and link syntax removed.

### 4.3 Saying an identifier: generic, and never drawing-specific

`webui/src/lib/speakId.ts` exports `speakId(entry: Designator, token: string): string`. It must
work on any drawing, so **no identifier appears in it** (§14.4):

- **A terminal** (`entry.kind === 'terminal'` and the id contains `:`): speak the part before the
  colon, then *"terminal"*, then the part after. So `TB-0V:9` becomes *T B zero V terminal nine*.
- **Letters:** a run of 1 to 3 capitals is spelled letter by letter (`CR`, `TB`, `PB`). A longer
  run is spoken as a lowercase word (`RECEPT`, `BYPASS`, `INFEED`), because a voice reads a word
  better than eight letters.
- **Digits:** a run with a leading zero is spoken digit by digit (`W048` → *W zero four eight*).
  Otherwise the run is left for the voice to read as a number (`125`).
- `-` and `_` become spaces.
- **A net** keeps its kind: it becomes *net* plus the spoken id, unless the preceding text already
  ends with the word *net*. So *"on net `125`"* is not spoken as *net net one two five*.

§15 Q6 asks whether the user wants a per-drawing pronunciation override file. **The default is no**,
because the generic rule is the part that survives drawing number two.

### 4.4 Reading list (and nothing else)

- `webui/src/components/Markdown.tsx` and `Citation.tsx`, whole (both short, both quoted in §3.1).
- `webui/src/lib/designators.ts`: `resolve`, `normalise`, the `Designator` type (`grep -n 'export'`,
  then those ranges).
- `webui/src/api/types.ts`: `Designator`, `DesignatorKind` (grep).
- **One real answer as a fixture.** `ls _claude_notes/webui_acceptance/` holds curated, committed
  acceptance runs. Take one whose answer has a table and 10 or more citations, and copy only its
  answer markdown to `webui/src/features/talkthrough/fixtures/answer.md`. If none is suitable, run
  the server's `translate()` over an archived turn with a `python -c` one-liner and join its `text`
  events. **Never `cat` a turn file.**
- How the existing tests build a `byToken`: `grep -rn 'buildLookup(' webui/src --include=*.test.*`.
  Reuse that fixture. Do not invent a new one.

### 4.5 Acceptance: `buildTalk.test.ts` and `speakId.test.ts`

- Each rule in 4.2 has a test, and each case in 4.3 has a test.
- **The agreement test:**
  1. Render `<Markdown>` over the fixture with the same `byToken`.
  2. Collect the text of every `button.cite`.
  3. Assert that list equals the list of `cite.token` from `buildTalk`, **in order**, before
     rule 7's de-duplication.
  If this test ever goes red, the spoken and read answers disagree about what is a link, which is
  the one thing this feature promises cannot happen.
- An answer with no citations yields sentences and an empty `items` list. An empty or whitespace
  answer yields no sentences, and the button stays hidden.

---

## §5 Phase 2: the voice and the engine. Store and timers, no UI.

**About $7–10.**

### 5.1 `webui/src/lib/speech.ts`: one speaker, reusable by plan 2

```ts
export interface Speaker {
  readonly supported: boolean
  speak(text: string, rate: number): Promise<'end' | 'cancelled'>
  cancel(): void
}
export const webSpeaker: Speaker      // the simulator's guard, pickVoice, onvoiceschanged cache
export function timedSpeaker(wpm?: number): Speaker  // no audio; resolves after words / (wpm·rate) min
```

- **Muted or unsupported uses `timedSpeaker`** (default 170 wpm), so captions advance at reading
  pace. This is the simulator's `holdMs` rule, made proportional to length.
- **Pause is `cancel()` and replay the current segment**, never
  `speechSynthesis.pause()`/`resume()`. Those are unreliable on Linux Chrome and Android (trap T3),
  and segments are short enough that repeating one is harmless.
- It lives in `lib/`, which may not import from `features/` (project trap 22), so
  `narrated_walkthrough_01.md` can reuse it unchanged.

### 5.2 `webui/src/features/talkthrough/talkStore.ts`: the engine

**State:**

- `messageId`, `talk`
- `pos: { s, g }` (the sentence and segment)
- `phase: 'idle' | 'highlighting' | 'dwelling' | 'speaking' | 'paused' | 'done'`
- a `gen` counter

**Settings, persisted in their own zustand `persist` key** `talkthrough-settings`:

- `dwell: 0 | 2000 | 4000 | 'press'`, default **2000**
- `rate`: 0.8 to 1.3, default 1.0
- `muted`
- `palette: { x, y } | null` (null means the top-right default)

**Actions:** `start(message)`, `play`, `pause`, `nextSentence`, `prevSentence`, `nextItem`,
`prevItem`, `exit`, `setDwell`, `setRate`, `setMuted`, `setPalette`.

**The loop, one segment at a time:**

1. If the segment has a `cite`: `select(kind, id, 'text')`, then `phase = 'dwelling'`. If `dwell`
   is `'press'`, go to `paused` and stop here. Otherwise wait `dwell` ms.
2. `phase = 'speaking'`, then `await speaker.speak(say, rate)`.
3. Advance to the next segment, or the next sentence. After the last one, `phase = 'done'`, and the
   last selection stays.

**Every await checks `gen` afterwards.** Every control increments `gen` and cancels the speaker, so
a stale promise from before a jump can never advance the new position (trap T4, the one that would
otherwise make *next* skip two).

**How the controls behave:**

- `prevSentence` goes to segment 0 of the previous sentence, or of the current one if more than one
  segment in (as a media player's back button does).
- `nextItem` and `prevItem` jump through `talk.items` and **always re-highlight**, even when paused,
  so a reader can step through the items silently. That is *"step forward to the next highlighted
  item"*.
- `start` calls `setActiveTab('drawing')`. `play` does too if the Ask tab is showing.

**Ending and pausing on its own:**

- `start(message)` on a message still `'streaming'` is refused. The button is not shown then
  anyway.
- **Subscribe to `chatStore`.** If `messageId` is no longer in `messages` (`reset()`), or a newer
  message starts streaming (`send()`), call `exit()`.
- **Subscribe to `appStore.activeTabId`.** Leaving the Drawing tab while `speaking`/`dwelling`
  pauses the talkthrough (§15 Q3).
- `exit()`: cancel speech, set `phase = 'idle'`, and **leave the selection**. The reader stays on
  the last thing they were shown.

### 5.3 Reading list

- `webui/src/stores/appStore.ts`, the `persist`/`partialize` block and `select`, and `chatStore.ts`
  `Message` and `reset`/`send`'s first lines. Grep for them, since both files were measured in
  §3.3.
- The simulator's lines 1686–1740 by `sed -n` (re-grep `pickVoice` first in case they moved).

### 5.4 Acceptance: `talkStore.test.ts`, with fake timers and a fake `Speaker` injected

- `start` switches to the Drawing tab and selects the first cite **before** its segment is spoken.
- Dwell `2000` waits 2 s between the select and the speak. `'press'` stops in `paused` until
  `play`. `0` does not wait.
- `pause` mid-segment then `play` re-speaks that segment from its start.
- `nextItem` while paused selects the next cite and speaks nothing.
- `prevSentence` follows the media-player rule.
- **A jump during a pending speak never double-advances** (the `gen` test).
- `reset()` on `chatStore` exits. Switching the tab to `ask` pauses.
- Muted uses the timed speaker. Settings persist and `pos` does not.

---

## §6 Phase 3: the palette and the button. Client only: rebuild, no restart.

**About $8–12.**

### 6.1 `webui/src/features/talkthrough/TalkPalette.tsx`

It is mounted once in `App.tsx` beside the `Tabs`, not inside a tab, so it survives `F2`. It
renders only when `talkStore.phase !== 'idle'`. It is `position: fixed` at `palette ?? {top: 12,
right: 12}`, about 340 px wide, with `z-50` (check the card z-indices and stay above them), and
`role="dialog" aria-label="Talkthrough"`.

```
┌ ⠿ Talk me through it ────────────────── 🔇  ✕ ┐   ← title bar = drag handle
│ Sentence 4 of 23 · item 7 of 31               │
│ Net `121` goes to an open contact on relay    │   ← caption: the current sentence,
│ **`CR1`**. Press `PB1` and `CR1` pulls in.    │     the current item in bold
│                                               │
│  ⏮ item   ◀ sentence   ▶/❚❚   sentence ▶   item ⏭ │
│  Pause at each item: [ off | 2 s | 4 s | until I press ▶ ]  │
│  Speed: [──●───] 1.0×                         │
│  Voice not available in this browser — captions only   (only when !supported) │
└───────────────────────────────────────────────┘
```

- **The caption is plain text with `<strong>`, not `Markdown`.** A caption's identifiers must not
  be buttons that start a second, competing selection mid-talk. Rendering from `show` makes that
  automatic.
- `phase === 'dwelling'` shows a thin progress bar under the caption for the dwell. `'press'` shows
  **`▶ Continue`**. The reader always knows *why* it has stopped.
- `done` shows *"End of the answer"* with `↺ From the start`, and the rest stays usable.

### 6.2 Dragging: `webui/src/lib/useDraggable.ts`, reusable by plan 2

- Pointer events on the title bar only: `setPointerCapture`, then move, then `setPalette({x, y})`
  on release.
- Clamp so at least 48 px of the title bar stays in the window. Re-clamp on `resize`, so a palette
  left at x=1800 on a large monitor is still reachable on a laptop.
- **Double-click the title bar to put it back at the top right** (`setPalette(null)`).
- It does **not** start a sheet pan: `stopPropagation` on `pointerdown`. The palette is `fixed` and
  outside the sheet anyway. Test it (trap T7).

### 6.3 Keys: scoped to the palette, apart from one

- **`Esc` ends the talkthrough from anywhere.** It is a capture-phase `window` listener that
  **calls `preventDefault()`**, so the Drawing tab's own Escape, which honours `defaultPrevented`,
  does not also clear the selection. It is active only while the palette is open, and it steps
  aside when the event target is a text field (the composer's Escape is the composer's own).
- **Everything else only while focus is inside the palette:** `Space` play/pause, `←`/`→` sentence,
  `Shift+←`/`Shift+→` item. Each calls `stopPropagation` + `preventDefault`, so the sheet does not
  also nudge (trap T6). Pressing any palette button leaves focus in the palette, so the keys work
  straight after the first click.
- **No new global shortcuts.** `F2` keeps its meaning (5.2 turns it into *pause*). §15 Q4 offers a
  global `Space`.

### 6.4 The button in `MessageView.tsx`

- `useMemo(() => buildTalk(message.text, byToken, hasViewer), [message.text, byToken, hasViewer])`,
  computed **only when `status === 'done'`**. That is one parse per finished answer, never per
  streamed chunk (trap T8).
- The button reads **`Talk me through it`**. While that message is the one being talked it reads
  **`Talking…`** and does nothing on a second press, because the palette owns it.
- It sits before `Copy markdown`. Its `title` reads: *"Switch to the drawing and read this answer
  aloud, highlighting each identifier as it is named."*

### 6.5 Reading list

- `App.tsx` lines 1–120.
- `MessageView.tsx` lines 80–110 (quoted in §3.4).
- The Drawing tab's Escape handler, `DrawingTab.tsx` ~584–630, **including the guard at its top**
  (project trap 31).
- `useTileViewport.ts`: its key handler and **its guard**
  (`grep -n 'keydown\|addEventListener\|target' webui/src/features/drawing/useTileViewport.ts`).
- z-index values on the cards: `grep -rn 'z-\[\|z-[0-9]' webui/src/features/drawing/*Card.tsx`.
- `AskTab.test.tsx` and `DrawingTab.test.tsx`: harness helpers only
  (`grep -n 'function \|beforeEach' …`), to reuse `stubServer`.

### 6.6 Acceptance: `features/talkthrough/TalkPalette.test.tsx`, a new file (project trap 11)

- The button is absent while streaming and present when done. Pressing it opens the palette and
  makes the Drawing tab active.
- Palette buttons call the right store actions.
- `Esc` exits **and the selection survives**.
- `Esc` in the composer does not exit.
- Arrow keys with focus in the palette move the talk **and do not nudge the sheet**.
- The drag moves the palette and persists `{x, y}`. Double-click resets it. A position off-screen
  after a resize is clamped back.
- With `speechSynthesis` absent (jsdom's default) the "captions only" line shows and timed captions
  advance.
- **Run the whole Drawing and Ask suites unchanged, and they must stay green.** This phase must not
  alter either tab's behaviour when no talkthrough is open.

---

## §7 Phase 4: walk it on a real answer, then write the documents

**About $4–6, plus at most $1.50 if a live question is asked.**

1. `cd webui && npm run build`, then start the server.
2. On the Ask tab, either:
   - press a starter question, **or**
   - (only if the user says so at the start, §15 Q1) ask the RECEPT1:3 question from §1.1
     verbatim. That costs up to $1.50 and is also the recording the second plan needs, so asking
     it here saves asking it twice. If asked, copy the new turn file from `server/.state/turns/`
     with `cp -p` into `schematic_extraction/PS20115MLM4-2/walkthrough/turns/` for plan 2 (see
     that plan's §4.4 and trap W1 for why not `extracted_docs/`).
3. Press `Talk me through it`, then listen:
   - at every dwell setting
   - once muted
   - once dragged to the far left and reloaded
   - once with `F2` mid-sentence
   - once with `New conversation` mid-talk
   Note any identifier whose spoken form is poor, and adjust `speakId`'s **generic** rules only.
4. **Stop the server** (§14.1).
5. Documents, **in one call**, written from notes taken while walking:
   - `_claude_notes/locate_tab_testing/28_tests_talkthrough.md`: the next free T-numbers after the
     highest in `27_tests_the_ask_tab.md` (**grep for it, never read the file**). One *do this,
     expect that* row each for: the button's appearance, the fly-before-name order, each dwell
     setting, the four step controls, mute and captions-only, drag/clamp/reset, `Esc` keeping the
     selection, `F2` pausing, `New conversation` ending it, a no-citation answer, and
     `SWUI_ALLOW_EDITS=false`.
   - One row in `locate_tab_instruction_and_test_manual.md`'s index table, styled like the `27_`
     row, ending: *"Needs no password. **Client only: rebuild the bundle, do not restart the
     server.**"*
6. Say which files want committing.

---

## §8 Deliberately not in this plan

- **Generating anything new.** There is no second model call, no separate "narration" written by
  the model, and no server-side speech. The narrative is the answer, as the user asked.
- **Highlighting in the Ask tab's text** (marking the sentence being spoken in the transcript). It
  is attractive, but it needs a sentence-to-DOM mapping through `react-markdown` that this plan
  avoids by captioning in the palette. It can come later.
- **Several items lit at once.** `appStore.selection` is one thing, and a net already lights all its
  wires. A multi-selection is a change to the selection model that every other feature reads.
- **Prompt changes.** An answer written for listening (sentences over tables, one identifier per
  clause) would speak better. It would be a `prompts.py` edit and a `PROMPT_VERSION` bump, it
  changes every answer, and it is **§15 Q5, the user's call, never a side effect.**
- **Voice choice in the palette.** `pickVoice`'s preference list decides.
- **The Locate and Review tabs.**

---

## §9 Traps specific to this plan (T-numbers here are traps, not tests)

- **T1. The spoken links and the read links must be the same set.** Same parser (`remark-gfm`), the
  same `resolve`, and the same `point` and `hasViewer` test. §4.5's agreement test is the guard. Do
  not write a regex for identifiers: `Citation.tsx`'s header explains why the allowlist exists.
- **T2. `Intl.Segmenter` will split `TB-0V:9.` or `CR-BP:A1.` badly** if identifiers are left in
  the text. Placeholders go in first (rule 5).
- **T3. Do not use `speechSynthesis.pause()`/`resume()`.** Use cancel and re-speak the segment.
  Long utterances are also cut off at ~15 s on some Chrome builds. Segments are short by
  construction, and a very long link-free sentence may be split at a comma if it passes 200
  characters.
- **T4. Stale promises.** Every await in the loop re-checks `gen`. Without it, pressing *next*
  while a segment is speaking advances twice: once for the press, and once when the cancelled
  utterance's `end` arrives.
- **T5. Speech needs a user gesture before the first `speak`.** The `Talk me through it` press is
  that gesture, so call `speak` from within its handler chain. Do not defer the first utterance
  behind an unrelated timer. Voices load asynchronously, so keep `onvoiceschanged`.
- **T6. Arrow keys belong to the sheet** unless the palette has focus and stops propagation. Read
  `useTileViewport`'s key guard before writing the palette's handler (project trap 31: read the top
  of the handler, not just the branch).
- **T7. The Escape and drag interactions are the two ways this can damage the Drawing tab.** Test
  both explicitly (§6.6).
- **T8. Parse only finished answers.** `useMemo` gated on `status === 'done'`. A parse per streamed
  chunk would re-walk a growing document hundreds of times.
- **T9. Declare what you import.** `unified` and `remark-parse` are present only as transitive
  dependencies. Add them to `package.json` at the installed versions, or a future `npm ci` breaks
  the build.
- **T10. The Ask tab is not `keepMounted`,** and the palette must not live inside it. It lives in
  `App.tsx`. The Drawing tab is `keepMounted`, so a `select` while the Ask tab shows still flies it.
- **T11. A test file is not named after its panel** (project trap 11). The new tests go in the new
  `features/talkthrough/` folder, and any assertion about the answer footer goes in
  `AskTab.test.tsx`, where `MessageView` is already exercised.
- **T12. Lesson file numbers.** `narrated_walkthrough_01.md` §8 names `28_tests_the_walkthrough.md`.
  **This plan runs first and takes `28_`,** so plan 2 must take the next free number. T-numbers:
  never reuse and never renumber (§14.3).

---

## §10 Order

**Phase 1 → 2 → 3 → 4.**

- 1 is pure and fixes the data shape everything else reads.
- 2 is the engine, tested without a screen.
- 3 is the only phase that touches existing components (`App.tsx`, `MessageView.tsx`).
- 4 needs everything.

**Install rule for every phase: rebuild the bundle, never restart the server.** Nothing in this plan
touches `server/app/`.

---

## §11 What this gives the second plan (`narrated_walkthrough_01.md`)

It is written for plan 2's building session to read. **Plan 2 was amended to match on
2026-09-26** (its header note and §3.8), so no further edit is needed unless this build changes a
name. If one does, say so in the write-up so plan 2 can be corrected.

- **`lib/speech.ts`** replaces plan 2 §7.5's port of the simulator's voice code.
- **`lib/useDraggable.ts`** replaces plan 2's draggable-card work.
- **Plan 2's climax (steps A5–A10) collapses.** Its Ask tour can replay the recorded answer and then
  **start this talkthrough on it**. The talkthrough already flies to every identifier in order and
  captions every sentence, so plan 2 no longer scripts nine `cite` steps by hand, and its
  `cite`-must-appear-in-answer test becomes unnecessary. **That is several dollars off plan 2 and
  a truer demo:** the tour then shows the feature a visitor will actually use.
- The RECEPT1:3 recording, if Phase 4 makes it (§7 step 2).

---

## §12 Budget

| phase | estimate | notes |
|---|---|---|
| 1 `buildTalk` + `speakId` | **$5–7** | pure functions, one fixture, the agreement test |
| 2 `speech` + `talkStore` | **$7–10** | fake timers and a fake speaker, so there is no flakiness to chase |
| 3 palette + button | **$8–12** | the only phase editing existing components |
| 4 walk + documents | **$4–6** (+ ≤ $1.50) | one walk, two documents in one call |
| **total** | **$24–35** | |

**If only part is funded:** 1 + 2 in one sitting (~$12–17) lands everything testable with no
visible change. 3 + 4 is the second sitting. Do not split inside a phase.

**Sanity marks:** at 60 calls, $3–6. Past half a phase's estimate before its tests are written
means the reading list grew. Stop and cut.

---

## §13 The token strategy: read this before opening a file

**What makes this plan cheap by construction:** it is client-only (no restart, no server tests
touched), its core is pure functions tested without a screen, and its engine is tested with fake
timers and a fake speaker. So most tests pass on the first or second run, and a test run at 100 K
context costs about a dollar.

**Do not read:**

- `geometry.json`, `circuit_logic.json`, `custom_kg.json`
- anything under `_claude_notes/archive/` or `_claude_notes/highlighting_wires_and_nets*.md`
- `narrated_walkthrough_01.md` (only §11 of this file concerns it)
- any `locate_tab_testing/*_tests_*.md` lesson document (a lesson document is a phase's output,
  never its input)
- `Multi_CIP_Simulator.html` whole
- a whole archived turn file (`head -3` at most)
- `DrawingTab.tsx` whole (1100+ lines; read the ranges named)

**The habits:**

- **Re-locate each phase's reading list in one or two batched `grep -n` calls**, not one call per
  line number.
- **Measure data with a one-liner.** An answer's text comes from `translate()` in the server venv,
  never by reading JSONL.
- **Write tests from fixtures the suite already has** (`stubServer`, the existing `buildLookup`
  fixture). Compute rather than guess.
- **Run the four checks twice per session, at the start and the end**, backgrounded and in
  parallel. Between edits, run only the one new test file (`npx vitest run
  src/features/talkthrough`).
- **Every edit is an exact-string replacement.** Do not re-read a file after editing it.
- **Write each document in one call**, from notes taken while working.
- **Cost ≈ $0.50 × context (M tokens) × calls.** The call count is the lever, so make fewer, fuller
  messages.

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
  which goes red when `locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names
  which. Clear it with the generator (§14.3) before starting.
- A red check in a session that has written no code means something else is wrong. Say so loudly.

**The two things that are easy to get wrong:**

1. **`SWUI_ALLOW_EDITS`** gates the Locate and Review tabs. It is `true` in `server/.env` and the
   editor password is `edit-1234`. With it false those routes are never registered, which is
   deliberate. **The talkthrough uses only Ask and Drawing and needs no password.** Walk it once
   with `SWUI_ALLOW_EDITS=false` to prove it.
2. **The client is a built bundle and `python -m app` has no reloader.**
   - A change under `webui/src/` needs `cd webui && npm run build`.
   - A change under `server/app/` needs a restart.
   - **A rebuilt bundle against an unrestarted server is the dangerous combination.**
   - This plan is client-only, so **rebuild and never restart**. If you find yourself editing
     `server/app/`, stop: the plan did not ask for it.

### 14.2 The project's traps that apply here

- **Trap 10: a panel's plumbing is three edits** (the props interface, the render, the call site).
  Assume that shape for the button in `MessageView` and the palette in `App`.
- **Trap 11:** test files are not named after panels (T11 above).
- **Trap 16: a control is documented in three places, and the third is prose.** The button, its
  tests, and the help text. Add one sentence about `Talk me through it` to `AskTab.tsx`'s `Intro`
  notes, and to the Drawing tab's help paragraph (`DrawingTab.tsx` ~1082–1109) beside *"click any
  identifier in an answer to fly here"*.
- **Traps 18 and 26:** the bottom corners are taken. The palette sits top-right.
- **Trap 22:** `lib/` may not import from `features/`. `speech.ts`, `speakId.ts` and
  `useDraggable.ts` are in `lib/` and import only types and `lib/`.
- **Trap 31: read the top of a handler, not just its branch.** This applies to the Escape and
  keyboard guards.
- **Trap 4:** never assert an absolute count against an authored file. The citation count in a
  test comes from the fixture's own rendering (§4.5), never a number typed into the test.

### 14.3 What not to do

- **Do not author anything** in `locations.json`, `label_corrections.json`, `wiring.json` or
  `author_circuit_logic.py`. Do not hand-edit `circuit_logic.json` or `custom_kg.json`; both are
  generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

- **Do not renumber anything**, and do not reuse a T-number, including demoted ones.
- **Do not auto-accept anything**, and add no control that writes.
- **Do not change `prompts.py`** without the user's answer to §15 Q5. If you do, bump
  `PROMPT_VERSION`.

### 14.4 Git, generality, reporting

- **The user does all git work. Do not commit and do not push.** Read git freely. At the end, name
  the files that want committing.
- **No drawing identifiers in `webui/src/` or `server/app/`.** `speakId` is generic by rule (§4.3).
  Test fixtures may contain real ids; source may not. The talkthrough works on drawing number two
  with no change, because it reads only an answer and the designator index.
- **End the session in the write-up, not a conversation.** Say what it cost, measured from the
  session transcript:

  ```
  ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
  # sum message.usage: input ×$5, output ×$25, cache_creation ×$6.25, cache_read ×$0.50, per 1M
  ```

- **Tell the user which files on the reading lists did not earn their tokens, and which files you
  needed that were not named.** Say it even when the answer is *the list was right*.

---

## §15 Questions to ask at the start of the building session, in one batch

1. **Phase 4's real answer:** walk it on a starter question (free if already asked) or ask the
   RECEPT1:3 question live (up to $1.50), which also gives plan 2 its recording? *Recommended: ask
   it live once.* It is the user's own example, and it serves both plans.
2. **Default dwell at each item:** 2 s (*recommended*), 4 s, off, or *until I press ▶*?
3. **`F2` to the Ask tab mid-talk:** pause (*recommended*, because the reader has left the sheet),
   or keep talking?
4. **A global `Space` for play/pause** while the palette is open (outside text fields)? *Recommended:
   no, keep keys scoped to the palette.* `Space` already scrolls the transcript and presses focused
   buttons.
5. **Answers written for listening:** add a line to `prompts.py` (*"write a chain of events as
   sentences, one identifier per clause; use a table only for lists"*), bump to `v1.4`, and
   re-record anything recorded? *Recommended: not now.* Build first, listen, then decide. The
   talkthrough must work on any answer anyway.
6. **Pronunciation:** keep `speakId` purely generic (*recommended*), or also read an optional
   per-drawing `pronounce` map from the extraction directory? That would mean a server route, and
   it is plan 2's `pronounce` field arriving early.




!!!!        Edit by John, your human coworker         !!!!
I accept all the recommendations to the above 6 questions.



