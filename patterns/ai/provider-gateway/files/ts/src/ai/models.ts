/**
 * Model registry. Reads config/models.json so that model ids, prices and
 * capabilities live in exactly one place — a data file, not code.
 *
 * Call sites use aliases ("fast" | "default" | "deep"). Swapping which model
 * "default" points at is then a one-line change to a JSON file, reviewable on
 * its own, instead of a rename across every call site.
 */
import registry from "../../config/models.json" with { type: "json" };

export type Provider = "anthropic" | "openai" | "google";

export interface ModelSpec {
  provider: Provider;
  contextWindow: number;
  maxOutput: number;
  price: { input: number; output: number; cachedInput?: number };
  supports: {
    tools: boolean;
    vision: boolean;
    streaming: boolean;
    promptCache: boolean;
  };
}

const MODELS = registry.models as unknown as Record<string, ModelSpec>;
const ALIASES = registry.aliases as Record<string, string>;
const FALLBACKS = registry.fallbacks as Record<string, string[]>;

/** Resolve an alias ("fast") or a raw model id to a concrete id. */
export function resolveModel(nameOrAlias: string): string {
  const id = ALIASES[nameOrAlias] ?? nameOrAlias;
  if (!MODELS[id]) {
    throw new Error(
      `Unknown model '${nameOrAlias}'. Known: ${[
        ...Object.keys(ALIASES),
        ...Object.keys(MODELS),
      ].join(", ")}. Add it to config/models.json.`,
    );
  }
  return id;
}

export function spec(modelId: string): ModelSpec {
  return MODELS[resolveModel(modelId)];
}

export function fallbacksFor(modelId: string): string[] {
  return FALLBACKS[resolveModel(modelId)] ?? [];
}

/** USD cost of a completed call. */
export function costOf(
  modelId: string,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number },
): number {
  const p = spec(modelId).price;
  const cached = usage.cachedInputTokens ?? 0;
  const fresh = Math.max(0, usage.inputTokens - cached);
  return (
    (fresh * p.input + cached * (p.cachedInput ?? p.input) + usage.outputTokens * p.output) /
    1_000_000
  );
}

/**
 * Pre-flight estimate, used to enforce the budget ceiling before spending.
 * Deliberately pessimistic: it assumes the model emits its full maxOutput,
 * because the point is to refuse a call that *could* be ruinous, not to
 * predict the average one.
 */
export function estimateMaxCost(modelId: string, inputTokens: number, maxOutputTokens?: number): number {
  const s = spec(modelId);
  return costOf(modelId, {
    inputTokens,
    outputTokens: maxOutputTokens ?? s.maxOutput,
  });
}
