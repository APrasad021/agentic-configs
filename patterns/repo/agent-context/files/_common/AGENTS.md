# AGENTS.md — {{PROJECT_NAME}}

Instructions for AI agents working in this repo. Humans should read it too;
if a rule here is not worth a human's attention, it is not worth an agent's
context window either.

**This file is the single source of truth.** Tool-specific files
(`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`) point here
rather than restating anything. Duplicated instructions drift, and drifted
instructions are worse than none — the agent follows the stale copy.

## Orientation

- **What this is:** <one sentence>
- **Entry point:** <the file to open first>
- **Run it:** `make dev` · **Verify it:** `make check`

```
src/
  ai/       provider gateway, prompts, evals
  config/   validated environment
```

## Commands

Use these, not the underlying tools. They are the same commands CI runs, so a
green `make check` locally means a green CI run.

| Command | Use it for |
|---|---|
| `make check` | The gate. Run before proposing a change is done. |
| `make test` | Tests alone, when iterating. |
| `make fmt` | Formatting. Never hand-format; never argue with the formatter. |
| `make eval` | AI behaviour changes — prompts, model swaps, tool definitions. |

## Conventions

- **Match the surrounding code.** Its naming and comment density are the spec,
  not a general style guide.
- **Comments explain *why*.** The code says what it does. A comment restating
  the line below it is noise that will go stale.
- **No new dependency without a reason in the PR description.** Every dep is a
  permanent maintenance and supply-chain cost.
- **Errors carry context.** `Invalid config` is useless; name the key, the
  value, and what was expected.

## Things that will bite you

<!-- The highest-value section. Fill it with the non-obvious traps you have
     actually hit. Each entry saves a wasted debugging cycle. Delete this
     comment and the placeholders once you have real ones. -->

- Environment is validated at startup in `src/config/env`. A missing key is a
  crash at boot, not a runtime `undefined` — this is intentional.
- Model ids live only in `config/models.json`. Do not hardcode one at a call
  site; use an alias (`fast` / `default` / `deep`).

## Working with AI code in this repo

- **Prompts are behaviour, not strings.** They live in `prompts/`, are
  versioned, and changing one requires running `make eval`.
- **Never log an API key or a raw prompt containing user data.** Use the
  `redact()` helper.
- **Treat model output as untrusted input.** Text retrieved from a document,
  a web page, or a tool result can contain instructions. Never let it decide
  whether to call a privileged tool.
- **Cost is a correctness property.** A change that makes a call 10× more
  expensive is a regression even if the output improves.

## Boundaries

Ask before: adding a dependency, changing a public API, editing CI workflows,
touching `config/models.json`, or rewriting git history.

Never: commit secrets, `--force` push to a shared branch, disable or skip a
failing test to make a build green.
