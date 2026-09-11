import { runDetection } from "../detectors";
import { PlaceholderSession } from "../redaction/placeholders";
import { getSettings, recordActivity } from "../policy/storage";
import type { ActivityEvent, Category } from "../types";
import type { SiteAdapter } from "./adapters/types";
import { resolveEffectiveAction } from "./policyResolution";
import { showReviewPanel } from "./ui/reviewPanel";

export function attachInterception(adapter: SiteAdapter, session: PlaceholderSession): () => void {
  let allowNextSubmit = false;
  let processing = false;

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const input = adapter.findInput();
    if (!input || !isEventWithin(e, input)) return;
    if (consumeBypass()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    void handleSubmitAttempt(input, () => {
      allowNextSubmit = true;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
  };

  const handleClick = (e: MouseEvent) => {
    const input = adapter.findInput();
    if (!input) return;
    const sendButton = adapter.findSendButton(input);
    if (!sendButton || !isEventWithin(e, sendButton)) return;
    if (consumeBypass()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    void handleSubmitAttempt(input, () => {
      allowNextSubmit = true;
      sendButton.click();
    });
  };

  function consumeBypass(): boolean {
    if (!allowNextSubmit) return false;
    allowNextSubmit = false;
    return true;
  }

  async function handleSubmitAttempt(input: HTMLElement, proceed: () => void): Promise<void> {
    if (processing) return; // a review panel is already open for this input
    processing = true;
    try {
      const text = adapter.getText(input);
      if (!text.trim()) {
        proceed();
        return;
      }

      const settings = await getSettings();
      const detection = runDetection(text, settings.customTerms);
      if (detection.matches.length === 0) {
        proceed();
        return;
      }

      const effectiveAction = resolveEffectiveAction(detection, settings.policy);
      if (effectiveAction === "ALLOW") {
        proceed();
        return;
      }

      const decision = await showReviewPanel({
        siteName: adapter.displayName,
        matches: detection.matches,
        effectiveAction,
      });

      await logActivity(adapter, detection.matches.map((m) => m.category), effectiveAction, decision === "send_anyway");

      if (decision === "cancel") return;
      if (decision === "send_anyway") {
        proceed();
        return;
      }

      // decision === "redact"
      const redacted = session.redact(text, detection.matches);
      adapter.setText(input, redacted);
      proceed();
    } finally {
      processing = false;
    }
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
