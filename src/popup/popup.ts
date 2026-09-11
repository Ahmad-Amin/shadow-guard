import { getActivity, getSettings, saveSettings } from "../policy/storage";
import type { ActivityEvent } from "../types";

const app = document.getElementById("app");
if (!app) throw new Error("popup root missing");

async function render(): Promise<void> {
  const [settings, activity] = await Promise.all([getSettings(), getActivity()]);

  app!.innerHTML = `
    <div class="header">
      <div>
        <h1>ShadowGuard</h1>
        <div class="subtitle">Protecting your AI prompts</div>
      </div>
    </div>
    <div class="toggle-row">
      <div>
        <div class="label">Private AI Mode</div>
        <div class="desc">Aggressively anonymize identifying values before every submission.</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="privacy-toggle" ${settings.privacyModeEnabled ? "checked" : ""} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="section-title">What ShadowGuard protected for you</div>
    ${renderActivity(activity)}
    <a class="footer-link" id="open-options" href="#">Manage policies and custom terms</a>
  `;

  document.getElementById("privacy-toggle")?.addEventListener("change", async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await saveSettings({ ...settings, privacyModeEnabled: checked });
  });

  document.getElementById("open-options")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function renderActivity(activity: ActivityEvent[]): string {
  if (activity.length === 0) {
    return `<div class="empty-state">No risky submissions caught yet. You're all clear.</div>`;
  }

  const items = activity
    .slice(0, 20)
    .map(
      (event) => `
      <li class="activity-item">
        <div class="top-row">
          <span class="site">${escapeHtml(event.site)}</span>
          <span class="action ${event.action}">${event.overridden ? "OVERRIDDEN" : event.action}</span>
        </div>
        <div class="meta">${escapeHtml(event.categories.join(", "))} · ${formatTime(event.timestamp)}</div>
      </li>`
    )
    .join("");

  return `<ul class="activity-list">${items}</ul>`;
}

function formatTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

void render();
