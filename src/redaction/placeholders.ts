import type { Category, Match, PlaceholderEntry } from "../types";

/**
 * Session-scoped, in-memory mapping between placeholder tokens and the
 * original sensitive values they replaced. Never persisted and never sent
 * anywhere — it lives only for the lifetime of the content script's page.
 */
export class PlaceholderSession {
  private counters: Partial<Record<Category, number>> = {};
  private byPlaceholder = new Map<string, PlaceholderEntry>();
  /** Reuse the same placeholder for a repeated identical value within a session. */
  private byOriginal = new Map<string, string>();

  /**
   * Redacts `text` in place of the given matches, returning the sanitized
   * string. Matches marked non-reversible (secrets/credentials) are always
   * stripped outright rather than mapped to a restorable placeholder.
   */
  redact(text: string, matches: Match[]): string {
    if (matches.length === 0) return text;

    // Apply from the end so earlier offsets stay valid as we splice.
    const ordered = [...matches].sort((a, b) => b.start - a.start);
    let result = text;

    for (const match of ordered) {
      const token = match.reversible ? this.placeholderFor(match) : this.stripToken(match);
      result = result.slice(0, match.start) + token + result.slice(match.end);
    }

    return result;
  }

  private placeholderFor(match: Match): string {
    const cacheKey = `${match.category}:${match.value}`;
    const existing = this.byOriginal.get(cacheKey);
    if (existing) return existing;

    const next = (this.counters[match.category] ?? 0) + 1;
    this.counters[match.category] = next;
    const placeholder = `[${match.category}_${next}]`;

    this.byPlaceholder.set(placeholder, {
      placeholder,
      original: match.value,
      category: match.category,
    });
    this.byOriginal.set(cacheKey, placeholder);
    return placeholder;
  }

  private stripToken(match: Match): string {
    return `[${match.category}_REMOVED]`;
  }

  /** Best-effort restoration of placeholder tokens found in AI response text. */
  restore(text: string): string {
    return this.restoreSegments(text)
      .map((seg) => ("original" in seg ? seg.original : seg.text))
      .join("");
  }

  /**
   * Same restoration as `restore()`, but split into ordered segments
   * instead of joined into one string, so a caller can tell which parts of
   * the result were substituted back in versus part of the AI's own text
   * (used to visually mark restored values in the response — see
   * responseRestorer.ts — rather than silently swapping them back in a way
   * indistinguishable from the AI having said them itself).
   */
  restoreSegments(text: string): ({ text: string } | { placeholder: string; original: string })[] {
    if (this.byPlaceholder.size === 0) return [{ text }];

    const pattern = [...this.byPlaceholder.keys()].map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "g");

    const segments: ({ text: string } | { placeholder: string; original: string })[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index) });
      const placeholder = m[0];
      const entry = this.byPlaceholder.get(placeholder);
      if (entry) segments.push({ placeholder, original: entry.original });
      lastIndex = m.index + placeholder.length;
    }
    if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
    return segments;
  }

  get mappingSize(): number {
    return this.byPlaceholder.size;
  }

  clear(): void {
    this.counters = {};
    this.byPlaceholder.clear();
    this.byOriginal.clear();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
