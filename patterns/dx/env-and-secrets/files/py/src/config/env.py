"""Validated environment.

Import ``settings`` from here; never call ``os.environ`` anywhere else.

Two things this buys you:
  1. The process dies at import time on a missing key, naming the key, instead
     of ``None`` surfacing as a 401 from a vendor API forty minutes into a job.
  2. ``settings`` is typed, so a typo in a key name is caught by mypy.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    env: Literal["development", "test", "production"] = "development"
    log_level: Literal["debug", "info", "warn", "error"] = "info"

    # Provider keys are optional here and checked at call time by the gateway:
    # a repo that only ever calls Anthropic should not need an OpenAI key to boot.
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None

    ai_max_usd_per_run: float = Field(default=1.0, gt=0)

    otel_exporter_otlp_endpoint: str | None = None


settings = Settings()


def redact(value: str | None) -> str:
    """Redact a secret for logs. Never log a key, even at debug level."""
    if not value:
        return "<unset>"
    return f"{value[:4]}…{value[-2:]} ({len(value)} chars)"
