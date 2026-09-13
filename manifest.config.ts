import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

const AI_SITE_MATCHES = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
];

export default defineManifest({
  manifest_version: 3,
  name: "ShadowGuard — AI Data Protection",
  description:
    "Detects secrets, credentials and personal data before you send them to ChatGPT, Claude or Gemini — redact instead of expose.",
  version: pkg.version,
  icons: {
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "public/icons/icon16.png",
      48: "public/icons/icon48.png",
      128: "public/icons/icon128.png",
    },
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  permissions: ["storage"],
  // api.lemonsqueezy.com is used only to activate/validate a purchased
  // license key (the key itself, nothing else) — no page content or
  // detected data is ever sent there.
  host_permissions: [...AI_SITE_MATCHES, "https://api.lemonsqueezy.com/*"],
  content_scripts: [
    {
      matches: AI_SITE_MATCHES,
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
});
