import type { Match, PolicyAction } from "../../types";
import { PANEL_STYLES } from "./styles";

// Only ever shown for WARN or BLOCK — REDACT is handled automatically,
// synchronously, before this panel would ever be invoked (see
// interceptor.ts). Neither remaining choice touches the page's DOM: Send
// Anyway just lets the original submission through, Cancel/Edit Prompt just
// leaves the draft as-is for the user to edit themselves.
export type ReviewDecision = "send_anyway" | "cancel";

interface ReviewPanelParams {
  siteName: string;
  matches: Match[];
  effectiveAction: PolicyAction;
}

const CATEGORY_EXPLANATIONS: Partial<Record<string, string>> = {
  SECRET: "Credentials and API keys should never be submitted to a public AI tool.",
  SSN: "Social Security Numbers are high-risk identifiers under most company policies.",
  CREDIT_CARD: "Card numbers are financial data and should be redacted before sending.",
  CUSTOM: "This matches a term your organization has marked as confidential.",
};

let activePanel: { host: HTMLElement; resolve: (decision: ReviewDecision) => void } | null = null;

export function showReviewPanel(params: ReviewPanelParams): Promise<ReviewDecision> {
  dismissActivePanel("cancel");

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-shadowguard-panel", "");
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_STYLES;
    shadow.appendChild(style);

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.appendChild(buildHeader(params));
    panel.appendChild(buildBody(params));
    panel.appendChild(buildFooter(params, (decision) => finish(decision)));
    shadow.appendChild(panel);

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("cancel");
    };
    document.addEventListener("keydown", onKeydown, true);

    function finish(decision: ReviewDecision) {
      document.removeEventListener("keydown", onKeydown, true);
      host.remove();
      if (activePanel?.host === host) activePanel = null;
      resolve(decision);
    }

    activePanel = { host, resolve: finish };
  });
}

function dismissActivePanel(decision: ReviewDecision): void {
  activePanel?.resolve(decision);
}

function buildHeader(params: ReviewPanelParams): HTMLElement {
  const header = document.createElement("div");
  header.className = "header";

  const dot = document.createElement("span");
  dot.className = `dot ${params.effectiveAction === "WARN" ? "warn" : ""}`;
  header.appendChild(dot);

  const title = document.createElement("strong");
  title.textContent =
    params.effectiveAction === "BLOCK"
      ? "ShadowGuard blocked this submission"
      : "ShadowGuard detected sensitive data";
  header.appendChild(title);

  return header;
}

function buildBody(params: ReviewPanelParams): HTMLElement {
  const body = document.createElement("div");
  body.className = "body";

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = `Before sending to ${params.siteName}, ShadowGuard found ${params.matches.length} item${
    params.matches.length === 1 ? "" : "s"
  } that match your organization's policy:`;
  body.appendChild(summary);

  const list = document.createElement("ul");
  list.className = "match-list";
  for (const match of dedupeByLabel(params.matches)) {
    list.appendChild(buildMatchRow(match));
  }
  body.appendChild(list);

  const explanation = pickExplanation(params.matches);
  if (explanation) {
    const explain = document.createElement("p");
    explain.className = "explain";
    explain.textContent = explanation;
    body.appendChild(explain);
  }

  return body;
}

function buildMatchRow(match: Match): HTMLElement {
  const row = document.createElement("li");

  const label = document.createElement("span");
  label.textContent = `${match.label} — ${maskValue(match.value)}`;
  row.appendChild(label);

  const badge = document.createElement("span");
  badge.className = `badge ${match.severity}`;
  badge.textContent = match.severity;
  row.appendChild(badge);

  return row;
}

function buildFooter(
  params: ReviewPanelParams,
  onDecision: (decision: ReviewDecision) => void
): HTMLElement {
  const footer = document.createElement("div");
  footer.className = "footer";

  if (params.effectiveAction === "BLOCK") {
    footer.appendChild(makeButton("Edit Prompt", "primary", () => onDecision("cancel")));
    return footer;
  }

  footer.appendChild(makeButton("Send Anyway", "primary", () => onDecision("send_anyway")));
  footer.appendChild(makeButton("Cancel", "ghost", () => onDecision("cancel")));
  return footer;
}

function makeButton(text: string, kind: "primary" | "secondary" | "ghost", onClick: () => void): HTMLElement {
  const button = document.createElement("button");
  button.className = kind;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function dedupeByLabel(matches: Match[]): Match[] {
  const seen = new Set<string>();
  const result: Match[] = [];
  for (const match of matches) {
    const key = `${match.category}:${match.label}:${match.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(match);
  }
  return result;
}

function pickExplanation(matches: Match[]): string | null {
  for (const match of matches) {
    const explanation = CATEGORY_EXPLANATIONS[match.category];
    if (explanation) return explanation;
  }
  return null;
}

function maskValue(value: string): string {
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 3)}${"•".repeat(Math.min(6, value.length - 5))}${value.slice(-2)}`;
}
