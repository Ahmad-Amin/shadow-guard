import type { Match } from "../types";

interface SecretRule {
  label: string;
  regex: RegExp;
}

// Ordered by specificity. Provider-specific prefixes go first so they win
// over the generic high-entropy fallback further down. Where a prefix could
// be a substring of a broader one (e.g. Anthropic's "sk-ant-" vs OpenAI's
// "sk-"), the broader rule explicitly excludes it via a negative lookahead
// rather than relying on array order.
const SECRET_RULES: SecretRule[] = [
  // --- AI providers ---
  { label: "Anthropic API key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: "OpenAI API key", regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: "Google API key", regex: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  { label: "Hugging Face token", regex: /\bhf_[A-Za-z0-9]{20,}\b/g },

  // --- Payments ---
  { label: "Stripe live secret key", regex: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { label: "Stripe live publishable key", regex: /\bpk_live_[A-Za-z0-9]{16,}\b/g },
  { label: "Stripe restricted key", regex: /\brk_live_[A-Za-z0-9]{16,}\b/g },
  { label: "Square access token", regex: /\bsq0(?:atp|csp)-[A-Za-z0-9_-]{20,}\b/g },
  { label: "PayPal/Braintree access token", regex: /\baccess_token\$production\$[A-Za-z0-9]{16}\$[A-Za-z0-9]{32}\b/g },

  // --- Cloud providers ---
  { label: "AWS access key ID", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  {
    label: "AWS secret access key",
    regex: /\b(?:aws_secret_access_key|secret[_-]?access[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
  },
  { label: "Azure Storage account key", regex: /\bAccountKey=([A-Za-z0-9+/]{86}==)/g },
  {
    label: "Azure Storage connection string",
    regex: /\bDefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/]{86}==/g,
  },
  { label: "GCP service account private key", regex: /"private_key":\s*"(-----BEGIN PRIVATE KEY-----[^"]+)"/g },

  // --- Dev tooling / source control ---
  { label: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { label: "GitLab personal access token", regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { label: "npm access token", regex: /\bnpm_[A-Za-z0-9]{30,}\b/g },
  { label: "PyPI upload token", regex: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,}\b/g },

  // --- Messaging / comms ---
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "Slack webhook URL", regex: /\bhooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { label: "Discord bot token", regex: /\b[MNO][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}\b/g },
  { label: "Twilio Account SID", regex: /\bAC[a-f0-9]{32}\b/g },
  { label: "SendGrid API key", regex: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
  { label: "Mailgun API key", regex: /\bkey-[a-f0-9]{32}\b/g },

  // --- Generic / structural ---
  { label: "JSON Web Token (JWT)", regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    label: "Private key block",
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  {
    label: "Database connection string",
    regex: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi,
  },
  { label: "Bearer token", regex: /\bAuthorization:\s*Bearer\s+([A-Za-z0-9\-._~+/]{20,}=*)/gi },
  {
    label: "Generic password assignment",
    regex: /(?<![A-Za-z])(?:password|passwd|pwd)\s*[:=]\s*["']?([^"'\s]{6,})["']?/gi,
  },
  {
    label: "Generic API key/token assignment",
    regex:
      /(?<![A-Za-z])(?:api[_-]?key|api[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret|refresh[_-]?token)\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,})["']?/gi,
  },
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
