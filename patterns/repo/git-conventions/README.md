# git-conventions

> Status: **stable** · stacks: sh · requires: `dx/task-runner`

## What this ships

- `.github/pull_request_template.md`
- `.gitmessage` — a commit template
- `scripts/hooks/pre-push` — the same gate CI runs, before the push

## Branch naming

```
<type>/<short-description>          feat/streaming-responses
<type>/<issue>-<description>        fix/412-token-overflow
claude/<description>-<id>           agent-authored branches
```

Prefixing agent branches is worth doing deliberately. It makes "what did the
agent touch this week" a one-line query, and it sets the right expectation for
reviewers without anyone having to check the commit author.

## Commit messages

Conventional commits, plus two types that matter specifically for AI work:

| Type | For |
|---|---|
| `prompt` | Prompt text or model selection changed |
| `eval` | The eval set changed |

These are not decoration. When a model's behaviour regresses in production,
`git log --grep '^prompt'` is the first thing you want, and it only works if
prompt changes were never buried inside a `feat` commit.

## The PR template's risk checklist

The four checkboxes are the ones where a reviewer's attention is worth the
most, and they are exactly the changes that *look* small in a diff:

- A prompt edit is a one-line diff that can change every output.
- A model swap is a one-line diff that can 10× the bill.
- A new dependency is a permanent supply-chain commitment.

## The pre-push hook

Runs `make check` — the same command CI runs, which is the whole point of
`dx/task-runner`. It also refuses a direct push to `main` and blocks a staged
`.env`.

`--no-verify` bypasses it. That is fine on a WIP branch and never fine on
main; the hook is there to save you a CI cycle, not to be a security control.
The real secret scanning is in `ci/security`, which runs where it cannot be
bypassed.

## Adapting it

- Use squash merges and the PR title becomes the commit message — so enforce
  the convention on PR titles rather than individual commits.
- Want enforcement rather than convention? Add `commitlint` to `LINT_TARGETS`.
  Worth it on a team, overhead on your own.
