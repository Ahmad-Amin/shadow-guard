import type { Category, Match, Severity } from "../types";

interface PiiRule {
  category: Category;
  severity: Severity;
  label: string;
  regex: RegExp;
  reversible: boolean;
  /** Optional extra validation (e.g. Luhn check) beyond the regex shape. */
  validate?: (value: string) => boolean;
  /**
   * Some raw value shapes (a bare 9-digit number, a bare street-looking
   * string) are too ambiguous to flag on their own. When set, a match is
   * only kept if this keyword pattern appears within `contextWindow`
   * characters of the match (checked on both sides), anchoring the
   * detection to an actual mention like "passport number" or "DOB".
   */
  contextKeywords?: RegExp;
  contextWindow?: number;
}

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
/** Private/RFC1918 + loopback ranges only — public IPs are routinely shared harmlessly and would be too noisy to flag. */
const PRIVATE_IPV4_SOURCE =
  `\\b(?:` +
  `10\\.${OCTET}\\.${OCTET}\\.${OCTET}` +
  `|172\\.(?:1[6-9]|2\\d|3[0-1])\\.${OCTET}\\.${OCTET}` +
  `|192\\.168\\.${OCTET}\\.${OCTET}` +
  `|127\\.${OCTET}\\.${OCTET}\\.${OCTET}` +
  `)\\b`;

const MONTH_NAME = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*";

const PII_RULES: PiiRule[] = [
  {
    category: "EMAIL",
    severity: "MEDIUM",
    label: "Email address",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    reversible: true,
  },
  {
    category: "PHONE",
    severity: "MEDIUM",
    label: "Phone number",
    regex: /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{2,4}\b/g,
    reversible: true,
  },
  {
    category: "SSN",
    severity: "HIGH",
    label: "US Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    reversible: true,
  },
  {
    category: "CREDIT_CARD",
    severity: "HIGH",
    label: "Credit card number",
    regex: /\b(?:\d[ -]?){13,16}\b/g,
    reversible: true,
    validate: isLuhnValid,
  },
  {
    category: "IBAN",
    severity: "HIGH",
    label: "IBAN",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
    reversible: true,
    validate: isIbanValid,
  },
  {
    category: "BANK_ACCOUNT",
    severity: "HIGH",
    label: "Bank account / routing number",
    regex: /\b\d{8,17}\b/g,
    reversible: true,
    validate: isBankAccountOrRoutingValid,
    contextKeywords: /\b(?:account|acct\.?|routing|aba)\s*(?:number|no\.?|num\.?|#)?\b/i,
    contextWindow: 30,
  },
  {
    category: "PASSPORT",
    severity: "HIGH",
    label: "Passport number",
    regex: /\b[A-Za-z]{0,2}\d{6,9}\b/g,
    reversible: true,
    contextKeywords: /\bpassport\b/i,
    contextWindow: 30,
  },
  {
    category: "DOB",
    severity: "HIGH",
    label: "Date of birth",
    regex: new RegExp(
      `\\b(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|${MONTH_NAME}\\.?\\s+\\d{1,2},?\\s+\\d{4})\\b`,
      "g"
    ),
    reversible: true,
    contextKeywords: /\b(?:dob|date of birth|birth\s?date|born on|birthday)\b/i,
    contextWindow: 30,
  },
  {
    category: "ADDRESS",
    severity: "MEDIUM",
    label: "Street address",
    regex:
      /\b\d{1,6}[A-Za-z]?\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Way|Place|Pl|Square|Sq|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Highway|Hwy)\.?\b(?:,?\s+(?:Apt|Suite|Ste|Unit|#)\.?\s*[\w-]+)?/gi,
    reversible: true,
  },
  {
    category: "IP_ADDRESS",
    severity: "MEDIUM",
    label: "Private IP address",
    regex: new RegExp(PRIVATE_IPV4_SOURCE, "g"),
    reversible: true,
  },
];

export function detectPii(text: string): Match[] {
  const matches: Match[] = [];

  for (const rule of PII_RULES) {
    rule.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(text)) !== null) {
      const value = m[0];
      if (rule.validate && !rule.validate(value)) continue;
      if (rule.contextKeywords && !hasNearbyContext(text, m.index, value.length, rule.contextKeywords, rule.contextWindow ?? 30)) {
        continue;
      }
      matches.push({
        category: rule.category,
        severity: rule.severity,
        label: rule.label,
        value,
        start: m.index,
        end: m.index + value.length,
        reversible: rule.reversible,
      });
      if (value.length === 0) rule.regex.lastIndex++;
    }
  }

  return dedupeOverlaps(matches);
}

function hasNearbyContext(text: string, start: number, length: number, keywords: RegExp, window: number): boolean {
  const before = text.slice(Math.max(0, start - window), start);
  const after = text.slice(start + length, Math.min(text.length, start + length + window));
  keywords.lastIndex = 0;
  return keywords.test(before) || keywords.test(after);
}

function isLuhnValid(value: string): boolean {
  const digits = value.replace(/[ -]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/** ISO 7064 MOD97-10, the IBAN check-digit algorithm: move the first 4 characters to the end, convert letters to numbers (A=10 .. Z=35), and the result must be ≡ 1 mod 97. Computed digit-by-digit since the numeric string can be far too long for JS's number precision. */
function isIbanValid(value: string): boolean {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);

  let remainder = 0;
  for (const ch of rearranged) {
    const numeric = ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * US ABA routing numbers (always exactly 9 digits) carry a checksum:
 * 3×(d1+d4+d7) + 7×(d2+d5+d8) + 1×(d3+d6+d9) ≡ 0 mod 10. General bank
 * account numbers have no universal checksum (format varies per bank), so
 * anything not 9 digits is left to the context-keyword requirement alone.
 */
function isBankAccountOrRoutingValid(value: string): boolean {
  if (value.length !== 9) return true;
  const d = (i: number) => Number(value[i] ?? "0");
  const sum = 3 * (d(0) + d(3) + d(6)) + 7 * (d(1) + d(4) + d(7)) + 1 * (d(2) + d(5) + d(8));
  return sum % 10 === 0;
}

/** Several rules can match overlapping spans (e.g. a bare digit run could satisfy both BANK_ACCOUNT and PASSPORT context). Keep the highest-severity, then longest, match per span. */
function dedupeOverlaps(matches: Match[]): Match[] {
  const rank: Record<Severity, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  const sorted = [...matches].sort(
    (a, b) => rank[b.severity] - rank[a.severity] || b.end - b.start - (a.end - a.start) || a.start - b.start
  );
  const result: Match[] = [];
  const occupied: Array<readonly [number, number]> = [];
  for (const match of sorted) {
    if (occupied.some(([s, e]) => match.start < e && match.end > s)) continue;
    occupied.push([match.start, match.end]);
    result.push(match);
  }
  return result.sort((a, b) => a.start - b.start);
}
