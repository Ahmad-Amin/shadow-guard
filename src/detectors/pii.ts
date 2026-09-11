import type { Category, Match, Severity } from "../types";

interface PiiRule {
  category: Category;
  severity: Severity;
  label: string;
  regex: RegExp;
  reversible: boolean;
  /** Optional extra validation (e.g. Luhn check) beyond the regex shape. */
  validate?: (value: string) => boolean;
}

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
    regex: /\b(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
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
      matches.push({
        category: rule.category,
        severity: rule.severity,
        label: rule.label,
        value,
        start: m.index,
        end: m.index + value.length,
        reversible: rule.reversible,
      });
    }
  }

  return matches;
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
