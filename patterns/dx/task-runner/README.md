# task-runner

> Status: **stable** · applies to any project

## What this is

A `Makefile` with a fixed set of verbs, plus one `make/*.mk` fragment per
language. Every project in your world answers the same commands:

| Verb | Means |
|---|---|
| `make bootstrap` | fresh clone → working checkout |
| `make dev` | the development loop |
| `make fmt` / `make lint` / `make typecheck` / `make test` | the individual gates |
| `make check` | **all** the gates — the one command that decides a merge |
| `make eval` | AI evals against the golden set |
| `make audit` | dependency + secret scanning |
| `make clean` | delete generated output |

## Why this is the first pattern to apply

It is the seam every other pattern plugs into, and it is where most repo
redundancy actually comes from. Without it, the same command logic gets
written three times — once in `package.json` scripts, once in a CI workflow,
once in a README — and the three drift apart.

With it:

- `ci/github-actions` runs `make check`. CI cannot disagree with your laptop.
- `ci/security` appends to `AUDIT_TARGETS`.
- `ai/evals` appends to `EVAL_TARGETS`.
- `dx/dev-loop` appends to `DEV_TARGETS`.

Patterns extend the runner by *adding a fragment*, never by editing the root
`Makefile`. That is what keeps the whole set composable.

## Why `make` and not `just` / `npm scripts` / `task`

`make` is already installed everywhere — CI images, containers, a fresh
laptop, an agent sandbox. Zero bootstrap cost matters most for the tool whose
whole job is bootstrapping. It is also language-neutral, which `npm scripts`
is not.

If you prefer [`just`](https://github.com/casey/just), the verb set transfers
verbatim; keep the names identical so muscle memory and agent instructions
still work.

## Extending it

Add a fragment. Nothing else changes:

```make
# make/go.mk
BOOTSTRAP_TARGETS += go-install
TEST_TARGETS      += go-test

go-install: ; go mod download
go-test:    ; go test ./...
.PHONY: go-install go-test
```

A target with no fragment registered is a silent no-op, so a TypeScript-only
repo can still run `make check` without a Python toolchain installed.

## Gotchas

- `.SHELLFLAGS := -eu -o pipefail -c` means a failing command in a recipe
  fails the target. That is deliberate — silent CI passes are worse.
- `make dev` in the Python fragment assumes `uvicorn app.main:app`. Change it
  to whatever your entry point is; it is the one line here that guesses.
