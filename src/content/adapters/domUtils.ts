/**
 * All three supported sites render their prompt box as a rich
 * contenteditable element backed by React state, not a plain <textarea>.
 * Setting `.textContent` directly leaves React's internal state stale, so we
 * go through `document.execCommand("insertText")`, which dispatches the same
 * native `input` events React listens for. A raw <textarea>/<input> fallback
 * is included for resilience if a site changes its markup.
 */

export function querySelectorFirst(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

export function getElementText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  return el.innerText;
}

export function setElementText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setNativeInputValue(el, text);
    return;
  }
  setContentEditableText(el, text);
}

function setNativeInputValue(el: HTMLTextAreaElement | HTMLInputElement, text: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function setContentEditableText(el: HTMLElement, text: string): void {
  el.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    // execCommand can be unavailable/deprecated in some contexts; fall back
    // to a manual DOM write plus a synthetic input event.
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
  }
}
