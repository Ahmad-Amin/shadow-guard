import type { SiteAdapter } from "./adapters/types";

const RECHECK_DEBOUNCE_MS = 500;
const FALLBACK_POLL_MS = 3000;

export interface ProtectionStatusMessage {
  type: "shadowguard:protection-status";
  isProtected: boolean;
  siteName: string;
}

/**
 * Keeps the toolbar badge honest for the life of the tab. A one-time check
 * at page load isn't enough: these are all SPAs where the composer can
 * mount well after `document_idle` (auth/loading screens), or disappear and
 * reappear as the user navigates client-side (e.g. a "new chat" landing
 * view vs. an actual conversation) without the content script ever
 * reloading. So this re-checks on every relevant DOM mutation (debounced)
 * plus a slow fallback poll for the rare mutation we didn't catch, and only
 * messages the background when the status actually flips.
 */
export function watchProtectionStatus(adapter: SiteAdapter): () => void {
  let lastReported: boolean | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function reportStatus(): void {
    const isProtected = adapter.findInput() !== null;
    if (isProtected === lastReported) return;
    lastReported = isProtected;

    const message: ProtectionStatusMessage = {
      type: "shadowguard:protection-status",
      isProtected,
      siteName: adapter.displayName,
    };
    chrome.runtime.sendMessage(message).catch(() => {
      // Service worker may be mid-restart — the next status flip (or the
      // fallback poll re-sending the same value after a DOM change) will
      // retry; nothing actionable to do here.
    });
  }

  function scheduleCheck(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reportStatus, RECHECK_DEBOUNCE_MS);
  }

  reportStatus();

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true });
  const interval = setInterval(reportStatus, FALLBACK_POLL_MS);

  return () => {
    observer.disconnect();
    clearInterval(interval);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
