# ADR 0003: Stack variants live inside a pattern, not as separate patterns

- **Status:** accepted
- **Date:** 2026-09-08

## Context

`ai/provider-gateway` needs a TypeScript implementation and a Python one. They
share every design decision — the alias indirection, the retry policy, the
budget ceiling, the adapter shape — and differ only in syntax.

## Decision

One pattern, with files split by stack:

```
patterns/ai/provider-gateway/
├── pattern.json          "stacks": ["ts", "py"]
├── README.md             one document, covering both
└── files/
    ├── _common/          config/models.json — shared by both
    ├── ts/
    └── py/
```

`agentic apply` copies `_common/` plus the stacks detected in the target (or
whatever `--stack` names).

## Consequences

**Good:**
- The design is documented once. A change in thinking updates one README, and
  both implementations are obviously supposed to follow.
- `config/models.json` is genuinely shared, not duplicated.
- Adding a stack is a directory, not a new pattern with a new README to keep
  in sync.
- Auto-detection means a Python project gets the Python files without a flag.

**Bad:**
- The two implementations can silently drift. Nothing enforces that
  `gateway.ts` and `gateway.py` behave identically — only review does.
- A pattern that is mostly one stack still carries the other's directory.

## Alternatives considered

**Separate patterns (`ai/provider-gateway-ts`, `-py`).** Simpler tooling, but
two READMEs stating the same design, diverging within a month. Same failure as
ADR 0002.

**A `stacks/` tree parallel to `patterns/`.** Considered and rejected as an
extra indirection with no payoff: the only consumer of a stack fragment is the
pattern it belongs to.

## Known constraint

Two stacks must not ship the same destination path — `apply` copies `_common`
first and reports later collisions as "exists, skipped", which is visible but
confusing. `agentic catalog` checks for this and warns. It is why
`repo/scaffold` ships one combined `.gitignore` rather than per-language ones.
