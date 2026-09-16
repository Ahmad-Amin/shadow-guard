import type { Match } from "../types";

const CANDIDATE_TOKEN = /\b[A-Za-z0-9+/_=-]{24,}\b/g;
// Calibrated empirically against realistic false-positive candidates
// (camelCase/PascalCase identifiers, snake_case constants, file paths,
// git branch names, plain English sentences with no spaces) and realistic
// secret shapes (hex/base64/base62-style random tokens). Entropy alone
// doesn't separate them cleanly — "TheQuickBrownFoxJumpsOverTheLazyDog"
// scores *higher* (4.63 bits/char) than a realistic Stripe-style key
// "pk_7f8a9b2c..." (4.13). Digit density is what actually distinguishes
// them: every English-identifier test case had 0% digits, while every
// realistic secret shape had double digits or more.
const MIN_ENTROPY_BITS_PER_CHAR = 3.8;
const MIN_DIGIT_RATIO = 0.08;
// Pure hex (any case, ignoring hyphens) is overwhelmingly UUIDs, git SHAs,
// and hash digests in real pasted text — technically high-entropy, but
// rarely an actual credential. Hyphens are stripped before this check
// because a canonical hyphenated UUID (the form people actually paste,
// e.g. "f47ac10b-58cc-...") would otherwise inconsistently slip past this
// exclusion purely from incidental entropy variance between individual
// UUIDs — confirmed directly: one real UUID landed at 3.88 bits/char
// (above the threshold) while two others landed at 3.4-3.7 (below it),
// even though none of them should ever be flagged. Excluding it removes
// the single biggest source of noise without meaningfully weakening
// coverage, since real API keys/tokens are almost always mixed
// alphanumeric (often with -, _, +, /, =), not plain hex.
const PURE_HEX = /^[0-9a-fA-F]+$/;

function isPureHexIgnoringHyphens(value: string): boolean {
  return PURE_HEX.test(value.replace(/-/g, ""));
}

function shannonEntropy(value: string): number {
  const freq = new Map<string, number>();
  for (const ch of value) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function digitRatio(value: string): number {
  const digits = value.match(/[0-9]/g)?.length ?? 0;
  return digits / value.length;
}

/**
 * Catches secrets that don't match any known provider's format — the
 * complement to secrets.ts's named-pattern rules, which can only ever
 * recognize formats we already know about. A random-looking opaque token
 * (high character-level entropy, not just "long") is a strong generic
 * signal for "this is a credential", regardless of which service issued it
 * or whether we've ever written a rule for that service's format.
 *
 * Deliberately lower-confidence than a named-pattern match: this produces
 * POSSIBLE_SECRET (WARN by default), not SECRET (BLOCK by default) — see
 * defaultPolicy.ts. A heuristic guess should never fully block a message
 * the way a confirmed Stripe/AWS key format does.
 */
export function detectPossibleSecrets(text: string, occupied: readonly (readonly [number, number])[]): Match[] {
  const matches: Match[] = [];
  CANDIDATE_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CANDIDATE_TOKEN.exec(text)) !== null) {
    const value = m[0];
    const start = m.index;
    const end = start + value.length;

    const alreadyCaught = occupied.some(([s, e]) => start < e && end > s);
    const looksRandom =
      !isPureHexIgnoringHyphens(value) &&
      shannonEntropy(value) >= MIN_ENTROPY_BITS_PER_CHAR &&
      digitRatio(value) >= MIN_DIGIT_RATIO;
    if (!alreadyCaught && looksRandom) {
      matches.push({
        category: "POSSIBLE_SECRET",
        severity: "MEDIUM",
        label: "High-entropy string (possible credential)",
        value,
        start,
        end,
        reversible: false,
      });
    }
  }
  return matches;
}
