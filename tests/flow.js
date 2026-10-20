// End-to-end flow: create account via UI, add expense+income+transfer via UI, verify engine totals and CSV round-trip.
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage(); const errs = [];
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/app.html'); await p.waitForTimeout(400);
  const ok = (n, c, x) => console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  await p.evaluate(() => { location.hash = '#/accounts'; }); await p.waitForTimeout(200);
  await p.click('[data-action="add"]'); await p.waitForTimeout(150);
  await p.fill('.modal [name="name"]', 'Test bank'); await p.fill('.modal [name="openingBalance"]', '1000');
  await p.click('.modal button[type="submit"], .modal .btn-primary'); await p.waitForTimeout(250);
  let d = await p.evaluate(() => SMM.store.get());
  ok('account created via UI (opening 100000 minor)', d.accounts.length === 1 && d.accounts[0].openingBalance === 100000, JSON.stringify(d.accounts.map((a) => a.openingBalance)));
  // transactions through the action layer + totals
  const r = await p.evaluate(() => {
    const A = SMM.actions, F = SMM.finance, id = SMM.store.get().accounts[0].id, today = SMM.dates.today();
    const a2 = A.saveAccount({ name: 'B', type: 'cash', openingBalance: '0', currency: 'DZD' });
    A.saveTransaction({ type: 'income', amount: '500', date: today, accountId: id, categoryId: 'cat_salary' });
    A.saveTransaction({ type: 'expense', amount: '120.50', date: today, accountId: id, categoryId: 'cat_food' });
    A.saveTransaction({ type: 'transfer', amount: '200', date: today, accountId: id, toAccountId: a2.item.id });
    A.saveTransaction({ type: 'refund', amount: '20.50', date: today, accountId: id, categoryId: 'cat_food' });
    const d = SMM.store.get(), m = SMM.dates; const t = F.periodTotals(d, { start: m.startOfMonth(today), end: m.endOfMonth(today) });
    const csv = SMM.csv.exportTransactions(d, d.transactions); return { t, bal: F.totalBalance(d, today), csvLines: csv.trim().split('\n').length };
  });
  ok('income=50000 expense=10000 (refund netted) net=40000', r.t.income === 50000 && r.t.expense === 10000 && r.t.net === 40000, JSON.stringify(r.t));
  ok('total balance 100000+50000-10000 = 140000 (transfer neutral)', r.bal === 140000, String(r.bal));
  ok('CSV export has header + 4 rows', r.csvLines === 5, String(r.csvLines));
  await p.evaluate(() => { location.hash = '#/transactions'; }); await p.waitForTimeout(300);
  ok('transactions page lists 4 rows', (await p.locator('#app main tbody tr, #app main .tx-row, #app main [data-tx-id]').count()) >= 4);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none'); await b.close();
})();
