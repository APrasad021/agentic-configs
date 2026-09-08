# cost-and-tokens

> Status: **stable** · stacks: ts, py · requires: `ai/provider-gateway`

## What this is

A per-run ledger. Wrap an entry point; every call inside is attributed to it.

```ts
await withRunBudget({ ceilingUsd: 2.0 }, async (ledger) => {
  await doTheWork();
  console.log(summarize(ledger));
});
```

```py
with run_budget(ceiling_usd=2.0) as ledger:
    do_the_work()
    print(summarize(ledger))
```

## Why the gateway's ceiling is not enough

The gateway caps a *single* call. That catches "somebody passed a 400k-token
document to the expensive model."

It does not catch the failure that actually generates surprise invoices: an
agent loop making 400 individually reasonable calls, each one well under the
per-call limit. Only a run-level total sees that.

## Why context-local, not a parameter

`AsyncLocalStorage` / `contextvars` means the ledger follows the async context
instead of being threaded through every function signature. Otherwise
accounting metastasises: every function between the entry point and the model
call grows a `ledger` parameter it does not use.

The trade-off is that it is implicit, and implicit is harder to trace. It is
worth it here because the alternative is that nobody adds the accounting at all.

Outside a run, `record()` is a no-op. A library function should not blow up
because its caller did not opt into budgeting.

## The summary is the point

```
run 7f3a: 12 calls, $0.0841 of $2.00
  claude-sonnet-5                9 calls  48210→3102 tok  $0.0912
  claude-haiku-4-5-20251001      3 calls   2100→ 410 tok  $0.0041
  cache hit rate: 61% of input tokens
```

Print it at the end of every CLI run and job. Cost you cannot see is cost you
do not manage, and the two most actionable numbers are both here: which model
is eating the budget, and whether prompt caching is working.

**A low cache hit rate is usually a fixable bug**, not a fact of life — it
generally means variable content sits ahead of the stable prefix in your
prompt. `ai/prompt-library` explains the ordering.

## What is not here

- **No per-user or per-tenant attribution.** Add a `tenantId` to `CallRecord`
  and aggregate on it if you bill customers.
- **No persistence.** The ledger dies with the process. Export it to your
  metrics backend via `dx/observability` if you need history.
- **No token counting before the call.** Costs are computed from *returned*
  usage, which is exact. The gateway's pre-flight estimate is deliberately
  crude because it is a guardrail, not a bill.

## Wiring it to the gateway

The gateway does not call `record()` itself — it does not depend on this
pattern. Call it at your own call site, or wrap `complete()` once:

```ts
export async function tracked(label: string, opts: CompleteOptions) {
  const t = Date.now();
  const r = await complete(opts);
  record({ ...r.usage, cachedInputTokens: r.usage.cachedInputTokens ?? 0,
           model: r.model, label, costUsd: r.costUsd, ms: Date.now() - t });
  return r;
}
```

The `label` is what makes the summary readable. Use the prompt id.
