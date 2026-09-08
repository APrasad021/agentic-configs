# Authoring patterns

```bash
./bin/agentic new dx/my-thing      # scaffolds the directory
# ... add files under files/_common, files/ts, files/py, files/sh
./bin/agentic catalog              # regenerates the index and runs integrity checks
```

## Anatomy

```
patterns/<domain>/<name>/
├── pattern.json        metadata — the only thing the tooling reads
├── README.md           what it is, why it is shaped this way, what it does not do
└── files/
    ├── _common/        always copied
    ├── ts/  py/  sh/   copied when the stack is detected or requested
```

Paths under a stack directory are relative to the target repo root, so
`files/ts/src/ai/gateway.ts` lands at `<target>/src/ai/gateway.ts`.

## `pattern.json`

```json
{
  "id": "dx/my-thing",
  "summary": "One line. Shown in `agentic list`, so make it say what you get.",
  "status": "draft",
  "version": "0.1.0",
  "stacks": ["ts", "py"],
  "requires": ["dx/task-runner"],
  "tools": ["make"],
  "tags": ["dx"],
  "vars": {
    "PROJECT_NAME": { "default": "", "description": "Defaults to the target dir name." }
  },
  "next": ["What to do right after applying this."]
}
```

- **`status`** — `stable` when the trade-offs are settled and written down;
  `draft` when something specific is unresolved; `deprecated` with a
  `supersededBy` when it is replaced.
- **`version`** — bump it when files change. `agentic check` compares this
  against what a target recorded, and it is the only staleness signal there is.
- **`requires`** — advisory. `apply` warns, never blocks.
- **`vars`** — only declared names are substituted, which is why a template can
  safely contain GitHub Actions' `${{ ... }}` or Jinja's `{{ ... }}`.

## Rules

**Two stacks must never write the same destination path.** `apply` copies
`_common` first and reports later collisions as "exists, skipped" — visible,
but confusing. `agentic catalog` fails on it. Name stack-specific fragments
distinctly: `make/eval-ts.mk`, not `make/eval.mk` in both.

**Do not restate a convention.** Link to `conventions/`. This is the rule the
whole repo exists to demonstrate ([ADR 0002](../decisions/0002-conventions-are-separate-from-patterns.md)).

**Say what the pattern does not do.** Every README here has a "what is
missing" or "deliberate limits" section. It is the most useful part: it tells
the reader whether their case is covered before they have built on it, and it
keeps a draft honest instead of aspirational.

**Comments explain why.** A comment restating the line below it is noise that
goes stale. A comment explaining why retries use jitter is why someone does not
remove the jitter.

## Writing the README

The sections that consistently earn their place:

1. **What this is** — with a usage snippet, immediately.
2. **Why it is shaped this way** — the decision someone would otherwise
   second-guess.
3. **The one rule that matters** — most patterns have exactly one.
4. **What it does not do** — see above.
5. **Adapting it** — the two or three lines people will actually need to change.

Skip the generic advice. "Write good tests" costs a reader's attention and
changes nothing.

## Changing an existing pattern

1. Edit files, bump `version` in `pattern.json`.
2. `./bin/agentic catalog`.
3. Note the change in the README if it alters a trade-off.

Existing projects will not pick it up — copies do not propagate
([ADR 0001](../decisions/0001-patterns-are-copied-not-linked.md)). They will
show as `stale` on their next `agentic check`, which is the intended signal.

## Testing a pattern

```bash
mkdir -p /tmp/t && ./bin/agentic apply dx/my-thing --target /tmp/t --stack all
./bin/agentic check --target /tmp/t
```

`--dry-run` prints what would be written without writing it.
