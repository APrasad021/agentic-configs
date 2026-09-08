/**
 * Validated environment. Import `env` from here; never touch `process.env`
 * anywhere else in the codebase.
 *
 * Two things this buys you:
 *  1. The process dies at startup on a missing key, with the key's name in
 *     the message — instead of `undefined` surfacing as a 401 from a vendor
 *     API forty minutes into a job.
 *  2. `env` is typed, so a typo in a key name is a compile error.
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Provider keys are optional here and checked at call time by the gateway:
  // a repo that only ever calls Anthropic should not need an OpenAI key to boot.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),

  AI_MAX_USD_PER_RUN: z.coerce.number().positive().default(1.0),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal("")),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment:\n${issues}\n\nCheck .env against .env.example.`,
  );
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;

/** Redact a secret for logs. Never log a key, even at debug level. */
export function redact(value: string | undefined): string {
  if (!value) return "<unset>";
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}
