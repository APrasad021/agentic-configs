## What changed

<!-- One paragraph. What a reviewer needs before reading the diff. -->

## Why

<!-- The problem, not the solution. If this is "because a ticket said so",
     link the ticket AND say what it is actually for. -->

## How to verify

<!-- The command a reviewer runs, or the steps to reproduce the fix.
     "make check" is not enough on its own — CI already did that. -->

## Risk

<!-- What breaks if this is wrong, and how you would notice. Delete the ones
     that do not apply. -->

- [ ] Changes AI behaviour (prompts, models, tool definitions) — `make eval` run, results below
- [ ] Changes cost per call — before/after noted
- [ ] Adds a dependency — justified above
- [ ] Changes CI, deploy, or permissions
- [ ] Migration or irreversible data change
