import type { CategoryPolicy, DetectionResult, PolicyAction } from "../types";

const ACTION_RANK: Record<PolicyAction, number> = {
  BLOCK: 3,
  REDACT: 2,
  WARN: 1,
  ALLOW: 0,
};

/** The strictest action any matched category's policy calls for wins. */
export function resolveEffectiveAction(detection: DetectionResult, policy: CategoryPolicy[]): PolicyAction {
  let effective: PolicyAction = "ALLOW";
  for (const match of detection.matches) {
    const rule = policy.find((p) => p.category === match.category);
    const action = rule?.action ?? "WARN";
    if (ACTION_RANK[action] > ACTION_RANK[effective]) effective = action;
  }
  return effective;
}
