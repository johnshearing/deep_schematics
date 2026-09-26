# T-1565–T-159x — the Ask tab, and what the model is told before it answers

> **Created 2026-09-26, and it is the first lesson document for the `Ask` tab** — which had none,
> having been tested only by `05_tests_save_and_recover.md` **T-426** (the tab coming back to the
> line you were reading). **It takes `27_` rather than `22_` because
> `highlighting_wires_and_nets_04.md` `§15` has reserved `22_` through `26_`** for the phases in
> that plan. Numbers are labels; do not renumber either.

Index: `locate_tab_instruction_and_test_manual.md`.

**Needs no editor password.** The `Ask` tab is one of the two tabs a visitor can be handed
(`Drawing` is the other), which is why the walkthrough in `claude.md` §1 is about those two.

**A change to `server/app/prompts.py` needs a server restart** — `python -m app` has no reloader —
and **it does not need a bundle rebuild.** Bump `PROMPT_VERSION` with every change to the text: it
is recorded with every archived turn, so an answer can always be traced to the prompt that
produced it.

---

## T-1565 · An answer says **who confirmed the endpoint**, and what the machine originally guessed

**Do.** Restart the server. On the `Ask` tab, ask about a wire whose far end was corrected — read
one off the file rather than off this page, because `was` is only present where a correction was
made:

```
cd schematic_extraction/PS20115MLM4-2/extracted_docs && python3 -c "
import json
for w in json.load(open('circuit_logic.json'))['wires']:
    e=w.get('endpoints') or {}
    if e.get('was'): print(w['id'], w['from_terminal'], '->', w['to_terminal'], 'was', e['was'], e.get('at','')[:10])
"
```

On 2026-09-26 that printed thirteen. Then ask, for one of them: *"Which terminal on the 0V block
does CR2's coil return land on, and how do we know?"*

**Expected.** The answer gives the terminal **and volunteers the provenance in words** — that a
person compared the record with the ink, on what date, and what the extraction originally had.
Something in the shape of: *"…the 7th point down on the 0V block (`TB-0V:7`), confirmed against
the ink by a person on 2026-09-21 — the extraction originally had this on `TB-0V:9` and was
corrected."*

**What must not happen.** It must **not** quote a count of how many endpoints are confirmed. The
file moves between questions as you author, so a census in an answer is a census that goes stale,
and the prompt forbids it by name.

**Why this test exists.** On 2026-09-24 you asked how the troubleshooting answers had been so good
when so much of what the model knew about the wires was wrong. The measured answer was that ten of
the eleven wrong screws were wrong *within one net*, so no answer about connectivity changed — and
the honest rider was this: *the confidence was not evidence.* Asked which screw, the model would
have said `:9` with the same fluency and been wrong for a year, **and nothing in the answer would
have told you.**

`wires[].endpoints` — `{source, by, at, was}` — had been in `circuit_logic.json` since 2026-09-08
and **the prompt never mentioned it**, so the model could not have used it. `v1.3`, written
2026-09-26, is the paragraph that tells it: what `index` and `human` mean, that on a multi-point
block the `index` guess was *allocated down the page rather than read*, and **when to volunteer
it** — a specific screw, a troubleshooting crux, or a record still reading `index`.

---

## T-1570 · The model does not quote the machine's superseded wire table

**Do.** Ask something that would tempt a grep into the wrong file: *"What does the extraction's own
table say `CR2:A2` connects to?"* — and then the same question without the invitation: *"Where does
`CR2:A2` go?"*

**Expected.** Both answers give **`TB-0V:7`**, which is what `wiring.json` and therefore
`circuit_logic.json` say. The first may legitimately *describe* the superseded row and must label it
as history; the second must not mention it at all.

**Why.** `author_circuit_logic.py` is 80 KB of the indexing pass's own tables and it sits in the
model's working directory, greppable, with `Read`, `Grep` and `Glob` scoped to `./**`. Its wire
table still reads `("CR2:A2", "TB-0V:9", …)` — **the machine's original guess, kept deliberately as
evidence**, exactly as `was` is kept one level down. You found this yourself on 2026-09-24 and
worried the file needed correcting; it does not, and correcting it would destroy the record of what
the machine got wrong.

**But nothing told the model that**, and a grep for a terminal id lands in it with no signal that it
is reading history. `v1.3` names the file, says it is superseded, and says **never quote an endpoint
out of it.** It also names `label_corrections.json` with its real limitation: 654 readings keyed on
`T####` label ids out of `geometry.json`, which the model does not read, **so it can confirm that a
reading was checked by a person and cannot locate anything.**

---

## T-1575 · What clears the conversation, and what does not

**Do.** Ask a question, then a follow-up that only makes sense as a follow-up (*"and which of those
is nearest the enclosure door?"*). Then press **`New conversation`**, at the right of the strip
under the transcript, and ask the follow-up again on its own.

**Expected.** The first follow-up is answered in context. After `New conversation` the same words
get an answer that does not know what *those* were — which is the control working.

**The full list of what clears it**, measured 2026-09-24:

| | |
|---|---|
| the **`New conversation`** button | immediate — it drops the client's session id, so the next question starts a fresh CLI session |
| reloading the browser | the chat store is not persisted |
| restarting the server | sessions are in memory, deliberately: persistence would mean storing visitor text |
| **1 hour** idle | `session_ttl_s` |
| more than **200** live sessions | LRU eviction |
| **20** questions in one conversation | a hard refusal saying *start a new one* |

**`F2` to the Drawing tab and back does *not* clear it.** That is deliberate.

**And one thing worth knowing before you reach for the button: clearing the context does not save
money, it costs a little.** A follow-up resumes the CLI's own transcript and its prompt cache; the
first question of a fresh conversation pays again to read `EXTRACTION_NOTES.md` and re-grep from
cold. **Press it to stop a stale premise contaminating an answer — not to economise.**
