# Naming

## Files and directories

`kebab-case` for files and directories, in every language. `provider-gateway`,
`check-media.sh`, `0001-use-postgres.md`. The exception is where a language
demands otherwise — Python modules are `snake_case` because imports require it.

## Branches

```
feat/streaming-responses
fix/412-token-overflow
claude/repo-structure-patterns-xt98lh
```

Agent branches carry a distinct prefix. It makes "what did the agent touch"
answerable in one query and sets reviewer expectations without anyone checking
the commit author.

## Commits

Conventional commits, plus two AI-specific types:

- `prompt:` — prompt text or model selection changed
- `eval:` — the eval set changed

These earn their place because `git log --grep '^prompt'` is the first thing
you want when output quality regresses — and it only works if prompt changes
were never buried inside a `feat` commit.

## Models

Call sites use **aliases**, never raw ids:

```
fast     the cheap one — classification, routing, extraction
default  the workhorse
deep     the expensive one — hard reasoning, final passes
```

Raw ids appear in exactly one file: `config/models.json`. This is the
indirection that makes a model migration a one-line diff instead of a
find-and-replace across a codebase.

## Prompts

`<namespace>.<id>.md`, where everything before the last dot is a namespace the
loader ignores: `billing.summarize.md`, `support.summarize.md`. Group by domain
without committing to a directory scheme up front.

## Patterns in this repo

`<domain>/<name>`, both kebab-case. The domain says *when you reach for it*:

| Domain | You reach for it when |
|---|---|
| `ai/` | you are calling a model |
| `repo/` | you are setting up or maintaining a repository |
| `ci/` | you are deciding what runs automatically |
| `dx/` | you are making the day-to-day loop faster or safer |
