# Architecture decision records

One file per decision, numbered, immutable once accepted.

## When to write one

When a choice is expensive to reverse and non-obvious to a newcomer:
a database, a framework, a provider, a boundary, a protocol, "we do not do X".

Not for: naming, formatting, or anything the linter decides.

## The rules that keep them useful

- **Immutable.** Wrong or outdated? Write a new ADR that supersedes it and
  link both ways. Editing an accepted ADR destroys the record of what was
  believed at the time, which is the whole value.
- **Consequences must include the bad ones.** An ADR with only upsides is
  useless to the person who inherits the downside.
- **Retroactive ADRs count.** Writing down a decision made six months ago is
  worth doing. It is often when you discover nobody agrees on what was decided.
