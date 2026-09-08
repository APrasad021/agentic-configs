# conventions

Prose that patterns refer to instead of restating.

This directory exists to kill the main source of redundancy in a repo like
this: eighteen pattern READMEs each explaining what a good error message looks
like, in eighteen slightly different and slowly diverging ways.

**Nothing here is copied into a target project.** A pattern links here; a
pattern does not paste from here. If a rule needs to reach a target repo, it
belongs in `repo/agent-context`'s `AGENTS.md`, which is a pattern with files.

| File | Covers |
|---|---|
| `repo-layout.md` | Where things go in a project, and why |
| `naming.md` | Naming across files, branches, models, prompts |
| `ai-conventions.md` | Rules specific to building with models |
