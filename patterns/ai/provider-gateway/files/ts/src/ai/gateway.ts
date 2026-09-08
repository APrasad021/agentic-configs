/**
 * One call signature over every provider.
 *
 * The point is NOT to abstract providers away — provider-specific features are
 * why you pick a provider. The point is that the boring 90% (auth, retries,
 * usage accounting, timeouts, fallback, budget) is written once, and the
 * interesting 10% stays reachable through `raw`.
 *
 * Adding a provider means adding one adapter below and one entry in
 * config/models.json. Nothing else in your codebase changes.
 */
import { env } from "../config/env.js";
import { costOf, estimateMaxCost, fallbacksFor, resolveModel, spec } from "./models.js";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** Alias ("fast" | "default" | "deep") or a concrete model id. */
  model?: string;
  messages: Message[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Abort the call after this many ms. Always set one in production. */
  timeoutMs?: number;
  /** Retries on transient failures, per model tried. */
  maxRetries?: number;
  /** Try the registry's fallback models when the primary keeps failing. */
  allowFallback?: boolean;
  /** Hard ceiling for this call. Defaults to AI_MAX_USD_PER_RUN. */
  maxUsd?: number;
  signal?: AbortSignal;
}

export interface Completion {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
  costUsd: number;
  /** Models tried and rejected before this one succeeded. */
  attempted: string[];
  /** The untouched provider response, for anything this interface flattens. */
  raw: unknown;
}

export class BudgetExceededError extends Error {}
export class MissingCredentialError extends Error {}

/** Errors worth retrying: transient by nature, not caused by the request. */
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

interface ProviderError extends Error {
  status?: number;
}

function isRetryable(err: unknown): boolean {
  const e = err as ProviderError;
  if (e?.name === "AbortError") return false;
  if (typeof e?.status === "number") return RETRYABLE_STATUS.has(e.status);
  // Network-level failures have no status and are worth one more try.
  return e instanceof TypeError;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function complete(opts: CompleteOptions): Promise<Completion> {
  const primary = resolveModel(opts.model ?? "default");
  const chain = opts.allowFallback === false ? [primary] : [primary, ...fallbacksFor(primary)];
  const attempted: string[] = [];

  let lastError: unknown;
  for (const modelId of chain) {
    attempted.push(modelId);
    try {
      return { ...(await callWithRetries(modelId, opts)), attempted };
    } catch (err) {
      // A budget or credential problem will not be fixed by another model.
      if (err instanceof BudgetExceededError || err instanceof MissingCredentialError) throw err;
      if (!isRetryable(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

async function callWithRetries(
  modelId: string,
  opts: CompleteOptions,
): Promise<Omit<Completion, "attempted">> {
  const maxRetries = opts.maxRetries ?? 2;
  const budget = opts.maxUsd ?? env.AI_MAX_USD_PER_RUN;

  // Refuse before spending, not after. A cheap approximation of input size is
  // enough here — being wrong by 20% does not matter when the ceiling exists
  // to catch a runaway loop, not to bill accurately.
  const approxInputTokens = Math.ceil(
    opts.messages.reduce((n, m) => n + m.content.length, 0) / 4,
  );
  const worstCase = estimateMaxCost(modelId, approxInputTokens, opts.maxOutputTokens);
  if (worstCase > budget) {
    throw new BudgetExceededError(
      `${modelId} could cost up to $${worstCase.toFixed(2)}, over the $${budget.toFixed(2)} ceiling. ` +
        `Raise maxUsd / AI_MAX_USD_PER_RUN, cap maxOutputTokens, or use a cheaper alias.`,
    );
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callProvider(modelId, opts);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !isRetryable(err)) throw err;
      // Exponential backoff with jitter: without jitter, a fleet of workers
      // retries in lockstep and re-creates the spike that rate-limited them.
      const base = 500 * 2 ** attempt;
      await sleep(base + Math.random() * base);
    }
  }
  throw lastError;
}

async function callProvider(
  modelId: string,
  opts: CompleteOptions,
): Promise<Omit<Completion, "attempted">> {
  const provider = spec(modelId).provider;
  const signal = opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 60_000);

  switch (provider) {
    case "anthropic":
      return anthropic(modelId, opts, signal);
    case "openai":
      return openai(modelId, opts, signal);
    case "google":
      return google(modelId, opts, signal);
    default: {
      const exhaustive: never = provider;
      throw new Error(`No adapter for provider '${exhaustive}'`);
    }
  }
}

function requireKey(value: string | undefined, name: string, provider: string): string {
  if (!value) {
    throw new MissingCredentialError(
      `${provider} needs ${name}. Add it to .env (see .env.example) or pick a model from another provider.`,
    );
  }
  return value;
}

async function post(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err: ProviderError = new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---- adapters ------------------------------------------------------------
// Each one does exactly two jobs: shape the request, and normalise the usage
// numbers. Everything else is handled above.

async function anthropic(modelId: string, o: CompleteOptions, signal: AbortSignal) {
  const key = requireKey(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY", "Anthropic");
  const system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const raw = (await post("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: o.maxOutputTokens ?? 4096,
      ...(o.temperature !== undefined && { temperature: o.temperature }),
      ...(system && { system }),
      messages: o.messages.filter((m) => m.role !== "system"),
    }),
  })) as {
    content: Array<{ type: string; text?: string }>;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };
  };

  const usage = {
    inputTokens: raw.usage.input_tokens,
    outputTokens: raw.usage.output_tokens,
    cachedInputTokens: raw.usage.cache_read_input_tokens,
  };
  return {
    text: raw.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
    model: modelId,
    usage,
    costUsd: costOf(modelId, usage),
    raw,
  };
}

async function openai(modelId: string, o: CompleteOptions, signal: AbortSignal) {
  const key = requireKey(env.OPENAI_API_KEY, "OPENAI_API_KEY", "OpenAI");
  const raw = (await post("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: o.messages,
      ...(o.maxOutputTokens && { max_completion_tokens: o.maxOutputTokens }),
      ...(o.temperature !== undefined && { temperature: o.temperature }),
    }),
  })) as {
    choices: Array<{ message: { content: string | null } }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };

  const usage = {
    inputTokens: raw.usage.prompt_tokens,
    outputTokens: raw.usage.completion_tokens,
    cachedInputTokens: raw.usage.prompt_tokens_details?.cached_tokens,
  };
  return {
    text: raw.choices[0]?.message.content ?? "",
    model: modelId,
    usage,
    costUsd: costOf(modelId, usage),
    raw,
  };
}

async function google(modelId: string, o: CompleteOptions, signal: AbortSignal) {
  const key = requireKey(env.GOOGLE_API_KEY, "GOOGLE_API_KEY", "Google");
  const system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const raw = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        contents: o.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        generationConfig: {
          ...(o.maxOutputTokens && { maxOutputTokens: o.maxOutputTokens }),
          ...(o.temperature !== undefined && { temperature: o.temperature }),
        },
      }),
    },
  )) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      cachedContentTokenCount?: number;
    };
  };

  const usage = {
    inputTokens: raw.usageMetadata.promptTokenCount,
    outputTokens: raw.usageMetadata.candidatesTokenCount,
    cachedInputTokens: raw.usageMetadata.cachedContentTokenCount,
  };
  return {
    text: raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
    model: modelId,
    usage,
    costUsd: costOf(modelId, usage),
    raw,
  };
}
