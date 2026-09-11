import type { CustomTerm, DetectionResult, Match, Severity } from "../types";
import { detectCustomTerms } from "./custom";
import { detectPii } from "./pii";
import { detectSecrets } from "./secrets";

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0,
};

export function runDetection(text: string, customTerms: CustomTerm[]): DetectionResult {
  if (!text.trim()) return { matches: [], highestSeverity: null };

  // Secrets take priority over PII when spans overlap (e.g. a token that
  // also looks like it contains digits a PII rule might flag).
  const secretMatches = detectSecrets(text);
  const occupied = secretMatches.map((m) => [m.start, m.end] as const);

  const piiMatches = detectPii(text).filter((m) => !overlapsAny(m, occupied));
  const customMatches = detectCustomTerms(text, customTerms).filter(
    (m) => !overlapsAny(m, occupied)
  );

  const matches = [...secretMatches, ...piiMatches, ...customMatches].sort(
    (a, b) => a.start - b.start
  );

  const highestSeverity = matches.reduce<Severity | null>((highest, m) => {
    if (!highest || SEVERITY_RANK[m.severity] > SEVERITY_RANK[highest]) return m.severity;
    return highest;
  }, null);

  return { matches, highestSeverity };
}

function overlapsAny(match: Match, spans: readonly (readonly [number, number])[]): boolean {
  return spans.some(([start, end]) => match.start < end && match.end > start);
}
