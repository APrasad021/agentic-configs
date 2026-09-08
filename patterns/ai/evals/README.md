# evals

> Status: **draft** · stacks: ts, py · requires: `ai/prompt-library`, `dx/task-runner`

## What this is

A regression suite for model behaviour. Cases are JSONL data, graders are
code, `make eval` runs them and exits non-zero on a failure so it can gate a
merge.

## Why "draft"

The harness works and the graders are real. What is unproven is whether this
shape survives contact with your actual workload — specifically whether you
need model-graded scoring, which changes the economics (evals stop being free
and start being a line item) and the reliability (a grader that is itself
non-deterministic).

Use it, and expect to revise it once you have 30+ cases.

## The rule that makes evals worth having

> Every case comes from a real failure, and carries a note saying which one.

Cases invented in the abstract test what you imagined going wrong. Cases
harvested from production test what actually goes wrong, and those two sets
overlap far less than you would hope.

The note matters as much as the case. Six months on, a case with no
explanation is one nobody will delete — because nobody can tell whether it
still guards something real — so the suite accumulates cruft and slows down
until people stop running it.

## Grader ordering

1. **Deterministic** — free, instant, never flaky.
2. **Programmatic** — parse the output, assert on structure.
3. **Model-graded** — last resort.

Most teams reach for model grading first. It is usually wrong: the majority of
real regressions are *structural* — too long, wrong format, ignored a
constraint, leaked the system prompt — and a five-line check catches those for
zero cost and zero flake.

Keep model grading for genuinely subjective criteria ("is this tone
appropriate"), pin the grader model explicitly, and remember the grader needs
its own evals before you can trust it.

## Temperature is pinned to 0

Non-zero temperature turns a regression suite into a coin flip: a failure no
longer tells you whether the prompt changed or whether you drew a different
sample. Pin it, and accept that you are testing the mode rather than the
distribution.

If you need distribution testing, run each case N times and assert on a pass
*rate*. That is a different tool and it costs N× as much.

## The injection case is not optional

```json
{"id": "summarize-ignores-injected-instruction", ...}
```

Any prompt that consumes retrieved or user-supplied text needs one. Injected
instructions are the failure mode that a normal quality eval will never catch,
because the output looks fine — it is just answering the attacker's question.

## Cost

Every eval run spends money. A 50-case suite on a mid-tier model is cents, and
you should still print the total (the runner does) so it stays visible. If
running evals becomes something people avoid because of cost, they will avoid
it right when it matters most — during a big prompt refactor.

## What is missing

- No pass-rate tracking over time (results are written to `evals/results/`,
  which is git-ignored — wire it to a store if you want trend lines).
- No model-graded grader shipped. Deliberate: see above.
- No CI job. Add it once the suite is stable — a flaky eval blocking merges
  destroys trust in the whole idea faster than no evals at all.
