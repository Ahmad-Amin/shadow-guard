// Lifetime-license gating via Lemon Squeezy's client-callable License API
// (https://docs.lemonsqueezy.com/help/licensing/license-api). No API secret
// is required for these endpoints — they're designed to be called directly
// from installed software/extensions.
//
// Model: a 7-day fully-functional trial starting at install, then
// interception/redaction pauses until a purchased key is activated. Trial
// state and activation state both live in chrome.storage.local — nothing is
// ever sent anywhere except the license key itself, to Lemon Squeezy, only
// when the user explicitly activates/deactivates.

// TODO: fill in once the Lemon Squeezy product/checkout is created.
export const LEMONSQUEEZY_CHECKOUT_URL = 'https://customreactform.lemonsqueezy.com/checkout/buy/d0c165e8-85a5-4c66-909e-486b952e27ea';

const LEMONSQUEEZY_API = 'https://api.lemonsqueezy.com/v1/licenses';
const STORAGE_KEY = 'shadowguard:license';
const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const REVALIDATE_INTERVAL_MS = 12 * 60 * 60 * 1000; // re-check with Lemon Squeezy at most every 12h
const CACHE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // recompute trial-day countdown hourly in long-lived tabs

export interface LicenseRecord {
  installedAt: number;
  licenseKey: string | null;
  instanceId: string | null;
  customerEmail: string | null;
  activatedAt: number | null;
  lastValidatedAt: number | null;
  /** false only after an explicit "invalid" response from Lemon Squeezy — never set false just because a network call failed, so an offline device is never locked out. */
  lastValidationOk: boolean;
}

export type EntitlementStatus = 'trial' | 'active' | 'expired';

export interface Entitlement {
  status: EntitlementStatus;
  trialDaysLeft: number;
}

function blankRecord(): LicenseRecord {
  return {
    installedAt: Date.now(),
    licenseKey: null,
    instanceId: null,
    customerEmail: null,
    activatedAt: null,
    lastValidatedAt: null,
    lastValidationOk: true,
  };
}

export async function getLicenseRecord(): Promise<LicenseRecord> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY] as LicenseRecord | undefined;
  if (existing) return existing;
  const fresh = blankRecord();
  await chrome.storage.local.set({ [STORAGE_KEY]: fresh });
  return fresh;
}

async function saveLicenseRecord(record: LicenseRecord): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: record });
}

export function computeEntitlement(record: LicenseRecord): Entitlement {
  if (record.licenseKey && record.instanceId && record.lastValidationOk) {
    return { status: 'active', trialDaysLeft: 0 };
  }

  const remaining = TRIAL_MS - (Date.now() - record.installedAt);
  if (remaining > 0) {
    return { status: 'trial', trialDaysLeft: Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000))) };
  }
  return { status: 'expired', trialDaysLeft: 0 };
}

async function callLicenseApi(action: 'activate' | 'validate' | 'deactivate', params: Record<string, string>): Promise<any> {
  const res = await fetch(`${LEMONSQUEEZY_API}/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return res.json();
}

export async function activateLicense(licenseKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = licenseKey.trim();
  if (!trimmed) return { ok: false, error: 'Enter a license key.' };

  try {
    const data = await callLicenseApi('activate', {
      license_key: trimmed,
      instance_name: 'ShadowGuard Extension',
    });

    if (!data.activated) {
      return { ok: false, error: data.error ?? "This license key couldn't be activated." };
    }

    const existing = await getLicenseRecord();
    await saveLicenseRecord({
      ...existing,
      licenseKey: trimmed,
      instanceId: data.instance?.id ?? null,
      customerEmail: data.meta?.customer_email ?? null,
      activatedAt: Date.now(),
      lastValidatedAt: Date.now(),
      lastValidationOk: true,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the license server. Check your connection and try again." };
  }
}

export async function deactivateLicense(): Promise<void> {
  const record = await getLicenseRecord();
  if (record.licenseKey && record.instanceId) {
    try {
      await callLicenseApi('deactivate', { license_key: record.licenseKey, instance_id: record.instanceId });
    } catch {
      // best-effort — clear the local activation regardless so the user isn't stuck.
    }
  }
  await saveLicenseRecord({
    ...record,
    licenseKey: null,
    instanceId: null,
    customerEmail: null,
    activatedAt: null,
    lastValidatedAt: null,
    lastValidationOk: true,
  });
}

/** Best-effort periodic re-check (e.g. a refunded/revoked key). Never downgrades on network failure. */
export async function revalidateLicense(): Promise<void> {
  const record = await getLicenseRecord();
  if (!record.licenseKey || !record.instanceId) return;
  if (record.lastValidatedAt && Date.now() - record.lastValidatedAt < REVALIDATE_INTERVAL_MS) return;

  try {
    const data = await callLicenseApi('validate', {
      license_key: record.licenseKey,
      instance_id: record.instanceId,
    });
    await saveLicenseRecord({ ...record, lastValidatedAt: Date.now(), lastValidationOk: Boolean(data.valid) });
  } catch {
    // offline or Lemon Squeezy unreachable — leave the last-known state as-is.
  }
}

// interceptor.ts needs a synchronous, always-current entitlement check on
// every Enter/Send attempt, without an async chrome.storage round-trip each
// time — same pattern as policy/storage.ts's settings cache.
let cachedEntitlement: Entitlement = { status: 'trial', trialDaysLeft: TRIAL_DAYS };

async function refreshEntitlementCache(): Promise<void> {
  const record = await getLicenseRecord();
  cachedEntitlement = computeEntitlement(record);
}

/** Call once per content-script load. Resolves once the first real read completes, so callers can reliably act on trial/expired state right after. */
export function initEntitlementCache(): Promise<void> {
  const initial = refreshEntitlementCache();
  void revalidateLicense().then(refreshEntitlementCache);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) void refreshEntitlementCache();
  });

  // A tab can stay open past the trial boundary without any storage write
  // ever happening — recompute periodically so status still flips to
  // "expired" without needing a page refresh.
  setInterval(() => void refreshEntitlementCache(), CACHE_REFRESH_INTERVAL_MS);

  return initial;
}

export function getCachedEntitlement(): Entitlement {
  return cachedEntitlement;
}
