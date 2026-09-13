import type { ActivityEvent, ShadowGuardSettings } from "../types";
import { DEFAULT_SETTINGS } from "./defaultPolicy";

const SETTINGS_KEY = "shadowguard:settings";
const ACTIVITY_KEY = "shadowguard:activity";
const MAX_ACTIVITY_EVENTS = 200;

export async function getSettings(): Promise<ShadowGuardSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = stored[SETTINGS_KEY] as ShadowGuardSettings | undefined;
  if (!settings) return DEFAULT_SETTINGS;
  // Merge so newly introduced default fields survive an upgrade from an
  // older stored shape.
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: ShadowGuardSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: ShadowGuardSettings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    callback(changes[SETTINGS_KEY].newValue as ShadowGuardSettings);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// interceptor.ts checks policy on every Enter/Send attempt and needs the
// result immediately, without an `await` round-trip through
// chrome.storage.local.get() on every keystroke. This cache is populated
// once at content-script startup and kept fresh via onSettingsChanged.
let cachedSettings: ShadowGuardSettings = DEFAULT_SETTINGS;

/** Call once per content script load, before relying on getCachedSettings(). */
export function initSettingsCache(): void {
  void getSettings().then((settings) => {
    cachedSettings = settings;
  });
  onSettingsChanged((settings) => {
    cachedSettings = { ...DEFAULT_SETTINGS, ...settings };
  });
}

/** Synchronous read of the last-known settings; falls back to defaults until the initial async load completes. */
export function getCachedSettings(): ShadowGuardSettings {
  return cachedSettings;
}

export async function getActivity(): Promise<ActivityEvent[]> {
  const stored = await chrome.storage.local.get(ACTIVITY_KEY);
  return (stored[ACTIVITY_KEY] as ActivityEvent[] | undefined) ?? [];
}

export async function recordActivity(event: ActivityEvent): Promise<void> {
  const existing = await getActivity();
  const updated = [event, ...existing].slice(0, MAX_ACTIVITY_EVENTS);
  await chrome.storage.local.set({ [ACTIVITY_KEY]: updated });
}
