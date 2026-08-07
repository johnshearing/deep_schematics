# WebUI v1 — A Simple, Public Demo

**Date:** 2026-08-07
**Goal:** the smallest useful web app: a visitor opens a page, asks Claude a question about
`PS20115MLM4-2`, and watches a cited answer stream in. Exposed to the internet so people can try
it. Built so features can be added later without rework.

Long-range ideas live in [`webui_ideas.md`](webui_ideas.md) and are explicitly **not** in scope
here.

---

## 1. What is already proven

Six `claude` invocations were run from a shell during planning, before any code was written. These
are measurements, not estimates, and three of them changed the design.

### 1.1 Headless spawn works with this machine's auth

`claude -p --output-format json` returns `result`, `session_id`, `total_cost_usd` and a
`permission_denials[]` array. The CLI is v2.1.223, a native binary at `/home/js/.local/bin/claude`,
authenticated by OAuth/subscription.

**Do not use `--bare`.** Its own help text says auth in that mode is strictly `ANTHROPIC_API_KEY`
or `apiKeyHelper` and that "OAuth and keychain are never read."

### 1.2 Bash is not needed — Read/Grep/Glob is enough

The most consequential finding.

The proven method in the test report used `python3 -c` filters over the JSON, so the obvious design
granted `Bash(python3:*)`. **That grant turns out to be unnecessary.** With `--tools "Read,Grep,Glob"`
and no Bash at all, Opus answered the hard troubleshooting question *better* than the original
test — zero permission denials, nothing degraded. It produced:

- the full energisation chain with every wire in order —
  `24E-1 → W025 → CR-BP:A1`, `CR-BP:A2 → W048 → BYPASS-CB:2 ─[BYPASS 5A]─ BYPASS-CB:1 → net 120`,
  `→ W053 → TB-120:3 … TB-120:1 → W052 → CR2:14 ─[CR2 N.O.]─ CR2:11 → net 121 (W051) → CR1:14
  ─[CR1 N.O.]─ CR1:11 → W050 → TB-0V:10`
- a ranked cause list and a four-step probe sequence, all referenced to `TB-0V`, each step stating
  what each possible reading would mean
- the green-lamp trap, caught unprompted and tabulated: the lamp is fed from PB terminals 1 and 3,
  while the switched output to the coil is terminal 4 via W040/W043 — *"Green proves the contact
  block has moved and the lamp supply is present. It proves nothing about W040/W043, the coils, or
  the contacts. A broken black 22AWG on terminal 4 gives you exactly what you're seeing: green
  lamp, dead relay."*
- an observation nobody asked for: net 120 also leaves the panel at `INFEED1:3`/`DISCHARGE1:3`, so
  an external machine can only pull it down, never cause the open — but disconnecting an interface
  cordset while troubleshooting matters
- an unprompted sourcing caveat, that "green = contact closed" comes from the component
  descriptions rather than from drawn conductors

Dropping Bash removes arbitrary code execution from the attack surface. For an app on the public
internet, that is the difference between a defensible design and an indefensible one.

### 1.3 The default `Read` tool escapes the working directory

With `--allowedTools "Read"` (unqualified) and `--permission-mode dontAsk`, the child successfully
read **`/home/js/.claude.json`** — the file holding the OAuth account and `primaryApiKey` — and
also `/etc/passwd` and `/home/js/schematics/claude.md`. No denials were recorded.

**The working directory is not a security boundary.** On a public endpoint, a visitor could simply
ask. This is the finding that most shapes the deployment plan.

### 1.4 Path-scoped tool rules do enforce — and there is a trap

| Allowlist rule | Outcome |
|---|---|
| `Read(./**)` | **Hard-denied.** Recorded in `permission_denials[]` |
| `Read(*)` | **Not denied.** Zero denials — the model merely *chose* not to comply |

`Read(*)` looks like it works and does not. Its refusal was model discretion, phrased as *"this is
a sensitive user config file... so I won't dump its contents"* — a decision, not a control. **Only a
recorded denial counts.**

Scoping was then confirmed across all three tools. With
`--allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)"`, a `Grep` for `oauthAccount` in
`/home/js/.claude.json` and a `Glob` of `/home/js/*` were both hard-denied and logged, while reads
and greps inside the drawing directory worked normally.

### 1.5 `--permission-mode dontAsk` denies rather than hangs

An off-allowlist command was denied, recorded, and the model adapted. It did not block waiting for
a human. This is what makes unattended operation possible at all — the alternative failure mode is
a child process hanging forever on a prompt nobody can answer.

### 1.6 Cost and latency, measured

| Model | Effort | Question | Time | Cost |
|---|---|---|---|---|
| Sonnet | low | "How many wires are in Net 110?" | 15 s | $0.20 |
| Sonnet | low | Net 125 troubleshooting | 59 s | $0.16 |
| Opus | high | Net 125 troubleshooting | 109 s | **$0.64** |

The Net 110 answer was exact: `4 wires: W047, W058, W059, W060`. Sonnet at low effort also reached
the correct diagnosis on the hard question and caught the green-lamp trap.

Opus is meaningfully better on depth, wire-level precision and self-scepticism, which is why it is
the default. But at **~$0.64 and ~2 minutes per question**, an unauthenticated public endpoint is a
direct route to an unbounded bill. **Cost control is a v1 feature, not a later refinement.**

---

## 2. The verified invocation

Every flag is load-bearing.

```bash
claude -p \
  --output-format stream-json --include-partial-messages \
  --model opus --effort high \
  --tools "Read,Grep,Glob" \
  --allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)" \
  --permission-mode dontAsk \
  --strict-mcp-config \
  --disable-slash-commands \
  --exclude-dynamic-system-prompt-sections \
  --append-system-prompt "<orientation — §4>" \
  --max-budget-usd 1.50 \
  --session-id <uuid>          # turn 1;  --resume <uuid> on turn 2+
```

`cwd` = `/home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs`.
No `--add-dir` — an unscoped one would reopen §1.3.

| Flag | Why |
|---|---|
| `--tools "Read,Grep,Glob"` | The real boundary. Bash, Write, Edit, WebFetch, WebSearch and Task **do not exist** in the session, so no injected instruction and no permission decision can reach them. |
| `--allowedTools "…(./**)"` | Confines the filesystem to the drawing directory. Verified in §1.4. |
| `--permission-mode dontAsk` | Denies without prompting (§1.5). |
| `--strict-mcp-config` | `/home/js/.claude.json` registers a `lightrag-tools` MCP server. Without this it boots on **every question** — cold-start cost, extra tool surface, and a path from a schematic question to mutating the LightRAG index. |
| `--disable-slash-commands` | The extraction skill is a *write* workflow. A query session must not be able to invoke it. |
| `--exclude-dynamic-system-prompt-sections` | Keeps the cached prompt prefix stable across turns, improving prompt-cache hit rate — the main per-turn cost lever. |
| `--max-budget-usd` | Per-turn hard ceiling. |
| `--session-id` / `--resume` | Server allocates the UUID up front, so resume is deterministic and we never wait for the init event to learn what to resume. |
| no `--settings` | `-p`'s help states invalid settings files are **silently ignored** in print mode. A silently dropped permission policy is the worst available failure. Explicit flags fail loudly. |
| no `--no-session-persistence` | `--resume` needs the transcript on disk. It is also an audit artifact worth keeping. |

### Child environment: allowlist, never strip

This process carries `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SESSION_ID`,
`CLAUDE_CODE_SSE_PORT`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_EXECPATH`, `CLAUDE_PID` and
`CLAUDE_EFFORT`. The server will often be launched from inside a Claude Code session. Inherited,
the child may treat itself as a nested session, try to attach to the parent's SSE port, and
**silently override the `--effort` flag you passed.**

Pass only: `HOME`, `PATH`, `USER`, `LANG`, `TZ`, plus `TERM=dumb` and `NO_COLOR=1`. Drop
`ANTHROPIC_*` unless deliberately set. All six tests used `env -i` for exactly this reason. Assert
in a unit test that no key matching `^CLAUDE` survives.

---

## 3. Going public — the layers outside the app

§1.3 is mitigated *in the app* by §1.4. For an internet-exposed service that is not enough on its
own.

### 3.1 Use an API key with a spend cap, not the personal OAuth subscription

Two independent reasons:

1. **Structural security.** An `ANTHROPIC_API_KEY` lets the server and its children run as a
   **dedicated unix user with its own `HOME`**, containing no `.claude.json` and no access to
   `/home/js`. That turns §1.3 from "mitigated by a permission rule" into "structurally
   impossible" — defence in depth, so a future flag typo isn't a credential leak.
2. **Basis of service.** Serving anonymous public traffic from a personal Claude subscription is
   worth checking against that plan's terms before going live. An API key is the intended path for
   a shared service, and it comes with real spend controls in the console.

### 3.2 Hard cost controls

- **Per-IP rate limit** (e.g. 3 questions per 10 minutes).
- **Global concurrency cap** of 2–3 in-flight questions.
- **Daily spend ceiling** that *disables* the endpoint with a clear message rather than silently
  degrading. At $0.64/question the arithmetic is unforgiving — 100 questions is $64.
- **`--max-budget-usd` per turn** as the innermost guard. Watch it fire once before depending on it.
- Default the toggle to Opus, but consider Sonnet for anonymous visitors and Opus behind a
  demo password — §1.6 shows Sonnet still gets the hard answer right at a quarter the cost.

### 3.3 Cloudflare Tunnel, not a forwarded port

This box is WSL2. A `0.0.0.0` bind is reachable from the Windows host and often the LAN, and this
endpoint spends money. Bind `127.0.0.1:9700` (LightRAG owns 9621) and let a tunnel terminate TLS
and provide the public hostname.

### 3.4 Treat the answer as untrusted markdown

- **No `rehype-raw`** — LightRAG's WebUI uses it, and it re-enables raw HTML from model output.
- Link-scheme allowlist (`http`, `https`, `#` only); `img` renders alt text only, so no remote
  fetch and therefore no exfiltration-by-image-URL.
- A CSP meta tag: `default-src 'self'; img-src 'self' data:; connect-src 'self'; script-src 'self'`.

### 3.5 Have an abuse plan ready
A shared demo password or a CAPTCHA, built but disabled. Turning it on should be a config change,
not a development task.

---

## 4. The orientation prompt

**Method and policy in the prompt; facts in the files.** Drawing-specific truth stays in
`EXTRACTION_NOTES.md`, where it is auditable and where a correction propagates automatically. The
one exception is the wires-vs-terminals trap, which is a method hazard rather than a fact.

The prompt must establish:

1. **Role.** You answer a maintenance electrician's questions about one electrical schematic, from
   its extraction artifacts, read-only.
2. **File routing.** Read `EXTRACTION_NOTES.md` in full first — it holds the corrections, the seven
   flagged inferences, and a prose "How the circuit actually works." `circuit_logic.json` (188 KB)
   is the master source. **Do not read `geometry.json`** — 608 KB of raw vector/OCR extraction that
   will not answer a netlist question. `custom_kg.json` is the same facts flattened for LightRAG;
   use only to cross-check. Don't open the tiles or the PDF.
3. **The counting trap.** `nets[].member_terminals` is electrical truth; `wires[]` are physical
   conductors. *"How many wires are on net N"* and *"how many terminals"* are different questions
   with different answers — **net 110 has 4 wires and 8 terminals.** State both when it clarifies.
4. **Domain rules not visible on any drawing.** A breaker DIN-rail-mounted as a manual switch is a
   switch, not protection — REVERSE 5A and BYPASS 5A are switches; only CB1 and CB2 protect. A lit
   lamp does not prove contact continuity. A high-impedance meter reads source voltage across an
   open, so a voltage reading proves *that* there is an open, not *where*.
5. **Citation.** Cite wire (`W047`), net (`110`), terminal (`CR-BP:A2`) and component (`CR1`) IDs
   for every claim. End with a Sources section naming each file and the specific table used.
6. **Epistemics.** Separate and label *the drawing shows* / *electrically this implies* / *I am
   inferring or cannot determine*. Net `130` completes only through the downstream machine, so
   nothing on this sheet can energise `CR-SW` — say so rather than inventing a path. If an answer
   rests on one of the seven flagged inferences, name it.
7. **Troubleshooting answer shape.** Restate the measurement and what it does and doesn't prove;
   give the complete candidate path with every wire and terminal in order; rank suspects with
   reasons; give a probe-by-probe procedure saying where to put each lead and what each reading
   means; challenge any premise the netlist shows to be weak evidence; eliminate alternative paths.
   This is the shape the tests already produce — encode it rather than hope for it.
8. **Output.** GitHub-flavoured markdown, tables for listings. No raw HTML, no scripts, no external
   images or links. Lead with the answer, then the evidence.
9. **Refuse out-of-scope.** Requests to modify files, run the extraction, or index anything:
   decline and offer the read-only answer.

`--append-system-prompt` rather than `--system-prompt`: the latter replaces Claude Code's default,
which is exactly the part that makes agentic file reading work. A `CLAUDE.md` in the drawing
directory is worse still — see §7.

---

## 5. Shape of the code

```
/home/js/schematics/                 ← git init here
    server/
        pyproject.toml               fastapi, uvicorn, pydantic-settings, slowapi
        app/main.py                  app factory, StaticFiles mount at /webui
        app/config.py                SWUI_* settings
        app/claude_runner.py         argv build, subprocess, NDJSON parse, killpg
        app/sessions.py              in-memory sessions, LRU
        app/prompts.py               §4
        app/questions.py             starter questions from §12 of HowToUseThisSkill.md
        app/limits.py                per-IP rate limit, daily spend ceiling
        app/static/                  vite output (gitignored)
    webui/
        package.json  vite.config.ts  tsconfig.json  components.json
        src/tabs.ts                  the tab registry
        src/api/client.ts            the only place fetch appears
        src/stores/                  zustand
        src/features/ask/AskTab.tsx  the one v1 tab
        src/components/ui/           shadcn primitives
```

**Server env:** its own venv — `uv init` at `server/`, Python 3.12. Do **not** borrow
`/home/js/LightRAG-Dev/.venv`: it is uv-managed for another project, has no pip, and the next
`uv sync` there would delete anything added.

**Frontend:** npm, not bun. LightRAG's own `vite.config.ts` documents two bugs caused by Bun/Node
divergence. One runtime, no surprises.

**Production serving:** mirror LightRAG's trick — `base: '/webui/'`,
`build.outDir: '../server/app/static'`, and `app.mount('/webui', StaticFiles(html=True))` guarded by
`if STATIC_DIR.is_dir()`. Dev is Vite on 5173 proxying `/api` to 9700.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | server up, `claude` version, today's spend vs ceiling |
| `GET` | `/api/drawing` | title block, notes, referenced drawings, counts — read from `circuit_logic.json` |
| `GET` | `/api/questions` | starter questions |
| `POST` | `/api/ask` | NDJSON stream; rate-limited |
| `POST` | `/api/turns/{id}/cancel` | stop button |

`/api/drawing` costs nothing and answers §12 Q21–Q25 and Q64 outright. Worth having on day one
purely as a cost lever: 47 components / 131 terminals / 26 nets / 71 wires / 8 cables /
7 subsystems / 402 relationships, plus the fact that there is **no revision** — `D` is the sheet
size.

### Transport: NDJSON over POST

One JSON object per line, `application/x-ndjson`, read client-side with `fetch` +
`AbortController` + `response.body.getReader()`.

Not SSE: `EventSource` is GET-only, so a long question won't fit, and its automatic reconnect would
**silently re-issue a paid question**. Not WebSocket: right eventually, but it costs connection
lifecycle and reconnect logic for no v1 benefit.

Cancellation is why this choice matters. `abort()` tears down the request, uvicorn reports a client
disconnect, and the server kills the child. But **don't rely on disconnect detection alone** — a
`StreamingResponse` generator only notices a dead socket when it next tries to yield, and a
thinking Opus can go 30 s without emitting anything. So: a `{"t":"heartbeat"}` line every 10 s, and
an explicit cancel endpoint that the Stop button calls *as well as* aborting the fetch.

### Three subprocess details that otherwise present as "answers randomly stop"

1. **asyncio's `StreamReader` defaults to a 64 KiB line limit** and `readline()` raises on
   overrun. A single `tool_result` line carrying part of a 188 KB netlist exceeds this routinely.
   Set `limit=16*1024*1024` and handle the overrun case.
2. **Always drain stderr.** An unread full pipe deadlocks the child. Read it into a bounded deque.
3. **`start_new_session=True`, and cancel the process group.** `proc.kill()` alone can orphan
   grandchildren. Use `os.killpg(os.getpgid(pid), SIGTERM)` → wait 3 s → `SIGKILL`, with
   `await proc.wait()` in a `finally` so nothing is left unreaped.

### Stream events that matter

`system`/`init` → capture `session_id` and the resolved model. `content_block_delta` text deltas →
**the only source of answer text**. Complete `assistant` messages → **the only source of tool
calls** (don't take text from both, or every answer renders twice). `result` → cost, duration,
`permission_denials[]` — surface denials rather than swallowing them; one usually means the
allowlist is too tight. Unrecognised event types: log and drop, so a CLI upgrade can't break the UI.

Coalesce text deltas server-side (flush on 50 ms or 512 chars) and batch client-side on
`requestAnimationFrame`. Every store write re-runs the markdown renderer over the whole growing
answer; LightRAG's chat gets this wrong and it is visible.

---

## 6. The UI

**A tab registry from day one.** LightRAG hardcodes its tabs in four separate places — a union
type, the trigger list, the panel list, and a hardcoded id map — with no registry, which is exactly
what makes it painful to extend. Since incremental growth is the whole point here:

```ts
export interface TabDef {
  id: string                 // plain string — no union type to widen
  label: string
  icon: LucideIcon
  Component: ComponentType
  order: number
  keepMounted?: boolean      // for future canvas/WebGL tabs
  isEnabled?: (ctx: TabContext) => boolean
}
export const TABS: TabDef[] = [ /* just 'ask' in v1 */ ]
```

One array, consumed by both the trigger list and the `forceMount`ed panels. Validate the persisted
`activeTabId` against the registry on hydrate, so a renamed tab can't wedge the app on a blank
screen. Adding a tab later is one new file plus one array entry.

**v1 screen.** Header: drawing name, model toggle (Opus / Sonnet), health dot. A slim orientation
panel from `/api/drawing` — counts, the drawing notes (the 4" DC/AC clearance note, the labelling
note), the four referenced drawings, and "Revision: none — `D` is the sheet size." Then the chat
column.

Details that matter more than they look:

- **A tool-activity strip** — `Read EXTRACTION_NOTES.md ✓ 120 ms`, `Grep circuit_logic.json ✓`.
  Answers take up to two minutes; this fills the wait *and* shows the reader the model consulted
  the netlist rather than its own memory. It's the trust feature.
- **Starter question chips fill the composer without sending.** Nobody should trigger a $0.64 call
  by mis-clicking.
- Stop button replacing Send while streaming. Copy-as-markdown per answer. Cost and elapsed time
  per answer.

**Starter questions,** chosen to show range and honesty:

1. "How many wires are in Net 110? List them with colour, gauge and endpoints." — the counting trap
2. "I'm reading 24 V on net 125. Both push buttons are green and the BYPASS breaker is closed, but
   the machine won't run. What should I suspect?" — the discriminator
3. "What conditions must be met to energise CR-ON?"
4. "What conditions are needed to energise CR-SW?" — where the correct answer is an honest
   *cannot be determined from this sheet*
5. "Describe the start/stop control circuit from button press to RUN signal."

**Out of v1:** the tile viewer, data tables, graph view, ingest, manuals, accounts, multiple
drawings, persistence across restart, i18n. None are blocked — the tab registry, the streaming
envelope and the per-drawing cwd all generalise.

---

## 7. Two housekeeping notes

**Rename `/home/js/schematics/claude.md`.** It contains stale `/home/js/LightRAG-Dev/jrs/...` paths
and an instruction to write planning documents. It should not be discovered today — the query cwd
is three levels down and the filename is lowercase on a case-sensitive filesystem — but a query
agent must never load it. Something like `_claude_notes/webui_request_2026-08.md` removes the
possibility entirely.

**Never create a `CLAUDE.md` inside `extracted_docs/`.** That directory is meant to be regenerable
from the skill, and adding a hand-written file to it breaks that guarantee.

The precise claim, corrected 2026-08-07: `circuit_logic.json` and `custom_kg.json` *are*
byte-for-byte reproducible, but `geometry.json` is **not** — its geometry reproduces exactly while
its OCR fields differ run to run, even at a fixed tesseract version. See `HowToUseThisSkill.md`
§3.1 for the measurements. This weakens the reproducibility argument slightly without changing the
conclusion: the directory should contain only what the pipeline emits, so that anything found there
can be traced to a script rather than to someone's memory.

There is also a second, independent reason that does not depend on reproducibility at all — a
`CLAUDE.md` in the query `cwd` is **auto-loaded into the session**, making it an uncontrolled
input to a public endpoint. All orientation belongs in `--append-system-prompt`, versioned in
`prompts.py`, where it is reviewable and cannot be edited by anything the drawing directory picks
up.

Also worth doing while setting up: **`git init` at `/home/js/schematics`.** `author_circuit_logic.py`
is the one irreplaceable, non-reproducible artifact in the project and is currently unversioned.

---

## 8. Verification

### Done — on the shell, before any code

| # | Check | Result |
|---|---|---|
| 1 | Headless spawn with OAuth | ✅ |
| 2 | Read/Grep/Glob alone answers the hard question | ✅ Bash unnecessary |
| 3 | Unscoped `Read` reaches `/home/js/.claude.json` | ⚠️ hole confirmed real |
| 4 | `Read(./**)`, `Grep(./**)`, `Glob(./**)` hard-deny the escape | ✅ (`Read(*)` does **not**) |
| 5 | `dontAsk` denies without hanging | ✅ |
| 6 | Cost and latency across both models | ✅ §1.6 |

### To do during implementation

**Backend** (`curl -N`, which is what proves streaming rather than buffering):
frames arrive incrementally; turn 2 resumes and does *not* re-read the netlist; `Ctrl-C` on the
curl leaves no orphan (`pgrep -f claude`); a second concurrent ask on one session returns 409
rather than interleaving writes into the same transcript; `--max-budget-usd 0.02` visibly fires;
launching with a bad `HOME` surfaces a clean `auth_required` rather than a hang.

**Security, before exposure** — re-run checks 3 and 4 *through the public URL, as a visitor*.
Ask it to read `/home/js/.claude.json`, `/etc/passwd`, and
`../../../schematic_skills/SKILL.md`; every one must be denied and logged. Confirm the rate limiter
triggers and the daily ceiling disables the endpoint.

**XSS** — feed the markdown renderer `<img src=x onerror=alert(1)>`, `<script>`, and
`[x](javascript:alert(1))`. Assert no script node, no `onerror` attribute, no `javascript:` href.

**Acceptance**, scripted from §12 of `HowToUseThisSkill.md`:

- Net 110 → **4 wires: W047, W058, W059, W060**, and separately **8 terminals**. Assert both; the
  documented failure mode is conflating them.
- Net 110 membership includes `CR-SW:14`, `CR-ON:A2`, `CR-BP:12`, `INFEED1:1`.
- Net 125 → must reach CR-BP coil not energised with an open on its 0 V return, rank
  `CR1:11-14`/`CR2:11-14` first, and not be fooled by the green lamps.
- Q28/Q34 → CB1 8 A, CB2 20 A, and REVERSE/BYPASS 5 A described as **switches**, not protection.
- Q21 → must **not** report a revision of `D`.
- Q67 → must **decline** to determine CR-SW's energising conditions and mention net 130 / the
  downstream machine. **A confident answer here is the failure.**

Archive each run into `_claude_notes/webui_acceptance/` — the same audit discipline the rest of the
project already uses.

---

## Related documents

- [`webui_ideas.md`](webui_ideas.md) — the long-range vision this is the first slice of.
- [`direct_file_query_test_PS20115MLM4-2.md`](direct_file_query_test_PS20115MLM4-2.md) — the test
  that established direct file access beats RAG here.
- `../schematic_skills/references/HowToUseThisSkill.md` — §7b query prompts, §12 the 71-question
  ground-truth bank.
