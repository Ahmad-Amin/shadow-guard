import { DEFAULT_SETTINGS } from "../policy/defaultPolicy";
import { getSettings, saveSettings } from "../policy/storage";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const existing = await getSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...existing });
});
