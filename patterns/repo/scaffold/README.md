# scaffold

> Status: **stable** · applies to any repo

## What this ships

| File | Why it exists |
|---|---|
| `README.md` | A skeleton with the sections people actually read, in the order they read them. |
| `.gitignore` | Multi-ecosystem, including AI working files (traces, eval output). |
| `.editorconfig` | A formatting floor for contributors without your formatter installed. |
| `.gitattributes` | LF normalisation, binary marking, generated-file collapsing. |
| `.github/CODEOWNERS` | Every path has a reviewer. |

## Two decisions worth knowing about

**One combined `.gitignore`, not per-language fragments.** A Python repo
ignoring `node_modules/` costs exactly nothing, and one file that is always
right beats fragments that drift apart. The only fragments worth splitting are
ones that would be *wrong* in the other ecosystem — and there aren't any here.

**`.gitattributes` marks lockfiles as generated.** They collapse in GitHub's
diff view. This is the cheapest possible improvement to review quality: a
2,000-line lockfile churn stops burying the six lines that matter.

## The `.gitignore` entries you might not expect

```
.agent-runs/
evals/results/
*.trace.jsonl
```

Agent traces and eval output are reproducible artifacts, not source. They are
also large, noisy, and frequently contain prompt text you would rather not
have in git history forever. If you need to keep a specific eval run, commit
it deliberately under a name that says so — don't let the directory default to
tracked.

## Adapting it

- **CODEOWNERS** starts as a single owner on everything. The specific rules
  below the catch-all are the ones worth keeping as a team grows: CI config,
  the model registry, and prompts all change system behaviour without looking
  like code changes.
- **README** — the "How it works" map is the section that decays fastest and
  matters most to agents. Keep it to directory-level orientation so it stays
  true through refactors.
