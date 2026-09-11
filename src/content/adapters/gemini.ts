import { getElementText, querySelectorFirst, setElementText } from "./domUtils";
import type { SiteAdapter } from "./types";

const INPUT_SELECTORS = ["div.ql-editor[contenteditable='true']", "rich-textarea div[contenteditable='true']"];
const SEND_BUTTON_SELECTORS = ["button[aria-label*='Send message' i]", "button[aria-label*='Send' i]"];
const RESPONSE_CONTAINER_SELECTORS = ["chat-window", "main"];

export const geminiAdapter: SiteAdapter = {
  id: "gemini",
  displayName: "Gemini",
  matchesHost: (hostname) => hostname === "gemini.google.com",

  findInput: () => querySelectorFirst(INPUT_SELECTORS),

  findSendButton: () => querySelectorFirst(SEND_BUTTON_SELECTORS),

  findResponseContainer: () => querySelectorFirst(RESPONSE_CONTAINER_SELECTORS),

  getText: getElementText,
  setText: setElementText,
};
