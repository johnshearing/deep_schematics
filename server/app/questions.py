"""Starter questions.

Chosen (plan §6) to show range *and* honesty. Two of the five are traps the project already
knows this data sets — the wires-vs-terminals count, and CR-SW, where the correct answer is
"cannot be determined from this sheet". A demo that only shows the model succeeding teaches a
visitor nothing about when to trust it.

`kind` lets the UI mark which are free: `deterministic` questions are answered by
`/api/drawing` with no model call at all (ideas §4 — every deterministic answer displaces a
paid one).
"""

from __future__ import annotations

from typing import Any

STARTER_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "net-110-wires",
        "text": (
            "How many wires are in Net 110? List them with colour, gauge and endpoints."
        ),
        "note": "The counting trap — wires and terminals are different questions.",
        "acceptance": "4 wires: W047, W058, W059, W060 — and separately 8 terminals.",
        "kind": "model",
    },
    {
        "id": "net-125-troubleshoot",
        "text": (
            "I'm reading 24 V on net 125. Both push buttons are green and the BYPASS breaker "
            "is closed, but the machine won't run. What should I suspect?"
        ),
        "note": "The discriminator. Watch for the green-lamp trap.",
        "acceptance": (
            "CR-BP coil not energised, open on its 0 V return; ranks CR1:11-14 / CR2:11-14 "
            "first; is not fooled by the green lamps."
        ),
        "kind": "model",
    },
    {
        "id": "cr-on-conditions",
        "text": "What conditions must be met to energise CR-ON?",
        "note": "Exercises COIL_CONTROLS_CONTACT, which is synthesised, not measured.",
        "acceptance": "CR-SW or CR-BP energised.",
        "kind": "model",
    },
    {
        "id": "cr-sw-conditions",
        "text": "What conditions are needed to energise CR-SW?",
        "note": "The honest answer is 'cannot be determined from this sheet.'",
        "acceptance": (
            "Must decline and mention net 130 / the downstream machine. A confident answer "
            "here is the failure."
        ),
        "kind": "model",
    },
    {
        "id": "start-stop-circuit",
        "text": "Describe the start/stop control circuit from button press to RUN signal.",
        "note": "The whole control chain, end to end.",
        "acceptance": "PB1/PB2 → CR1/CR2 → BYPASS → CR-BP → CR-ON → RUN.",
        "kind": "model",
    },
]


def starter_questions() -> list[dict[str, Any]]:
    """Public shape — the acceptance text stays server-side; it is a test oracle, and
    showing it to a visitor would tell the model the answer if they pasted it back."""
    return [
        {"id": q["id"], "text": q["text"], "note": q["note"], "kind": q["kind"]}
        for q in STARTER_QUESTIONS
    ]
