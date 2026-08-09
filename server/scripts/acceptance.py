#!/usr/bin/env python3
"""Run the plan §8 acceptance questions through the live API and archive the answers.

    uv run python scripts/acceptance.py --model sonnet
    uv run python scripts/acceptance.py --model opus --only net-125-troubleshoot

Every run writes a markdown report to `_claude_notes/webui_acceptance/`, which is the same
audit discipline the rest of the project already uses: an answer you cannot trace back to a
model, an effort level and a prompt version is an anecdote.

The checks are deliberately crude — substring and regex over the answer text. They are here
to catch the *known* failure modes (conflating wires with terminals, inventing a path for
CR-SW, reporting `D` as a revision), not to grade prose.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ARCHIVE = REPO_ROOT / "_claude_notes" / "webui_acceptance"


@dataclass
class Check:
    label: str
    ok: bool
    detail: str = ""


@dataclass
class Case:
    id: str
    question: str
    why: str
    check: Callable[[str], list[Check]]


def has(text: str, *needles: str) -> bool:
    lowered = text.lower()
    return all(needle.lower() in lowered for needle in needles)


def any_of(text: str, *needles: str) -> bool:
    lowered = text.lower()
    return any(needle.lower() in lowered for needle in needles)


def check_net_110(answer: str) -> list[Check]:
    wires = {"W047", "W058", "W059", "W060"}
    return [
        Check("names all four wires", wires <= set(re.findall(r"W\d{3}", answer)),
              f"found {sorted(set(re.findall(r'W0[45][0-9]', answer)))}"),
        Check("says 4 wires", bool(re.search(r"\b(4|four)\b[^.\n]{0,30}wire", answer, re.I))),
        # The documented failure mode is conflating the two counts, so both must appear.
        Check("says 8 terminals", bool(re.search(r"\b(8|eight)\b[^.\n]{0,30}terminal",
                                                 answer, re.I))),
    ]


def check_net_110_members(answer: str) -> list[Check]:
    return [
        Check(f"includes {t}", t.lower() in answer.lower())
        for t in ("CR-SW:14", "CR-ON:A2", "CR-BP:12", "INFEED1:1")
    ]


def check_net_125(answer: str) -> list[Check]:
    return [
        Check("reaches CR-BP coil not energised", has(answer, "CR-BP")),
        Check("ranks the CR1/CR2 contacts", any_of(answer, "CR1:11", "CR2:11", "11-14")),
        Check("talks about the 0 V return", any_of(answer, "0V", "0 V", "TB-0V")),
        Check("is not fooled by the green lamps",
              any_of(answer, "lamp", "green") and any_of(answer, "does not prove",
                                                         "proves nothing", "doesn't prove")),
    ]


def check_breakers(answer: str) -> list[Check]:
    return [
        Check("CB1 is 8 A", bool(re.search(r"CB1[^.\n]{0,60}8\s*A", answer, re.I))),
        Check("CB2 is 20 A", bool(re.search(r"CB2[^.\n]{0,60}20\s*A", answer, re.I))),
        Check("calls the 5 A units switches",
              bool(re.search(r"(reverse|bypass)[^.\n]{0,120}switch", answer, re.I))),
        Check("does not call them protection", _no_unnegated_protection(answer)),
    ]


def _no_unnegated_protection(answer: str) -> bool:
    """Every "REVERSE/BYPASS … protect…" must carry a negation.

    A bare substring test fails here, and it fails in the direction that matters: the *right*
    answer — "used as a manual switch, not protection" — contains the word "protection", so a
    naive check marks a correct answer wrong and hides a real regression behind a red light.
    """
    negations = ("not ", "n't", "rather than", "no over", "instead of", "never")
    for match in re.finditer(r"(reverse|bypass)[^.\n]{0,90}protect\w*", answer, re.I):
        if not any(word in match.group(0).lower() for word in negations):
            return False
    return True


def check_revision(answer: str) -> list[Check]:
    return [
        Check("does not report a revision of D",
              not re.search(r"revision[^.\n]{0,20}\bD\b", answer, re.I)
              or bool(re.search(r"\bD\b[^.\n]{0,40}sheet size", answer, re.I))),
        Check("explains D is the sheet size", any_of(answer, "sheet size")),
    ]


def check_cr_sw(answer: str) -> list[Check]:
    return [
        # A confident answer here is the failure, not a bonus.
        Check("declines to determine it",
              any_of(answer, "cannot be determined", "can't be determined", "cannot determine",
                     "not determinable", "cannot tell", "insufficient")),
        Check("mentions net 130", any_of(answer, "130")),
        Check("mentions the downstream machine",
              any_of(answer, "downstream", "subordinate", "off-sheet", "off sheet",
                     "another drawing")),
    ]


CASES = [
    Case("net-110-wires",
         "How many wires are in Net 110? List them with colour, gauge and endpoints.",
         "the counting trap — wires are not terminals", check_net_110),
    Case("net-110-members",
         "List every terminal that is a member of net 110.",
         "ON_NET correctness across a multi-terminal net", check_net_110_members),
    Case("net-125-troubleshoot",
         "I'm reading 24 V on net 125. Both push buttons are green and the BYPASS breaker is "
         "closed, but the machine won't run. What should I suspect?",
         "the discriminator, including the green-lamp trap", check_net_125),
    Case("breaker-ratings",
         "What are the ratings and purposes of every circuit breaker on this drawing?",
         "Q28/Q34 — REVERSE and BYPASS 5 A are switches, not protection", check_breakers),
    Case("revision",
         "What is the drawing number and revision of this schematic?",
         "Q21 — 'D' is the sheet size", check_revision),
    Case("cr-sw-conditions",
         "What conditions are needed to energise CR-SW?",
         "Q67 — a confident answer is the failure", check_cr_sw),
]


def ask(base: str, question: str, model: str, session_id: str | None) -> dict:
    body = json.dumps({"question": question, "model": model, "session_id": session_id})
    request = urllib.request.Request(
        f"{base}/api/ask", data=body.encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    text, meta, tools, denials = [], {}, [], []
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310
        for raw in response:
            line = raw.decode("utf-8").strip()
            if not line:
                continue
            event = json.loads(line)
            if event["t"] == "text":
                text.append(event["d"])
            elif event["t"] == "tool":
                tools.append(f"{event['name']} {event['detail']}".strip())
            elif event["t"] == "denial":
                denials.append(event)
            elif event["t"] in {"done", "error", "start"}:
                meta.update(event)
    return {"answer": "".join(text), "meta": meta, "tools": tools, "denials": denials}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:9700")
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--only", action="append", help="case id; repeatable")
    args = parser.parse_args()

    cases = [c for c in CASES if not args.only or c.id in args.only]
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        f"# WebUI acceptance run — {args.model}",
        "",
        f"**When:** {stamp} · **Endpoint:** `{args.base}`",
        "",
        "Generated by `server/scripts/acceptance.py`. Checks are substring/regex probes for",
        "the known failure modes in `webui_v1_plan.md` §8, not a grade on the prose.",
        "",
    ]
    total_cost = 0.0
    passed = failed = 0

    for case in cases:
        print(f"→ {case.id} …", flush=True)
        started = time.time()
        try:
            # Each case gets a fresh session: a resumed one would let an earlier answer
            # contaminate the next, which is exactly what an acceptance run must not allow.
            result = ask(args.base, case.question, args.model, None)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"   request failed: {exc}")
            lines += [f"## ❌ {case.id}", "", f"Request failed: `{exc}`", ""]
            failed += 1
            continue

        checks = case.check(result["answer"])
        ok = all(check.ok for check in checks)
        passed += ok
        failed += not ok
        cost = float(result["meta"].get("cost_usd") or 0.0)
        total_cost += cost

        print(f"   {'PASS' if ok else 'FAIL'}  ${cost:.3f}  {time.time() - started:.0f}s")
        for check in checks:
            print(f"     {'✓' if check.ok else '✗'} {check.label} {check.detail}")

        lines += [
            f"## {'✅' if ok else '❌'} {case.id}",
            "",
            f"*{case.why}*",
            "",
            f"**Question:** {case.question}",
            "",
            "| Check | Result |",
            "|---|---|",
            *[f"| {c.label} | {'✅' if c.ok else '❌'} {c.detail} |" for c in checks],
            "",
            f"**Cost:** ${cost:.4f} · **Duration:** "
            f"{result['meta'].get('duration_ms', 0) / 1000:.1f}s"
            f" · **Denials:** {len(result['denials'])}",
            "",
            "**Tool calls:** " + (", ".join(f"`{t}`" for t in result["tools"]) or "none"),
            "",
            "<details><summary>Answer</summary>",
            "",
            result["answer"] or "*(empty)*",
            "",
            "</details>",
            "",
        ]

    lines.insert(3, f"**Result:** {passed} passed, {failed} failed · total ${total_cost:.2f}\n")
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    report = ARCHIVE / f"{stamp}-{args.model}.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n{passed} passed, {failed} failed · ${total_cost:.2f} · {report}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
