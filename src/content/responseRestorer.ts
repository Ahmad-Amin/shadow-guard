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
    if (!container || !container.isConnected) {
      container = adapter.findResponseContainer();
    }
    if (!container) return;
    restorePlaceholdersInSubtree(container, session, adapter.findInput());
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

function restorePlaceholdersInSubtree(
  root: HTMLElement,
  session: PlaceholderSession,
  excludeInput: HTMLElement | null
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    if (excludeInput?.contains(node)) {
      node = walker.nextNode();
      continue;
    }
    const text = node.textContent;
    if (text && text.includes("[")) {
      const restored = session.restore(text);
      if (restored !== text) node.textContent = restored;
    }
    node = walker.nextNode();
  }
}
