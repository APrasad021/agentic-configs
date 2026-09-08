"""Load prompts from ``prompts/*.md`` by id.

A prompt is a file, not a string literal, because a prompt is behaviour. Files
get diffs, review, blame and history; an f-string buried in a service method
gets none of those, and "which change made the output worse" becomes
unanswerable.

Front-matter carries the settings the prompt was tuned with, so the model and
temperature travel with the text instead of being re-guessed per call site.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

_FRONT_MATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?(.*)\Z", re.DOTALL)
_KV = re.compile(r"^([A-Za-z_]\w*):\s*(.*)$")
_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")

PROMPT_DIR = Path(os.environ.get("PROMPT_DIR", "prompts"))


@dataclass(frozen=True)
class Prompt:
    id: str
    template: str
    version: int = 1
    model: str | None = None
    temperature: float | None = None
    max_output_tokens: int | None = None
    description: str | None = None
    inputs: list[str] = field(default_factory=list)


def _parse_front_matter(raw: str) -> tuple[dict[str, object], str]:
    """Minimal reader: scalars and flat string lists, nothing more."""
    m = _FRONT_MATTER.match(raw)
    if not m:
        return {}, raw

    meta: dict[str, object] = {}
    for line in m.group(1).splitlines():
        kv = _KV.match(line)
        if not kv:
            continue  # nested keys (changelog) are documentation, not config
        key, value = kv.group(1), kv.group(2).strip()
        if not value:
            continue
        if value.startswith("["):
            meta[key] = [s.strip() for s in value[1:-1].split(",") if s.strip()]
        elif re.fullmatch(r"-?\d+", value):
            meta[key] = int(value)
        elif re.fullmatch(r"-?\d+\.\d+", value):
            meta[key] = float(value)
        else:
            meta[key] = value.strip("\"'")
    return meta, m.group(2)


_CAMEL = {"maxOutputTokens": "max_output_tokens"}
_FIELDS = {f for f in Prompt.__dataclass_fields__ if f not in {"id", "template"}}


def load_prompt(prompt_id: str) -> Prompt:
    matches = [
        p
        for p in PROMPT_DIR.glob("*.md")
        if p.name == f"{prompt_id}.md" or p.name.endswith(f".{prompt_id}.md")
    ]
    if not matches:
        raise FileNotFoundError(f"No prompt {prompt_id!r} in {PROMPT_DIR}/")

    meta, body = _parse_front_matter(matches[0].read_text())
    kwargs = {
        _CAMEL.get(k, k): v for k, v in meta.items() if _CAMEL.get(k, k) in _FIELDS
    }
    return Prompt(id=prompt_id, template=body.strip(), **kwargs)  # type: ignore[arg-type]


def render(prompt: Prompt, **inputs: str) -> str:
    """Fill ``{{placeholders}}``.

    Raises on a missing input rather than rendering ``{{document}}`` into the
    prompt, which the model will cheerfully answer about — producing a
    plausible response to a broken request.
    """

    def sub(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in inputs:
            given = ", ".join(inputs) or "none"
            raise KeyError(f"Prompt {prompt.id!r} needs input {key!r}. Given: {given}")
        return inputs[key]

    return _PLACEHOLDER.sub(sub, prompt.template)
