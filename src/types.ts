export type Category =
  | "SECRET"
  | "EMAIL"
  | "PHONE"
  | "CREDIT_CARD"
  | "SSN"
  | "IBAN"
  | "BANK_ACCOUNT"
  | "PASSPORT"
  | "DOB"
  | "ADDRESS"
  | "IP_ADDRESS"
  | "PERSON"
  | "CUSTOM";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type PolicyAction = "ALLOW" | "WARN" | "REDACT" | "BLOCK";

export interface Match {
  category: Category;
  severity: Severity;
  /** Human-readable label, e.g. "Stripe live secret key" */
  label: string;
  /** The exact substring that matched, used for redaction. */
  value: string;
  start: number;
  end: number;
  /** Whether this category should ever be reversibly restored in a response. */
  reversible: boolean;
}

export interface DetectionResult {
  matches: Match[];
  highestSeverity: Severity | null;
}

export interface CategoryPolicy {
  category: Category;
  action: PolicyAction;
}

export interface CustomTerm {
  id: string;
  /** Plain keyword or a regex source string, depending on `isRegex`. */
  pattern: string;
  isRegex: boolean;
  label: string;
}

export interface ShadowGuardSettings {
  privacyModeEnabled: boolean;
  policy: CategoryPolicy[];
  customTerms: CustomTerm[];
}

export interface PlaceholderEntry {
  placeholder: string;
  original: string;
  category: Category;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  site: string;
  categories: Category[];
  action: PolicyAction;
  overridden: boolean;
}
