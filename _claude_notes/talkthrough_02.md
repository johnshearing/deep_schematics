# Talkthrough, 02: speak a selection, speak an edited answer, read the question first, and choose the voice

*Written 2026-09-27 in a planning session, straight after `talkthrough_01.md` was built and
walked. Nothing here is built yet. The building session starts with "read
`_claude_notes/talkthrough_02.md` and execute the request" and nothing else, so this file has to
be enough on its own. **It extends 01 and does not repeat it.** 01's §3, §9, §13 and §14 still
hold: read 01's §9 (traps) and §14 (standing rules), and nothing else of 01.*

---

## §0 How to use this document

1. Read §0 to §3, §9 and §10 first. Each phase carries its own reading list and acceptance
   criteria.
2. **Ask §11's questions at the start of the session, in one batch**, before opening a code file.
   The user may already have answered them at the bottom of this file. If so, don't ask again.
3. Price each phase before it starts and report what it cost (§8).
4. Phases run in order. Each ends green and leaves nothing half-installed.
5. If a phase uncovers a design question this file does not answer, write it down and stop.

---

## §1 Why this plan exists

### 1.1 In the user's words (2026-09-27)

> Everything works as expected. […] Please make the default "off". *(Done in the planning session:
> `talkStore.ts` `dwell: 0`. A browser that already stored a setting keeps it.)*
>
> I would like you to create the following functionality instead [of skipping the Sources
> section]:
> 1. If the user highlights a section of text and then clicks on the "Talk me through it" button
>    then only the highlighted text will be spoken.
> 2. Allow the user to edit the entire answer and then have the edited answer spoken when the
>    "Talk me through it" button is pressed.
> 3. Provide a button that allows the question to be read aloud before the answer is spoken.
>
> All of the above will make it possible for me to create **videos that clearly teach about the
> circuit and demonstrate what deep_schematics can do.** I also wonder if my edited responses can
> be used to inform you (the ai model) what I am hoping you will provide in your responses.
>
> Also please tell me if there is a control that allows me to change the voice. *(There is none:
> `pickVoice()` in `webui/src/lib/speech.ts` chooses from a preference list. §5 adds a control.)*
>
> Please explain to me where I can see how you found and made these corrections [to
> pronunciation] so that I can make these corrections myself. *(Answered in conversation. §4 adds
> the on-screen half: the palette can show the spoken text.)*

### 1.2 What that decides

- **The audience is a video.** Every feature here serves someone recording the screen. So
  **choices persist** (voice, question-first), **nothing flickers or pops up mid-talk**, and **what
  is spoken is what is on screen**. An edited answer is *shown* edited, not just spoken edited
  (§11 Q2).
- **01's promise still holds: spoken links equal read links.** A selection or an edit changes
  *which text* is fed to `buildTalk`, never the rule for what counts as a link. The agreement test
  must pass over an edited answer too.
- **It still never authors drawing data.** An edited answer is the user's *prose*, not netlist
  data. If it is saved to disk (§11 Q3), it goes in a new directory of its own, never into an
  extraction file.
- **Steering the model with edits is a separate, later decision** (§7, §11 Q6). This plan makes
  the edits *collectable*. It does not change `prompts.py`.

---

## §2 The goal test

1. **Selection:** select part of an answer and press `Talk me through it`. Only the sentences the
   selection touches are spoken (§11 Q1), with their links highlighted as usual. With no selection,
   or a selection outside this answer, the whole answer is spoken, as today.
2. **Edit:** an `Edit` button in the answer footer opens the answer's markdown in a text box, with
   `Save`, `Cancel` and, once saved, `Revert to original`. After `Save` the answer is rendered from
   the edited text, marked *edited*, and `Talk me through it` speaks it. Links in the edited text
   work exactly as in an original answer.
3. **Question first:** a palette setting **`Read the question first`** (persisted). When on, the
   talk begins with the question that produced the answer, then the answer. Pressing ◀ sentence
   from the answer's first sentence goes back into the question.
4. **Voice:** a **`Voice`** dropdown in the palette lists the browser's voices (English first). The
   choice persists by voice name, and it falls back to `pickVoice()` when the stored voice is
   absent (another machine or browser).
5. **Spoken text:** a palette toggle **`Show spoken text`** puts the `say` form under the caption
   (*T B zero V terminal 9*), so a poor pronunciation can be seen, not only heard, and fixed in
   `speakId.ts`.
6. Everything in 01's goal test still holds, and 01's tests stay green unchanged.

---

## §3 What exists (measured 2026-09-27)

- **`webui/src/features/talkthrough/buildTalk.ts`** `buildTalk(markdown, byToken, hasViewer):
  Talk`. `Sentence { segments, block }`, `Segment { show, say, cite?, link? }`. Blocks come from
  mdast, and sentences come from `Intl.Segmenter` over each block's flattened text.
- **`talkStore.ts`** `start(message)` builds the talk from `message.text`. Settings are persisted
  under `talkthrough-settings` (`dwell`, `rate`, `muted`, `palette`). **Add new settings to that
  `partialize`.** Tests inject speakers through `setSpeakers`.
- **`webui/src/lib/speech.ts`** `webSpeaker` uses a module-level `pickVoice()` with a cache.
  `Speaker.speak(text, rate)` takes no voice argument.
- **`MessageView.tsx`**: `MessageView({ message })` renders the answer through `<Markdown>` and a
  `Footer` holding the talk and copy buttons. **It receives only its own message.** The question is
  the preceding `role: 'user'` message in `chatStore.messages` (`AskTab.tsx` line ~92 maps them).
- **`chatStore` is not persisted** (`create<ChatState>()((set, get) => …)`, no `persist`). A reload
  or `New conversation` loses the transcript, and so would lose an edit held only there (§11 Q3).
- **User questions are plain text** (`whitespace-pre-wrap`), not markdown. An id in a question
  (`RECEPT1:3`) is not backticked and is not a link.
- `Markdown.tsx` is the XSS boundary (its header). **Any change to it is additive attributes only,
  never raw HTML** (trap T2 below).

---

## §4 Phase A: small palette additions (voice, spoken text, question first). About $6–9.

1. **Voice.**
   - `speech.ts`: add `listVoices(): SpeechSynthesisVoice[]` (English first, then the rest) and
     `setPreferredVoice(name | null)`. `pickVoice()` tries the preferred name first.
   - The palette gets a `Voice` `<select>` that re-renders on `voiceschanged`.
   - A `voice: string | null` setting is persisted.
   - Hidden when `!voiceSupported()`.
   - `lib/` still imports nothing from `features/`.
2. **Show spoken text.** A persisted `showSay` toggle. When on, a muted line under the caption
   shows the current sentence's `say`, with the current segment in bold.
3. **Question first.**
   - `start(message, opts?)` finds the question as the nearest earlier `role: 'user'` message.
   - With `questionFirst` on, it prepends the question's sentences as blocks of a new kind
     `'q'` (`Sentence.block` gains `'q'`).
   - The question is spoken as plain text through `Intl.Segmenter`. **Tokens in it are spoken by
     `speakId` only when a whole whitespace-delimited token resolves exactly** (§11 Q7), and they
     are not highlighted unless Q7 says so.
   - The caption labels question sentences *Question*.
   - `talk.items` indices stay correct because the question is prepended before the items are
     computed.
4. **Acceptance.**
   - `talkStore.test.ts`: the voice choice persists. A missing voice falls back. `questionFirst`
     speaks the question first. ◀ sentence crosses back into the question.
   - `TalkPalette.test.tsx`: the dropdown lists voices (stub `speechSynthesis.getVoices`), and
     `Show spoken text` shows `say`.

**Reading list:** `speech.ts`, `talkStore.ts` and `TalkPalette.tsx`, all whole (all written by 01,
all short). `AskTab.tsx` lines 80–100.

---

## §5 Phase B: speak only the selection. About $8–12.

**The approach: sentence granularity, located by block and text offset.**

1. **Mark the blocks.**
   - `Markdown.tsx` adds `data-md={node.position.start.offset}` to each spoken block element
     (`p`, `li`, `h1`–`h6`, `tr`). react-markdown 9 passes `node` to component overrides.
   - This is an **additive attribute**, the same XSS posture as today. Assert it in
     `Markdown.test.tsx`.
2. **Key the sentences.** `buildTalk` records, on each `Sentence`, `key` (the same mdast start
   offset of its block) and `from`/`to`: the sentence's character range within that block's
   *shown* text (the concatenated `show`), which is the block's DOM `textContent`.
3. **Read the selection.**
   - On the button's **`pointerdown`/`mousedown`**, before the press can collapse the selection
     (trap T1), read `window.getSelection()`.
   - Keep it only if both ends are inside this message's `.answer` element.
   - For each end, find `closest('[data-md]')` and the text offset from that block's start (a
     `Range` from block start to the boundary, `.toString().length`).
4. **Filter.** `sliceTalk(talk, from: {key, offset}, to: {key, offset}): Talk` keeps the
   sentences that the selection touches, in document order, and recomputes `items`.
5. **Start.** `start(message, { selection })`. The caption counter reads *Sentence n of N
   (selection)*.
6. **Acceptance.**
   - `buildTalk.test.ts`: keys and offsets agree with a rendered `<Markdown>`. For every sentence,
     the rendered block's `textContent.slice(from, to)` equals the sentence's shown text. This is
     the selection's analogue of 01's agreement test.
   - `sliceTalk` cases: within one sentence, across blocks, across a table, and across a list.
   - `TalkPalette.test.tsx`: a jsdom `Range` selection over a rendered answer speaks only those
     sentences. A selection in the question bubble, or in another answer, is ignored.

**Reading list:** `Markdown.tsx` (short) and `Markdown.test.tsx`'s `arm` helper. Then **measure,
do not assume** how react-markdown renders a *tight* list item (with or without `<p>`) and a table
row, with a two-line script rendering a fixture and printing `container.innerHTML` (trap T3).

---

## §6 Phase C: edit the answer. About $6–9 client-only, plus $6–10 if Q3 chooses saving to disk.

1. **Store.**
   - `Message` gains `edited?: string` (the user's text) and keeps `text` (the model's original).
   - `chatStore` gains `editAnswer(id, text | null)`, where null reverts.
   - A helper `answerText(m) = m.edited ?? m.text` is used by `MessageView`, `Copy markdown`
     (§11 Q2) and `talkStore.start`.
2. **UI.**
   - An `Edit` ghost button in the footer, beside `Talk me through it`, opens a monospace
     `<textarea>` in place of the rendered answer, sized to its content, with `Save`, `Cancel`,
     and `Revert to original` once edited.
   - An *edited* badge sits in the footer.
   - The textarea is a text field, so `Esc` in it is the textarea's (01's Escape guard already
     steps aside), and `F2` still works (it's bare `F2`, which a textarea ignores).
3. **If Q3 = save to disk.**
   - A new server route `PUT /api/edited-answers/{turn_id}` writes `{question, original, edited,
     prompt_version, model, saved_at}` to
     `schematic_extraction/<drawing>/walkthrough/edited_answers/<turn_id>.json`.
   - A `GET` lists them, and `/api/drawing` or the Ask tab reloads them when the same turn is
     reopened.
   - **Gated like the editor**: registered only when `SWUI_ALLOW_EDITS` is true, and needing the
     editor password.
   - Server tests cover path-traversal refusal (turn ids are UUIDs, so validate the shape), the
     gate, and the round trip.
   - **This phase restarts the server**, the one step in this plan that does (trap T5).
   - `Message` needs its `turnId`, so check whether `chatStore` keeps it per message (it keeps
     one `turnId` at the store level today).
4. **Acceptance.**
   - `AskTab.test.tsx`: edit, save, and the rendered answer and its links follow the edit. Revert
     restores. The talk speaks the edit.
   - 01's agreement test runs once more over an edited fixture.

**Reading list:** `chatStore.ts` (`Message`, `send`'s first lines, `reset`), `MessageView.tsx`
whole. If Q3 = disk: `server/app/main.py`'s editor-gated route block (grep `ALLOW_EDITS\|allow_edits`)
and one existing gated route with its tests (grep in `server/tests`).

---

## §7 Not in this plan: steering the model with the edits (§11 Q6)

**Yes, it can be done, in two known ways. Both change what every future answer costs and says,
so they are a plan of their own, after edits exist to learn from:**

- **Exemplars.** A few saved *original → edited* pairs are placed where the model reads them (a
  file in its working directory, named in `prompts.py`), with a line such as *"answers the user
  has rewritten, and how; write like the rewritten ones."* This costs input tokens on every
  question, roughly the length of the exemplars.
- **Distilled rules.** Read the pairs, write down what changed (*"no preamble"*, *"chain of events
  as numbered sentences"*, *"sources as one line"*), and put those rules into `prompts.py`. This
  costs almost nothing per question, but a person, or a session, has to do the distilling.

Either is a `prompts.py` edit and a `PROMPT_VERSION` bump (01 §14.3). **This plan's contribution
is to keep each edit beside its original, question, model and prompt version (Phase C, Q3), which
is exactly the data either method needs.**

---

## §8 Budget

| phase | estimate |
|---|---|
| A voice, spoken text, question first | $6–9 |
| B selection | $8–12 |
| C edit (client) | $6–9 |
| C′ save edits to disk (only if Q3 = disk) | +$6–10 |
| D walk and documents | $3–5 |
| **total** | **$23–35**, or **$29–45** with C′ |

01 came in at about $6 against a $24–35 estimate, because its core was pure functions with
fixtures. B and C′ are the phases most likely to run long: B for DOM measurement, C′ because it
touches the server.

---

## §9 Traps specific to this plan

- **T1. Pressing the button can clear the selection before the handler runs** (it varies by
  browser). Read the selection on `pointerdown`/`mousedown` and hold it for the `click`. Do not
  `preventDefault` a keyboard activation. With the keyboard, the selection is still intact at
  `click`.
- **T2. `Markdown.tsx` is the XSS control.** Add `data-md` attributes through the existing
  component overrides only. Never `rehype-raw`, and never an HTML string.
- **T3. react-markdown renders a tight list item without `<p>`.** The `li` block's key must be
  found on the element that actually exists. Measure first (§5 reading list).
- **T4. An edit is not the model's answer.** `Copy markdown` and the talk use the edit, but
  anything that reports on the *model* (acceptance runs, cost, a future exemplar file) must be
  able to see both. Never overwrite `text`.
- **T5. C′ is the only server change.** Rebuild **and** restart for it. Without C′, this plan is
  client-only like 01.
- **T6. Voices load asynchronously and differ per machine.** Persist the voice by *name*, fall
  back silently, and never assume `getVoices()` is non-empty on first render.
- **T7. Lesson file numbers.** Append the new rows to `28_tests_talkthrough.md` as **T-1670
  onward** (same feature, same document). `narrated_walkthrough_01.md` still takes the next free
  file number (`29_`).

---

## §10 Standing rules

01 §14 applies in full: the four checks at the start and the end, stop any server you start, the
user owns git, no drawing ids in `webui/src/`, and say what the session cost, measured from the
transcript.

---

## §11 Questions to ask at the start of the building session, in one batch

1. **Selection granularity:** speak the **whole sentences** the selection touches
   (*recommended*: a half-sentence is spoken badly and its links may be cut in half), or exactly
   the selected characters?
2. **An edited answer on screen:** show the edit on the Ask tab as well, marked *edited*, with
   `Copy markdown` copying the edit (*recommended*, since the video should show what is spoken), or
   speak the edit while still showing the original?
3. **Where edits live:**
   - **(a)** in the browser only: lost on reload or `New conversation`, and cheap
   - **(b)** saved to disk beside the drawing, as *question, original, edited, model, prompt
     version*, behind the editor password (*recommended if Q6 is ever yes*; costs C′)
4. **Can the question be edited too,** in the same way? *Recommended: yes, speak-only, since a
   video may want the question phrased better than it was typed.*
5. **Question first:** a persisted palette toggle (*recommended*), or a second footer button
   `Talk me through it, question first`?
6. **Steering the model with edits (§7):** confirm this stays a later, separate plan
   (*recommended*). Build C′ now if you want the data collected meanwhile.
7. **Identifiers in the question:** speak them well (`speakId`) but don't highlight them
   (*recommended*: the question has no links on screen, so highlighting would break 01's
   *spoken equals read* promise), or also fly to them as they are read?
8. **Voice:** also a per-voice pitch control? *Recommended: no, name and speed are enough.*
