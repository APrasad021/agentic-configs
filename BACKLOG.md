# Backlog

Planned work, in dependency order, written to be picked up by a coding agent
with no prior context on this repo. Read `AGENTS.md` first.

Each item states **why**, a **plan of attack**, **done when**, and **traps**.
Update the status marker when you finish something; do not delete the entry.

| # | Item | Status |
|---|---|---|
| 1 | Tests that gate pushes and PR merges | `todo` |
| 2 | Simplify the folder structure | `todo` |
| 3 | Configs from personas, context and memory | `todo` |
| 4 | Architecture for MCP/API delivery (other repo) | `todo` |

## Why this order

Tests come before the restructure, not after. Item 2 moves ~86 files and
rewrites path handling in `lib/cmd_apply.sh`; without item 1 the only way to
verify it is by eye, across seventeen patterns. Item 1 is what makes item 2 a
mechanical change instead of a risky one.

Items 3 and 4 both build on the pattern layout, so doing them before item 2
means migrating twice.

Items 3 and 4 also share a keystone: a **plan/execute split** (see item 4).
Build it once in item 4's step 1, and item 3 becomes a plan producer. If you
do item 3 first, build the plan step anyway.

---

# 1. Tests that gate pushes and PR merges

**Status:** `todo` · unblocks item 2

## Why

There are zero tests. Every verification so far has been manual. The repo also
ships `dx/task-runner`, `ci/github-actions`, `repo/git-conventions` and
`repo/scaffold` — and applies none of them to itself. Fixing that gap *is*
most of this task: dogfooding gets us the Makefile, the workflow and the
pre-push hook for free, and proves the patterns work.

## Plan of attack

1. **Dogfood first.** `./bin/agentic apply` these into the repo root:
   `dx/task-runner`, `repo/scaffold` (expect `.gitignore`/`README.md`
   collisions — keep ours, take the rest), `repo/git-conventions`,
   `ci/github-actions`. This yields `Makefile`, `make/`, the pre-push hook and
   `.github/workflows/ci.yml` without writing them by hand.
2. **Add `make/sh.mk`** — this repo's stack is bash, and no fragment exists for
   it. Register `shellcheck` under `LINT_TARGETS` and the test runner under
   `TEST_TARGETS`. Write it as a real pattern fragment if it generalises;
   inline it here if not.
3. **Write `tests/run.sh` in plain bash.** No bats, no npm. The repo's whole
   dependency contract is bash + jq, and a test suite that breaks it is a bad
   advertisement. A ~30-line assert helper is enough.
4. **Cover these six layers**, roughly in value order:
   - `agentic catalog` exits 0 (integrity checks already exist — just gate them)
   - CLI behaviour: apply, `--dry-run` writes nothing, `--stack` resolution and
     its two error messages, auto-detection (a Python-only target gets no TS
     files), `--force`, dependency warnings
   - **Var substitution safety** — the highest-value single test. Assert that
     a literal `${{ secrets.X }}` in a workflow template survives apply
     untouched, and that only declared vars are replaced
   - Golden apply: snapshot each pattern's written file list to
     `tests/golden/<domain>__<name>.txt`; fail on unexpected adds/removes
   - `check` reporting: drift, missing and stale each detected
   - Shipped-code unit tests for the pure functions in `ai/provider-gateway`
     and `ai/prompt-library` (cost math, alias resolution, front-matter
     parsing, `render` throwing on a missing input)
5. **Add a cross-language parity test.** `cost_of` and `resolve_model` must
   return identical results in TS and Python for the same inputs. This is the
   exact drift risk `decisions/0003` names as unenforced, and it is cheap to
   close: run both, diff the output.
6. **Wire the gates.** `make check` runs everything; the pre-push hook already
   calls it; `.github/workflows/ci.yml` already calls it.

## Done when

`make check` passes locally and in CI, the pre-push hook blocks a failing
push, and the `check` job is a **required status check** in branch protection.

## Traps

- **Branch protection is a repo setting, not a file.** The workflow is
  advisory until someone ticks the box in Settings → Branches. This is the
  step that makes any of it real; say so explicitly when handing off.
- The shipped TS is not compiled anywhere. Either add a `tsc --noEmit` pass
  over `patterns/**/files/ts/` with a minimal tsconfig, or test the logic by
  stripping types — but pick one deliberately and note it, because right now
  the TypeScript has never been type-checked, only executed.
- Tests that call a real provider API do not belong here. Every test must run
  offline with no API key.

---

# 2. Simplify the folder structure

**Status:** `todo` · needs item 1

## Why

40 of 86 pattern files sit 7–8 path segments deep
(`patterns/ai/provider-gateway/files/ts/src/ai/gateway.ts`). And three
top-level prose directories — `conventions/`, `decisions/`, `docs/` — hold
458 lines across 8 files between them, which is one directory's worth of
content spread over three.

## Plan of attack

Four candidates. **Two are worth doing; two are churn.** Verdicts included so
nobody re-litigates them.

1. **Drop the `files/` level. ✅ Do it.**
   ```
   patterns/<domain>/<name>/
   ├── pattern.json
   ├── README.md
   ├── common/     (was files/_common/)
   ├── ts/ py/ sh/ (was files/ts/ ...)
   ```
   Removes one segment from every file-bearing path. The stack directory names
   are a fixed, known set, so there is no ambiguity with the two metadata
   files. Rename `_common` → `common` at the same time; the underscore only
   existed to sort it first inside `files/`.

   Touches: `lib/cmd_apply.sh` (the copy loop), `lib/cmd_show.sh` (the file
   listing), `lib/cmd_catalog.sh` (all four integrity checks),
   `lib/cmd_new.sh` (the scaffold), plus `docs/authoring-patterns.md` and
   `decisions/0003`.

2. **Merge the three prose directories into `docs/`. ✅ Do it.**
   ```
   docs/
   ├── authoring-patterns.md
   ├── conventions/
   └── decisions/
   ```
   Update the links in `README.md`, `AGENTS.md` and every pattern README that
   points at `conventions/`. Grep for `conventions/` and `decisions/` — the
   convention-linking rule from `decisions/0002` means there are many.

3. **Merge `lib/cmd_*.sh` into fewer files. ❌ Skip.**
   473 lines across 8 files, largest is 151. One file per command is trivially
   navigable and lets an agent open exactly what it needs. Merging trades that
   for a smaller `ls`. Not worth a commit.

4. **Flatten domains (`ai/provider-gateway` → `ai-provider-gateway`). ❌ Skip.**
   Removes a segment but breaks browsing by domain, and pattern ids already
   read as paths everywhere including `applied.json` in downstream repos.

## Done when

`make check` passes, `agentic catalog` reports `integrity: ok`, and applying
every pattern into a scratch target produces byte-identical output to the
golden snapshots from item 1.

## Traps

- **Do item 1 first.** The golden snapshots are the only cheap proof that a
  52-file move changed nothing.
- Pattern **ids do not change**, so `.agentic/applied.json` in downstream
  repos stays valid and `agentic check` keeps working. Do not renumber or
  rename patterns as part of this — that would break them.
- Bump `version` in every touched `pattern.json`? **No.** The shipped files are
  unchanged; only this repo's internal layout moved. Bumping would report
  every downstream project as `stale` for no reason.
- Watch for hardcoded `files/` and `_common` strings in READMEs and ADRs, not
  just in code.

---

# 3. Configs from personas, context and memory

**Status:** `todo` · needs item 2

## Why

Today, setting up a project means knowing which of seventeen patterns you want
and typing seven `apply` commands with the right flags. The knowledge of
"which set, with which values" lives in the user's head and gets re-derived
every time.

Three distinct things hide inside this item — build them in this order, and
each is useful alone:

| | What | Where it lives |
|---|---|---|
| **Profile** | A named bundle: pattern set + var defaults | `profiles/*.json`, in-repo, committed |
| **Memory** | This user's answers, remembered across runs | `~/.config/agentic/memory.json`, never committed |
| **Context** | What the target repo already tells us | Inferred at apply time |

## Plan of attack

1. **Profiles.** `profiles/<name>.json`:
   ```json
   {
     "id": "ai-service-ts",
     "description": "TypeScript service that calls models",
     "patterns": ["dx/task-runner", "repo/scaffold", "dx/env-and-secrets",
                  "repo/agent-context", "ci/github-actions",
                  "ai/provider-gateway", "ai/prompt-library"],
     "stacks": ["ts"],
     "vars": { "GITHUB_OWNER": "APrasad021" }
   }
   ```
   Add `agentic profile list|show|apply <id> --target DIR`. Apply resolves
   `requires` and orders patterns so dependencies land first — `dx/task-runner`
   must precede anything shipping a `make/*.mk` fragment.

   Start with three profiles, not ten: `ai-service-ts`, `ai-service-py`,
   `minimal-repo`. More is guessing.

2. **Memory.** A single JSON file under `${XDG_CONFIG_HOME:-~/.config}/agentic/`
   recording var values the user has supplied before, and the profile they last
   used. Write it after a successful apply; read it to prefill.

   **Precedence, highest wins:** `--var` flag → memory → profile → pattern
   default → derived (e.g. `PROJECT_NAME` from the target dir name). Implement
   this as one function with a test per layer; it is the part that will
   otherwise get subtly wrong.

   Never store a secret in memory. Var values are things like a GitHub org, not
   API keys — add an explicit `"secret": true` flag to a var declaration and
   refuse to persist those.

3. **Context detection.** Extend `detect_stacks()` into `detect_context()`
   returning JSON: stacks present, whether it is a git repo, whether CI already
   exists, whether `AGENTS.md` exists. Use it to *suggest* a profile and to
   skip patterns already applied — suggest, never auto-apply.

4. **`agentic init --target DIR`** ties it together: detect context, suggest a
   profile, show the resolved plan, ask once, apply.

## Done when

`agentic init --target ~/code/new-thing` takes a project from empty to a full
working setup, with vars prefilled from memory, in one command.

## Traps

- **Profiles must not duplicate pattern content.** A profile is a list of ids
  and var values — nothing else. The moment a profile contains a file, this
  repo has two ways to ship the same thing. See `decisions/0002`.
- Memory is per-machine and un-synced. Treat it as a convenience that can
  vanish; anything load-bearing belongs in a committed profile.
- "Persona" is tempting to over-model. It is a named list of patterns plus
  defaults. Resist adding conditionals, inheritance, or a DSL until three real
  profiles have made the case.

---

# 4. Architecture for MCP/API delivery (separate repo)

**Status:** `todo` · needs item 2 · design work before code

## Why

A separate repo will serve these patterns over MCP and an HTTP API. That
consumer cannot shell out to a bash CLI, and reimplementing apply logic in a
second language would duplicate the exact thing this repo exists to prevent.

The tension to resolve: **bash + jq was right for a zero-dependency local CLI
and is wrong as a library for a remote server.** Resolve it with a contract,
not a rewrite.

## Plan of attack

1. **Split apply into plan + execute.** This is the keystone; do it first, in
   *this* repo. Add `agentic plan <id> --target DIR [--stack S] [--var K=V]`
   emitting JSON and touching nothing:
   ```json
   {
     "schema": 1,
     "pattern": "ai/provider-gateway",
     "version": "1.0.0",
     "stacks": ["common", "ts"],
     "vars": { "PROJECT_NAME": "my-app" },
     "files": [
       { "path": "config/models.json", "source": "common/config/models.json",
         "action": "write", "sha256": "..." },
       { "path": "src/ai/gateway.ts", "source": "ts/src/ai/gateway.ts",
         "action": "skip", "reason": "exists" }
     ]
   }
   ```
   Then `apply` becomes `plan | execute`. Nothing else changes for users, and
   `--dry-run` becomes `plan` with a pretty printer.

2. **The plan is the API contract.** The remote service returns plans and file
   contents; the *client* writes to disk. The server never needs filesystem
   semantics, drift stamps, or knowledge of the user's machine — which is also
   what makes it safe to expose.

3. **Publish JSON Schemas** for `pattern.json`, `catalog.json` and the plan
   envelope, under `schemas/`. Add `"schemaVersion"` to `pattern.json` so the
   consumer can reject a format it does not understand instead of guessing.
   Validate them in `make check` (item 1).

4. **Decide how the other repo gets the content**, and write it up as an ADR
   here before either repo commits to it:
   - *git clone/pull at build time* — simplest, no publishing step, content is
     always a commit sha you can pin. **Start here.**
   - *published package* — real versioning, but only helps the importable
     subset; most patterns are `Makefile`/`.gitignore`/workflow files. See
     `decisions/0001` for why that argument already lost once.
   - *served from this repo via raw GitHub* — no.

5. **Shape the MCP surface as read-mostly.** `list_patterns`,
   `get_pattern(id)`, `plan(id, context)`, `get_file(id, path)`. An MCP server
   that writes to a user's filesystem is a much larger security surface for
   very little gain — the client already has an agent that can write files.

## Done when

`agentic plan` emits a stable, schema-validated JSON envelope; `apply` is
implemented as plan + execute with no behaviour change; the schemas are
published and validated in CI; and an ADR records the content-delivery
decision.

## Traps

- **Do not port the CLI to TypeScript or Python "so the server can import
  it".** That is the failure this contract avoids: two implementations
  drifting. If the server needs local execute semantics later, it consumes a
  plan.
- Do not let the API design leak back into `pattern.json`. Patterns are files
  and metadata; anything the API needs that patterns do not have belongs in the
  plan envelope or in the server.
- Version the plan schema from day one. It is the interface between two repos
  that will not always deploy together.

---

# Known debt

Not prioritized — logged so it is not rediscovered. Promote to a numbered item
if it starts costing something.

- **Model prices in `patterns/ai/provider-gateway/common/config/models.json`
  are unverified defaults.** They are documented as such, and the alias
  indirection makes correcting them a one-line change. A periodic check
  against provider pricing pages would be worth automating.
- **The shipped TypeScript has never been type-checked**, only executed with
  types stripped. Item 1 step 4 should settle this.
- **No streaming and no tool-calling loop** in `ai/provider-gateway` — both are
  documented as deliberate gaps in its README, not oversights.
- **Six patterns are `draft`.** Each README states what specifically is
  unresolved. `ai/agent-runtime` and `ci/release-deploy` are the two blocked on
  an external decision (agent framework, deploy platform) rather than on work.
- **`repo/media-assets` has no CDN/deploy half.** Belongs with
  `ci/release-deploy` once a platform is chosen.
