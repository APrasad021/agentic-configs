# docs

> Status: **stable** · requires: `repo/scaffold`

## What this ships

- `docs/decisions/` — ADR template and the rules for using it
- `CHANGELOG.md` — Keep a Changelog format

## Why only these two

Most documentation rots because it describes *how the code works*, and the code
changes underneath it. These two do not rot:

- An **ADR** describes a decision at a point in time. It cannot go stale
  because it was never a claim about the present.
- A **changelog** is append-only history.

The README (from `repo/scaffold`) and `AGENTS.md` (from `repo/agent-context`)
carry the how-it-works material, deliberately at directory-level altitude so
they survive refactors.

If you want per-function docs, generate them from the code. Hand-written
API docs are the fastest-rotting artifact in any repo.

## The section people skip

**Consequences — including the bad ones.** An ADR that lists only benefits
tells you nothing you could not have guessed. The reason to write one is so
that in two years, when the downside bites, the person hitting it can tell
whether it was foreseen and accepted or simply missed. Those two situations
call for completely different responses.

## AI changes belong in the changelog

A model swap or a prompt revision changes product behaviour as much as a code
change, and is far more likely to go unrecorded because the diff is one line.

```
### Changed
- Default model moved from X to Y — 30% cheaper, eval pass rate unchanged (12/12)
```

Note the eval result in the entry. Six weeks later, when quality complaints
arrive, that line is the difference between a two-minute answer and a week of
bisecting.
