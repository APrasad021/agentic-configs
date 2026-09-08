/**
 * Eval runner — deliberately ~100 lines.
 *
 * STATUS: draft. The graders below cover the deterministic cases in
 * evals/cases/. Extend `GRADERS` rather than reaching for a framework; the
 * value here is in the cases, not the harness.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { complete } from "../src/ai/gateway.js";
import { loadPrompt, render } from "../src/ai/prompts.js";

interface Case {
  id: string;
  prompt: string;
  inputs: Record<string, string>;
  graders: Array<Record<string, unknown>>;
  note?: string;
}

type Grader = (output: string, spec: Record<string, any>) => string | null;

/** Each grader returns null on pass, or a reason string on failure. */
const GRADERS: Record<string, Grader> = {
  contains: (out, s) => (out.includes(s.value) ? null : `missing ${JSON.stringify(s.value)}`),
  contains_any: (out, s) =>
    s.values.some((v: string) => out.toLowerCase().includes(v.toLowerCase()))
      ? null
      : `none of ${JSON.stringify(s.values)} present`,
  not_contains: (out, s) => {
    const hit = s.values.find((v: string) => out.includes(v));
    return hit ? `must not contain ${JSON.stringify(hit)}` : null;
  },
  regex: (out, s) => (new RegExp(s.value, s.flags ?? "").test(out) ? null : `no match for /${s.value}/`),
  max_bullets: (out, s) => {
    const n = out.split("\n").filter((l) => /^\s*[-*•]/.test(l)).length;
    return n <= s.value ? null : `${n} bullets, max ${s.value}`;
  },
  json_valid: (out) => {
    try { JSON.parse(out); return null; } catch (e) { return `invalid JSON: ${(e as Error).message}`; }
  },
};

function loadCases(dir = "evals/cases"): Case[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) =>
      readFileSync(join(dir, f), "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Case),
    );
}

async function main() {
  const cases = loadCases();
  const results: Array<{ id: string; pass: boolean; failures: string[]; costUsd: number }> = [];
  let totalCost = 0;

  for (const c of cases) {
    const p = loadPrompt(c.prompt);
    const r = await complete({
      model: p.model,
      // Evals pin temperature to 0 so a failure means the prompt changed, not
      // that you drew a different sample. Non-zero temperature turns a
      // regression suite into a coin flip.
      temperature: 0,
      maxOutputTokens: p.maxOutputTokens,
      messages: [{ role: "user", content: render(p, c.inputs) }],
    });
    totalCost += r.costUsd;

    const failures = c.graders
      .map((g) => {
        const grader = GRADERS[g.type as string];
        if (!grader) return `unknown grader '${g.type}'`;
        return grader(r.text, g);
      })
      .filter((x): x is string => x !== null);

    results.push({ id: c.id, pass: failures.length === 0, failures, costUsd: r.costUsd });
    console.log(`${failures.length === 0 ? "✓" : "✗"} ${c.id}${failures.length ? ` — ${failures.join("; ")}` : ""}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed · $${totalCost.toFixed(4)}`);

  mkdirSync("evals/results", { recursive: true });
  writeFileSync(
    `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    JSON.stringify({ passed, total: results.length, totalCost, results }, null, 2),
  );

  // Non-zero exit so `make eval` gates a merge.
  if (passed < results.length) process.exit(1);
}

main();
