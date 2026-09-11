import type { Match } from "../types";

interface SecretRule {
  label: string;
  regex: RegExp;
}

// Ordered by specificity. Provider-specific prefixes go first so they win
// over the generic high-entropy fallback further down.
const SECRET_RULES: SecretRule[] = [
  { label: "OpenAI API key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "Stripe live secret key", regex: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { label: "Stripe live publishable key", regex: /\bpk_live_[A-Za-z0-9]{16,}\b/g },
  { label: "AWS access key ID", regex: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { label: "AWS secret access key", regex: /\b(?:aws_secret_access_key|secret[_-]?access[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi },
  { label: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "Google API key", regex: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  { label: "JSON Web Token (JWT)", regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\b/g },
  { label: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { label: "Database connection string", regex: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi },
  { label: "Generic password assignment", regex: /\b(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{6,})["']/gi },
  { label: "Generic API key/token assignment", regex: /\b(?:api[_-]?key|api[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret)\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,})["']?/gi },
];

export function detectSecrets(text: string): Match[] {
  const matches: Match[] = [];

  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(text)) !== null) {
      // Prefer a captured credential value over the whole assignment when present.
      const value = m[1] ?? m[0];
      const start = m[1] ? m[0].indexOf(m[1]) + m.index : m.index;
      matches.push({
        category: "SECRET",
        severity: "CRITICAL",
        label: rule.label,
        value,
        start,
        end: start + value.length,
        reversible: false,
      });
      if (m[0].length === 0) rule.regex.lastIndex++;
    }
  }

  return dedupeOverlaps(matches);
}

/** When multiple rules match overlapping spans, keep only the longest match per span. */
function dedupeOverlaps(matches: Match[]): Match[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: Match[] = [];
  let lastEnd = -1;
  for (const match of sorted) {
    if (match.start >= lastEnd) {
      result.push(match);
      lastEnd = match.end;
    }
  }
  return result;
}
