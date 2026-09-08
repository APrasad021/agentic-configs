"""Model registry.

Reads ``config/models.json`` so model ids, prices and capabilities live in
exactly one place — a data file, not code.

Call sites use aliases (``fast`` / ``default`` / ``deep``). Swapping which
model ``default`` points at is then a one-line change to a JSON file,
reviewable on its own, instead of a rename across every call site.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

Provider = Literal["anthropic", "openai", "google"]

_REGISTRY_PATH = Path(__file__).resolve().parents[2] / "config" / "models.json"


@dataclass(frozen=True)
class Price:
    input: float
    output: float
    cached_input: float | None = None


@dataclass(frozen=True)
class ModelSpec:
    provider: Provider
    context_window: int
    max_output: int
    price: Price
    supports: dict[str, bool]


@lru_cache(maxsize=1)
def _registry() -> dict:
    return json.loads(_REGISTRY_PATH.read_text())


@lru_cache(maxsize=1)
def _models() -> dict[str, ModelSpec]:
    out: dict[str, ModelSpec] = {}
    for model_id, raw in _registry()["models"].items():
        p = raw["price"]
        out[model_id] = ModelSpec(
            provider=raw["provider"],
            context_window=raw["contextWindow"],
            max_output=raw["maxOutput"],
            price=Price(p["input"], p["output"], p.get("cachedInput")),
            supports=raw["supports"],
        )
    return out


def resolve_model(name_or_alias: str) -> str:
    """Resolve an alias ('fast') or a raw model id to a concrete id."""
    aliases = _registry()["aliases"]
    model_id = aliases.get(name_or_alias, name_or_alias)
    if model_id not in _models():
        known = ", ".join([*aliases, *_models()])
        raise KeyError(
            f"Unknown model {name_or_alias!r}. Known: {known}. "
            "Add it to config/models.json."
        )
    return model_id


def spec(model_id: str) -> ModelSpec:
    return _models()[resolve_model(model_id)]


def fallbacks_for(model_id: str) -> list[str]:
    fb = _registry().get("fallbacks", {})
    return [m for m in fb.get(resolve_model(model_id), []) if not m.startswith("_")]


def cost_of(
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
) -> float:
    """USD cost of a completed call."""
    p = spec(model_id).price
    fresh = max(0, input_tokens - cached_input_tokens)
    cached_rate = p.cached_input if p.cached_input is not None else p.input
    return (
        fresh * p.input + cached_input_tokens * cached_rate + output_tokens * p.output
    ) / 1_000_000


def estimate_max_cost(
    model_id: str, input_tokens: int, max_output_tokens: int | None = None
) -> float:
    """Pre-flight estimate used to enforce the budget ceiling before spending.

    Deliberately pessimistic: it assumes the model emits its full ``max_output``,
    because the point is to refuse a call that *could* be ruinous, not to
    predict the average one.
    """
    s = spec(model_id)
    return cost_of(model_id, input_tokens, max_output_tokens or s.max_output)
