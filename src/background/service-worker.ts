import { DEFAULT_SETTINGS } from "../policy/defaultPolicy";
import { getSettings, saveSettings } from "../policy/storage";
import { getLicenseRecord } from "../license/license";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const existing = await getSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...existing });
  // Establishes the trial's installedAt precisely at install time, rather
  // than whenever the license record happens to first be read.
  await getLicenseRecord();
});
