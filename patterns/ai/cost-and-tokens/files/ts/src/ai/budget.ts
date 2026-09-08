/**
 * Per-run cost accounting.
 *
 * The gateway enforces a ceiling on a *single* call. That does not stop the
 * failure that actually costs money: an agent loop making 400 individually
 * reasonable calls. This tracks the run as a whole.
 *
 * Uses AsyncLocalStorage so call sites do not have to thread a ledger through
 * every function — the ledger follows the async context instead.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../config/env.js";

export interface CallRecord {
  model: string;
  label: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  ms: number;
}

export interface RunLedger {
  runId: string;
  ceilingUsd: number;
  calls: CallRecord[];
}

export class RunBudgetExceededError extends Error {}

const storage = new AsyncLocalStorage<RunLedger>();

export function currentRun(): RunLedger | undefined {
  return storage.getStore();
}

/** Run `fn` inside a budgeted context. Nested calls share the same ledger. */
export async function withRunBudget<T>(
  opts: { runId?: string; ceilingUsd?: number },
  fn: (ledger: RunLedger) => Promise<T>,
): Promise<T> {
  const ledger: RunLedger = {
    runId: opts.runId ?? crypto.randomUUID(),
    ceilingUsd: opts.ceilingUsd ?? env.AI_MAX_USD_PER_RUN,
    calls: [],
  };
  return storage.run(ledger, () => fn(ledger));
}

/** Record a completed call. Throws once the run's total passes its ceiling. */
export function record(call: CallRecord): void {
  const ledger = storage.getStore();
  if (!ledger) return; // accounting is optional; not being in a run is fine
  ledger.calls.push(call);

  const total = totalUsd(ledger);
  if (total > ledger.ceilingUsd) {
    throw new RunBudgetExceededError(
      `Run ${ledger.runId} spent $${total.toFixed(4)} over ${ledger.calls.length} calls, ` +
        `past its $${ledger.ceilingUsd.toFixed(2)} ceiling. ` +
        `Most expensive: ${topCalls(ledger, 3).map((c) => `${c.label} ($${c.costUsd.toFixed(4)})`).join(", ")}`,
    );
  }
}

export const totalUsd = (l: RunLedger): number => l.calls.reduce((n, c) => n + c.costUsd, 0);

const topCalls = (l: RunLedger, n: number): CallRecord[] =>
  [...l.calls].sort((a, b) => b.costUsd - a.costUsd).slice(0, n);

/**
 * Human-readable summary. Print this at the end of every CLI run and job:
 * cost you cannot see is cost you do not manage.
 */
export function summarize(l: RunLedger): string {
  const byModel = new Map<string, { n: number; usd: number; in: number; out: number }>();
  for (const c of l.calls) {
    const e = byModel.get(c.model) ?? { n: 0, usd: 0, in: 0, out: 0 };
    byModel.set(c.model, {
      n: e.n + 1,
      usd: e.usd + c.costUsd,
      in: e.in + c.inputTokens,
      out: e.out + c.outputTokens,
    });
  }

  const cached = l.calls.reduce((n, c) => n + c.cachedInputTokens, 0);
  const input = l.calls.reduce((n, c) => n + c.inputTokens, 0);
  const lines = [
    `run ${l.runId}: ${l.calls.length} calls, $${totalUsd(l).toFixed(4)} of $${l.ceilingUsd.toFixed(2)}`,
  ];
  for (const [model, e] of byModel) {
    lines.push(`  ${model.padEnd(28)} ${String(e.n).padStart(3)} calls  ${e.in}→${e.out} tok  $${e.usd.toFixed(4)}`);
  }
  if (input > 0) {
    lines.push(`  cache hit rate: ${((cached / input) * 100).toFixed(0)}% of input tokens`);
  }
  return lines.join("\n");
}
