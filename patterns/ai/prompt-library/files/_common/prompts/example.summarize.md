---
id: summarize
version: 3
model: fast
temperature: 0.2
maxOutputTokens: 512
description: Summarize a document into bullet points for a technical reader.
inputs: [document, audience]
changelog:
  - v3: added the "say so" instruction — v2 invented detail when the input was thin
  - v2: constrained to 5 bullets; v1 rambled at 20+
  - v1: initial
---

You are summarizing a technical document for {{audience}}.

Produce at most 5 bullets. Each bullet is one sentence, states a fact from the
document, and contains no hedging.

If the document does not contain enough substance for 5 bullets, produce
fewer and say so. Do not pad.

<document>
{{document}}
</document>
