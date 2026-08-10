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
cp .env.example .env          # optional — every setting has a default. Do not clobber an
                              # existing .env; it is gitignored and holds the demo password
uv run python -m app          # binds SWUI_HOST:SWUI_PORT, default 127.0.0.1:9700

# 2. frontend, in another terminal
cd webui
npm install
npm run dev                   # http://localhost:5173, proxies /api to 9700
```

`python -m app` is the launch command rather than `uvicorn app.main:app` because uvicorn's CLI
takes the bind address as a flag, which would leave `SWUI_HOST` in your `.env` silently
ignored. Use the uvicorn CLI directly only when you want `--reload` for frontend work, and
remember it overrides the setting:

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9700
```

For a single-process deployment, build the frontend into the server's static directory:

```bash
cd webui && npm run build     # writes ../server/app/static
# then http://127.0.0.1:9700/webui/
```

`app/static/` is a build artifact and is gitignored.

Vite content-hashes the asset filenames, so the server caches `/webui/assets/*` for a year and
sends `Cache-Control: no-cache` on `index.html` — the file that names them. Without that,
browsers apply heuristic caching to the HTML, and a visitor keeps running the *previous*
bundle against the *current* server: the API has endpoints the UI does not know about, and
features that shipped appear to be missing. If you are debugging something that looks like a
build that did not take effect, check the asset hash in the page source against
`app/static/assets/` before anything else.

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
| `SWUI_DEMO_PASSWORD` | *(empty — disabled)* | §3.5. Set it and the UI asks for it. See "The demo password" below |
| `SWUI_UNLOCK_RATE_LIMIT` | `5/minute` | guesses per IP against `/api/unlock` |
| `SWUI_HOST` | `127.0.0.1` | `0.0.0.0` to accept connections from off the machine. Read only by `python -m app` |
| `SWUI_PORT` | `9700` | as above |

## The demo password

**Where it lives: `SWUI_DEMO_PASSWORD` in `server/.env`.** Change the value, restart the
server, done — it is not compiled into the frontend and appears nowhere else.

Two settings decide it together, and the second is the one that matters:

| Want | `SWUI_DEMO_PASSWORD` | `SWUI_ANONYMOUS_MODELS` |
|---|---|---|
| Open demo, no password | *(empty)* | `sonnet` |
| Public demo, Sonnet free, Opus gated (plan §3.2) | your password | `sonnet` |
| Nothing is free — every question needs the password | your password | *(empty)* |

A password alone does **not** close the server: with `SWUI_ANONYMOUS_MODELS=sonnet` a stranger
can still ask unlimited Sonnet questions and only Opus is locked. Emptying it is what makes
the password a gate on the whole thing.

`POST /api/unlock` validates a password without spending a question, so a typo reports itself
immediately instead of surfacing as a 403 on a real question. It gets its own rate-limit
bucket because guessing is the attack here, and `/api/ask`'s per-endpoint limit does not cover
it. A short numeric password is only as strong as that limit.

The browser holds the password in memory for the tab and sends it as `X-Demo-Password`. It is
never written to `localStorage` — a shared demo secret has no business outliving the tab — so
each reload asks again.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | server up, `claude` version, today's spend vs ceiling |
| `GET` | `/api/drawing` | title block, notes, references, counts — free, no model call |
| `GET` | `/api/source` | the source PDF, inline — `404` when none sits beside the extraction |
| `GET` | `/api/questions` | starter questions |
| `POST` | `/api/unlock` | check the demo password without spending a question; own rate limit |
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
| `status` | `s` — currently only `thinking`. Reasoning text is never forwarded; a 30 s silence gets a label instead |
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
cd server && uv run pytest -q          # 46 tests, offline and free
cd webui  && npx vitest run            # 15 tests: 7 XSS cases against the real markdown
                                       # renderer, plus the unlock flow and the app shell
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

## Exposing this on a LAN under WSL2

Reaching the server from another device takes three things, and all three are silent when
missing — each one fails as a plain connection timeout:

1. **Bind to `0.0.0.0`.** `SWUI_HOST=0.0.0.0` in `server/.env`, launched with `python -m app`.
   WSL2 is NAT'd behind its own virtual interface, so the Windows host is not the same machine
   as far as the socket is concerned and a loopback bind rejects it.
2. **Forward the port from Windows into WSL.** In an **Administrator** PowerShell or cmd:

   ```
   netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9700 connectaddress=<WSL_IP> connectport=9700
   netsh advfirewall firewall add rule name="Schematic WebUI" dir=in action=allow protocol=TCP localport=9700
   ```

   where `<WSL_IP>` is `hostname -I` inside WSL. Verify with
   `netsh interface portproxy show all`.
3. **Forward the port on the router**, if you want it reachable from outside the LAN.

> **The WSL IP is not stable.** It is assigned by WSL's NAT and can change when WSL restarts,
> which breaks the portproxy rule from step 2 with no error anywhere — the server looks
> healthy and external clients just time out. If access stops working after a reboot, re-check
> `hostname -I` against `netsh interface portproxy show all` before debugging anything else.

Checks, in the order that isolates the failing hop:

```bash
ss -ltnp | grep 9700                      # in WSL: must show 0.0.0.0:9700, not 127.0.0.1:9700
curl -s -o /dev/null -w '%{http_code}\n' http://$(hostname -I | awk '{print $1}'):9700/webui/
```

Then load `http://<windows-lan-ip>:9700/webui/` from another device. Testing the public IP
from inside the LAN relies on the router hairpinning the connection back, which not all
routers do and which does not prove an external path works — confirm from a phone on cellular.

## Before exposing this to the internet

The app-level controls above are necessary but not sufficient. §3 of the plan is the rest:
run under a dedicated unix user with `ANTHROPIC_API_KEY` and its own `HOME`, bind
`127.0.0.1:9700` behind a Cloudflare Tunnel rather than forwarding a port from WSL2, and
re-run the §1.3/§1.4 escape probes *through the public URL as a visitor* before announcing it.

The WSL2 port-forwarding recipe above is the expedient path, not that one. What it currently
has going for it: `SWUI_DEMO_PASSWORD` is set and `SWUI_ANONYMOUS_MODELS` is empty, so no
question reaches the model unauthenticated, and the daily ceiling bounds the damage if the
password leaks. What it still lacks from §3.1 is the dedicated unix user and API key — the
child still runs as you, and `--safe-mode` plus the path scoping are what stand between a
visitor's question and your home directory.
