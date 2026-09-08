# prompt-library

> Status: **stable** · stacks: ts, py · requires: `ai/provider-gateway`

## What this is

Prompts live in `prompts/*.md` with YAML front-matter, and are loaded by id:

```ts
const p = loadPrompt("summarize");
const text = render(p, { document, audience: "backend engineers" });
await complete({ model: p.model, temperature: p.temperature, messages: [{ role: "user", content: text }] });
```

## Why a file and not a string literal

A prompt is behaviour. It deserves what code gets: a diff, a review, a blame
line, a history.

A template literal inside a service method gets none of that. When output
quality drops next month, "which change caused it" is answerable for a file
and unanswerable for a string that has been edited inline eleven times inside
unrelated commits.

The front-matter carries `model`, `temperature` and `maxOutputTokens` because
those were tuned *with* this text. Splitting them means every call site
re-guesses, and one of them guesses differently.

## The `changelog` block

```yaml
changelog:
  - v3: added the "say so" instruction — v2 invented detail when the input was thin
  - v2: constrained to 5 bullets; v1 rambled at 20+
```

The loader ignores it — it is for humans. It is also the single most useful
thing in the file. Prompt engineering is empirical, and without a record of
what you already tried and why it failed, you will re-try it. Write the
failure mode, not just the change.

## Naming: `example.summarize.md`

Everything before the last dot is a namespace the loader ignores. So
`billing.summarize.md` and `support.summarize.md` can coexist, and you can
group files by domain without inventing a directory scheme up front.

## Rendering fails loudly on a missing input

`render()` throws rather than leaving `{{document}}` in the text. This matters
more than it looks: a model handed a literal `{{document}}` does not error — it
produces a fluent, confident answer to nothing. That is much harder to notice
than a stack trace.

## Deliberate limits

The front-matter parser handles scalars and flat lists. It is ~30 lines with
no YAML dependency, and it stops there on purpose — the moment a prompt needs
nested config, the complexity belongs in code, not in front-matter.

There is no A/B testing, no remote prompt store, no runtime hot-swap. Those
are real needs at scale and each one is a system, not a feature. Add them when
you have the traffic to justify one.

## Adapting it

- **Prompt caching:** put the stable prefix (instructions, examples) at the
  top and the variable part at the bottom. Providers cache prefixes, so this
  ordering is worth real money on repeated calls.
- **Few-shot examples:** keep them in the prompt file. They are part of the
  behaviour, and splitting them out is how they go stale.
