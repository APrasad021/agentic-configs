# agent-runtime

> Status: **draft** · requires: `ai/provider-gateway`

## What this ships

`docs/agent-boundaries.md` — the rules for tool definitions, trust boundaries
and loop safety, written to be read by both humans and agents.

## Why this is rules and not code

The agent loop is the most framework-dependent thing in the AI stack. A loop
written for the Claude Agent SDK is not portable to LangGraph and is
meaningless if you hand-roll one. Shipping a loop here would mean shipping the
wrong loop for most projects.

The *rules*, though, are framework-independent, and they are the part people
get wrong. So this pattern ships the boundary rules and leaves the mechanism to
whichever framework you land on.

## The rule worth internalising

> Retrieved text never decides whether a privileged tool runs.

Every prompt-injection incident is a variation of this: content the model
retrieved contained instructions, the model followed them, and something
privileged happened. The defence is not a better model or a better system
prompt — it is that the gate on a privileged action is a check the model
cannot influence.

## What this will grow into

Once you settle on a framework, this pattern should gain:

- A tool-registry helper that carries the read/write/privileged class.
- A loop wrapper enforcing max-iterations, timeout, budget and no-progress.
- MCP server config with pinned versions and scoped credentials.

Until then, treat `docs/agent-boundaries.md` as a checklist you apply by hand
and reference from `AGENTS.md`.
