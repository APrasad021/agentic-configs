# AGENTS.md — agentic-configs

This repo holds reusable building patterns. It is also, deliberately, an
example of the conventions it ships — so changes here should follow the rules
in `conventions/`.

**Picking up planned work?** `BACKLOG.md` has four items in dependency order,
each with a plan of attack, a done-when, and the traps. Start there rather than
inventing an approach.

## Orientation

- **The CLI:** `bin/agentic` dispatches to `lib/cmd_*.sh`. Bash + `jq` only.
- **The content:** `patterns/<domain>/<name>/`, each with `pattern.json`,
  `README.md`, and `files/`.
- **The reasoning:** `conventions/` (rules) and `decisions/` (ADRs).

## Commands

```bash
./bin/agentic catalog     # regenerate catalog.json + run integrity checks
./bin/agentic list
bash -n bin/agentic lib/*.sh    # syntax check the CLI
```

**Run `./bin/agentic catalog` after any change under `patterns/`.** It
regenerates the index and fails on the mistakes that are easy to make when
authoring: an undeclared stack directory, a colliding destination path, a
missing README, a `requires` that does not resolve.

## Conventions

Read `conventions/` before adding content — especially
`conventions/ai-conventions.md` if the change touches model calls.

- **Never restate a convention inside a pattern README.** Link to it. This is
  the repo's core rule; see `decisions/0002-*.md`.
- **Comments explain why, not what.** The code says what it does.
- **Every pattern README states what the pattern does not do.** A draft
  pattern must say specifically what is unresolved.
- **Bump `version` in `pattern.json`** whenever files change — it is the only
  staleness signal downstream projects get.

## Things that will bite you

- `bin/agentic` and `lib/*.sh` run under `set -euo pipefail`. A bare
  `[ cond ] && action` at statement level **exits the script** when the
  condition is false. Use `if ... then ... fi`.
- `catalog.json` is generated. Never hand-edit it.
- Only variables declared in a pattern's `vars` are substituted on apply. This
  is what lets a template file contain a literal `${{ secrets.X }}` or a Jinja
  `{{ name }}` without being mangled — do not replace this with a blanket
  substitution.
- Two stacks in one pattern must not ship the same destination path. `catalog`
  catches it; `apply` would silently skip the second one.
- Model ids and prices in `patterns/ai/provider-gateway/files/_common/config/models.json`
  go stale. They are documented as defaults to verify, not as facts.

## Boundaries

Ask before: adding a dependency to the CLI (bash + `jq` is the whole
contract), restructuring `patterns/`, or changing what `apply` writes into a
target repo.

Never: commit a real secret or API key, even in an example file.
