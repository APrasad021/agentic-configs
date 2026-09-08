# github-actions

> Status: **stable** · requires: `dx/task-runner`

## The whole design

```yaml
- run: make bootstrap
- run: make check
```

CI does not know what a linter is. It runs the same command you run. There is
one definition of "does this pass", and it lives in the Makefile.

The failure this prevents is the common one: a workflow that inlines
`npm run lint && npm test`, drifts from `package.json`, and fails CI on
something that passed locally — or worse, passes CI on something broken
because a step got dropped in a merge.

## Why no build matrix

One job, one runner. Add a matrix when you actually support multiple runtime
versions and a bug would slip through without it — not on principle. Until
then a matrix is a 4× minute cost for zero signal.

The conditional setup steps mean one workflow serves a TypeScript repo, a
Python repo, or both, without a matrix and without editing per project.

## Three settings that matter more than they look

**`permissions: contents: read`** — GitHub's default token is far more
powerful than most workflows need, and a compromised dependency in a build
step inherits it. Least privilege at the top, escalate per job.

**`concurrency` with `cancel-in-progress` on PRs only** — a new push
supersedes the old run. Restricted to PRs deliberately: cancelling a `main`
run loses the record of whether that commit was ever green.

**`timeout-minutes: 15`** — without it, a hung job burns the full six-hour
default. Set it to roughly 3× your normal runtime.

## Version pinning

Actions are pinned to major tags (`@v4`), not SHAs. Tags are mutable, so a
compromised action release reaches you.

SHA pinning is the hardening step, and it is only sustainable with automation
— `ci/security` ships a Renovate config that pins to SHA and keeps them
current. Do that rather than pinning by hand, which decays into a set of
two-year-old actions nobody dares touch.

## Adapting it

- **Required status checks.** This workflow is advisory until `check` is
  required in branch protection. Do that; it is the step that makes any of
  this real.
- **Caching.** `setup-node`/`setup-uv` cache dependencies already. Add more
  caching only after you have measured where the time actually goes.
- **Needs secrets?** Add `env:` to the specific step, never to the workflow —
  a workflow-level secret is visible to every step including third-party
  actions.
