# ShadowGuard — Extension MVP Demo

Local-first Chrome extension that detects secrets, credentials and PII before
they're sent to ChatGPT, Claude or Gemini, and redacts them automatically
with local, reversible placeholders. Built per `ShadowGuard_Product_Blueprint.pdf`
section 21 ("Recommended First Build") — no backend, no admin dashboard yet;
everything runs and stores locally in the browser via `chrome.storage.local`.

## What it does

1. Intercepts your prompt just before it's sent (Enter key or send button).
2. Runs local regex-based detectors for secrets (API keys, AWS keys, JWTs,
   private key blocks, DB connection strings, ...), PII (email, phone, SSN,
   credit card w/ Luhn check, IBAN), and your own custom terms/regex.
3. Applies your configured policy per category (Allow / Warn / Redact / Block):
   - **Block** (e.g. secrets, SSNs by default): shows a panel explaining what
     was found; the submission is stopped and can only be edited, not sent
     as-is.
   - **Redact** (e.g. email, phone, credit card by default): automatically
     rewrites the sensitive values in place to placeholders like `[EMAIL_1]`
     right when you hit Enter/Send — no confirmation click, no page reload.
     It never auto-submits the redacted draft; you review it and press
     Enter/Send yourself, at which point it goes through normally (detection
     now finds nothing left to flag).
   - **Warn** (e.g. person names — no detector emits this category yet): a
     panel offers Send Anyway or Cancel.
4. Best-effort restores placeholders back to their real values when they
   appear in the AI's response, scoped to exclude the prompt box itself (see
   "Known limitations" — this exclusion is the fix for a real bug that
   existed earlier).
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

**After changing the code:** `npm run build`, then click the reload icon (⟳)
on the extension's card in `chrome://extensions` — and also hard-refresh
(⌘R/Ctrl+R) any ChatGPT/Claude/Gemini tab you already had open. Reloading the
extension does not update content scripts already injected into open tabs;
clicking something like ChatGPT's "New chat" is client-side routing, not a
page load, so it won't pick up the new script either — only a real refresh
or a brand-new tab does.

Also worth knowing while testing: Chrome will sometimes silently disable an
unpacked extension after several reload cycles, showing "Turn on developer
mode to use this extension" on its card even though the toggle looks fine —
if the extension stops intercepting anything, check `chrome://extensions`
and toggle Developer mode off/on to re-enable it.

## Licensing (Lemon Squeezy)

Chrome Web Store no longer supports paid listings, so monetization happens
outside the store: the extension installs free, runs fully for a **7-day
trial**, then interception/redaction pauses (fails open — it never blocks
submissions on an unpaid device) until a purchased license key is activated.

- `src/license/license.ts` — all license state (`chrome.storage.local`) and
  the calls to Lemon Squeezy's [client-callable License API](https://docs.lemonsqueezy.com/help/licensing/license-api)
  (`activate` / `validate` / `deactivate`). No API secret is involved — only
  the license key itself is ever sent, and only on explicit
  activate/deactivate.
- Trial start is recorded once, at install (`service-worker.ts`'s
  `onInstalled`), not at first use.
- The options page has the "License" card (activate/deactivate); the popup
  shows a compact trial-countdown or "protection paused" banner.
- **Before shipping**: create the $10 lifetime product in Lemon Squeezy and
  set `LEMONSQUEEZY_CHECKOUT_URL` in `src/license/license.ts` — it's left
  blank for now, and the options page simply hides the "buy" link until it's
  set.

## Known limitations (by design, for this first pass)

- Site selectors (`src/content/adapters/*.ts`) are best-effort; ChatGPT/Claude/
  Gemini change their DOM periodically, so interception can silently stop
  working on a given site until selectors are updated.
- **Auto-redact was, for a long time during development, unreliable on rich-
  text composers (ChatGPT's `#prompt-textarea`/ProseMirror, Gemini's Quill
  editor) — a rewrite would apply and then silently revert a moment later.**
  This took an unusually long investigation (dozens of controlled, repeated
  trials against real chatgpt.com/gemini.google.com) because the actual cause
  was in a completely different, unrelated file, and every plausible
  Quill/ProseMirror-internals theory (clipboard vs. `execCommand`, isolated
  vs. main JS world via a real cross-world bridge, timing, focus theft,
  synchronous vs. panel-click-triggered rewrites, the panel's DOM lifecycle,
  a two-step "second Enter press" design) was ruled out one at a time, each
  confirmed with multiple repeated runs, before the real bug was found:
  **`responseRestorer.ts`'s own `MutationObserver` — which watches the page
  for AI responses so it can swap `[EMAIL_1]`-style placeholders back to
  real values — was scoped too broadly.** Its container selectors (e.g.
  `"main"`) can include the prompt editor itself, not just past responses.
  The instant a redaction wrote `[EMAIL_1]` into the editor, this observer
  saw that same mutation, found a matching entry in the placeholder session
  (populated by the redaction that had just run), and "restored" it straight
  back to the original value — undoing our own redaction, silently, a moment
  after it applied. Fixed by excluding the prompt input's own subtree from
  restoration (`restorePlaceholdersInSubtree`'s `excludeInput` parameter).
  With that one fix, redaction works reliably and immediately, synchronously,
  with no button, no clipboard, no page reload — confirmed via dozens of
  repeated runs at wait times up to 5+ seconds on real chatgpt.com and
  gemini.google.com.
- Response restoration (placeholders → original values in the AI's reply) is
  still a best-effort text-node scan, not a guaranteed contract — it's just
  no longer scoped broadly enough to clobber the prompt box.
- A second, separate bug surfaced while fixing the one above: harmless
  prompts stopped sending at all. The original design always called
  `preventDefault()`/`stopImmediatePropagation()` on every Enter/Send
  attempt, then conditionally replayed it via a synthetic re-dispatched
  event for the common "nothing sensitive, let it through" case. That
  re-dispatch was intermittently not being recognized as the bypass by our
  own listener (root cause not fully isolated — possibly some interaction
  with the page's own event handling reprocessing the redispatched event).
  Fixed by restructuring `interceptor.ts` to check synchronously *before*
  ever touching the event: `preventDefault()` is now called only when there
  is actually something to flag (Warn/Redact/Block), so the common case
  (nothing sensitive) lets the real, original, trusted event through
  untouched — no synthetic re-dispatch involved at all. The bypass/
  re-dispatch mechanism still exists, but only for the much rarer WARN →
  "Send Anyway" path.
- No backend, sync across devices, admin dashboard, or file upload scanning
  yet — see the blueprint's MVP scope (section 7) and roadmap (section 15)
  for what's next.
