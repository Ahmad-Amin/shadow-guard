import { runDetection } from "../detectors";
import { PlaceholderSession } from "../redaction/placeholders";
import { getCachedSettings, recordActivity } from "../policy/storage";
import { getCachedEntitlement } from "../license/license";
import type { ActivityEvent, Category, DetectionResult, PolicyAction } from "../types";
import type { SiteAdapter } from "./adapters/types";
import { resolveEffectiveAction } from "./policyResolution";
import { suppressRestorationBriefly } from "./responseRestorer";
import { showReviewPanel } from "./ui/reviewPanel";
import { showToast } from "./ui/toast";

export function attachInterception(adapter: SiteAdapter, session: PlaceholderSession): () => void {
  let allowNextSubmit = false;
  let bypassTimer: ReturnType<typeof setTimeout> | null = null;

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const input = adapter.findInput();
    if (!input || !isEventWithin(e, input)) return;
    if (consumeBypass()) return;

    const outcome = evaluate(input);
    if (outcome === null) return; // nothing to flag — let the original event through untouched

    e.preventDefault();
    e.stopImmediatePropagation();
    handleInterception(input, outcome, () => {
      grantBypass(5000);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
  };

  const handleClick = (e: MouseEvent) => {
    const input = adapter.findInput();
    if (!input) return;
    const sendButton = adapter.findSendButton(input);
    if (!sendButton || !isEventWithin(e, sendButton)) return;
    if (consumeBypass()) return;

    const outcome = evaluate(input);
    if (outcome === null) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    handleInterception(input, outcome, () => {
      grantBypass(5000);
      sendButton.click();
    });
  };

  // Arms a one-shot bypass for the next Enter/Send attempt, auto-expiring
  // after `ttlMs` if never consumed. Used both for the immediate synthetic
  // re-dispatch after a WARN "Send Anyway" decision, and for the REDACT
  // toast's "Send anyway" action, where the user's *own* later keypress is
  // what actually submits — the TTL keeps a clicked-but-never-sent bypass
  // from silently waiving detection on unrelated text typed much later.
  function grantBypass(ttlMs: number): void {
    allowNextSubmit = true;
    if (bypassTimer) clearTimeout(bypassTimer);
    bypassTimer = setTimeout(() => {
      allowNextSubmit = false;
      bypassTimer = null;
    }, ttlMs);
  }

  function consumeBypass(): boolean {
    if (!allowNextSubmit) return false;
    allowNextSubmit = false;
    if (bypassTimer) {
      clearTimeout(bypassTimer);
      bypassTimer = null;
    }
    return true;
  }

  // Only preventDefault()/stopImmediatePropagation() the submit event when
  // there's actually something to flag — most prompts have nothing
  // sensitive in them, and letting those go through as the original,
  // untouched, real trusted event (rather than always intercepting and
  // conditionally replaying via a synthetic re-dispatch) is simpler and
  // more robust than relying on the bypass/re-dispatch mechanism for the
  // common case. That mechanism is still needed, but now only for the much
  // rarer WARN → "Send Anyway" path.
  function evaluate(input: HTMLElement): { text: string; effectiveAction: PolicyAction; detection: DetectionResult } | null {
    const text = adapter.getText(input);
    if (!text.trim()) return null;

    // Trial expired and no license activated: protection pauses (fails
    // open) rather than silently blocking someone who hasn't paid — the
    // popup/options surface the "activate to resume" prompt instead.
    if (getCachedEntitlement().status === "expired") return null;

    const settings = getCachedSettings();
    const detection = runDetection(text, settings.customTerms);
    if (detection.matches.length === 0) {
      // Nothing new to flag — but if this text still carries placeholders
      // from an earlier redaction in this session (the normal case right
      // after a REDACT round-trip: the user re-presses Enter on the
      // now-clean, placeholder-containing draft), it's about to be sent
      // untouched. The instant it renders as this tab's own message
      // bubble, watchForResponseRestoration would otherwise "restore" it
      // back to the real value in the transcript — see responseRestorer.ts.
      if (session.restore(text) !== text) suppressRestorationBriefly(1200);
      return null;
    }

    const effectiveAction = resolveEffectiveAction(detection, settings.policy);
    if (effectiveAction === "ALLOW") return null;

    return { text, effectiveAction, detection };
  }

  function handleInterception(
    input: HTMLElement,
    { text, effectiveAction, detection }: { text: string; effectiveAction: PolicyAction; detection: DetectionResult },
    proceed: () => void
  ): void {
    const categories = detection.matches.map((m) => m.category);

    if (effectiveAction === "REDACT") {
      // Auto-redact immediately, in place — no confirmation click, no
      // reload. Never auto-submits: the user reviews the now-redacted
      // draft and presses Enter/Send themselves, at which point detection
      // finds nothing left to flag and it goes through normally (via the
      // untouched-real-event path above, not a re-dispatch).
      const redacted = session.redact(text, detection.matches);
      adapter.setText(input, redacted);
      showToast(
        `Redacted ${detection.matches.length} item${detection.matches.length === 1 ? "" : "s"} (${describeCategories(
          categories
        )}). Review your draft, then send it yourself.`,
        {
          label: "Send anyway",
          onClick: () => {
            // Restore the original (unredacted) text and arm a one-shot
            // bypass so the user's own next Enter/Send goes through
            // untouched — it does NOT auto-submit for them, matching
            // REDACT's "never auto-submit" rule.
            adapter.setText(input, text);
            grantBypass(15000);
            showToast("Original text restored — press Enter/Send within 15s to submit it as-is.", 4000);
            void logActivity(adapter, categories, effectiveAction, true);
          },
        }
      );
      void logActivity(adapter, categories, effectiveAction, false);
      return;
    }

    // WARN or BLOCK: neither ever rewrites the DOM (WARN's choices are
    // Send Anyway / Cancel; BLOCK only offers Cancel), so the review panel
    // is safe to use here.
    void (async () => {
      const decision = await showReviewPanel({
        siteName: adapter.displayName,
        matches: detection.matches,
        effectiveAction,
      });

      await logActivity(adapter, categories, effectiveAction, decision === "send_anyway");

      if (decision === "send_anyway") {
        proceed();
      }
    })();
  }

  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("click", handleClick, true);

  return () => {
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("click", handleClick, true);
  };
}

function isEventWithin(e: Event, el: HTMLElement): boolean {
  return e.target instanceof Node && el.contains(e.target);
}

function describeCategories(categories: Category[]): string {
  return Array.from(new Set(categories))
    .map((c) => c.toLowerCase().replace(/_/g, " "))
    .join(", ");
}

async function logActivity(
  adapter: SiteAdapter,
  categories: Category[],
  action: ActivityEvent["action"],
  overridden: boolean
): Promise<void> {
  const event: ActivityEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    site: adapter.displayName,
    categories: Array.from(new Set(categories)),
    action,
    overridden,
  };
  await recordActivity(event);
}
