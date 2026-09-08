# release-deploy

> Status: **draft** · requires: `ci/github-actions`

## What this ships

`.github/workflows/release.yml` — a tag-driven release with a verification
gate and a GitHub Environment for approval.

## Why "draft"

**The deploy step is a placeholder.** The actual command depends entirely on
your platform — Fly, Vercel, Cloud Run, ECS, a VPS — and writing one here
would be guessing at the most consequential line in the file.

What *is* worth keeping regardless of platform is everything around it, which
is the part people get wrong.

## The four decisions that transfer to any platform

**1. Tags trigger production, not branch pushes.** Pushing a tag is a
deliberate act with a name attached. A branch push is not, and eventually
someone merges at 5pm on a Friday.

**2. Re-run the full gate against the tagged commit.** It nearly always
passes. The one time it does not — a bad merge, a dependency that moved, a
tag on the wrong commit — is the run that pays for every other run.

**3. Approval lives in a GitHub Environment, not in a workflow condition.**
Environments give you required reviewers, wait timers and scoped secrets, and
they cannot be edited by the same PR that is trying to deploy. A condition in
the YAML can.

**4. Rollback must not require a rebuild.** This is the one people discover
during an incident. If rolling back means re-running the build, your rollback
takes as long as a deploy, at the worst possible moment. Deploy an immutable
artifact, keep the previous one alive, and make rollback a pointer change.

## OIDC over long-lived keys

`id-token: write` lets the workflow exchange a short-lived GitHub identity for
cloud credentials. Every major cloud supports it. A long-lived deploy key in
repo secrets is the single most valuable thing an attacker can get out of your
CI — OIDC removes the target entirely.

## What is missing

- **Preview environments per PR.** Genuinely valuable and completely
  platform-specific. Vercel and Netlify do it for free; on your own
  infrastructure it is real work.
- **Database migrations.** The hard part of deploys and out of scope here.
  The rule: migrations must be backwards-compatible with the *currently
  running* code, because for a few minutes both versions are live.
- **Version bumping.** Use `changesets` (JS) or `release-please` when you
  publish a package.
