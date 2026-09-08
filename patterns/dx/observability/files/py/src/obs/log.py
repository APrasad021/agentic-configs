"""Structured logging.

STATUS: draft. This is a small JSON logger, not a wrapper around structlog or
OpenTelemetry — the point is the *shape* of the fields and the redaction, which
transfer to whatever backend you land on.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from ..config.env import settings

Level = Literal["debug", "info", "warn", "error"]
_ORDER: dict[str, int] = {"debug": 10, "info": 20, "warn": 30, "error": 40}

#: Keys whose values never appear in logs, at any level. Matched
#: case-insensitively as a substring, so ``anthropic_api_key`` and
#: ``X-Api-Key`` both hit.
#:
#: This list is the whole reason to have a logger rather than print(): every
#: credential leak into logs happens because someone logged an object that
#: happened to contain a key, not because someone logged the key.
SECRET_KEYS = ("key", "token", "secret", "password", "authorization", "cookie", "credential")


def _redact(value: Any, depth: int = 0) -> Any:
    if depth > 6:
        return value
    if isinstance(value, dict):
        return {
            k: ("[redacted]" if any(s in k.lower() for s in SECRET_KEYS) else _redact(v, depth + 1))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_redact(v, depth + 1) for v in value]
    return value


def _emit(level: Level, msg: str, **fields: Any) -> None:
    if _ORDER[level] < _ORDER[settings.log_level]:
        return
    line = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "msg": msg,
        **_redact(fields),
    }
    # One JSON object per line: greppable by a human, parseable by a collector.
    stream = sys.stderr if level == "error" else sys.stdout
    print(json.dumps(line), file=stream)


def debug(msg: str, **f: Any) -> None: _emit("debug", msg, **f)
def info(msg: str, **f: Any) -> None: _emit("info", msg, **f)
def warn(msg: str, **f: Any) -> None: _emit("warn", msg, **f)
def error(msg: str, **f: Any) -> None: _emit("error", msg, **f)


@dataclass
class AiCallFields:
    """The fields an AI call should always carry.

    Anything less and you cannot answer "why did this run cost $40" or "which
    prompt version produced that".
    """

    run_id: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    ms: float
    outcome: Literal["ok", "error", "budget", "timeout"]
    prompt_id: str | None = None
    prompt_version: int | None = None
    #: Models tried before this one succeeded — a fallback you never see is a
    #: fallback you never fix.
    attempted: list[str] | None = None
    cached_input_tokens: int = 0


def log_ai_call(fields: AiCallFields) -> None:
    info("ai.call", **asdict(fields))
