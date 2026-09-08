# security

> Status: **stable** · requires: `ci/github-actions`

## What this ships

| Scan | Catches |
|---|---|
| **gitleaks** | A credential in a commit — including one added and removed within the same PR |
| **`make audit`** | Known-vulnerable dependencies |
| **CodeQL** | Injection, path traversal, unsafe deserialisation |
| **Dependabot** | Updates, grouped weekly |

## Why `fetch-depth: 0` on the secret scan

Scanning the working tree is nearly useless. The common leak is: key committed,
noticed, deleted in the next commit, PR merged. The tree is clean; the history
is not, and the key is live in every fork and clone. The scan needs history.

## Why Dependabot is grouped and weekly

The failure mode of dependency automation is not a missed update — it is forty
open PRs nobody reviews, which trains you to ignore the one that matters. So:
minor and patch land in a single weekly PR; majors stay separate because they
need a human.

## What this does *not* do

**It does not turn on GitHub's own scanning.** `dependabot.yml` configures
update PRs. Dependabot *alerts* and *secret scanning* are repo settings:
Settings → Code security. Turn them on; they are free on public repos.

**It does not cover AI-specific risks.** Prompt injection, tool-permission
boundaries and untrusted retrieved content are not things CodeQL models. Those
live in `repo/agent-context` (the rules agents read) and `ai/agent-runtime`
(the boundaries the code enforces). Treat that as a real gap, not a covered one.

## If a key leaks

**Rotate first, scrub second.** A key in a pushed commit is compromised the
moment the push lands. Rewriting history does not un-compromise it — forks,
mirrors, CI caches and GitHub's own event API already have it.

1. Revoke at the provider. Now.
2. Issue a new key, update the secret store.
3. *Then* consider history rewriting, mostly for tidiness.
4. Check provider usage logs for calls you did not make.

Decide this drill before you need it. The instinct under pressure is to fix
the git history first, and that is the step that does not matter.
