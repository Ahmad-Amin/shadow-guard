import type { CustomTerm, Match } from "../types";

export function detectCustomTerms(text: string, terms: CustomTerm[]): Match[] {
  const matches: Match[] = [];

  for (const term of terms) {
    let regex: RegExp;
    try {
      regex = term.isRegex
        ? new RegExp(term.pattern, "gi")
        : new RegExp(escapeRegExp(term.pattern), "gi");
    } catch {
      continue; // invalid user-supplied regex; skip rather than break detection
    }

    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({
        category: "CUSTOM",
        severity: "HIGH",
        label: term.label || "Protected term",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        reversible: true,
      });
    }
  }

  return matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
