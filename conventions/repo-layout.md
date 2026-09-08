# Repo layout

The shape a project ends up with after applying the patterns here.

```
.
├── AGENTS.md               instructions — for agents and humans
├── CLAUDE.md               one line, points at AGENTS.md
├── Makefile                the verb set
├── make/                   per-language fragments
├── .env.example            the env schema
├── config/
│   └── models.json         model ids, prices, aliases, fallbacks
├── prompts/                prompts as files, with front-matter
├── evals/
│   ├── cases/              golden set, JSONL
│   └── results/            git-ignored output
├── src/
│   ├── config/env          validated environment
│   ├── ai/                 gateway, models, prompts, budget
│   └── obs/                logging
├── scripts/                shell entry points and hooks
└── docs/
    └── decisions/          ADRs
```

## The principles behind it

**Data that changes on a different schedule than code lives in a data file.**
Model ids and prices change monthly; the code calling them does not. So
`config/models.json`, not constants. Prompts change on their own rhythm and
need their own review; so `prompts/*.md`, not string literals.

**One directory per concern, flat inside.** `src/ai/` holds five files, not a
tree. Nesting is a cost you pay on every navigation and should be earned by
actual volume.

**Generated output is git-ignored and named as output.** `evals/results/`,
`.agent-runs/`. If a specific run matters, commit it deliberately.

**Config that CI reads is a file, not a workflow input.** `.nvmrc`,
`.python-version`, `Makefile`. One source, read by your shell, your CI and
your devcontainer alike.

## Where AI-specific structure differs from ordinary structure

Three things have no equivalent in a non-AI project, and all three exist for
the same reason — **behaviour lives outside the code**:

- `prompts/` — behaviour as text
- `config/models.json` — behaviour as a model choice
- `evals/` — the test suite for behaviour that has no deterministic assertion

A repo that keeps prompts inline and model ids scattered has the same
behaviour, but no way to review a change to it, and no way to tell which
change caused a regression.
