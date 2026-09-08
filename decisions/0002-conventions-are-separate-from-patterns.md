# ADR 0002: Conventions are prose; patterns are files

- **Status:** accepted
- **Date:** 2026-09-08

## Context

Early drafts had each pattern README explain the reasoning behind its rules.
By the fourth pattern, "errors should carry context", "behaviour lives in
data files", and "model output is untrusted" had each been written three
times in slightly different words.

That is the failure mode this repo exists to prevent, reproduced inside the
repo itself.

## Decision

Two directories with a hard rule between them:

- **`conventions/`** — prose. Explains *why*. Never copied into a project.
- **`patterns/`** — files. Ships *what*. Always copied.

A pattern README links to a convention. It does not restate it.

The one bridge: when a rule needs to reach a target repo (because an agent
working there must follow it), it goes into `repo/agent-context`'s
`AGENTS.md` — which is a pattern, with files, applied like any other.

## Consequences

**Good:**
- One place to change a rule.
- Pattern READMEs stay about the specific trade-offs of that pattern, which is
  the part that is genuinely local.
- `conventions/` is short enough to read end to end, which is what makes it
  usable as context for an agent.

**Bad:**
- Reading one pattern's README no longer tells you everything. That is a real
  cost, paid to keep eighteen copies of a rule from drifting.
- Requires discipline. The temptation to "just explain it here" is constant.

## Alternatives considered

**Self-contained pattern READMEs.** Better in isolation, worse in aggregate:
whichever copy is updated becomes right and the rest become confidently wrong.
An agent reading a stale copy follows it.

**Conventions inside AGENTS.md only.** Would collapse the two directories, but
`AGENTS.md` has to stay short — it is loaded into a context window on every
task. `conventions/` can afford to explain reasoning; `AGENTS.md` can only
afford to state rules.
