// App smoke test: every route in 3 languages x 2 themes, then clicks every visible button (modal dismissed after each). Fails on any JS error.
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const base = 'http://localhost:8765/app.html';
const routes = ['overview','transactions','accounts','income','budgets','categories','recurring','goals','calendar','reports','student','assistant','settings'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('crash', () => console.log('CRASH')); p.on('close', () => console.log('PAGE CLOSED')); await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' @' + p.url()));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', (d) => d.dismiss().catch(() => {}));
  await p.goto(base); await p.waitForTimeout(500);
  console.log('empty-state overview ok:', (await p.locator('main, .main, #app').first().innerText()).length > 20);
  await p.evaluate(() => { SMM.actions.loadDemo(SMM.dates ? SMM.dates.today() : SMM.dates.today()); });
  let clicks = 0, empties = [];
  for (const [lang, th] of [['en', 'midnight'], ['ar', 'light'], ['fr', 'emerald']]) {
    await p.evaluate(([l, t]) => { SMM.store.setSettings({ language: l, theme: t }); }, [lang, th]);
    await p.reload(); await p.waitForTimeout(300);
    for (const r of routes) { process.stdout.write(lang + ':' + r + ' ');
      await p.evaluate((h) => { location.hash = '#/' + h; }, r); await p.waitForTimeout(150);
      const txt = await p.locator('#app').innerText({ timeout: 3000 }).catch(() => '');
      if (/\b(lp|ov|tx|set|budgets|goals|rep|stu|as)\.[a-zA-Z]+\.?[a-zA-Z]*\b/.test(txt.replace(/\d+\.\d+/g, ''))) empties.push(lang + ' ' + r + ': raw key? ' + (txt.match(/\b(ov|tx|set|budgets|goals|rep|stu|as)\.[a-zA-Z.]+/) || [])[0]);
      if (txt.trim().length < 30) empties.push(lang + ' ' + r + ' blank');
      if (lang === 'en') {
        const n = await p.locator('#app main button:visible, #app main a[data-action]:visible').count();
        for (let i = 0; i < Math.min(n, 40); i++) {
          const el = p.locator('#app main button:visible, #app main a[data-action]:visible').nth(i);
          const label = await el.evaluate((e) => (e.innerText || '') + (e.getAttribute('aria-label') || '') + (e.dataset.action || ''), null, { timeout: 400 }).catch(() => null);
          if (label === null) continue;
          if (/delete|reset|remove|clear|erase|wipe|حذف|supprimer/i.test(label)) continue;
          process.stdout.write('[' + label.replace(/\s+/g, ' ').slice(0, 20) + '] '); try { await el.click({ timeout: 800 }); clicks++; } catch (e) {}
          await p.waitForTimeout(40);
          if (await p.locator('.modal-backdrop').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(60); if (await p.locator('.modal-backdrop').count()) await p.evaluate(() => document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove())); }
          if (!p.url().includes('#/' + r)) { await p.evaluate((h) => { location.hash = '#/' + h; }, r); await p.waitForTimeout(100); }
        }
      }
    }
  }
  console.log('clicks:', clicks); console.log('content issues:', empties.length ? '\n' + empties.join('\n') : 'none');
  console.log('ERRORS:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
  await b.close(); process.exit(errs.length || empties.length ? 1 : 0);
})();
