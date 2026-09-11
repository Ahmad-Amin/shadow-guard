import { POLICY_TEMPLATES } from "../policy/defaultPolicy";
import { getSettings, saveSettings } from "../policy/storage";
import type { Category, CustomTerm, PolicyAction, ShadowGuardSettings } from "../types";

const app = document.getElementById("app");
if (!app) throw new Error("options root missing");

const CATEGORY_LABELS: Record<Category, string> = {
  SECRET: "Secrets & credentials",
  EMAIL: "Email addresses",
  PHONE: "Phone numbers",
  CREDIT_CARD: "Credit card numbers",
  SSN: "Social Security Numbers",
  IBAN: "Bank account / IBAN",
  PERSON: "Person names",
  CUSTOM: "Custom protected terms",
};

const POLICY_ACTIONS: PolicyAction[] = ["ALLOW", "WARN", "REDACT", "BLOCK"];

let settings: ShadowGuardSettings;

async function init(): Promise<void> {
  settings = await getSettings();
  render();
}

function render(): void {
  app!.innerHTML = `
    <div class="wrap">
      <header>
        <h1>ShadowGuard Settings</h1>
        <p>Choose how ShadowGuard reacts to each data category, and add terms specific to your organization.</p>
      </header>

      <section class="card">
        <h2>Policy templates</h2>
        <p class="hint">Apply a starting point, then fine-tune individual categories below.</p>
        <div class="templates">
          ${Object.keys(POLICY_TEMPLATES)
            .map((name) => `<button data-template="${name}">${name}</button>`)
            .join("")}
        </div>
      </section>

      <section class="card">
        <h2>Category policy <span id="saved-pill-policy" class="saved-pill">Saved</span></h2>
        <p class="hint">Allow, Warn, Redact or Block each type of sensitive data when it's about to be sent to an AI tool.</p>
        <table>
          <thead><tr><th>Category</th><th>Action</th></tr></thead>
          <tbody id="policy-rows"></tbody>
        </table>
      </section>

      <section class="card">
        <h2>Custom protected terms <span id="saved-pill-terms" class="saved-pill">Saved</span></h2>
        <p class="hint">Project names, customer names or codewords that aren't standard PII but matter to your company.</p>
        <div class="term-form">
          <input type="text" id="term-label" placeholder="Label (e.g. Project Falcon)" />
          <input type="text" id="term-pattern" placeholder="Keyword or regex" />
          <label class="checkbox-row"><input type="checkbox" id="term-regex" /> Treat as regex</label>
          <button class="add-btn" id="add-term">Add term</button>
        </div>
        <table>
          <thead><tr><th>Label</th><th>Pattern</th><th></th></tr></thead>
          <tbody id="term-rows"></tbody>
        </table>
      </section>
    </div>
  `;

  renderPolicyRows();
  renderTermRows();
  wireTemplateButtons();
  wireTermForm();
}

function renderPolicyRows(): void {
  const tbody = document.getElementById("policy-rows")!;
  tbody.innerHTML = settings.policy
    .map(
      (rule) => `
      <tr>
        <td>${CATEGORY_LABELS[rule.category]}</td>
        <td>
          <select data-category="${rule.category}">
            ${POLICY_ACTIONS.map(
              (action) => `<option value="${action}" ${action === rule.action ? "selected" : ""}>${action}</option>`
            ).join("")}
          </select>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      const category = target.dataset.category as Category;
      const action = target.value as PolicyAction;
      settings = {
        ...settings,
        policy: settings.policy.map((r) => (r.category === category ? { ...r, action } : r)),
      };
      await saveSettings(settings);
      flashSaved("saved-pill-policy");
    });
  });
}

function renderTermRows(): void {
  const tbody = document.getElementById("term-rows")!;
  if (settings.customTerms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty">No custom terms yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = settings.customTerms
    .map(
      (term) => `
      <tr>
        <td>${escapeHtml(term.label)}</td>
        <td>${escapeHtml(term.pattern)}${term.isRegex ? " <em>(regex)</em>" : ""}</td>
        <td><button class="remove-btn" data-remove="${term.id}">Remove</button></td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.remove!;
      settings = { ...settings, customTerms: settings.customTerms.filter((t) => t.id !== id) };
      await saveSettings(settings);
      renderTermRows();
      flashSaved("saved-pill-terms");
    });
  });
}

function wireTemplateButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((button) => {
    button.addEventListener("click", async () => {
      const templateName = button.dataset.template!;
      const template = POLICY_TEMPLATES[templateName];
      if (!template) return;
      settings = { ...settings, policy: template.map((rule) => ({ ...rule })) };
      await saveSettings(settings);
      renderPolicyRows();
      flashSaved("saved-pill-policy");
    });
  });
}

function wireTermForm(): void {
  document.getElementById("add-term")?.addEventListener("click", async () => {
    const labelInput = document.getElementById("term-label") as HTMLInputElement;
    const patternInput = document.getElementById("term-pattern") as HTMLInputElement;
    const regexInput = document.getElementById("term-regex") as HTMLInputElement;

    const pattern = patternInput.value.trim();
    if (!pattern) return;

    const term: CustomTerm = {
      id: crypto.randomUUID(),
      label: labelInput.value.trim() || pattern,
      pattern,
      isRegex: regexInput.checked,
    };

    settings = { ...settings, customTerms: [...settings.customTerms, term] };
    await saveSettings(settings);

    labelInput.value = "";
    patternInput.value = "";
    regexInput.checked = false;

    renderTermRows();
    flashSaved("saved-pill-terms");
  });
}

function flashSaved(id: string): void {
  const pill = document.getElementById(id);
  if (!pill) return;
  pill.classList.add("visible");
  setTimeout(() => pill.classList.remove("visible"), 1200);
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

void init();
