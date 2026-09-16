import type { PlaceholderSession } from "../redaction/placeholders";
import type { SiteAdapter } from "./adapters/types";

/**
 * Best-effort restoration: watches the AI response area for new text and
 * swaps any placeholder tokens (e.g. "[EMAIL_1]") back to their original
 * values, purely client-side. If a site's response DOM structure doesn't
 * match `findResponseContainer`, this degrades to a no-op rather than
 * corrupting the page.
 *
 * The response container selectors are broad (e.g. "main") and can end up
 * containing the prompt editor itself, not just past responses. Without
 * excluding the editor, this observer would "restore" our own redaction
 * placeholders back to their original values the instant we write them —
 * which is exactly what was happening; see README's "Known limitations"
 * for how this was finally tracked down after a lot of red herrings.
 */
export function watchForResponseRestoration(
  adapter: SiteAdapter,
  session: PlaceholderSession
): () => void {
  let container: HTMLElement | null = null;

  const observer = new MutationObserver(() => {
    if (session.mappingSize === 0) return;
    if (Date.now() < suppressUntil) return;
    if (!container || !container.isConnected) {
      container = adapter.findResponseContainer();
    }
    if (!container) return;
    restorePlaceholdersInSubtree(container, session, adapter.findInput());
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

let suppressUntil = 0;

/**
 * `findResponseContainer()` is broad by necessity (see doc comment above)
 * and typically wraps the *entire* conversation area, not just the AI's
 * turns — there's no reliable, site-agnostic way to tell "the assistant's
 * message" apart from "the message I just sent" once it leaves the
 * composer and renders as a transcript bubble. Without this, the instant a
 * redacted message you send renders in the transcript, this same
 * restoration logic "fixes" it back to the real value — which looks like
 * ShadowGuard failed, even though the actual network request already went
 * out with the redacted text moments earlier (this only ever touches the
 * local DOM, after the fact).
 *
 * Call this right when a message containing live placeholders is about to
 * be sent. Your own message bubble renders essentially instantly; any real
 * AI response has an inherent minimum round-trip delay, so a short
 * suppression window reliably skips your own bubble without meaningfully
 * delaying restoration in the assistant's actual reply.
 */
export function suppressRestorationBriefly(ms: number): void {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms);
}

// A silent text swap makes a restored value look exactly like something
// the AI actually said, which is misleading — the AI never saw it. Marking
// it visually (and via a tooltip) makes clear it was substituted back in
// locally, purely for readability, without weakening the actual guarantee
// that the real value was never sent.
const RESTORED_TITLE = "Restored locally for your reference — never sent to the AI.";

function restorePlaceholdersInSubtree(
  root: HTMLElement,
  session: PlaceholderSession,
  excludeInput: HTMLElement | null
): void {
  // Collect first, mutate after: replacing a text node with multiple nodes
  // mid-walk would leave the TreeWalker's traversal in an undefined state.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    if (!excludeInput?.contains(node) && node.textContent?.includes("[")) {
      candidates.push(node as Text);
    }
    node = walker.nextNode();
  }

  for (const textNode of candidates) {
    const text = textNode.textContent ?? "";
    const segments = session.restoreSegments(text);
    const first = segments[0];
    if (segments.length === 1 && first && "text" in first) continue; // no known placeholder in this node

    const replacement = segments.map((seg) =>
      "original" in seg ? buildRestoredValueMarker(seg.original) : document.createTextNode(seg.text)
    );
    textNode.replaceWith(...replacement);
  }
}

function buildRestoredValueMarker(original: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = original;
  span.title = RESTORED_TITLE;
  span.style.borderBottom = "1px dotted #3a86ff";
  span.style.backgroundColor = "rgba(58, 134, 255, 0.12)";
  span.style.borderRadius = "3px";
  span.style.padding = "0 2px";
  span.style.cursor = "help";
  return span;
}
