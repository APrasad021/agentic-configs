# evals/

`cases/*.jsonl` — one case per line. Cases are **data**: adding one is a
one-line diff, and a whole file diffs cleanly in review.

Every case carries a `note` saying *what real failure it came from*. A case
without that note is a case nobody will dare delete later, because nobody will
know whether it still matters.

## Adding a case

The only good source of cases is production failures. When a model does
something wrong:

1. Add the exact input as a case.
2. Write the grader that would have caught it.
3. *Then* fix the prompt.

In that order — otherwise you have no evidence the fix worked, only a belief.

## Graders

Prefer, in this order:

1. **Deterministic** (`contains`, `not_contains`, `max_bullets`, `json_valid`,
   `regex`) — free, instant, never flaky.
2. **Programmatic** — parse the output and assert on structure.
3. **Model-graded** — last resort. Expensive, non-deterministic, and needs its
   own evals to be trustworthy. Use it only for genuinely subjective criteria,
   and pin the grader model.

Most teams reach for model grading first. It is almost always the wrong call:
the majority of real regressions are structural (too long, wrong format,
ignored a constraint) and a five-line deterministic check catches them.

## The injection case

`summarize-ignores-injected-instruction` is not optional. Any prompt that
takes retrieved or user-supplied text needs one, and it must survive every
future refactor of this directory.
