# ShadowGuard — Extension MVP Demo

Local-first Chrome extension that detects secrets, credentials and PII before
they're sent to ChatGPT, Claude or Gemini, and offers one-click redaction
with local, reversible placeholders. Built per `ShadowGuard_Product_Blueprint.pdf`
section 21 ("Recommended First Build") — no backend, no admin dashboard yet;
everything runs and stores locally in the browser via `chrome.storage.local`.

## What it does

1. Intercepts your prompt just before it's sent (Enter key or send button).
2. Runs local regex-based detectors for secrets (API keys, AWS keys, JWTs,
   private key blocks, DB connection strings, ...), PII (email, phone, SSN,
   credit card w/ Luhn check, IBAN), and your own custom terms/regex.
3. Shows a review panel with the categories found and the policy action
   (Allow / Warn / Redact / Block) configured for each.
4. On "Redact & Send", replaces sensitive values with placeholders like
   `[EMAIL_1]`, `[SECRET_REMOVED]` before the text ever leaves the page, and
   best-effort restores them in the AI's response.
5. Logs minimized activity (category + action, not raw content) viewable in
   the extension popup.

Policies and custom terms are managed from the options page
(right-click the extension icon → Options, or the popup's "Manage policies" link).

## Development

```bash
npm install
npm run dev     # watches and rebuilds into dist/ with HMR support
npm run build   # one-off production build into dist/
```

## Load into Chrome

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` folder.
4. Visit chatgpt.com, claude.ai or gemini.google.com and paste something like
   an email address or a fake API key (`sk-` followed by 20+ characters) into
   the prompt box, then hit Enter.

## Known limitations (by design, for this first pass)

- Site selectors (`src/content/adapters/*.ts`) are best-effort; ChatGPT/Claude/
  Gemini change their DOM periodically, so interception can silently stop
  working on a given site until selectors are updated.
- Response restoration (placeholders → original values in the AI's reply) is
  a best-effort text-node scan, not a guaranteed contract.
- No backend, sync across devices, admin dashboard, or file upload scanning
  yet — see the blueprint's MVP scope (section 7) and roadmap (section 15)
  for what's next.
