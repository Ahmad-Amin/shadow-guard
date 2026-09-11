import { chatGptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { geminiAdapter } from "./gemini";
import type { SiteAdapter } from "./types";

const ADAPTERS: SiteAdapter[] = [chatGptAdapter, claudeAdapter, geminiAdapter];

export function resolveAdapter(hostname: string): SiteAdapter | null {
  return ADAPTERS.find((adapter) => adapter.matchesHost(hostname)) ?? null;
}

export type { SiteAdapter };
