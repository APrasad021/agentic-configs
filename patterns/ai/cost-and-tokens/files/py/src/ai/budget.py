"""Per-run cost accounting.

The gateway enforces a ceiling on a *single* call. That does not stop the
failure that actually costs money: an agent loop making 400 individually
reasonable calls. This tracks the run as a whole.

Uses ``contextvars`` so call sites do not have to thread a ledger through every
function — the ledger follows the execution context instead.
"""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Iterator

from ..config.env import settings


@dataclass
class CallRecord:
    model: str
    label: str
    input_tokens: int
    output_tokens: int
    cached_input_tokens: int
    cost_usd: float
    ms: float


@dataclass
class RunLedger:
    run_id: str
    ceiling_usd: float
    calls: list[CallRecord] = field(default_factory=list)

    @property
    def total_usd(self) -> float:
        return sum(c.cost_usd for c in self.calls)


class RunBudgetExceededError(RuntimeError):
    pass


_current: ContextVar[RunLedger | None] = ContextVar("run_ledger", default=None)


def current_run() -> RunLedger | None:
    return _current.get()


@contextmanager
def run_budget(
    run_id: str | None = None, ceiling_usd: float | None = None
) -> Iterator[RunLedger]:
    """Run a block inside a budgeted context. Nested blocks share the ledger."""
    existing = _current.get()
    if existing is not None:
        yield existing
        return

    ledger = RunLedger(
        run_id=run_id or str(uuid.uuid4()),
        ceiling_usd=ceiling_usd if ceiling_usd is not None else settings.ai_max_usd_per_run,
    )
    token = _current.set(ledger)
    try:
        yield ledger
    finally:
        _current.reset(token)


def record(call: CallRecord) -> None:
    """Record a completed call. Raises once the run's total passes its ceiling."""
    ledger = _current.get()
    if ledger is None:
        return  # accounting is optional; not being in a run is fine
    ledger.calls.append(call)

    if ledger.total_usd > ledger.ceiling_usd:
        top = sorted(ledger.calls, key=lambda c: c.cost_usd, reverse=True)[:3]
        detail = ", ".join(f"{c.label} (${c.cost_usd:.4f})" for c in top)
        raise RunBudgetExceededError(
            f"Run {ledger.run_id} spent ${ledger.total_usd:.4f} over "
            f"{len(ledger.calls)} calls, past its ${ledger.ceiling_usd:.2f} "
            f"ceiling. Most expensive: {detail}"
        )


def summarize(ledger: RunLedger) -> str:
    """Human-readable summary.

    Print this at the end of every CLI run and job: cost you cannot see is cost
    you do not manage.
    """
    by_model: dict[str, dict[str, float]] = {}
    for c in ledger.calls:
        e = by_model.setdefault(c.model, {"n": 0, "usd": 0.0, "in": 0, "out": 0})
        e["n"] += 1
        e["usd"] += c.cost_usd
        e["in"] += c.input_tokens
        e["out"] += c.output_tokens

    lines = [
        f"run {ledger.run_id}: {len(ledger.calls)} calls, "
        f"${ledger.total_usd:.4f} of ${ledger.ceiling_usd:.2f}"
    ]
    for model, e in by_model.items():
        lines.append(
            f"  {model:<28} {int(e['n']):>3} calls  "
            f"{int(e['in'])}→{int(e['out'])} tok  ${e['usd']:.4f}"
        )

    total_in = sum(c.input_tokens for c in ledger.calls)
    cached = sum(c.cached_input_tokens for c in ledger.calls)
    if total_in:
        lines.append(f"  cache hit rate: {cached / total_in * 100:.0f}% of input tokens")
    return "\n".join(lines)
