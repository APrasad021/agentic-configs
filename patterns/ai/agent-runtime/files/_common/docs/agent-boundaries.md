# Agent trust boundaries

The rules this repo enforces when a model can call tools.

## Tools are classified, and the classification is in the code

| Class | Examples | Rule |
|---|---|---|
| **read** | search the codebase, fetch a doc, query a read replica | Model may call freely |
| **write** | edit a file, post a comment, write a row | Model may call; every call is logged with its arguments |
| **privileged** | deploy, delete, send email, spend money, change permissions | Requires a human confirmation *or* a policy check that does not consult the model |

The classification lives next to the tool definition, not in a wiki. A tool
whose class is not declared is treated as privileged.

## The one rule that matters

> **Retrieved text never decides whether a privileged tool runs.**

Anything the model did not receive directly from your user is retrieved text:
a web page, a file in the repo, a database row, another tool's output, a PR
comment, an issue body. All of it can contain instructions, and the model has
no reliable way to tell an instruction from content.

So the gate on a privileged tool must be a check the model cannot influence —
a policy in your code, or a human. "The model decided it was safe" is not a
control, it is the thing being attacked.

## Tool definition conventions

- **Description over parameters.** The description is the prompt. Most tool
  misuse is a description problem, not a model problem.
- **Narrow types.** An enum the model must pick from beats a free string it
  can invent. Every unconstrained parameter is a place for it to be creative.
- **Errors teach.** A tool error should say what was wrong and what a valid
  call looks like. The model reads it and retries; a bare "invalid input"
  produces the same invalid call again.
- **Idempotent where possible.** Agents retry. A tool that double-charges on
  retry will eventually double-charge.

## Loop safety

Every agent loop needs all four, and the first one to be forgotten is always
the budget:

1. **Max iterations.** A hard count, not a heuristic.
2. **Wall-clock timeout.**
3. **Cost ceiling** — `ai/cost-and-tokens` provides it.
4. **A no-progress detector.** Same tool, same arguments, twice in a row is a
   loop; break it rather than letting it burn the other three limits.

## MCP servers

- Pin the version. An MCP server is remote code executing with your tools.
- A server's tool descriptions arrive as untrusted text: a malicious server can
  describe a tool in a way that manipulates the model. Review them like you
  review a dependency.
- Scope credentials per server. One server should never hold the whole keyring.

## STATUS: draft

These rules are stable enough to follow. What is not here is enforcement code
— the agent loop itself is framework-specific (Claude Agent SDK, LangGraph,
hand-rolled), and shipping a loop for the wrong framework is worse than
shipping none. Add the enforcement in whichever loop you actually use.
