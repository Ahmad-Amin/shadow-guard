import type { PlaceholderSession } from "../redaction/placeholders";
import type { SiteAdapter } from "./adapters/types";

/**
 * Best-effort restoration: watches the AI response area for new text and
 * swaps any placeholder tokens (e.g. "[EMAIL_1]") back to their original
 * values, purely client-side. If a site's response DOM structure doesn't
 * match `findResponseContainer`, this degrades to a no-op rather than
 * corrupting the page.
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
    restorePlaceholdersInSubtree(container, session);
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

function restorePlaceholdersInSubtree(root: HTMLElement, session: PlaceholderSession): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent;
    if (text && text.includes("[")) {
      const restored = session.restore(text);
      if (restored !== text) node.textContent = restored;
    }
    node = walker.nextNode();
  }
}
