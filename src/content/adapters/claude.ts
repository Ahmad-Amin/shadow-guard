import { getElementText, querySelectorFirst, setElementText } from "./domUtils";
import type { SiteAdapter } from "./types";

const INPUT_SELECTORS = ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"][aria-label*="prompt" i]'];
const SEND_BUTTON_SELECTORS = ['button[aria-label*="Send" i]', "button[type='submit']"];
const RESPONSE_CONTAINER_SELECTORS = ["div[data-testid='conversation-turns']", "main"];

export const claudeAdapter: SiteAdapter = {
  id: "claude",
  displayName: "Claude",
  matchesHost: (hostname) => hostname === "claude.ai",

  findInput: () => querySelectorFirst(INPUT_SELECTORS),

  findSendButton: (input) => {
    const button = querySelectorFirst(SEND_BUTTON_SELECTORS);
    if (button) return button;
    return input.closest("form")?.querySelector("button[type='submit']") ?? null;
  },

  findResponseContainer: () => querySelectorFirst(RESPONSE_CONTAINER_SELECTORS),

  getText: getElementText,
  setText: setElementText,
};
