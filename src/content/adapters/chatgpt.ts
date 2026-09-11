import { getElementText, querySelectorFirst, setElementText } from "./domUtils";
import type { SiteAdapter } from "./types";

const INPUT_SELECTORS = ["#prompt-textarea", 'div[contenteditable="true"][id^="prompt-textarea"]'];
const SEND_BUTTON_SELECTORS = ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'];
const RESPONSE_CONTAINER_SELECTORS = ["main [role='presentation']", "main"];

export const chatGptAdapter: SiteAdapter = {
  id: "chatgpt",
  displayName: "ChatGPT",
  matchesHost: (hostname) => hostname === "chatgpt.com" || hostname === "chat.openai.com",

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
