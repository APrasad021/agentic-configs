# provider-gateway

> Status: **stable** · stacks: ts, py · requires: `dx/env-and-secrets`

## What this is

A thin layer with one call signature across Anthropic, OpenAI and Google:

```ts
const r = await complete({ model: "default", messages: [{ role: "user", content: "hi" }] });
r.text; r.costUsd; r.usage; r.attempted; r.raw;
```

```py
r = complete([Message("user", "hi")], model="default")
r.text; r.cost_usd; r.usage; r.attempted; r.raw
```

## What it is deliberately not

**Not an abstraction that hides providers.** Provider-specific features —
extended thinking, structured outputs, prompt caching, Gemini's context
window — are usually *why* you chose that provider. Hiding them means writing
an escape hatch six weeks later.

So the split is: the boring 90% (auth, retries, backoff, timeouts, usage
normalisation, fallback, budget) is written once; the interesting 10% stays
reachable through `raw`, which is the untouched provider response.

If you find yourself adding a provider-specific option to `CompleteOptions`,
that is the signal to call that provider's SDK directly for that one code path
instead. This gateway is for the calls that are genuinely interchangeable.

## `config/models.json` is the only place model ids live

Model ids, prices, context windows and capabilities are **data**, not code.
Call sites use aliases:

```
"fast"    → the cheap one you use for classification and routing
"default" → the workhorse
"deep"    → the expensive one for hard reasoning
```

Retargeting `default` at a newly released model is then a one-line diff to a
JSON file — reviewable on its own, revertable on its own — rather than a
find-and-replace across every call site. That single indirection is the main
reason this pattern earns its keep as models turn over.

> ⚠️ **Verify the prices before trusting them for billing.** They are
> plausible defaults, not a contract, and vendors change them. Updating that
> file is a normal maintenance task, not a code change.

## The four failure behaviours

| Behaviour | Why it works this way |
|---|---|
| **Retry** on 408/409/429/5xx | Only transient statuses. A 400 is your bug; retrying it just burns time. |
| **Backoff with jitter** | Without jitter, a fleet of workers retries in lockstep and re-creates the spike that rate-limited them. |
| **Fallback across providers** | `fallbacks` in the registry. Keep at least one cross-provider entry — a provider-wide outage is the case fallback exists for. |
| **Budget ceiling** | Estimated *before* the call, assuming the model emits its full `maxOutput`. Pessimistic on purpose: it exists to stop a runaway loop, not to bill accurately. |

Budget and credential errors are **not** retried and **not** failed over — no
other model fixes a missing key or a ceiling that is too low, and silently
trying a second one just doubles the confusing error.

## Adding a provider

1. Add its models to `config/models.json`.
2. Add one adapter function. It has exactly two jobs: shape the request, and
   normalise usage into `{inputTokens, outputTokens, cachedInputTokens}`.
3. Add the case to the switch / adapter map.

Nothing else in your codebase changes. That is the test of whether this layer
is still doing its job — when adding a provider starts requiring changes at
call sites, the abstraction has stopped fitting.

## Known gaps

- **No streaming.** Streaming diverges hard across providers and pulls the
  whole surface with it (`AsyncIterable` vs SSE vs callbacks). Call the SDK
  directly when you stream, or extend this with a separate `stream()` entry
  point rather than overloading `complete()`.
- **No tool-calling loop.** That is `ai/agent-runtime`'s job.
- **Token estimation is `length / 4`.** Fine for a guardrail, wrong for
  accounting. `ai/cost-and-tokens` uses the *actual* returned usage.
