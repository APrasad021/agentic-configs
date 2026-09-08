/**
 * Structured logging.
 *
 * STATUS: draft. This is a small JSON logger, not a wrapper around pino or
 * OpenTelemetry — the point is the *shape* of the fields and the redaction,
 * which transfer to whatever backend you land on.
 */
import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Keys whose values never appear in logs, at any level. Matched case-
 * insensitively as a substring, so `anthropicApiKey` and `X-Api-Key` both hit.
 *
 * This list is the whole reason to have a logger rather than console.log:
 * every credential leak into logs happens because someone logged an object
 * that happened to contain a key, not because someone logged the key.
 */
const SECRET_KEYS = ["key", "token", "secret", "password", "authorization", "cookie", "credential"];

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEYS.some((s) => k.toLowerCase().includes(s))
      ? "[redacted]"
      : redactDeep(v, depth + 1);
  }
  return out;
}

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL as Level]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(redactDeep(fields) as object),
  };
  // One JSON object per line: greppable by a human, parseable by a collector.
  (level === "error" ? console.error : console.log)(JSON.stringify(line));
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};

/**
 * The fields an AI call should always carry. Anything less and you cannot
 * answer "why did this run cost $40" or "which prompt version produced that".
 */
export interface AiCallFields {
  runId: string;
  promptId?: string;
  promptVersion?: number;
  model: string;
  /** Models tried before this one succeeded — a fallback you never see is a fallback you never fix. */
  attempted?: string[];
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costUsd: number;
  ms: number;
  outcome: "ok" | "error" | "budget" | "timeout";
}

export const logAiCall = (f: AiCallFields) => log.info("ai.call", { ...f });
