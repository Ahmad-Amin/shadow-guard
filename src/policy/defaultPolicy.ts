import type { CategoryPolicy, ShadowGuardSettings } from "../types";

export const DEFAULT_CATEGORY_POLICY: CategoryPolicy[] = [
  { category: "SECRET", action: "BLOCK" },
  { category: "SSN", action: "BLOCK" },
  { category: "CREDIT_CARD", action: "REDACT" },
  { category: "IBAN", action: "REDACT" },
  { category: "BANK_ACCOUNT", action: "REDACT" },
  { category: "PASSPORT", action: "REDACT" },
  { category: "DOB", action: "REDACT" },
  { category: "ADDRESS", action: "REDACT" },
  { category: "IP_ADDRESS", action: "REDACT" },
  { category: "EMAIL", action: "REDACT" },
  { category: "PHONE", action: "REDACT" },
  { category: "PERSON", action: "WARN" },
  { category: "CUSTOM", action: "REDACT" },
];

export const DEFAULT_SETTINGS: ShadowGuardSettings = {
  privacyModeEnabled: true,
  policy: DEFAULT_CATEGORY_POLICY,
  customTerms: [],
};

/**
 * Named starting points an admin/user can pick from. All of them use the
 * same category set today; they differ in how strict the borderline
 * categories (EMAIL/PHONE/PERSON) are treated.
 */
export const POLICY_TEMPLATES: Record<string, CategoryPolicy[]> = {
  General: DEFAULT_CATEGORY_POLICY,
  Engineering: DEFAULT_CATEGORY_POLICY.map((p) =>
    p.category === "PERSON" ? { ...p, action: "ALLOW" } : p
  ),
  Finance: DEFAULT_CATEGORY_POLICY.map((p) =>
    p.category === "CREDIT_CARD" || p.category === "IBAN" || p.category === "BANK_ACCOUNT"
      ? { ...p, action: "BLOCK" }
      : p
  ),
  HR: DEFAULT_CATEGORY_POLICY.map((p) =>
    p.category === "EMAIL" ||
    p.category === "PHONE" ||
    p.category === "PERSON" ||
    p.category === "DOB" ||
    p.category === "ADDRESS" ||
    p.category === "PASSPORT"
      ? { ...p, action: "BLOCK" }
      : p
  ),
};
