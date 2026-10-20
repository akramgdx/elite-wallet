// Headless-browser smoke test: node tests/smoke.js  (needs playwright + chromium; server on :8765)
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const base = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [], fails = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_(NAME|INTERNET|CONNECTION|TUNNEL|PROXY)|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  p.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) errs.push('REQFAIL ' + r.url()); });
  const check = (n, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')); if (!ok) fails.push(n); };

  await p.goto(base + 'index.html'); await p.waitForTimeout(500);
  check('landing renders 10+ sections', (await p.locator('main > section').count()) >= 10);
  check('hero previews rendered', (await p.locator('#p-hero .kpi').count()) > 0 && (await p.locator('#p-budget .progress').count()) === 3 && (await p.locator('#p-goals svg').count()) === 3);
  check('no raw i18n keys visible', !/\blp\.[a-z0-9]+\.[a-z0-9.]+/i.test(await p.locator('body').innerText()));
  await p.click('#cta-explore'); await p.waitForTimeout(700);
  check('Explore Features scrolls to #features', (await p.evaluate('location.hash')) === '#features' && (await p.evaluate('scrollY')) > 300);
  await p.locator('#personalize').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.click('[data-theme-id="emerald"]');
  check('theme switch', (await p.evaluate("document.documentElement.dataset.theme")) === 'emerald');
  await p.click('#lang-seg [data-lang="ar"]');
  check('Arabic => RTL', (await p.evaluate("document.documentElement.dir")) === 'rtl' && (await p.evaluate("document.documentElement.lang")) === 'ar');
  check('Arabic text shown', /ابدأ/.test(await p.locator('#cta-start').innerText()));
  await p.click('#lang-seg [data-lang="fr"]'); check('French', /Commencer/.test(await p.locator('#cta-start').innerText()));
  await p.click('#lang-seg [data-lang="en"]');
  await p.click('#mode-toggle'); check('mode toggle', ['dark', 'light'].includes(await p.evaluate("document.documentElement.dataset.mode")));
  // mobile menu
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  check('no horizontal scroll (mobile)', await p.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
  await p.click('#menu-btn'); check('mobile menu opens', await p.locator('#mobile-menu').isVisible());
  await p.keyboard.press('Escape'); check('mobile menu closes (Esc)', !(await p.locator('#mobile-menu').isVisible()));
  await p.setViewportSize({ width: 1280, height: 900 });
  // Get Started
  await p.evaluate('scrollTo(0,0)');
  await Promise.all([p.waitForURL('**/app.html'), p.click('#cta-start')]);
  check('Get Started opens app.html', /app\.html/.test(p.url()));
  await p.waitForTimeout(800);
  check('app shell rendered', (await p.locator('.sidebar, nav').count()) > 0, errs.slice(0, 3).join(' | '));
  console.log('\nERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await b.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
