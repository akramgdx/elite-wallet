# Smart Money Manager

Personal-finance web app (vanilla HTML/CSS/JS, no frameworks, no build step) with a public marketing landing page.

- `index.html` — long-scroll landing page (10 sections). "Get Started" → `app.html`; "Explore Features" → smooth-scroll to `#features`.
- `app.html` — the application (hash routes `#/overview`, `#/transactions`, …).
- Languages: English, Français (LTR), العربية (RTL, Tajawal font). Default currency DZD (EUR/USD/GBP/CAD available).
- 8 themes (Midnight Dark, Pure Light, Emerald Finance, Ocean Blue, Violet Modern, Rose Elegant, Graphite, Warm Sand) × Light/Dark/System + accent colors. Landing and app share the same settings.

## Run
Any static server (ES-module-free, so `file://` also works for most browsers):
```
cd smart-money-manager && python3 -m http.server 8765   # open http://localhost:8765/
```

## Tests
```
node --test tests/finance.test.js     # 22 tests: money, income/expense/transfer/refund rules, budgets+rollover, goals, CSV, import/export, corrupt storage, recurring, health score, student, demo data…
node --test tests/i18n.test.js        # every used key exists in EN; FR/AR complete with identical placeholders; landing keys
node tests/smoke.js                   # headless Chromium (Playwright): landing, CTAs, theme/lang/RTL, mobile menu, Get Started → app
node tests/app-smoke.js               # every route in EN/AR/FR, demo data loaded, clicks every visible button, fails on any JS error
node tests/flow.js                    # UI creates an account; income/expense/transfer/refund totals + CSV verified in the browser
```
Browser tests need Playwright + Chromium and a server on :8765 (`PW=<path to playwright>` to override).

## Architecture
`js/core/*` pure logic (money, defaults/validation, finance engine, CSV, store, actions, assistant) → `js/ui/*` (i18n, theme, icons, charts, ui kit) → `js/pages/*` (one module per page) → `js/app.js` (shell/router). Only `store.js` touches `localStorage` (`smm.v1.data`, `smm.v1.backup`; corrupt data is kept under `smm.v1.corrupt.<ts>`, never overwritten).

Financial rules (single engine, `finance.js`): money = integer minor units; transfers are neither income nor expense; refunds reduce expenses; budgets exclude transfers; accounts in a non-base currency are excluded from aggregates (no FX).

## Honest limitations / external requirements
- **No backend, no accounts, no sync.** Data lives in this browser's localStorage, **not encrypted**. Use Settings → Backup (JSON) regularly.
- **No bank connection** and **no currency conversion**.
- **AI assistant** is a *local rule-based demo* (clearly labelled). A real model needs your own server: `POST {question, context(aggregates only), language}` → `{answer}`, configured in Settings with explicit consent. No API key is ever stored client-side.
- **Voice input** uses the browser's SpeechRecognition (Chrome-family); audio may be processed by the browser vendor. Spoken replies use `speechSynthesis`. Both degrade gracefully when unsupported.
- **Notifications** work only while the app is open (no push service).
- Fonts load from Google Fonts; offline, system fonts are used.
- Landing previews use a small fixed *sample* data set run through the real engine and are labelled as such.
