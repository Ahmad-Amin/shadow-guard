import { DEFAULT_SETTINGS } from "../policy/defaultPolicy";
import { getSettings, saveSettings } from "../policy/storage";
import { getLicenseRecord } from "../license/license";
import type { ProtectionStatusMessage } from "../content/statusMonitor";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const existing = await getSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...existing });
  // Establishes the trial's installedAt precisely at install time, rather
  // than whenever the license record happens to first be read.
  await getLicenseRecord();
});

const PROTECTED_COLOR = "#1a7a3e";
const NOT_PROTECTED_COLOR = "#a4121a";

// The toolbar badge is per-tab, driven by whatever the content script last
// reported via statusMonitor.ts. Content scripts can't set the badge
// themselves (chrome.action isn't available there), so this is the only
// place that touches it.
chrome.runtime.onMessage.addListener((message: ProtectionStatusMessage, sender) => {
  if (message?.type !== "shadowguard:protection-status") return;
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  void chrome.action.setBadgeText({ tabId, text: message.isProtected ? "✓" : "!" });
  void chrome.action.setBadgeBackgroundColor({
    tabId,
    color: message.isProtected ? PROTECTED_COLOR : NOT_PROTECTED_COLOR,
  });
  void chrome.action.setTitle({
    tabId,
    title: message.isProtected
      ? `ShadowGuard — protecting ${message.siteName}`
      : `ShadowGuard — couldn't find the prompt box on ${message.siteName}. Protection is paused on this page.`,
  });
});

// A stale badge from whatever page previously loaded in this tab must not
// linger into a new page load — otherwise navigating from an AI site to an
// unrelated site (or to a page where the composer hasn't mounted yet) would
// keep showing the old, now-meaningless status. The content script (if any)
// reports the real status again shortly after this fires.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void chrome.action.setBadgeText({ tabId, text: "" });
});
