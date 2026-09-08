"""Eval runner — deliberately ~100 lines.

STATUS: draft. The graders below cover the deterministic cases in
``evals/cases/``. Extend ``GRADERS`` rather than reaching for a framework; the
value here is in the cases, not the harness.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from src.ai.gateway import Message, complete
from src.ai.prompts import load_prompt, render

Grader = Callable[[str, dict[str, Any]], str | None]


def _contains(out: str, s: dict) -> str | None:
    return None if s["value"] in out else f"missing {s['value']!r}"


def _contains_any(out: str, s: dict) -> str | None:
    low = out.lower()
    return None if any(v.lower() in low for v in s["values"]) else f"none of {s['values']} present"


def _not_contains(out: str, s: dict) -> str | None:
    hit = next((v for v in s["values"] if v in out), None)
    return f"must not contain {hit!r}" if hit else None


def _regex(out: str, s: dict) -> str | None:
    return None if re.search(s["value"], out) else f"no match for /{s['value']}/"


def _max_bullets(out: str, s: dict) -> str | None:
    n = sum(1 for line in out.splitlines() if re.match(r"^\s*[-*•]", line))
    return None if n <= s["value"] else f"{n} bullets, max {s['value']}"


def _json_valid(out: str, _s: dict) -> str | None:
    try:
        json.loads(out)
    except ValueError as exc:
        return f"invalid JSON: {exc}"
    return None


#: Each grader returns None on pass, or a reason string on failure.
GRADERS: dict[str, Grader] = {
    "contains": _contains,
    "contains_any": _contains_any,
    "not_contains": _not_contains,
    "regex": _regex,
    "max_bullets": _max_bullets,
    "json_valid": _json_valid,
}


def load_cases(directory: str = "evals/cases") -> list[dict]:
    cases: list[dict] = []
    for path in sorted(Path(directory).glob("*.jsonl")):
        for line in path.read_text().splitlines():
            if line.strip():
                cases.append(json.loads(line))
    return cases


def main() -> int:
    results = []
    total_cost = 0.0

    for case in load_cases():
        prompt = load_prompt(case["prompt"])
        r = complete(
            [Message("user", render(prompt, **case["inputs"]))],
            model=prompt.model or "default",
            # Evals pin temperature to 0 so a failure means the prompt changed,
            # not that you drew a different sample. Non-zero temperature turns a
            # regression suite into a coin flip.
            temperature=0,
            max_output_tokens=prompt.max_output_tokens,
        )
        total_cost += r.cost_usd

        failures = [
            msg
            for g in case["graders"]
            if (msg := (GRADERS[g["type"]](r.text, g) if g["type"] in GRADERS else f"unknown grader {g['type']!r}"))
        ]
        results.append({"id": case["id"], "pass": not failures, "failures": failures, "cost_usd": r.cost_usd})
        mark = "✓" if not failures else "✗"
        detail = f" — {'; '.join(failures)}" if failures else ""
        print(f"{mark} {case['id']}{detail}")

    passed = sum(1 for r in results if r["pass"])
    print(f"\n{passed}/{len(results)} passed · ${total_cost:.4f}")

    out_dir = Path("evals/results")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    (out_dir / f"{stamp}.json").write_text(
        json.dumps({"passed": passed, "total": len(results), "total_cost": total_cost, "results": results}, indent=2)
    )

    # Non-zero exit so `make eval` gates a merge.
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
