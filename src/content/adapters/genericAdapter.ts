import { getElementText, setElementText } from "./domUtils";
import type { SiteAdapter } from "./types";

const EDITABLE_SELECTOR = "textarea, [contenteditable='true']";
const MIN_HEIGHT_PX = 24;
const MIN_WIDTH_PX = 80;
const SEND_BUTTON_SELECTOR = 'button[aria-label*="send" i], button[data-testid*="send" i]';

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isUsableComposer(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const editable = el instanceof HTMLTextAreaElement ? !el.disabled && !el.readOnly : el.isContentEditable;
  if (!editable || !isVisible(el)) return false;
  const rect = el.getBoundingClientRect();
  return rect.height >= MIN_HEIGHT_PX && rect.width >= MIN_WIDTH_PX;
}

function findComposerCandidates(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).filter(isUsableComposer);
}

/**
 * Fallback for AI sites we haven't written a bespoke selector-based adapter
 * for. Hand-picked selectors need upkeep every time a product redesigns its
 * markup, and we can't verify exact selectors against a logged-in session
 * for every site up front. Instead: the currently-focused editable element
 * is almost always the composer (it's what fired the Enter keydown that
 * triggered evaluation in the first place); otherwise fall back to the
 * last visible textarea/contenteditable in DOM order, since chat composers
 * are near-universally rendered at the end of the page. Less precise than a
 * bespoke adapter, but degrades safely: worst case it finds nothing and
 * ShadowGuard simply doesn't intercept on that page, same as an unsupported
 * site today.
 */
export function createGenericAdapter(id: string, displayName: string, hosts: string[]): SiteAdapter {
  return {
    id,
    displayName,
    matchesHost: (hostname) => hosts.includes(hostname),

    findInput: () => {
      if (isUsableComposer(document.activeElement)) return document.activeElement as HTMLElement;
      const candidates = findComposerCandidates();
      return candidates.at(-1) ?? null;
    },

    findSendButton: (input) => {
      const form = input.closest("form");
      if (form) {
        const button = form.querySelector<HTMLElement>(`${SEND_BUTTON_SELECTOR}, button[type="submit"]`);
        if (button) return button;
      }
      let ancestor = input.parentElement;
      for (let depth = 0; depth < 6 && ancestor; depth++) {
        const button = ancestor.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
        if (button) return button;
        ancestor = ancestor.parentElement;
      }
      return document.querySelector<HTMLElement>(SEND_BUTTON_SELECTOR);
    },

    findResponseContainer: () => document.querySelector<HTMLElement>("main") ?? document.body,

    getText: getElementText,
    setText: setElementText,
  };
}
