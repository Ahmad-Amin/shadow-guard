import { chatGptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { geminiAdapter } from "./gemini";
import { createGenericAdapter } from "./genericAdapter";
import type { SiteAdapter } from "./types";

// These use the heuristic generic adapter rather than hand-verified
// selectors (see genericAdapter.ts) — broad coverage now, can be upgraded
// to bespoke adapters later if a site's composer proves hard to detect.
const ADAPTERS: SiteAdapter[] = [
  chatGptAdapter,
  claudeAdapter,
  geminiAdapter,
  createGenericAdapter("perplexity", "Perplexity", ["www.perplexity.ai", "perplexity.ai"]),
  createGenericAdapter("copilot", "Microsoft Copilot", ["copilot.microsoft.com"]),
  createGenericAdapter("meta-ai", "Meta AI", ["www.meta.ai", "meta.ai"]),
  createGenericAdapter("grok", "Grok", ["grok.com"]),
  createGenericAdapter("deepseek", "DeepSeek", ["chat.deepseek.com"]),
  createGenericAdapter("mistral", "Mistral Le Chat", ["chat.mistral.ai"]),
  createGenericAdapter("poe", "Poe", ["poe.com"]),
];

export function resolveAdapter(hostname: string): SiteAdapter | null {
  return ADAPTERS.find((adapter) => adapter.matchesHost(hostname)) ?? null;
}

export type { SiteAdapter };
