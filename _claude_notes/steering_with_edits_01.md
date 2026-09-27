# Steering with edits, 01: *teach the model the answers you want*, from the answers you rewrote

*Written 2026-09-27, at the end of the session that built `talkthrough_02.md`. Nothing here is
built yet. **Do not start it until at least five edited answers exist** (§2). The building
session starts with "read `_claude_notes/steering_with_edits_01.md` and execute the request" and
nothing else, so this file has to be enough on its own. Every fact it relies on has a pointer
here, measured on 2026-09-27.*

---

## §0 How to use this document

1. **Read §0 to §3 and §11 to §12 first.** They are the rules. Each phase (§4 to §6) carries its
   own reading list and acceptance criteria.
2. **Ask §13's questions at the start of the session, in one batch**, before opening a code file.
   The user may already have answered them at the bottom of this file. If so, don't ask again.
3. **Say at the start whether the funded budget covers the phase you are about to run** (§10).
   Price each phase before it starts and report what it cost.
4. Phases run in order. Each ends green and leaves nothing half-installed.
5. **Plans are documents first.** If a phase uncovers a design question this file does not answer,
   write the question down and stop. Do not improvise a second plan inside a building session.

---

## §1 Why this plan exists

### 1.1 In the user's words

> *(2026-09-27)* I also wonder if my edited responses can be used to inform you (the ai model)
> what I am hoping you will provide in your responses.
>
> *(Answering `talkthrough_02.md` §11 Q6)* Your recommendation is best. Please make a separate
> plan for this. This document must be self-contained and standalone.

The user makes **videos that teach the circuit and demonstrate deep_schematics**. They edit
answers in place on the Ask tab, or replace them with their own, and then present them with the
talkthrough (`Talk me through it`). Every edit is a statement of what the answer *should* have
been.

### 1.2 What that decides

- **The data already exists and is the user's.** Since `talkthrough_02.md`, each saved edit is a
  JSON record beside the drawing (§3.1). This plan **reads** those records. It never edits,
  moves or deletes one.
- **What changes is `server/app/prompts.py`, and nothing else the model sees.** Every answer, on
  every drawing, is shaped by that one file. So a change to it is **the user's decision, rule by
  rule**, and it always comes with a `PROMPT_VERSION` bump and a server restart.
- **The rules must be generic.** No drawing's identifiers go into `prompts.py`'s new section
  (§12.3). A rule like *"no preamble before the answer"* survives drawing number two. *"Mention
  `CR-BP` first"* does not.
- **Measure, don't hope.** A prompt change is judged by re-asking questions whose edited answers
  exist and comparing the new answer with the user's edit, not with the old answer (§6).

### 1.3 The two known ways, and the one this plan recommends

1. **Distilled rules (recommended first).** Read the *original → edited* pairs, name what changed
   (*"dropped the working notes at the top"*, *"chain of events as numbered sentences, not a
   table"*, *"one short Sources line"*), and write those as rules in a new section of
   `prompts.py`. This costs almost nothing per question. A person, or a session, has to do the
   distilling, and the user approves each rule.
2. **Exemplars.** Show the model a few rewritten answers as examples. This costs input tokens on
   every question, and it carries **a real hazard** (trap S2): an exemplar is full of facts, and
   the model reads its working directory as the drawing's truth. **This plan does not build
   exemplars** unless §13 Q1 says so, and even then only as a later phase.

---

## §2 The goal test

The work is done when:

1. `server/scripts/edit_report.py` turns every saved record into one readable Markdown report,
   `_claude_notes/steering/edit_report.md`, fully generated. For each edit it shows the question,
   a word-level diff of the answer, and measured features (§4.2).
2. From that report, the session proposes **candidate rules**, each tied to the edits that
   motivate it, and **the user accepts or rejects each one**.
3. The accepted rules sit in `prompts.py` under one new heading, `PROMPT_VERSION` is `v1.4`, and
   the server tests pass.
4. **A before/after measurement** (§6) re-asks up to five of the edited questions on the new
   prompt, sets each new answer beside the user's edit, and records which rules the new answer
   now follows. `server/scripts/acceptance.py` still passes at least what it passed before.
5. The user sees one write-up: the rules adopted, the measurement, and what it cost.

**Precondition: five or more records** in `schematic_extraction/<drawing>/walkthrough/edited_answers/`
(`ls … | wc -l`). With fewer there is nothing to distil. Say so and stop.

---

## §3 What exists (measured 2026-09-27)

### 3.1 The records, written by `talkthrough_02.md`'s Phase C

- **Where:** `schematic_extraction/PS20115MLM4-2/walkthrough/edited_answers/<turn_id>.json`, one
  per turn. It's the directory beside `extracted_docs/`, never inside it
  (`server/app/edited_answers.py`, `edited_answers_dir()`).
- **Shape:**

  ```json
  { "turn_id": "…uuid…", "saved_at": "2026-09-27T20:39:34Z",
    "model": "sonnet", "prompt_version": "v1.3",
    "question": { "original": "…", "edited": "…" | null },
    "answer":   { "original": "…markdown…", "edited": "…markdown…" | null } }
  ```

  `model` and `prompt_version` come from the turn archive's `_meta` line when it exists
  (`turn_meta()`), so they are the values *as asked*.
- **Read them with** `GET /api/edited-answers` (editor-gated), or straight from disk in a script.
  **Prefer the script:** it needs no server.
- **An edit may be a total replacement**: the user said they may *author a response of their own*
  and present it. A replacement is still a statement of style, but its diff against the original is
  meaningless. §4.2 detects it (low word overlap) and reports it as *authored*, not *edited*.

### 3.2 How the model is asked, and what it can see

- `server/app/prompts.py` (288 lines): `PROMPT_VERSION = "v1.3"` (line ~41) and
  `ORIENTATION_PROMPT` (line ~43 onward, headed `# Your role`, then `# Which file to read`, …).
  `orientation_prompt()` (line ~287) returns it. The header comments record why each past version
  changed. **Keep that habit:** say what `v1.4` added and why.
- `server/app/claude_runner.py` runs the `claude` CLI with **cwd = the drawing directory**
  (`settings.drawing_dir`, `…/extracted_docs`) and
  `--allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)"` (its header, line ~10, and the argv
  around lines ~160–195), and passes the prompt with `--append-system-prompt`. **The model cannot
  read `walkthrough/`.** That is deliberate (trap S1).
- `PROMPT_VERSION` is stamped into every turn archive's `_meta` line (`claude_runner.py` ~651) and
  into `/api/health` (`main.py` ~225). **`python -m app` has no reloader:** a prompt change needs
  a restart.

### 3.3 Measuring an answer

- `server/scripts/acceptance.py` (261 lines) asks a fixed set of questions against a running
  server and applies substring/regex checks for known failure modes. It writes a report to
  `_claude_notes/webui_acceptance/<timestamp>-<model>.md`. **A run cost about $0.39 on sonnet**
  (2026-08-11). Read its `main()` argparse for the flags; don't read the whole script.
- Turn archives: `server/.state/turns/<turn_id>.jsonl`. **Never `cat` one** (they run to hundreds
  of KB). An answer's text comes from `translate()` (`claude_runner.py` ~258) over the archive's
  events, joined, or from the saved record's `answer.original`.
- **Asking a question live** means `POST /api/ask` with `{"question": …}` and the demo password in
  `X-Demo-Password` (`SWUI_DEMO_PASSWORD` in `server/.env`). The response is a stream of JSON
  lines; the `text` events joined are the answer. One question costs about $0.10–0.15 on sonnet.

### 3.4 One edit-worthy fault already seen

The live RECEPT1:3 answer (2026-09-26) began with the model's own working notes: *"Also need
PB1:1 supply source … That's enough to write the full answer."* It's kept as
`webui/src/features/talkthrough/fixtures/recept1_3.md`. **If the user's edits remove such
preambles, the rule writes itself.** Check it against the report rather than assuming.

---

## §4 Phase 1: the edit report. A script, no model change. About $4–6.

### 4.1 `server/scripts/edit_report.py`

- **Input:** the records directory (default from `Settings().drawing_dir`, so drawing number two
  works unchanged). **Output:** `_claude_notes/steering/edit_report.md`, **fully generated**, with
  a first line saying so and naming the command. Never hand-edit it.
- **Per record,** newest first:
  - the question (and its edit, if any)
  - the measured features (4.2)
  - a **word-level diff** of the answer: `difflib.SequenceMatcher` over `str.split()` tokens, shown
    as `~~removed~~` / `**added**`, and collapsed to ±20 words of context around each change, so a
    long answer stays readable
- **Summary table at the top:** one row per feature, and how many edits show it.

### 4.2 Features, each a small pure function with a test

| feature | measured as |
|---|---|
| authored, not edited | word overlap (`SequenceMatcher.ratio()` on tokens) below 0.3 |
| length change | words before → after, and the percentage |
| preamble removed | the original's first paragraph is gone, and it did not start with a heading |
| sections removed / added | `##` headings present in one and not the other (e.g. `Sources`) |
| tables → prose | the original had a GFM table and the edit has none, or fewer |
| lists → prose, prose → lists | counts of list items before and after |
| identifiers | backticked spans before and after: dropped, added, count |
| hedges removed | a small generic word list (*"likely"*, *"appears"*, *"it seems"*) before and after |

These are **generic, by shape**. No drawing identifier appears in the script.

### 4.3 Reading list

- `server/app/edited_answers.py`, whole (short).
- One record, **`head -c 1500`** of it. Never the whole directory.
- `server/scripts/acceptance.py` lines 1–50 only, for the house style of a script (docstring,
  argparse, paths).

### 4.4 Acceptance: `server/tests/test_edit_report.py`

- Each feature has a test on a tiny synthetic record, with no real records in the tests.
- The report is deterministic: the same records in, byte-identical out.
- **Run it on the real records**, and paste only the summary table into the session notes.

---

## §5 Phase 2: from the report to rules. About $4–7, mostly one careful conversation.

1. From the summary table and the diffs, the session drafts **candidate rules**. Each one is:
   - one imperative sentence, generic, in the prompt's own voice
   - the edits that motivate it (turn ids)
   - how often it appears (*4 of 6 edits*)
   - what it might break (e.g. *"prefer prose to tables"* vs the maintenance reader at 2 a.m.,
     who may want the table)
2. **Write the candidates into `_claude_notes/steering/candidate_rules.md` and stop for the
   user's verdict on each.** In the building session this is the one question batch in the middle
   of the plan, and it is expected.
3. **Accepted rules** go into `ORIENTATION_PROMPT` as one new section, `# How to write the answer`
   (or appended to an existing section on the same subject, if one exists; read the prompt's
   headings with `grep -n '^# ' server/app/prompts.py` first).
   - `PROMPT_VERSION = "v1.4"`, with a header comment saying what `v1.4` added and that it came
     from the user's edits (name the report).
4. **Restart the server** (the one step in this plan that must), then run the server tests.

**Reading list:** `prompts.py` lines 1–60 and its `# ` headings (grep). The rest of the prompt only
if a candidate rule touches an existing section.

**Acceptance:** `pytest` green. If a test pins the prompt's text or version, update it
deliberately and say so. `grep -n 'PROMPT_VERSION' -r server/tests` first.

---

## §6 Phase 3: measure it. About $3–6, including at most $1.50 of live questions.

1. Start the server on the new prompt. **Stop it in the same turn.**
2. **Re-ask up to five questions whose edits the rules came from**, using the *original* question
   text (not the edited one) so the comparison is fair. Use `POST /api/ask` with a one-liner that
   joins the `text` events, and save each answer to `_claude_notes/steering/after/<turn_id>.md`.
3. **Run `edit_report.py`'s feature functions on each (old answer → new answer) and (new answer
   → user's edit) pair.** The question is whether the new answer moved toward the edit. Report
   per rule: followed, partly, or not.
4. Run `acceptance.py` once on the new prompt and compare it with the latest committed report in
   `_claude_notes/webui_acceptance/`. **A check that passed before and fails now blocks the
   change.** Say so and let the user choose.
5. Write `_claude_notes/steering/steering_01_results.md` in one call: the rules, the measurements,
   the acceptance comparison, and the cost.

---

## §7 Deliberately not in this plan

- **Exemplars in the model's context** (§1.3 way 2), unless §13 Q1 asks for them, and then as a
  separate later plan, because of trap S2.
- **Anything automatic.** No rule is adopted without the user's yes. Nothing learns at runtime.
- **Fine-tuning.** It is not available for this setup, and it would not be generic across
  drawings anyway.
- **Changing the talkthrough, the edit box or the records' format.** `talkthrough_02.md` owns them.
- **Per-drawing prompts.** `prompts.py` is shared by every drawing, by design.

---

## §8 Traps specific to this plan (S-numbers are traps, not tests)

- **S1. The model cannot see `walkthrough/`,** and must not be given it. Its tools are scoped to
  `./**` under `extracted_docs/`, and `--add-dir` reopens an escape (`claude_runner.py` ~144). Do
  not copy records into `extracted_docs/` either (S2).
- **S2. An exemplar is also a set of facts.** The model treats every file in its working directory
  as evidence about the drawing. An edited answer can contain the user's own claims, or claims
  true under an older extraction, and the model would then cite them as the sheet. That is why
  rules come first and exemplars are out of scope.
- **S3. Authored answers are not diffs.** A replacement shares few words with the original, and
  diffing it produces noise. Detect it (§4.2) and use it for style features only.
- **S4. Style rules can fight correctness rules.** The prompt already requires backticked
  identifiers, exact spelling and a Sources section (grep `Sources` in `prompts.py`). A candidate
  that removes Sources conflicts with that. Say so in the candidate, and let the user choose (for
  example *"one line of Sources"* rather than none).
- **S5. `PROMPT_VERSION` and the restart.** Every prompt change bumps it, and a running server
  keeps the old prompt until restarted. Check `/api/health`'s `prompt_version` before measuring.
- **S6. Tokens per question.** A rules section adds its length to every question, cached or not.
  Keep it short: rules, not essays. Report its size in tokens (≈ characters / 4).
- **S7. Never edit a record.** They are the user's. The report is generated from them, and a
  wrong report is fixed in the script.

---

## §9 Order

**Phase 1 → 2 → 3.** Phase 1 is pure and useful on its own: the user can read the report even if
no rule is ever adopted. Phase 2 stops for the user in the middle. Phase 3 needs the new prompt.

**Install:** Phase 1 changes no running code. Phase 2 needs **one server restart** and no bundle
rebuild (no client change).

---

## §10 Budget

| phase | estimate | notes |
|---|---|---|
| 1 edit report | **$4–6** | a pure script and its tests, synthetic records |
| 2 candidate rules → prompt | **$4–7** | one question batch in the middle |
| 3 measure | **$3–6** (+ ≤ $1.50 live) | five re-asks, one acceptance run |
| **total** | **$11–19** | |

**Sanity mark:** past half a phase's estimate before its tests are written means the reading list
grew. Stop and cut.

---

## §11 The token strategy: read this before opening a file

**What makes this plan cheap by construction:** Phase 1 is a pure script tested on synthetic
records, Phase 2 is a short prompt edit, and Phase 3 spends its money on live questions, not on
reading.

**Do not read:**

- `geometry.json`, `circuit_logic.json`, `custom_kg.json`, `locations.json`, `wiring.json`
- any turn archive whole (`head -3` at most; answers come from `translate()` or the record)
- all of the records (one record's `head -c 1500`, then the report)
- `prompts.py` whole (lines 1–60 and its headings; more only for a section a rule touches)
- `acceptance.py` whole (lines 1–50 and `main()`'s flags)
- anything under `_claude_notes/archive/`, or any `locate_tab_testing/*_tests_*.md`
- the web client (`webui/`): this plan does not touch it

**The habits:**

- Re-locate each reading list in one or two batched `grep -n` calls.
- **Compute, don't guess:** counts come from the script's own output.
- **Run the checks twice per session, at the start and the end,** backgrounded and in parallel.
  Between edits, run only the new test file.
- Every edit is an exact-string replacement. Don't re-read a file after editing it.
- Write each document in one call, from notes taken while working.
- **Cost ≈ $0.50 × context (M tokens) × calls.** The call count is the lever.

---

## §12 Standing rules. Every one of these has cost a session.

### 12.1 Running it, and the checks

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn, by its PID** (`… & SRV=$!` … `kill $SRV`).
**Never `pkill -f 'python -m app'`:** the pattern matches the shell running it and kills your own
command.

The four checks:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

- A vitest worker error (`ERR_IPC_CHANNEL_CLOSED`) beside pytest is contention, not a red test.
  Re-run `npx vitest run` alone before reporting.
- Start from green and read the counts off your own run. On 2026-09-27 they stood at **272
  server** and **578 web**, and they move.
- A red check in a session that has written no code means something else is wrong. Say so loudly.

### 12.2 Where things are

- `SWUI_ALLOW_EDITS` in `server/.env` gates the editor routes, `GET /api/edited-answers`
  included. It is `true` here, and the editor password is `SWUI_EDITOR_PASSWORD` in the same file.
  **A script reading the records from disk needs neither.**
- `server/app/` changes need a restart. `webui/src/` changes need `npm run build`. This plan
  should need only the restart.

### 12.3 What not to do

- **Do not author anything** in `locations.json`, `label_corrections.json`, `wiring.json` or
  `author_circuit_logic.py`. Do not hand-edit `circuit_logic.json` or `custom_kg.json`; both are
  generated.
- **Never edit, move or delete an edited-answer record** (S7).
- **No drawing identifiers in `server/app/` or `webui/src/`**, and none in the new prompt rules.
  Test fixtures may contain real ids; source may not.
- **Do not change `prompts.py` without the user's yes on each rule**, and bump `PROMPT_VERSION`
  when you do.
- Do not renumber anything, and do not reuse a T-number.

### 12.4 Git and reporting

- **The user does all git work. Do not commit and do not push.** Read git freely. At the end,
  name the files that want committing.
- **End the session in the write-up.** Say what it cost, measured from the session transcript:

  ```
  ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
  # sum message.usage once per message id: input ×$5, output ×$25, cache_creation ×$6.25,
  # cache_read ×$0.50, per 1M tokens
  ```

- **Tell the user which files on the reading lists did not earn their tokens, and which files you
  needed that were not named.** Say it even when the answer is *the list was right*.

---

## §13 Questions to ask at the start of the building session, in one batch

1. **Rules only, or rules and then exemplars?** *Recommended: rules only* (trap S2). Exemplars
   would be their own plan, designed around keeping them out of the model's evidence.
2. **Who drafts the rules?** *Recommended: the session drafts candidates from the report, and you
   accept or reject each one.* Or you write them yourself from the report, and the session only
   installs and measures them.
3. **How many edits before starting?** *Recommended: at least five, from at least three different
   questions,* so a rule reflects a habit, not one answer.
4. **Sources section:** keep the prompt's current rule, shorten it to one line, or let your edits
   decide? *Recommended: let the edits decide, but never drop citations inside the answer.*
5. **Measurement spend:** up to five live re-asks (about $0.75) plus one acceptance run (about
   $0.40)? *Recommended: yes.*
6. **Should the rules apply to every drawing?** `prompts.py` is shared. *Recommended: yes, and
   that is why the rules must be generic.*
