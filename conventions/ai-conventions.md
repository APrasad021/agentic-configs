# AI conventions

Rules that apply to any code in this repo's patterns that calls a model.

## Behaviour is data, not code

Three things live outside your source files because they change on a different
schedule and need their own review:

| Thing | Lives in | Because |
|---|---|---|
| Model choice | `config/models.json` | Ids and prices change monthly |
| Prompt text | `prompts/*.md` | A prompt change is a behaviour change and needs a diff |
| Expected behaviour | `evals/cases/*.jsonl` | Adding a case should be a one-line diff |

## Cost is a correctness property

A change that makes a call 10× more expensive is a regression, even if output
quality improves. Treat a cost change like a latency change: it needs to appear
in the PR description with a before and after.

The three mechanisms, in escalating order:

1. Per-call ceiling — `ai/provider-gateway`
2. Per-run ledger — `ai/cost-and-tokens`
3. Provider-side spend limits — set these too; they are the only backstop that
   survives a bug in your own code

## Model output is untrusted input

Anything the model did not receive directly from your user is untrusted: a
retrieved document, a web page, a database row, a tool result, a PR comment.
All of it can contain instructions, and no model reliably distinguishes an
instruction from content.

The boundary: **retrieved text never decides whether a privileged tool runs.**
The gate on a privileged action must be a check the model cannot influence.
See `ai/agent-runtime`.

## Non-determinism is a testing problem, not an excuse

"It is non-deterministic" is often used to justify not testing. The right
responses:

- Pin `temperature: 0` in evals. You are testing the mode, not the distribution.
- Prefer deterministic graders. Most real regressions are structural.
- If you genuinely need distribution testing, run N times and assert on a pass
  *rate*. That is a different, more expensive tool — use it deliberately.

## Fallback must be visible

A silent cross-provider fallback is a provider outage you never noticed and a
bill you cannot explain. Log `attempted` on every call (`dx/observability`),
and alert when the fallback rate moves.

## Prompt caching is worth real money

Put the stable prefix — instructions, examples, schema — at the top; put the
variable part at the bottom. Providers cache prefixes. A low cache hit rate is
usually this ordering being wrong, which makes it a bug rather than a fact of
life.
