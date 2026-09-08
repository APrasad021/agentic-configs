"""One call signature over every provider.

The point is NOT to abstract providers away — provider-specific features are
why you pick a provider. The point is that the boring 90% (auth, retries,
usage accounting, timeouts, fallback, budget) is written once, and the
interesting 10% stays reachable through ``Completion.raw``.

Adding a provider means adding one adapter below and one entry in
``config/models.json``. Nothing else in your codebase changes.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx

from ..config.env import settings
from .models import cost_of, estimate_max_cost, fallbacks_for, resolve_model, spec

Role = Literal["system", "user", "assistant"]

RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}


@dataclass
class Message:
    role: Role
    content: str


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int
    cached_input_tokens: int = 0


@dataclass
class Completion:
    text: str
    model: str
    usage: Usage
    cost_usd: float
    attempted: list[str] = field(default_factory=list)
    raw: Any = None


class BudgetExceededError(RuntimeError):
    pass


class MissingCredentialError(RuntimeError):
    pass


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS
    # Network-level failures carry no status and are worth another try.
    return isinstance(exc, (httpx.TimeoutException, httpx.TransportError))


def complete(
    messages: list[Message],
    *,
    model: str = "default",
    max_output_tokens: int | None = None,
    temperature: float | None = None,
    timeout_s: float = 60.0,
    max_retries: int = 2,
    allow_fallback: bool = True,
    max_usd: float | None = None,
) -> Completion:
    primary = resolve_model(model)
    chain = [primary] + (fallbacks_for(primary) if allow_fallback else [])
    attempted: list[str] = []
    last_exc: BaseException | None = None

    for model_id in chain:
        attempted.append(model_id)
        try:
            result = _call_with_retries(
                model_id,
                messages,
                max_output_tokens=max_output_tokens,
                temperature=temperature,
                timeout_s=timeout_s,
                max_retries=max_retries,
                max_usd=max_usd,
            )
            result.attempted = attempted
            return result
        except (BudgetExceededError, MissingCredentialError):
            # Another model will not fix a budget or credential problem.
            raise
        except Exception as exc:  # noqa: BLE001 — re-raised below if not retryable
            if not _is_retryable(exc):
                raise
            last_exc = exc

    assert last_exc is not None
    raise last_exc


def _call_with_retries(
    model_id: str,
    messages: list[Message],
    *,
    max_output_tokens: int | None,
    temperature: float | None,
    timeout_s: float,
    max_retries: int,
    max_usd: float | None,
) -> Completion:
    budget = max_usd if max_usd is not None else settings.ai_max_usd_per_run

    # Refuse before spending, not after. A cheap approximation of input size is
    # enough — being wrong by 20% does not matter when the ceiling exists to
    # catch a runaway loop, not to bill accurately.
    approx_input = sum(len(m.content) for m in messages) // 4
    worst_case = estimate_max_cost(model_id, approx_input, max_output_tokens)
    if worst_case > budget:
        raise BudgetExceededError(
            f"{model_id} could cost up to ${worst_case:.2f}, over the "
            f"${budget:.2f} ceiling. Raise max_usd / AI_MAX_USD_PER_RUN, cap "
            f"max_output_tokens, or use a cheaper alias."
        )

    last_exc: BaseException | None = None
    for attempt in range(max_retries + 1):
        try:
            return _call_provider(
                model_id,
                messages,
                max_output_tokens=max_output_tokens,
                temperature=temperature,
                timeout_s=timeout_s,
            )
        except Exception as exc:  # noqa: BLE001 — re-raised below
            last_exc = exc
            if attempt == max_retries or not _is_retryable(exc):
                raise
            # Exponential backoff with jitter: without jitter a fleet of workers
            # retries in lockstep and re-creates the spike that rate-limited it.
            base = 0.5 * (2**attempt)
            time.sleep(base + random.random() * base)

    assert last_exc is not None
    raise last_exc


def _call_provider(
    model_id: str,
    messages: list[Message],
    *,
    max_output_tokens: int | None,
    temperature: float | None,
    timeout_s: float,
) -> Completion:
    provider = spec(model_id).provider
    adapter = {"anthropic": _anthropic, "openai": _openai, "google": _google}[provider]
    with httpx.Client(timeout=timeout_s) as client:
        return adapter(client, model_id, messages, max_output_tokens, temperature)


def _require_key(value: str | None, name: str, provider: str) -> str:
    if not value:
        raise MissingCredentialError(
            f"{provider} needs {name}. Add it to .env (see .env.example) or "
            "pick a model from another provider."
        )
    return value


def _post(client: httpx.Client, url: str, **kwargs: Any) -> dict:
    res = client.post(url, **kwargs)
    res.raise_for_status()
    return res.json()


# ---- adapters -------------------------------------------------------------
# Each one does exactly two jobs: shape the request, and normalise the usage
# numbers. Everything else is handled above.


def _anthropic(client, model_id, messages, max_output_tokens, temperature) -> Completion:
    key = _require_key(settings.anthropic_api_key, "ANTHROPIC_API_KEY", "Anthropic")
    system = "\n\n".join(m.content for m in messages if m.role == "system")
    body: dict[str, Any] = {
        "model": model_id,
        "max_tokens": max_output_tokens or 4096,
        "messages": [
            {"role": m.role, "content": m.content} for m in messages if m.role != "system"
        ],
    }
    if system:
        body["system"] = system
    if temperature is not None:
        body["temperature"] = temperature

    raw = _post(
        client,
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
        json=body,
    )
    u = raw["usage"]
    usage = Usage(
        input_tokens=u["input_tokens"],
        output_tokens=u["output_tokens"],
        cached_input_tokens=u.get("cache_read_input_tokens", 0) or 0,
    )
    text = "".join(b.get("text", "") for b in raw["content"] if b.get("type") == "text")
    return Completion(
        text=text,
        model=model_id,
        usage=usage,
        cost_usd=cost_of(
            model_id, usage.input_tokens, usage.output_tokens, usage.cached_input_tokens
        ),
        raw=raw,
    )


def _openai(client, model_id, messages, max_output_tokens, temperature) -> Completion:
    key = _require_key(settings.openai_api_key, "OPENAI_API_KEY", "OpenAI")
    body: dict[str, Any] = {
        "model": model_id,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
    }
    if max_output_tokens:
        body["max_completion_tokens"] = max_output_tokens
    if temperature is not None:
        body["temperature"] = temperature

    raw = _post(
        client,
        "https://api.openai.com/v1/chat/completions",
        headers={"authorization": f"Bearer {key}"},
        json=body,
    )
    u = raw["usage"]
    usage = Usage(
        input_tokens=u["prompt_tokens"],
        output_tokens=u["completion_tokens"],
        cached_input_tokens=(u.get("prompt_tokens_details") or {}).get("cached_tokens", 0) or 0,
    )
    return Completion(
        text=raw["choices"][0]["message"].get("content") or "",
        model=model_id,
        usage=usage,
        cost_usd=cost_of(
            model_id, usage.input_tokens, usage.output_tokens, usage.cached_input_tokens
        ),
        raw=raw,
    )


def _google(client, model_id, messages, max_output_tokens, temperature) -> Completion:
    key = _require_key(settings.google_api_key, "GOOGLE_API_KEY", "Google")
    system = "\n\n".join(m.content for m in messages if m.role == "system")
    gen: dict[str, Any] = {}
    if max_output_tokens:
        gen["maxOutputTokens"] = max_output_tokens
    if temperature is not None:
        gen["temperature"] = temperature

    body: dict[str, Any] = {
        "contents": [
            {
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.content}],
            }
            for m in messages
            if m.role != "system"
        ],
        "generationConfig": gen,
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    raw = _post(
        client,
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent",
        headers={"x-goog-api-key": key},
        json=body,
    )
    u = raw["usageMetadata"]
    usage = Usage(
        input_tokens=u["promptTokenCount"],
        output_tokens=u.get("candidatesTokenCount", 0),
        cached_input_tokens=u.get("cachedContentTokenCount", 0) or 0,
    )
    parts = (raw.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    return Completion(
        text="".join(p.get("text", "") for p in parts),
        model=model_id,
        usage=usage,
        cost_usd=cost_of(
            model_id, usage.input_tokens, usage.output_tokens, usage.cached_input_tokens
        ),
        raw=raw,
    )
