# dev-loop

> Status: **draft** · stacks: ts, py · requires: `dx/task-runner`

## What this ships

- `.nvmrc` / `.python-version` — pinned toolchain versions
- `.devcontainer/devcontainer.json` — a reproducible environment
- `make dev-test` — tests in watch mode

## Pinned versions are read by three consumers

The same two files serve your version manager (`nvm`, `pyenv`, `mise`), CI
(`setup-node` and `setup-python` read them via `node-version-file`), and the
devcontainer. One place to bump, three things stay in sync.

This is why `ci/github-actions` reads the files rather than hardcoding a
version: hardcoding is how CI ends up on Node 18 while everyone develops on 22,
and the difference surfaces as a mysterious failure six weeks later.

## Why a devcontainer matters more now

It used to be about onboarding humans. It is now also about **agents**: a
coding agent in a cloud sandbox gets whatever the container gives it. If
`make bootstrap` works in the devcontainer, it works for the agent — and "it
works on my machine but the agent cannot run the tests" stops being a category
of problem.

## The number that decides whether any of this works

**How long `make check` takes.**

Under ~60 seconds and people run it before pushing. Past that they stop, and
every gate you built moves from "caught locally" to "caught in CI four minutes
later" — or worse, "caught in review". Optimising `make check` is the highest-
leverage DX work available, and it is almost always more valuable than adding
another tool to it.

## Why "draft"

The version pinning and devcontainer are solid and generic. The `dev` targets
are placeholders — `npm run dev` and `pytest-watch` assume conventions your
project may not have — and hot-reload setup is genuinely framework-specific.

Missing, and worth adding once your stack is settled: seed data (`make seed`),
a local service compose file, and preview environments (which live with
`ci/release-deploy`).
