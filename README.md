# agentic-configs

Standardized building patterns to call on when starting or hardening a project.

Each pattern is a small, self-contained set of files plus a README explaining
the trade-offs. `agentic apply` copies one into a project and records what it
wrote, so you can tell later what drifted and what went stale.

```bash
./bin/agentic list                          # what is available
./bin/agentic show ai/provider-gateway      # what it ships and why
./bin/agentic apply dx/task-runner --target ~/code/my-app
./bin/agentic check --target ~/code/my-app  # drift and staleness
```

Requires `bash` and `jq`. Nothing else.

## Layout

```
bin/agentic         the CLI
lib/                one file per subcommand
catalog.json        generated index — never hand-edited
patterns/           the copyable units, <domain>/<name>/
conventions/        prose. Explains why. Never copied into a project.
decisions/          ADRs for this repo's own design
docs/               how to author and extend patterns
```

The `conventions/` ↔ `patterns/` split is the one structural idea worth
knowing about: **prose lives in exactly one place and is never copied; files
live in patterns and are always copied.** A pattern README links to a
convention rather than restating it, which is what stops eighteen slightly
different explanations of the same rule from accumulating. See
[ADR 0002](decisions/0002-conventions-are-separate-from-patterns.md).

## The patterns

Domains say *when you reach for it*, not what technology it uses.

### `ai/` — you are calling a model

| Pattern | | |
|---|---|---|
| [`provider-gateway`](patterns/ai/provider-gateway/) | stable | One call signature over Anthropic/OpenAI/Google; model registry, retries, fallback, cost ceiling |
| [`prompt-library`](patterns/ai/prompt-library/) | stable | Prompts as versioned files with front-matter, loaded by id |
| [`cost-and-tokens`](patterns/ai/cost-and-tokens/) | stable | Per-run token and cost ledger with a hard ceiling |
| [`evals`](patterns/ai/evals/) | draft | Golden-set regression harness wired into `make eval` |
| [`agent-runtime`](patterns/ai/agent-runtime/) | draft | Tool conventions and the trust boundary around privileged tools |

### `repo/` — you are setting up or maintaining a repository

| Pattern | | |
|---|---|---|
| [`scaffold`](patterns/repo/scaffold/) | stable | README, .gitignore, .editorconfig, .gitattributes, CODEOWNERS |
| [`agent-context`](patterns/repo/agent-context/) | stable | AGENTS.md as the single source of truth; every other tool file points at it |
| [`git-conventions`](patterns/repo/git-conventions/) | stable | Branch and commit conventions, PR template, pre-push gate |
| [`docs`](patterns/repo/docs/) | stable | ADRs and a changelog — the two documents that do not rot |
| [`media-assets`](patterns/repo/media-assets/) | draft | Where images and video belong; a pre-commit size guard |

### `ci/` — you are deciding what runs automatically

| Pattern | | |
|---|---|---|
| [`github-actions`](patterns/ci/github-actions/) | stable | A workflow that calls `make check` and nothing else |
| [`security`](patterns/ci/security/) | stable | Secret scanning, dependency audit, CodeQL, grouped Dependabot |
| [`release-deploy`](patterns/ci/release-deploy/) | draft | Tag-driven release, environment approval, rollback without rebuild |

### `dx/` — you are making the daily loop faster or safer

| Pattern | | |
|---|---|---|
| [`task-runner`](patterns/dx/task-runner/) | stable | The Makefile verb set every other pattern plugs into |
| [`env-and-secrets`](patterns/dx/env-and-secrets/) | stable | Fail-fast env validation; `.env.example` as the schema |
| [`dev-loop`](patterns/dx/dev-loop/) | draft | Pinned toolchain versions, devcontainer, watch mode |
| [`observability`](patterns/dx/observability/) | draft | Structured logging with secret redaction; the AI call field set |

**`stable`** means the shape has been thought through and the trade-offs are
written down. **`draft`** means it works but something specific is unresolved —
each draft README says exactly what, in its own words, rather than leaving you
to guess.

## Where to start on a new project

```bash
T=~/code/new-thing
./bin/agentic apply dx/task-runner    --target $T   # the seam everything else uses
./bin/agentic apply repo/scaffold     --target $T
./bin/agentic apply dx/env-and-secrets --target $T
./bin/agentic apply repo/agent-context --target $T
./bin/agentic apply ci/github-actions --target $T
```

Then, once it actually calls a model:

```bash
./bin/agentic apply ai/provider-gateway --target $T
./bin/agentic apply ai/prompt-library   --target $T
```

Apply `dx/task-runner` first. Its `Makefile` is what `ci/github-actions`,
`ci/security`, `ai/evals` and `dx/dev-loop` all hook into — applying it later
means fixing up references.

## How it stays adaptable

The pressure this repo is built against is that agent and AI practice turns
over fast, so the structure has to make revision cheap:

- **Adding a pattern is one directory.** `agentic new <domain>/<name>`, then
  `agentic catalog` regenerates the index. There is no central registry to
  edit and therefore nothing to forget to update.
- **Adding a language to an existing pattern is one subdirectory.** The design
  document stays shared ([ADR 0003](decisions/0003-stacks-live-inside-patterns.md)).
- **Volatile facts are data, not code.** Model ids and prices live in
  `config/models.json`; prompts live in `prompts/*.md`. When they change —
  and they will, monthly — the diff is a data file, not a refactor.
- **`draft` is a first-class status.** A pattern can ship with its unresolved
  question stated plainly instead of waiting to be perfect or pretending it is.
- **Deprecation has a path.** Set `"status": "deprecated"` and add
  `"supersededBy"`. Nothing breaks for projects that already applied it.
- **`agentic check` reports staleness.** Copying is a deliberate trade-off
  ([ADR 0001](decisions/0001-patterns-are-copied-not-linked.md)) — updates do
  not propagate, so the tool tells you where you are behind.

## Authoring

See [docs/authoring-patterns.md](docs/authoring-patterns.md).

## Planned work

See [BACKLOG.md](BACKLOG.md) — four items in dependency order, each with a
plan of attack written for a coding agent picking it up cold.
