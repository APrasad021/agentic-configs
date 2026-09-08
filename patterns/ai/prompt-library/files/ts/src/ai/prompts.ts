/**
 * Load prompts from prompts/*.md by id.
 *
 * A prompt is a file, not a string literal, because a prompt is behaviour.
 * Files get diffs, review, blame and history; a template literal buried in a
 * service method gets none of those, and "which change made the output worse"
 * becomes unanswerable.
 *
 * Front-matter carries the settings the prompt was tuned with, so the model
 * and temperature travel with the text instead of being re-guessed per call site.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface PromptMeta {
  id: string;
  version: number;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  description?: string;
  inputs?: string[];
}

export interface Prompt extends PromptMeta {
  template: string;
}

const PROMPT_DIR = process.env.PROMPT_DIR ?? "prompts";
const cache = new Map<string, Prompt>();

/** Minimal front-matter reader: scalars and flat string lists, nothing more. */
function parseFrontMatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };

  const meta: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (!kv) continue; // nested keys (changelog) are documentation, not config
    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    if (!value) continue;
    if (value.startsWith("[")) {
      meta[key] = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      meta[key] = Number(value);
    } else {
      meta[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body: m[2] };
}

export function loadPrompt(id: string): Prompt {
  const cached = cache.get(id);
  if (cached && process.env.NODE_ENV === "production") return cached;

  const file = readdirSync(PROMPT_DIR).find(
    (f) => f.endsWith(".md") && (f === `${id}.md` || f.endsWith(`.${id}.md`)),
  );
  if (!file) throw new Error(`No prompt '${id}' in ${PROMPT_DIR}/`);

  const { meta, body } = parseFrontMatter(readFileSync(join(PROMPT_DIR, file), "utf8"));
  const prompt: Prompt = { id, version: 1, ...(meta as object), template: body.trim() } as Prompt;
  cache.set(id, prompt);
  return prompt;
}

/**
 * Fill {{placeholders}}. Throws on a missing input rather than rendering
 * "{{document}}" into the prompt, which the model will cheerfully answer
 * about — producing a plausible response to a broken request.
 */
export function render(prompt: Prompt, inputs: Record<string, string>): string {
  return prompt.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in inputs)) {
      throw new Error(
        `Prompt '${prompt.id}' needs input '${key}'. Given: ${Object.keys(inputs).join(", ") || "none"}`,
      );
    }
    return inputs[key];
  });
}
