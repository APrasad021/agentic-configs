# env-and-secrets

> Status: **stable** · stacks: ts, py, sh

## What this is

Three things that together make credential handling boring:

1. **`.env.example` is the schema.** Committed, always complete, never holds a
   real value.
2. **A validator that runs at startup** (`src/config/env.ts` / `env.py`). A
   missing or malformed key kills the process immediately with the key's name
   in the message.
3. **`scripts/load-env.sh`** for shell contexts and pre-push checks.

## The rule that actually matters

> Every key read anywhere in the codebase appears in `.env.example`, added in
> the same commit that starts reading it.

Everything else here is machinery to make breaking that rule loud. The failure
mode this prevents is specific and expensive: a key that only exists on the
machine of whoever added it, discovered when a deploy 401s at 3am.

## Why provider keys are optional in the schema

A repo that only calls Anthropic should not need an `OPENAI_API_KEY` to boot.
So the validator allows them to be absent, and `ai/provider-gateway` raises the
error at call time — naming the provider, the model, and the key it needed.
Required-at-startup would force everyone to stub keys they never use, and a
stubbed key is worse than an absent one because it fails deeper in.

## Where secrets actually live

`.env` is for local development only. Everywhere else:

| Context | Mechanism |
|---|---|
| CI | GitHub Actions secrets, referenced as `${{ secrets.X }}` |
| Deployed app | The platform's secret store (Fly, Vercel, Cloud Run, K8s) |
| Shared with a teammate | 1Password / `op run --env-file` — never Slack, never email |
| Committed, encrypted | SOPS + age, if you truly need secrets in git |

`ci/security` adds a gitleaks scan so a key that slips into a commit is caught
before it reaches a branch.

## If a key does leak

Rotate first, scrub second. A key in git history is compromised the moment the
push lands, and rewriting history does not un-compromise it — mirrors, forks,
and CI caches already have it. Revoke at the provider, issue a new one, *then*
worry about the history.

## Adapting it

- Not using zod / pydantic-settings? The pattern is the fail-fast boundary,
  not the library. Any validation at module load works.
- Add a key: `.env.example` → the schema → `AGENTS.md` if an agent needs it.
