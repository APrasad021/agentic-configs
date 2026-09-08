# ADR 0001: Patterns are copied into projects, not linked

- **Status:** accepted
- **Date:** 2026-09-08

## Context

Patterns have to reach real projects somehow. The options were a git submodule
or subtree, a published package (npm/PyPI), or copying files in.

The projects consuming these are heterogeneous — TypeScript, Python, shell,
sometimes all three in one repo — and each one will need to diverge from the
pattern in small ways almost immediately.

## Decision

`agentic apply` copies files into the target repo and records what it wrote,
with a SHA per file, in `<target>/.agentic/applied.json`.

## Consequences

**Good:**
- A copied file is the project's own. Editing it needs no permission and
  breaks nothing upstream — which is what actually happens to every template.
- Zero runtime dependency. A project that applied a pattern two years ago
  still works if this repo disappears.
- `agentic check` still reports drift and staleness, so "copied" does not mean
  "untracked".

**Bad:**
- **Updates do not propagate.** A fix here does not reach projects that
  already applied the pattern. `agentic check` tells you a pattern is stale;
  merging the change is manual.
- Divergence is invisible until someone runs `check`.
- The same file exists in N repos. That is the cost being accepted.

## Alternatives considered

**Git submodule / subtree.** Live updates, but submodules are famously
painful (detached HEADs, clones that miss the contents, CI that forgets
`--recursive`), and — decisively — you cannot customise per project without
either forking or carrying local modifications that fight every update. Since
per-project customisation is the *normal* case here, this fails at the main
requirement.

**Published package.** Proper semver and real update propagation. But it only
solves the problem for code (`src/ai/*`), and most of what these patterns ship
is not importable: a `Makefile`, a `.gitignore`, a workflow file, an
`AGENTS.md`. Those have to be copied regardless, so a package would mean two
distribution mechanisms instead of one. Revisit if `ai/provider-gateway` alone
becomes worth publishing.
