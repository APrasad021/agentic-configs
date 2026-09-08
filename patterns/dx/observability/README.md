# observability

> Status: **draft** · stacks: ts, py · requires: `dx/env-and-secrets`

## What this ships

A small JSON logger with automatic secret redaction, plus the field set an AI
call should always carry.

## Why a logger instead of `console.log` / `print`

**Redaction.** Every credential that ends up in logs got there because someone
logged an *object* that happened to contain a key — a request config, an error
with the headers attached, a settings dump. Nobody logs `apiKey` directly.

So redaction is recursive and matches key names as substrings. It costs
nothing and removes an entire category of incident.

## The AI call field set

```json
{"msg":"ai.call","runId":"7f3a","promptId":"summarize","promptVersion":3,
 "model":"claude-sonnet-5","attempted":["claude-sonnet-5"],
 "inputTokens":4821,"outputTokens":310,"cachedInputTokens":2900,
 "costUsd":0.0091,"ms":1840,"outcome":"ok"}
```

Each field answers a question you will eventually have to answer:

| Field | Question |
|---|---|
| `runId` | Which calls belonged to the same job? |
| `promptId` + `promptVersion` | Which prompt produced this? |
| `attempted` | Did we silently fall back? |
| `cachedInputTokens` | Is prompt caching actually working? |
| `costUsd` | Why did this run cost $40? |
| `outcome` | Was that a real error, a timeout, or a budget stop? |

`attempted` is the one people leave out and then miss most. A fallback that
fires silently for three weeks is a provider outage you never noticed and a
bill you cannot explain.

## Decide the prompt-logging policy now

Do you log prompt and completion *text*?

- **Yes:** debugging becomes vastly easier — and you have just created a
  system holding user content, with all the retention, access-control and
  deletion obligations that implies.
- **No:** debugging a bad output means reproducing it.

There is no universally right answer. There is a wrong time to decide, which
is after you already have production traffic. A common middle path: log a hash
of the input plus full text only for sampled or explicitly flagged runs.

## Why "draft"

The logger is intentionally minimal and the field set is the real content.
What is missing is distributed tracing — OpenTelemetry spans for an agent loop
would be genuinely useful (a span per tool call, nested under the run) and is
a bigger commitment than a logger. `OTEL_EXPORTER_OTLP_ENDPOINT` is already in
`.env.example` for when you get there.
