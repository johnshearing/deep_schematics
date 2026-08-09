# Schematic WebUI — server

A read-only question-answering service over one extracted electrical schematic. It spawns
headless `claude` (`-p --output-format stream-json`) with `Read`/`Grep`/`Glob` scoped to the
drawing directory, and streams the answer to the browser as NDJSON.

Implements [`_claude_notes/webui_v1_plan.md`](../_claude_notes/webui_v1_plan.md). Section
references below point at that document.

---

## Quick start

```bash
# 1. server
cd server
uv sync
cp .env.example .env          # edit if your paths differ
uv run uvicorn app.main:app --host 127.0.0.1 --port 9700

# 2. frontend, in another terminal
cd webui
npm install
npm run dev                   # http://localhost:5173, proxies /api to 9700
```

For a single-process deployment, build the frontend into the server's static directory:

```bash
cd webui && npm run build     # writes ../server/app/static
# then http://127.0.0.1:9700/webui/
```

`app/static/` is a build artifact and is gitignored.

---

## Configuration

Every setting is read from the environment or `server/.env` with the `SWUI_` prefix. See
`.env.example` for the full list with defaults; the ones that matter most:

| Setting | Default | Notes |
|---|---|---|
| `SWUI_DRAWING_DIR` | `../schematic_extraction/PS20115MLM4-2/extracted_docs` | the child's `cwd`; the only directory it can read |
| `SWUI_DEFAULT_MODEL` | `sonnet` | `opus` costs ~4× more per question (§1.6) |
| `SWUI_ANONYMOUS_MODELS` | `sonnet` | which models a visitor may pick without the demo password (§3.2) |
| `SWUI_MAX_BUDGET_USD` | `1.50` | per-turn ceiling, passed to `--max-budget-usd` |
| `SWUI_DAILY_SPEND_CEILING_USD` | `10.00` | disables `/api/ask` with a clear message when reached |
| `SWUI_RATE_LIMIT` | `3/10 minutes` | per-IP |
| `SWUI_MAX_CONCURRENT_TURNS` | `2` | global |
| `SWUI_DEMO_PASSWORD` | *(empty — disabled)* | §3.5: built, off by default. Set it and the UI asks for it |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | server up, `claude` version, today's spend vs ceiling |
| `GET` | `/api/drawing` | title block, notes, references, counts — free, no model call |
| `GET` | `/api/questions` | starter questions |
| `POST` | `/api/ask` | NDJSON answer stream; rate-limited |
| `POST` | `/api/turns/{turn_id}/cancel` | Stop button |

### The `/api/ask` stream

`application/x-ndjson`, one JSON object per line, each with a `t` (type) field:

| `t` | Payload |
|---|---|
| `start` | `session_id`, `turn_id`, `model` |
| `init` | `claude_session_id`, `model` resolved by the CLI |
| `tool` | `name`, `detail`, `id` — feeds the tool-activity strip |
| `tool_result` | `id`, `ok`, `ms` |
| `text` | `d` — the answer delta. Coalesced server-side (50 ms / 512 chars) |
| `heartbeat` | keeps the socket alive so cancellation is detected while Opus thinks |
| `denial` | a recorded `permission_denials[]` entry — surfaced, never swallowed |
| `done` | `cost_usd`, `duration_ms`, `num_turns`, `is_error`, `daily_spend_usd` |
| `error` | `message`, `code` |

Unrecognised CLI event types are logged and dropped, so a CLI upgrade cannot break the UI.

## Why the invocation looks the way it does

`app/claude_runner.py` builds the argv from §2 of the plan. Every flag is load-bearing, and
three of them are security controls rather than conveniences:

- `--tools "Read,Grep,Glob"` — Bash, Write, Edit, WebFetch, WebSearch and Task do not exist in
  the session, so no injected instruction can reach them.
- `--allowedTools "Read(./**)" "Grep(./**)" "Glob(./**)"` — path scoping. Unqualified `Read`
  reaches `/home/js/.claude.json` (§1.3); `Read(*)` **looks** like it scopes and does not (§1.4).
- `--strict-mcp-config` — otherwise the `lightrag-tools` MCP server boots on every question.
- `--safe-mode` — **found during implementation, not in the plan.** Without it the child
  auto-loads `~/.claude/projects/<git-root-slug>/memory/MEMORY.md`. The drawing directory is
  inside this git repo, so that resolves to *this project's own* memory index. No permission
  rule sees it: there is no tool call to deny, the file is injected before the model runs, and
  `permission_denials[]` stays empty. Verified with a canary string — leaked without the flag,
  absent with it. Safe mode also drops CLAUDE.md discovery, skills, plugins, hooks and custom
  agents, and leaves auth, tools and permissions working.
- `--verbose` — also not in the plan, and also not optional: the CLI exits 1 with
  *"When using --print, --output-format=stream-json requires --verbose"*.

The child environment is an allowlist, never a strip: `HOME`, `PATH`, `USER`, `LANG`, `TZ`,
plus `TERM=dumb` and `NO_COLOR=1`. Any inherited `CLAUDE*` variable can make the child think
it is a nested session and silently override `--effort`. `tests/test_runner.py` asserts no key
matching `^CLAUDE` survives.

## Tests

```bash
cd server && uv run pytest -q          # 36 tests, offline and free
cd webui  && npx vitest run            # 7 XSS cases against the real markdown renderer
```

The subprocess tests use `tests/fake_claude.py`, a stub that emits a canned stream-json
transcript, so the suite costs nothing and needs no network. Its `FAKE_MODE` env var switches
it between the cases the runner has to survive — a hang, a crash, an oversized `tool_result`,
a permission denial, a budget stop, an auth failure, and junk on the wire.

### Acceptance against the real drawing

```bash
uv run python scripts/acceptance.py --model sonnet
uv run python scripts/acceptance.py --model opus --only net-125-troubleshoot
```

This spends real money (~$0.37 for the full Sonnet sweep) and writes a markdown report into
`_claude_notes/webui_acceptance/`. It runs the §8 ground-truth questions, including the three
the project already knows this data sets: net 110's wires-vs-terminals count, the `D`
sheet-size trap, and CR-SW — where a *confident* answer is the failure.

Run the server with `SWUI_RATE_LIMIT_ENABLED=false` first, or the per-IP limiter will
(correctly) stop the sweep after three questions.

## Before exposing this to the internet

The app-level controls above are necessary but not sufficient. §3 of the plan is the rest:
run under a dedicated unix user with `ANTHROPIC_API_KEY` and its own `HOME`, bind
`127.0.0.1:9700` behind a Cloudflare Tunnel rather than forwarding a port from WSL2, and
re-run the §1.3/§1.4 escape probes *through the public URL as a visitor* before announcing it.
