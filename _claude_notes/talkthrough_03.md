# Talkthrough, 03: *natural speech first*, then pronunciation, movable cards, keeping what was said, and steering the model with the user's edits

**Written 2026-09-28, from the user's own words on 2026-09-27 and 2026-09-28. This document is
self-contained on purpose: `claude.md` may be empty or about something else by the time it is
executed, so everything a session needs to do this work is here.** It **absorbs and retires** two
plans:

- `talkthrough_02.md` (built 2026-09-27, all but its persistence gap)
- `steering_with_edits_01.md` (written 2026-09-27 and revised 2026-09-28, never built)

Both now live in `_claude_notes/archive/` and are **grep targets, never reads**. Code comments
still cite them by name (`talkthrough_02.md §6` and so on). That is history, not an instruction.
`talkthrough_01.md` (built 2026-09-26) is finished in the same way.

---

## §0 How to use this document

**Read this file whole. It is the reading list, the traps, the budget and the plan.** Then read
**only** the reading list of the session you are executing. Nothing else from `_claude_notes`.

**Session 1 comes first, and alone.** The user, 2026-09-28: *"Let's make this change first before
making any other changes. That is because everything else that is decided depends on the result of
this change."* **Session 1 builds §4 and stops.** The user then listens and reports. Sessions 2–7
wait for that report, and some of their decisions change with it (§16).

**One session per sitting.** When a session's acceptance criteria are met, write it up and stop,
even if there is context left. The write-up is part of the session, not an extra.

**Ask that session's questions (§16) in its first message, in one batch**, before opening a code
file. The user may already have answered them at the bottom of this file. If so, don't ask again.

**If a session's first measurement contradicts this document, the measurement wins.** Every count
below was taken on 2026-09-28, and the user edits and authors between sessions. Recompute; never
quote the page.

**Plans are documents first.** If a session uncovers a design question this file does not answer,
write it down and stop. Do not improvise a second plan inside a building session.

---

## §1 Why this plan exists

### 1.1 The goal, in the user's words

The project's aim (`goals_01.md` §1): **the model highlights things on the drawing *as it speaks its
answer*.** The talkthrough (`talkthrough_01.md`) is the first version of that: **`Talk me
through it`** under an answer switches to the Drawing tab and reads the answer aloud, flying to
each linked identifier as it is named.

The user now uses it to make **videos that teach the circuit and demonstrate deep_schematics**,
including a short one *"which might be used to attract customers that might fund this project."*

### 1.2 What the user asked for, in their own words

**The pause (2026-09-28), after rewriting an answer for the video:**

> I placed any links at the beginning of each sentence. This was to eliminate an uncomfortable
> pause that occurred when the link was in the middle or at the end of a sentence.

And after being told that part of the pause is the talkthrough's own doing:

> Please let's try that fix. **But please make it possible to roll back the change. What I have now
> works very well. I want to be able to get back to the current state if the change does not
> work.** I suggest we have a session where only that one change is made. Then I will test to see
> how well it works. My test will not require that you create any responses to a question. Rather
> I will simply rewrite the answer I already have with the link in the middle and at the end of a
> sentence and we will see how it sounds when read aloud.

**Pronunciation (2026-09-28):**

> When the browser reads this aloud, we hear "disc 1" but it would be better to hear "disconnect
> 1". So what I need is something that keeps the link (`DISC1`) but reads this aloud as
> "disconnect 1". […] The notation idea could be used for one off situations and the list could be
> used for when a particular pronunciation must be used across all responses.
>
> I like your ideas about one-off notation and a per drawing list. **I also think there might still
> be a use for a pronunciation list that covers all drawings.** Perhaps the system checks the global
> list first, then the per drawing list, and finally the one-off notation.

**The cards (2026-09-28):**

> When on the "Drawing" tab, and an item in the list is armed, an information box about that item
> will appear in the lower left of the screen just to the right of the list. Please put a handle on
> this box so that I can move it out of the way when required. Also please make it possible for me
> to copy the text from the information box onto the clipboard.

*(Built on 2026-09-28 for that card, the selection card. §6 does the same for the other two.)*

**Keeping what was said (2026-09-28):**

> I think the only thing left to do from that plan [`talkthrough_02.md`] is **persistent storage of
> the original questions, your answers, and my edits.**

**Steering (2026-09-27 and 2026-09-28):**

> I also wonder if my edited responses can be used to inform you (the ai model) what I am hoping
> you will provide in your responses. […] **I understand that you do not have access to the audio
> and so are unable to listen to the responses as they are read aloud, so I am your eyes and
> ears.** It will be good to make a collection of these edits that I make to your responses. Then
> you can pick up on the style and change your responses accordingly.

### 1.3 What that decides

- **Session 1 is reversible by construction** (§4.1): a palette switch returns the exact current
  behaviour, the old code path is left untouched, and the session is one commit.
- **The user is the only judge of how anything sounds.** No session can hear the talkthrough. A
  listening result is the user's report, never a test's claim.
- **Nothing here generates a second model call.** The talkthrough reads the answer on screen.
  Steering changes the prompt, which shapes future answers.
- **The pronunciation lists are the user's authored data.** A session builds the screen that edits
  them and never writes an entry itself.
- **Steering changes `server/app/prompts.py`, rule by rule, only on the user's yes**, with a
  `PROMPT_VERSION` bump and a restart. Its rules are generic. A *fact* the user corrects is never a
  prompt rule (trap 20).

---

## §2 The goal test

The whole plan is done when:

1. **(Session 1)** With **Natural flow** on, a sentence with links in the middle or at the end is
   spoken **as one continuous utterance**, and each link still lights up as it is named. With it
   off, everything behaves exactly as it did on 2026-09-28.
2. **(Session 2)** `DISC1` is heard as *"disconnect 1"* wherever the user has said so, in three
   ways, from the most general to the most specific:
   - a **global** list for every drawing
   - a **per-drawing** list
   - a **one-off** notation in an edited answer

   The screen still shows `DISC1` as a link.
3. **(Session 3)** The conductor card and the path card can be dragged out of the way and their text
   copied, like the selection card.
4. **(Session 4)** A question, the model's answer and the user's edits survive a reload, and a past
   turn can be reopened on the Ask tab and talked through again.
5. **(Sessions 5–7)** The user's edits are turned into a report, the user accepts style rules from
   it, the rules are in `prompts.py` as `v1.4`, and a measurement shows new answers moving toward the
   user's edits.

---

## §3 What exists that you will reuse (measured 2026-09-28)

### 3.1 The talkthrough engine

- **`webui/src/features/talkthrough/buildTalk.ts`**:
  - `buildTalk(markdown, byToken, hasViewer): Talk` parses with `remark-parse` + `remark-gfm`, the
    grammar `components/Markdown.tsx` renders with.
  - `Sentence { segments, block, keys?, from?, to? }` and `Segment { show, say, cite?, link? }`.
  - **A sentence is cut immediately before each link.** Playing segment *k* means *highlight its
    `cite`, dwell, speak its `say`*.
  - Also exports `buildQuestion`, `sliceTalk` and `Mark`.
- **`talkStore.ts`**:
  - The loop is `run(gen)`: for each segment, highlight and dwell if it has a cite, then
    `await speaker().speak(segment.say, rate, pitch)`, then advance.
  - **Each segment is its own `speak()` call, so its own utterance.** That is the pause (§4).
  - Every control bumps `gen` and cancels. Every await re-checks `gen`.
  - Settings are persisted under `talkthrough-settings`: `dwell` (default `0`), `rate`, `muted`,
    `palette`, `voice`, `pitch`, `questionFirst`, `showSay`.
  - Tests inject speakers with `setSpeakers(voice, timed)`.
- **`TalkPalette.tsx`** is the draggable palette: caption, controls, voice, pitch, toggles.
- **`webui/src/lib/speech.ts`**:
  - `Speaker { supported; speak(text, rate, pitch?) → Promise<'end'|'cancelled'>; cancel() }`
  - `webSpeaker` (the browser's `speechSynthesis`) and `timedSpeaker(wpm = 170)` (no audio, timed)
  - plus `listVoices`, `onVoicesChanged` and `setPreferredVoice`
  - **Pause is cancel and re-speak, never `speechSynthesis.pause()`** (unreliable on Linux Chrome
    and Android).
- **Tests:** `buildTalk.test.ts` (including the **agreement tests**: spoken links equal rendered
  `button.cite`s, and sentence offsets slice the rendered block text), `talkStore.test.ts` (fake
  speakers, fake timers), and `TalkPalette.test.tsx` (the real Drawing tab alongside).
- **Fixtures:** `fixtures/answer.md` (two acceptance answers), `fixtures/recept1_3.md` (the user's
  RECEPT1:3 answer, asked live 2026-09-26) and `fixtures/designators.json` (the real index, trimmed).

### 3.2 How an identifier becomes a link and a spoken word

- `webui/src/components/Citation.tsx`: `resolve(byToken, textOf(children))`. **A link only if the
  entry resolves, has a `point`, and the sheet is tiled.** The allowlist is the designator index,
  never a pattern.
- `webui/src/components/Markdown.tsx` is **the XSS boundary** (no `rehype-raw`, schemes
  allowlisted). It adds `data-md` offsets to spoken blocks. Any change there is additive and
  inert.
- **`webui/src/lib/speakId.ts`**: `speakId(entry, token, before)`. The rules are generic, by shape:
  - terminal `A:B` → *A terminal B*
  - 1–3 capitals are spelt out; longer runs become words
  - a consonant-vowel-consonant run is a word, plus a `WORDS` set (`ON OFF IN OUT UP DOWN`)
  - a digit run with a leading zero is read digit by digit
  - nets say *net* once

  **No drawing's ids appear in it.** Tests: `speakId.test.ts`.
- The designator index is `GET /api/designators` (`server/app/drawing.py` `designator_index()`),
  built into `appStore.byToken` by `lib/designators.ts` `buildLookup`.

### 3.3 The cards on the Drawing tab

| card | file | corner | movable |
|---|---|---|---|
| selection (what you clicked or armed) | `webui/src/features/drawing/SelectionCard.tsx` | `bottom-3 left-3` | **yes, since 2026-09-28**: a grip, a copy button, position in `cardPlacement.ts` (`drawing-card-placement`) |
| conductor (pointing at a line) | `ConductorCard.tsx` | `bottom-3 left-3` | no |
| path (clicking a painted run) | `PathCard.tsx` | `bottom-3 right-3` | no |

- **`webui/src/lib/useDraggable.ts`** does the dragging: `within: 'window' | 'parent'`, `home` and
  `keep`. It clamps inside the window or the offset parent, re-clamps on resize, and a double-click
  goes home.
- **The corners are a rule** (§14.2 trap 9): two cards can be open at once, and `DrawingTab.tsx`
  decides precedence (its comment near line ~1010).
- Tests: `DrawingTab.test.tsx`, `describe('moving and copying the selection card')`, which stubs
  `offsetParent` and rectangles because jsdom has no layout.

### 3.4 Edits, records and archives

- **Edits in the browser:** `chatStore` `Message.edited?` (the user's text) beside `Message.text`
  (the original, never overwritten), with `editMessage(id, text | null)` and `shownText(m)`. The
  edit box is `features/ask/EditBox.tsx`; the answer footer's `Edit` and the question bubble's
  hover pencil are in `MessageView.tsx`. **After Save the screen shows only the edit, with no
  badge** (the user's choice, for video).
- **Edits on disk:** `features/ask/edits.ts` `persistEdits` calls `PUT /api/edited-answers/{turn_id}`
  (`server/app/main.py`, inside `if settings.allow_edits:`, editor password). That route writes
  `schematic_extraction/<drawing>/walkthrough/edited_answers/<turn_id>.json` via
  `server/app/edited_answers.py`:

  ```json
  { "turn_id", "saved_at", "model", "prompt_version",
    "question": { "original", "edited" | null }, "answer": { "original", "edited" | null } }
  ```

  `model` and `prompt_version` come from the turn archive's `_meta` line (`turn_meta()`).
  `GET /api/edited-answers` lists them. **An edit is only saved while the editor is unlocked**; the
  edit box says which applies. **On 2026-09-28 the directory was empty**: the user's first video
  edit was made while locked, and exists only in §3.7.
- **The transcript is not persisted.** `chatStore` has no `persist`, so a reload loses the
  conversation.
- **Turn archives:** `server/.state/turns/<turn_id>.jsonl` (`settings.log_dir`), 92 of them on
  2026-09-28. The first line is `_meta` (`turn_id`, `session_id`, `model`, `effort`,
  `prompt_version`, `drawing_dir`), written by `claude_runner.py` `_open_archive` (~line 640). The
  rest is the CLI's stream events; the answer is its text deltas, via `translate()`
  (`claude_runner.py` ~258). **The question is not in the archive:** it is fed on stdin
  (`claude_runner.py` ~390–398) and never written down. Measured.
- The Ask tab's model session lives in server memory (`app/sessions.py`). A reload loses the
  client's `sessionId`, so a follow-up after a reload starts a fresh model session.

### 3.5 The prompt and the model's sandbox

- `server/app/prompts.py` (288 lines): `PROMPT_VERSION = "v1.3"` (~41) and `ORIENTATION_PROMPT`
  (~43 onward, sections headed `# Your role`, `# Which file to read`, …). The header comments record
  why each version changed.
- `server/app/claude_runner.py` runs the `claude` CLI with **cwd = `extracted_docs/`** and
  `--allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)"`, and passes the prompt with
  `--append-system-prompt`. **The model cannot read `walkthrough/`** (trap 19).
- `server/scripts/acceptance.py` (261 lines) runs fixed questions against a live server with
  substring checks and writes `_claude_notes/webui_acceptance/<ts>-<model>.md`. A sonnet run cost
  about $0.39.
- `server/app/questions.py` holds six starter questions (the sixth, `run-chain-isolated`, is the
  user's RECEPT1:3 question, added 2026-09-28).

### 3.6 Where the user's pronunciation data would live

Nothing exists yet. §5 proposes two authored files, with the same authored-vs-generated rule as the
extraction's own files:

- **global:** `schematic_extraction/pronunciations.json`, beside every drawing
- **per drawing:** `schematic_extraction/<drawing>/walkthrough/pronunciations.json`

The server finds both from `settings.drawing_dir` (`…/<drawing>/extracted_docs`): its
`parent.parent` and its `parent / "walkthrough"`.

### 3.7 The user's first worked edit (2026-09-28), captured here because it never reached the disk

For the funders' video, the user took **one snippet** of the live RECEPT1:3 answer and edited **both
the question and the snippet**.

**The question, as edited:** *"How is power delivered to the 24 Volt net?"*

**The model's snippet (original):**

> `PLG1`/`PLG2` bring 115VAC in → `DISC1` poles L1-T1/L3-T3 (closed) → `CB1` (8A, must be closed) →
> `PS1` converts to 24VDC → `PS1:+` → `CB2` (20A, must be closed) → net `24E-1`, the DC distribution
> bus. `PS1`'s two minus terminals establish `0V`.

**The user's edit:**

> `PLG1` the 30 Amp electrical plug brings 115 Volts AC into the electrical disconnect. `DISC1` is
> the disconnect. This disconnect must be switched to the on position. `CB1` the 8 Amp circuit
> breaker must also be closed. `PS1` the DC power supply is now energized and it converts AC power
> to 24 Volts DC. `PS1:+` is the power supply's output terminal. `CB2` the 20 Amp circuit breaker
> receives the 24 Volt output from the power supply. When the circuit breaker is closed the 24 Volt
> DC distribution buss becomes energized. `24E-1`, which is the 24 Volt distribution buss is seen
> here. `PS1:-1` which is the power supply's minus terminal establishes the zero Volt buss. `0V`,
> which is seen here is the zero volt buss. `PS1:-2`, the power supply's second minus terminal,
> bonds the neutral zero volt buss to the chassis ground. `TB-GND-B:2` is that chassis ground
> terminal. The system is now energized and ready to run.

The user on the original, spoken: *"did show the components and nets in the correct order but the
speech was very unnatural and confusing to listen to"*. On the edit: *"correct, easy to understand
and pleasing to listen to."*

| # | change | the user's reason | kind |
|---|---|---|---|
| E1 | `→` and `/` replaced by words | stated | style |
| E2 | **every identifier opens its sentence** | stated: a link mid- or end-sentence caused *"an uncomfortable pause"*. **Session 1 may make this unnecessary** | style, or an engine fix |
| E3 | **a short description straight after each identifier** (*`DISC1` is the disconnect*) | stated: so a listener can follow | style |
| E4 | units spelt out: *115 Volts AC*, *8 Amp*, *24 Volts DC* | implied by E1 | style |
| E5 | one step per sentence, in the order power flows, ending with the result | implied | style |
| E6 | parenthetical asides dropped (*poles L1-T1/L3-T3 (closed)*) | implied | style |
| F1 | **`PLG1` is the male plug that brings 115 VAC in; `PLG2` is a female receptacle that sends it out to the next machine.** The model said both bring power in | stated: *"You couldn't know that because symbols are not yet indexed from the schematic."* | **fact** (trap 20) |
| F2 | terminals the original did not name: `PS1:-1`, `PS1:-2`, `TB-GND-B:2`, and the chassis bond | the user's knowledge of the sheet | fact. Check each resolves in the index, or it is not a link |

---

## §4 Session 1: natural flow, one utterance per sentence. Alone, and reversible.

**About $8–14. Client only: rebuild the bundle, never restart the server.**

### 4.1 Rollback is part of the design, not an afterthought

1. **A persisted palette switch, `Natural flow`**, a new setting `flow: boolean` in
   `talkthrough-settings`.
   - **Off** runs today's code path, `run(gen)`, **unchanged, byte for byte**.
   - **On** runs the new path.
   - Rollback is one click, and so is an A/B comparison on the same sentence.
2. **The old path is not edited.** The new path is a new function beside it (`runFlow(gen)`), and
   the switch chooses between them. **Every existing talkthrough test runs with `flow: false` and
   must pass unchanged.** That is the proof the old behaviour is intact.
3. **The session is one commit.** Tell the user at the start to commit first (their habit: *"Save
   before …"*), and at the end name exactly the files that make up this change. Then
   `git revert <that commit>` removes it entirely if the switch alone is not enough.
4. **Pausing at items still works the old way.** When `dwell` is not `0` (2 s, 4 s, *until I press
   ▶*), the pauses are wanted, so the new path hands each sentence to the old one. Natural flow
   applies only when *Pause at each item* is off (§16 S1 Q3).

### 4.2 How one utterance still lights each link

- **One sentence, one `speak()`.** Join the sentence's segments' `say` from the current segment to
  its end with single spaces, and record each segment's **character offset** in that string.
- **The timing comes from the voice itself.** A `SpeechSynthesisUtterance` fires `boundary`
  events (`event.name === 'word'`, `event.charIndex`) as it speaks. Extend `Speaker.speak` with an
  optional fourth argument, `onBoundary?: (charIndex: number) => void`, which is **additive**, so
  every existing caller is unchanged.
  - `webSpeaker`: `u.onboundary = (e) => e.name === 'word' && onBoundary?.(e.charIndex)`
  - `timedSpeaker`: simulates boundaries by timer at each word's share of the duration, so muted
    captions and tests behave the same
- **When the voice reaches a link's offset, fly to it.** Set `pos.g` to that segment (the caption's
  bold moves), then `select(cite.kind, cite.id, 'text')`. **Fire on the boundary of the word just
  before the link** (§16 S1 Q2), so the eye still reaches the sheet a moment before the ear hears
  the name, which was 01's promise.
- **A voice that sends no boundaries** (trap 3; some network voices send none) must still light the
  links. At `speak` start, schedule each link on an **estimate**: its offset's share of the text,
  at the rate's words per minute. When the first real boundary arrives, drop the estimates and
  follow the voice. Either way, when the utterance ends, fire any link not yet lit, so none is
  skipped.
- **Long sentences:** a joined sentence over ~220 characters is split **at segment boundaries**
  into several utterances (trap 4). There is a short gap between them, far fewer than today.
- **Controls:**
  - pause cancels, and play re-speaks **from the current segment** to the sentence's end, with
    the offsets recomputed
  - next/previous item jump to that segment
  - `gen` guards every callback: a boundary from a cancelled utterance must do nothing

### 4.3 Reading list (and nothing else)

- `talkStore.ts` whole (≈300 lines) and `speech.ts` whole (≈150). They are the change.
- `TalkPalette.tsx`: `grep -n 'Show spoken text\|questionFirst'` for where the switch goes, then
  those lines.
- `talkStore.test.ts`: its `fakeSpeaker` helper and `beforeEach` (grep), to extend, not to copy.

### 4.4 Acceptance: `talkStore.test.ts` and `TalkPalette.test.tsx`

- With `flow: true` and `dwell: 0`, a three-segment sentence makes **one** `speak` call whose text
  is the three `say`s joined. The fake's `onBoundary` at each link's (preceding-word) offset selects
  that cite and moves `pos.g`.
- With a fake that sends **no** boundaries, the estimates light every link (fake timers), and the
  end lights any stragglers.
- A boundary from a cancelled utterance, after `nextItem`, changes nothing (the `gen` test).
- Pause, then play, re-speaks from the current segment. Muted uses the timed speaker's simulated
  boundaries.
- `dwell: 2000` with `flow: true` behaves exactly as `flow: false` (the old path).
- **Every pre-existing talkthrough test passes with `flow: false`,** and they are not edited except
  to set it.
- The palette shows `Natural flow`, persisted, and toggling it mid-talk takes effect at the next
  sentence.

### 4.5 Documents, and the user's test

Append **T-1705–T-1720** to `_claude_notes/locate_tab_testing/28_tests_talkthrough.md`. They cover
the switch, a link at the start, middle and end of a sentence with it on and off, the no-boundary
voice (try the automatic *Google* voice, then a *Microsoft* or local voice), a long sentence,
pause and resume, and **rollback by unticking**.

The user's own test: rewrite the §3.7 answer with links mid-sentence and at the end, then talk it
through with the switch on and off. **Stop there and wait for the report.**

---

## §5 Session 2: pronunciation, in three layers. About $14–22, and one server restart.

### 5.1 The three layers, most general to most specific

The user: *"the system checks the global list first, then the per drawing list, and finally the
one-off notation."* **Read as layers, each overriding the one before** (§16 S2 Q1): the most
specific word the user wrote wins.

1. **Built-in rules**: `speakId.ts`, as today.
2. **Global list**: `schematic_extraction/pronunciations.json`, for every drawing.
3. **Per-drawing list**: `schematic_extraction/<drawing>/walkthrough/pronunciations.json`.
4. **One-off notation** in the answer text, which wins.

**The file shape** (both lists):

```json
{ "schema": 1,
  "entries": [ { "match": "DISC1", "say": "disconnect 1", "by": "js", "at": "2026-09-28T…Z" } ] }
```

- `match` is **exact and case-sensitive**: a whole identifier (the backticked token as written, or
  an index id) or a whole word in prose (for example `115VAC` → *115 volts AC*, if §16 S2 Q2 says
  prose too).
- **No patterns.** A pattern is the thing `Citation.tsx` exists to refuse.

### 5.2 The one-off notation: `` `DISC1 "disconnect 1"` ``

- **Inside the backticks: the token, a space, and the spoken form in double quotes.** It's easy to
  type in the edit box, invisible on camera, and safe inside a GFM table, where a `|` would split
  the cell.
- **`Citation.tsx`** splits a span matching `^(.+?) "(.+)"$` into *token* and *say*, resolves the
  **token**, and **shows only the token** (`<code>DISC1</code>`), link and all. A span that does
  not resolve still shows only its token.
- **`buildTalk.ts`** does the same split, and the segment's `say` uses the quoted form literally:
  no *net* prefix, no spelling rules.
- **The agreement tests must hold with the notation in the fixture:** the spoken links still equal
  the rendered buttons, and the sentence offsets still slice the rendered text. The rendered text
  no longer contains the quoted part, so the offsets count the *shown* token (trap 5).
- **Added 2026-09-30, at the user's request: a silent link, `` `W12 ""` ``.** Empty quotes: shown and
  lit, never said. It is on screen while the words after it are spoken. Two in a row, or one at
  the end of a sentence, light only for a moment, because one item is lit at a time (§11). A list
  entry with an empty `say` does the same for every mention.

### 5.3 The server

- `GET /api/pronunciations` returns `{ global: entries[], drawing: entries[] }`.
  - **Open to read**: a visitor's talkthrough should say *disconnect 1* too.
  - A missing file is `[]`, and a malformed one is a 500 with the file named.
- `PUT /api/pronunciations/{scope}` (`global` | `drawing`), inside `if settings.allow_edits:`,
  behind the editor password, the whole list replaced atomically (`os.replace`, as
  `edited_answers.py` does). It validates shape, `match` non-empty, and `say` ≤ 200 characters.
- `appStore.loadAll` fetches it once, like `byToken`. `speakId` gains an optional lookup argument,
  so it stays pure and in `lib/` (trap 8).

### 5.4 The screen: `Say it as…`

- With **Show spoken text** on, the palette's current item gets a small **`Say it as…`** button. It
  opens a field prefilled with the current `say`, plus **Save for this drawing** and **Save for
  every drawing**. The next time that item is spoken, it uses the new form.
- It is hidden when the editor routes are absent, and it says *"Unlock the editor (Locate tab) to
  save"* when locked, **inside the palette, never on the answer.**
- **Nothing is written without the user pressing Save** (§14.3).

### 5.5 Reading list

- `speakId.ts`, `Citation.tsx`, and `buildTalk.ts`'s `inline()` and the segment loop (grep
  `close = ()`).
- `server/app/edited_answers.py`, whole: the pattern for an authored side file and its atomic
  write.
- `main.py`'s editor block (grep `if settings.allow_edits:`) and `_require_editor`.
- `appStore.ts` `loadAll` (grep).

### 5.6 Acceptance

- Server: `tests/test_pronunciations.py` covers read with no files, read both, the gated PUT (401
  and 404 when editing is off), shape refusals, and the atomic write.
- Web: `speakId.test.ts` checks precedence (built-in < global < drawing < notation).
  `buildTalk.test.ts` checks the notation and both agreement tests over a fixture that uses it.
  `Markdown.test.tsx` checks that the notation shows only the token.
- `TalkPalette.test.tsx`: `Say it as…` saves through a stubbed fetch, and the next speak uses it.
- Documents: **T-1725–T-1745** in `28_`. **Tell the user the install is a restart plus a rebuild.**

---

## §6 Session 3: the other two cards, movable and copyable. About $5–8. Client only.

**What "the other two movable boxes" means.** The Drawing tab has exactly three floating
information cards (§3.3). The selection card (lower left, what you clicked or armed in the list)
became movable and copyable on 2026-09-28. **The conductor card** (lower left, when you point at a
line on the sheet) and **the path card** (lower right, when you click a painted run) are the other
two. The Locate and Review tabs have side panels, not floating cards, and are not in scope.

1. **The same grip and copy button**, via `useDraggable(…, { within: 'parent', home: {} })`, each
   with its own remembered position (`cardPlacement.ts` gains `conductor` and `path`; §16 S3 Q1).
2. **Refactor, don't copy:** lift `SelectionCard.tsx`'s grip strip and `CopyCard` into one small
   shared component (`features/drawing/CardChrome.tsx`), and use it in all three. The selection
   card's tests must pass unchanged.
3. **The corners stay the rule.** Moving a card must not change which card shows when two are open
   (`DrawingTab.tsx` ~1010). Read that comment first (trap 9).

**Reading list:** `ConductorCard.tsx` and `PathCard.tsx`, their outer `<div>` only (grep
`absolute bottom-3`). `SelectionCard.tsx` lines 1–40 and its `CopyCard`. `DrawingTab.tsx`
~1000–1030.

**Acceptance:** in `DrawingTab.test.tsx`, drag, clamp, reset and copy for each card, with the
existing selection-card tests passing unchanged. Documents: **T-1750–T-1760** in `28_`.

---

## §7 Session 4: keeping questions, answers and edits, and reopening them. About $10–16, and one restart.

**The gap, measured (§3.4):** edits reach disk only when saved while unlocked. The transcript is
lost on reload. The turn archives keep every answer, but **not its question**.

1. **Record the question.** `claude_runner.py` `_open_archive` writes `"question": question` into
   `_meta`: one line, plus a test. Turns asked before this change stay question-less, and are
   listed as *(question not recorded)*.
2. **List and reopen past turns** (§16 S4 Q1), editor-gated like everything that reads a
   visitor's words (§16 S4 Q2):
   - `GET /api/turns` returns `turn_id`, `saved` time (the file's mtime), `model`, `prompt_version`,
     `question` and the answer's first ~120 characters, newest first, capped at 200.
   - `GET /api/turns/{turn_id}` returns the question and the whole answer, joined from the
     archive's text via `translate()`, **plus the saved edit record if one exists.** The id is
     validated as `edited_answers.TURN_ID` does.
3. **On the Ask tab, a `Past answers` list** (collapsed, near the starter questions, only when the
   editor is unlocked). `Open` puts that question and answer into the transcript as a finished
   pair, with any saved edits applied and `turnId` kept, so `Edit`, saving and `Talk me through
   it` all work on it.
4. **Survive a reload** (§16 S4 Q3): persist `chatStore.messages` (not `busy`, not the stream) in
   `sessionStorage`, so an F5 in the middle of preparing a video loses nothing. A reopened or
   restored conversation cannot send a follow-up to the old model session (it is gone), so the
   composer says a new question starts a fresh conversation.

**Reading list:** `claude_runner.py` ~630–660 (`_open_archive`) and `translate()` ~258–300.
`main.py`'s editor block. `chatStore.ts` (the `create` call, `reset`). `edited_answers.py`.
`AskTab.tsx` ~80–100.

**Acceptance:**
- Server tests: `_meta` carries the question. List and read are gated, cap at 200, refuse a bad id,
  and tolerate a question-less archive.
- Web: `AskTab.test.tsx` covers open, edit, talk, and a restored transcript after a simulated
  reload.
- Documents: **T-1765–T-1785** in `28_`.

---

## §8 Session 5: steering, part 1, the edit report. A script, no model change. About $4–6.

**Precondition:** records in `walkthrough/edited_answers/` (`ls … | wc -l`). With none, build and
test the script on synthetic records, say that the real report is empty, and go on: Session 6 can
start from §3.7.

- **`server/scripts/edit_report.py`** reads the records (path from `Settings().drawing_dir`, so
  drawing two works unchanged) and writes **`_claude_notes/steering/edit_report.md`**, fully
  generated. Its first line says so and names the command.
  - **Per record, newest first:** the question (and its edit), the features below, and a
    **word-level diff** (`difflib.SequenceMatcher` over `str.split()` tokens, shown as
    `~~removed~~` / `**added**`, ±20 words of context).
  - A summary table on top.
- **Features, each a small pure function with a test:**
  - *authored, not edited* (token overlap ratio < 0.3)
  - length change
  - preamble removed
  - `##` sections removed or added (for example `Sources`)
  - tables → prose
  - lists ↔ prose
  - backticked identifiers dropped or added
  - arrows and slashes replaced (E1)
  - identifiers moved to sentence start (E2)
  - a description right after an identifier (E3)
  - units spelt out (E4)
  - **fact-changing edits flagged separately** (trap 20)

  All are generic, with no drawing identifier in the script.
- **Reading list:** `edited_answers.py` whole. One record, `head -c 1500`.
  `server/scripts/acceptance.py` lines 1–50, for house style.
- **Acceptance:** `server/tests/test_edit_report.py` covers each feature on synthetic records, and
  the output is deterministic. Run it on the real records and paste only the summary table into
  the write-up.

---

## §9 Session 6: steering, part 2, rules into the prompt. About $4–7, one restart.

1. **Candidate rules**, each one:
   - one imperative, generic sentence in the prompt's voice
   - the edits that motivate it
   - how often it appears
   - what it might break (for example, the 2 a.m. electrician may want the compact table)

   **Start from E1–E6 (§3.7)**, weighted by Session 1's result: if natural flow removed the pause,
   E2 becomes a soft preference (§16 S6 Q2).
2. **Write them to `_claude_notes/steering/candidate_rules.md` and stop for the user's verdict on
   each.** This mid-session question batch is expected.
3. **Accepted rules** go in one new section of `ORIENTATION_PROMPT` (`# How to write the answer`, or
   appended to an existing section on the same subject: `grep -n '^# ' server/app/prompts.py`
   first). `PROMPT_VERSION = "v1.4"`, with a header comment saying what it added and that it came
   from the user's edits.
4. **The facts (F1, F2) are not rules** (trap 20). Where they go is §16 S6 Q4.
5. `pytest` green. If a test pins the prompt's text or version, update it deliberately and say so
   (`grep -rn PROMPT_VERSION server/tests`). **The restart is the user's** if their server is
   running (§14.1).

**Reading list:** `prompts.py` lines 1–60 and its `# ` headings. More only if a rule touches an
existing section.

---

## §10 Session 7: steering, part 3, measure it. About $3–6, plus at most $1.50 live.

1. **The server must run the new prompt.** Check `curl -s localhost:9700/api/health` for
   `prompt_version: v1.4`. Use the user's server if it's up (§14.1), or start one by the safe
   method and stop it.
2. **Re-ask up to five questions whose edits the rules came from**, using the *original* question
   text. Always include *"How is power delivered to the 24 Volt net?"* against §3.7. Use
   `POST /api/ask` with `X-Demo-Password` (`SWUI_DEMO_PASSWORD` in `server/.env`) and join the
   `text` events. Save to `_claude_notes/steering/after/<n>.md`.
3. Run the report's feature functions on *old → new* and *new → user's edit*. Per rule: followed,
   partly, or not.
4. One `acceptance.py` run, compared with the latest in `_claude_notes/webui_acceptance/`. **A
   check that passed before and fails now blocks the change.** Say so, and let the user choose.
5. Write `_claude_notes/steering/steering_01_results.md` in one call.

**The user listens to the new answers through the talkthrough and reports.** That is the real
measurement. The numbers only say what can be read.

---

## §11 Deliberately **not** in this plan

- **Exemplars in the model's context** (trap 19): showing rewritten answers to the model. It is
  its own plan, if ever.
- **Anything automatic.** No rule and no pronunciation is adopted without the user's yes. Nothing
  learns at runtime.
- **Fine-tuning.** It is not available here, and not generic.
- **Highlighting the sentence being spoken in the Ask tab's text**, and multiple items lit at once.
- **The narrated walkthrough** (`narrated_walkthrough_01.md`). It is its own plan. It takes lesson
  file `29_` and **T-2000 onward**.
- **The Locate and Review tabs' panels** (§6 is the Drawing tab's cards only).
- **Symbol indexing** (it would make F1 knowable). That belongs to `highlighting_wires_and_nets_04.md`
  §9.

---

## §12 Order, sessions, and the budget

| # | Session | What it unlocks | Estimate |
|---|---|---|---|
| 1 | **§4 natural flow**, alone and reversible | **every later decision about how answers should be written for listening** | **$8–14** |
| 2 | **§5 pronunciation**, three layers | *disconnect 1*, and the user's own spellings on camera | **$14–22** |
| 3 | **§6 the other two cards** | nothing blocks the sheet | **$5–8** |
| 4 | **§7 keep and reopen** | a prepared video answer survives a reload; the steering data accumulates | **$10–16** |
| 5 | **§8 edit report** | reading the edits as a whole | **$4–6** |
| 6 | **§9 rules into the prompt** | answers written the way the user rewrites them | **$4–7** |
| 7 | **§10 measure** | proof, and the user's ear | **$3–6** (+ ≤ $1.50) |

**Total: $48–79 over seven sessions.** Past sessions came in well under their estimates
(talkthrough 01: $6 against $24–35; 02: about $11 against $31–48), because their cores were pure
functions with fixtures. **§5 and §7 touch the server and are the likeliest to run long.**

**Session 1 must run first and alone** (§0). After it, 2–4 may be reordered at the user's word.
5–7 need edits on disk, so **Session 4 before 5** is the natural order (it makes collecting easy).

**Sanity marks:** at 60 calls a session has usually spent $3–6. Past half a session's estimate
before its tests are written means the reading list grew. Stop and cut.

---

## §13 The token strategy: read this before opening a file

### 13.1 Do not read these

- `geometry.json`, `circuit_logic.json`, `custom_kg.json`, `locations.json`, `wiring.json`
- `_claude_notes/archive/` (including the retired `talkthrough_02.md` and
  `steering_with_edits_01.md`: grep them if a code comment's reference needs it, and never read
  them)
- `_claude_notes/highlighting_wires_and_nets*.md`: their rules that apply are in §14
- `narrated_walkthrough_01.md`
- any `locate_tab_testing/*_tests_*.md` lesson document (a lesson document is a session's output,
  never its input). For `28_`, `tail -5` to find the last row
- `Multi_CIP_Simulator.html`
- a whole turn archive (`head -3 | cut -c1-300` at most)
- all of the edit records (one, `head -c 1500`)
- `DrawingTab.tsx` whole (1100+ lines: the ranges named)
- `prompts.py` whole, and `acceptance.py` whole

### 13.2 The habits that made the cheapest sessions cheap

- **Re-locate each reading list in one or two batched `grep -n` calls**, not one call per line.
- **Measure data with a one-liner.** An answer's text comes from `translate()` or a record, never
  by reading JSONL.
- **Write tests from fixtures the suite already has** (`fixtures/*.md`, `designators.json`, the
  `fakeSpeaker`, `stubServer`, the Drawing tab's `TILES`/`INDEX`). Compute rather than guess.
- **Run the four checks twice per session, at the start and the end**, backgrounded and in
  parallel. Between edits, run only the touched test files.
- **Every edit is an exact-string replacement**, batched in one script where there are several.
  Don't re-read a file after editing it.
- **Write each document in one call**, from notes taken while working.
- **Cost ≈ $0.50 × context (M tokens) × calls.** The call count is the lever.

### 13.3 Sanity marks while working

- A test that fails on its first run is usually the test's arithmetic. Check the expectation
  against a measurement before touching the code (four times in 02, the fix was the test).
- jsdom has no layout, no `PointerEvent` and no `speechSynthesis`. The existing tests show how
  each is stubbed. Reuse those stubs.

---

## §14 Standing rules: every one of these has cost a session

### 14.1 Running it

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**The console is the user's.** If you start a server, stop it in the same turn and **prove the port
is free**. On 2026-09-27 a session left one running and the user could not restart theirs. The rule
was right and the method was wrong, so follow this exactly:

1. **Look first:** `ss -ltnp | grep :9700`. **A listener there is the user's server.** Never start a
   second one and never kill theirs. Use it, if it is running the code you need (only if they
   restarted after your last `server/app/` change), or ask.
2. **Start it so that `$!` is the server:** run `cd /home/js/schematics/server` as its own command,
   then `.venv/bin/python -m app > /tmp/server.log 2>&1 & SRV=$!`. **Never background a
   `cd … && python …` list:** `$!` is then a subshell, and `kill` orphans the server.
3. **Stop it and verify by the port, not the PID:** `kill $SRV`, then `ss -ltnp | grep :9700` must
   print nothing. If a python you started still listens, kill that PID. Say that the port is free.
4. **Never `pkill -f 'python -m app'`:** it matches, and kills, your own shell.

**The four checks:**

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

- **Background them in parallel, but a worker error is not a red test.** A vitest
  `ERR_IPC_CHANNEL_CLOSED` beside pytest is contention. Re-run `npx vitest run` alone. Only a
  named failing test is a failure.
- **Start from green, and read the counts off your own run:** **272 server and 580 web** on
  2026-09-28, and they move.
- The known exception: `test_the_committed_artifact_is_exactly_what_the_generator_writes` goes red
  when `locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names which. Clear it
  with the generator (§14.3) before starting.
- A red check in a session that has written no code means something else is wrong. Say so loudly.

**The two things that are easy to get wrong:**

1. **`SWUI_ALLOW_EDITS`** gates the Locate and Review tabs **and every write route** (edited
   answers, and this plan's pronunciations and past turns). It is `true` in `server/.env`, and the
   editor password is `SWUI_EDITOR_PASSWORD` there (`edit-1234`). With it false those routes are
   never registered, which is deliberate. **The talkthrough itself needs no password.**
2. **The client is a built bundle, and `python -m app` has no reloader.** A `webui/src/` change
   needs `cd webui && npm run build`. A `server/app/` change needs a restart. **A rebuilt bundle
   against an unrestarted server is the dangerous combination.** Say plainly which a session needs:
   Session 1 and 3 need a rebuild only; 2, 4 and 6 need a rebuild and a restart.

### 14.2 The traps

1. **The spoken links and the read links must be the same set.** Same parser, same `resolve`, and
   the same `point`/`hasViewer` test. The agreement tests guard it, so never weaken them.
2. **Stale promises and callbacks.** Every await and every `onboundary` re-checks `gen`.
   Otherwise *next* pressed mid-sentence advances twice.
3. **Not every voice sends word boundaries.** Measure on the user's machine, and never assume. The
   estimate fallback (§4.2) is required, not optional.
4. **Long utterances get cut off** (about 15 s on some Chrome builds). Split at segment boundaries
   past ~220 characters.
5. **Offsets count what is shown.** The `data-md` / `from`/`to` mapping (selection) counts the
   rendered text. The one-off notation hides text, so its quoted part must not be counted (§5.2).
6. **Never `speechSynthesis.pause()`/`resume()`.** Cancel and re-speak.
7. **Speech needs a user gesture before the first `speak`**, and `Talk me through it` is it. Do
   not defer the first utterance behind an unrelated timer.
8. **`lib/` may not import from `features/`.** `speech.ts`, `speakId.ts` and `useDraggable.ts`
   stay in `lib/`, and take data as arguments.
9. **The corners are the rule.** `bottom-3 left-3` holds the selection and conductor cards, and
   `bottom-3 right-3` the path card. The palette defaults top-right. Moving a card changes where
   it is, never which one shows.
10. **A panel's plumbing is three edits** (the props interface, the render, the call site).
11. **A control is documented in three places, and the third is prose.** The button, its tests,
    and the help text: `AskTab.tsx`'s `Intro` notes and the Drawing tab's help paragraph
    (`DrawingTab.tsx` ~1082–1109).
12. **A test file is not named after its panel.** New talkthrough tests go in
    `features/talkthrough/`, answer-footer tests in `AskTab.test.tsx`, and card tests in
    `DrawingTab.test.tsx`.
13. **Never assert an absolute count against an authored file.** Counts in a test come from the
    fixture's own rendering.
14. **Read the top of a handler, not just its branch** (the Escape and key guards especially).
15. **Parse only finished answers.** `useMemo` gated on `status === 'done'`.
16. **Declare what you import.** No new runtime dependency without `package.json` and the lockfile.
    An offline `npm install` fails on an optional tarball, so the lock's root `dependencies` can be
    edited directly, as 01 did.
17. **When the user reports that something does not work, measure before theorising.** `ls -l`,
    `md5sum`, `git status --short`, `ss -ltnp`, and a real request through the running server.
18. **Never restart the user's server while they may have unsaved work** (an edit box open, a Locate
    save badge not `saved`). Ask.
19. **The model cannot see `walkthrough/`**, and must not be given it (`--add-dir` reopens an
    escape). An exemplar is also a set of facts the model would cite as the drawing's.
20. **An edit mixes style and facts, and only style belongs in `prompts.py`.** F1 (`PLG2` sends
    power *out*) as a prompt rule would be a drawing identifier in `server/app/`, and wrong on
    drawing two.
21. **T-numbers:** this plan holds **T-1705–T-1795**, appended to `28_tests_talkthrough.md` (which
    spent T-1600–T-1700). `highlighting_wires_and_nets_04.md` holds T-1800–T-1979 (moved up on
    2026-09-28), and the narrated walkthrough T-2000 onward. **Never reuse and never renumber.**
    If a session's block runs out, stop and ask.

### 14.3 What not to do

- **Do not author anything in the user's authored files:** `locations.json`,
  `label_corrections.json`, `wiring.json`, `author_circuit_logic.py`, the edit records, and this
  plan's pronunciation lists. A session builds the screen; the user makes the entries.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

- **Do not offer the user a hand edit to JSON.** An un-authorable thing is a named gap in a panel.
- **Do not correct the user's data for them, ever, even when you can see it is wrong.** List it,
  explain it, and let them do it. This covers F1: no session writes it into `EXTRACTION_NOTES.md`
  or anywhere else the user authors.
- **Do not auto-accept anything**, and add no control that writes without a press.
- **Do not change `prompts.py` without the user's yes on each rule**, and bump `PROMPT_VERSION`
  when you do.
- **Do not renumber anything.**
- **Do not commit and do not push.** The user does all the git work. Read git freely. **Say at the
  end which files want committing**, and that anything the user authored while walking lands in the
  same commit unless they separate it. **Session 1 especially: its files are one commit, so it can
  be reverted alone.**

### 14.4 Three things to build *for*, not just build

1. **This has to generalise to other drawings.** No drawing identifier in `webui/src/` or
   `server/app/`, and none in a prompt rule. The global pronunciation list is the user's data, not
   code.
2. **The user presents on camera.** Nothing pops up mid-talk. Notices live inside the palette or
   the edit box, never on the answer. What is spoken is what is shown.
3. **Build for the model's highlight.** Every improvement here serves *the model highlights things
   as it speaks*. Natural flow is the first time that sounds like one voice rather than a list.

### 14.5 Ending a session

- Say what it cost, measured from the transcript:

  ```
  ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
  # sum message.usage once per message id: input ×$5, output ×$25, cache_creation ×$6.25,
  # cache_read ×$0.50, per 1M tokens
  ```

- **Tell the user which files on the reading list did not earn their tokens, and which you needed
  that were not named.** Say it even when the answer is *the list was right*.
- End in the write-up, not a conversation.

---

## §15 Documents to write, and where

**Each session writes its own, in one call, from notes taken while its tests were written.**

| session | lesson document | index |
|---|---|---|
| 1 §4 | append **T-1705–T-1720** to `locate_tab_testing/28_tests_talkthrough.md` | extend the `28_` row in `locate_tab_instruction_and_test_manual.md` |
| 2 §5 | append **T-1725–T-1745** (lists, notation, `Say it as…`, precedence) | same row, and say it needs a restart |
| 3 §6 | append **T-1750–T-1760** (both cards) | same row |
| 4 §7 | append **T-1765–T-1785** (past answers, reload, questions recorded) | same row, and say it needs a restart |
| 5–7 | none: `_claude_notes/steering/edit_report.md` (generated), `candidate_rules.md`, `steering_01_results.md` | none |

**And update `claude.md` §1 at the end of every session** to name the next session. It is the file
the user's next *"Greetings"* reads first.

---

## §16 Open questions: ask each session's in its first message, not at the end

**Session 1 (§4):**
1. **Natural flow on or off after the session?** *Recommended: on*, so the test hears it. Untick
   to compare, or to roll back.
2. **When does a link light up?** On the word just before its name (*recommended*: the eye first,
   as today), or exactly as its name starts?
3. **With *Pause at each item* on (2 s, 4 s, until ▶):** keep today's per-item behaviour
   (*recommended*: the pauses are the point then), or pause mid-utterance?

!!!! The following is an edit by John, your human coworker. These are my responses to the questions for session 1  !!!!
For question 1, I accept your recommendation.
For question 2, I accept your recommendation.
For question 3, I have the "Pause" setting off so that the speech will sound natural. Sometimes I turn it on if I need to slow things down but most of the time I prefer to keep the setting to "off".
!!!! This is the end of John's edit.  !!!!


**Session 2 (§5):**
1. **Precedence:** confirm that *"global first, then per drawing, finally the one-off"* means each
   later layer overrides the earlier, so the one-off wins. *Recommended: yes.*
2. **Words in prose too** (`115VAC` → *115 volts AC*), or identifiers only? *Recommended: both, whole
   words, case-sensitive.*
3. **`Say it as…` saves to** the drawing's list by default, with *every drawing* as the second
   button? *Recommended: yes.*
4. **The notation** `` `DISC1 "disconnect 1"` ``: acceptable? *Recommended: yes.*

!!!! The following is an edit by John, your human coworker. These are my responses to the questions for session 2  !!!!
For question 1, I accept your recommendation.
For question 2, I accept your recommendation.
For question 3, I accept your recommendation.
For question 3, I accept your recommendation.
!!!! This is the end of John's edit.  !!!!



**Session 3 (§6):**
1. **Each card remembers its own place** (*recommended*), or one place for all three?

**Session 4 (§7):**
1. **What to keep:** a *Past answers* list reopened from the server's archives and saved edits
   (*recommended*), the transcript surviving a reload in the browser (*recommended, too*), or only
   one of them?
2. **Who may see past answers:** the editor only (*recommended*: on a public demo the archives
   hold visitors' questions), or anyone?
3. **A reopened answer and follow-ups:** a follow-up starts a new conversation (*recommended*: the old
   model session is gone)?

**Session 6 (§9), with Session 1's result in hand:**
1. **Rules only, or rules and then exemplars?** *Recommended: rules only* (trap 19).
2. **E2 (identifier first):** if natural flow removed the pause, keep it as a soft preference
   (*recommended*) or drop it. If it did not, make it a rule.
3. **For every answer, or only under a *"Write for listening"* switch?** *Recommended: every
   answer*, because the user's edit reads better on screen too. Choose the switch to keep the
   compact style for troubleshooting.
4. **Facts the edits correct (F1):** the user adds a line to `EXTRACTION_NOTES.md` (*recommended*,
   written by the user or on their explicit instruction), wait for symbol indexing, or a new
   authored facts file?
5. **Sources:** keep, shorten to one line, or let the edits decide (*recommended*, never dropping
   the citations inside the answer)?
6. **Measurement spend** (Session 7): up to five re-asks (~$0.75) and one acceptance run (~$0.40)?
   *Recommended: yes.*
7. **Keep collecting:** unlock the editor before editing, so each edit is saved (Session 4 makes
   this easier)? *Recommended: yes.*
