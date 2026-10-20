// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');

const mem = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } });
['money', 'defaults', 'finance', 'csv', 'store', 'actions'].forEach((m) => require('../js/core/' + m + '.js'));
const { money, dates, finance: F, actions: A, store, csv, defaults } = globalThis.SMM;

const TODAY = '2026-10-15';
const M = (n) => Math.round(n * 100);
function fresh() {
  mem.clear(); store._reload();
  const a = A.saveAccount({ name: 'Bank', type: 'bank', openingBalance: '1000.00' }).item;
  const b = A.saveAccount({ name: 'Cash', type: 'cash', openingBalance: '200' }).item;
  return { a, b };
}
const tx = (o) => A.saveTransaction(Object.assign({ type: 'expense', date: '2026-10-05', accountId: '', categoryId: 'cat_food', amount: '10' }, o));
const S = () => store.get();
const month = dates.range('month', TODAY);

test('money.parse handles formats and rejects garbage', () => {
  assert.equal(money.parse('1250.5'), 125050);
  assert.equal(money.parse('1 250,50'), 125050);
  assert.equal(money.parse('1,250.50'), 125050);
  assert.equal(money.parse('1.250,50'), 125050);
  assert.equal(money.parse('١٢٫٥'), 1250);
  assert.equal(money.parse('0.1') + money.parse('0.2'), 30); // no float drift
  for (const bad of ['', 'abc', '-5', '1.234', '1e3', null, undefined, NaN]) assert.equal(money.parse(bad), null, String(bad));
  assert.equal(money.toDecimal(125005), '1250.05');
});

test('1-2. create income and expense; balances', () => {
  const { a } = fresh();
  assert.ok(tx({ type: 'income', amount: '500', categoryId: 'cat_salary', accountId: a.id }).ok);
  assert.ok(tx({ type: 'expense', amount: '120.50', accountId: a.id }).ok);
  assert.equal(F.accountBalance(S(), a.id), M(1000 + 500 - 120.5));
  const t = F.periodTotals(S(), month);
  assert.equal(t.income, M(500)); assert.equal(t.expense, M(120.5)); assert.equal(t.net, M(379.5));
});

test('3-4. edit and delete a transaction update everything', () => {
  const { a } = fresh();
  const id = tx({ type: 'expense', amount: '100', accountId: a.id }).item.id;
  assert.equal(F.accountBalance(S(), a.id), M(900));
  assert.ok(A.saveTransaction({ type: 'expense', amount: '40', date: '2026-10-06', accountId: a.id, categoryId: 'cat_transport' }, id).ok);
  assert.equal(F.accountBalance(S(), a.id), M(960));
  assert.equal(F.categoryTotals(S(), month)[0].categoryId, 'cat_transport');
  A.deleteTransaction(id);
  assert.equal(F.accountBalance(S(), a.id), M(1000));
  assert.equal(F.periodTotals(S(), month).expense, 0);
});

test('5-6. transfers move money but are not income/expense and keep total constant', () => {
  const { a, b } = fresh();
  const before = F.totalBalance(S());
  assert.ok(A.saveTransaction({ type: 'transfer', amount: '300', date: '2026-10-07', accountId: a.id, toAccountId: b.id }).ok);
  assert.equal(F.accountBalance(S(), a.id), M(700));
  assert.equal(F.accountBalance(S(), b.id), M(500));
  assert.equal(F.totalBalance(S()), before);
  const t = F.periodTotals(S(), month);
  assert.equal(t.income, 0); assert.equal(t.expense, 0);
  assert.equal(F.categoryTotals(S(), month).length, 0);
  assert.equal(A.saveTransaction({ type: 'transfer', amount: '1', date: '2026-10-07', accountId: a.id, toAccountId: a.id }).ok, false);
});

test('7. refunds reduce expenses (not income) and are not double counted', () => {
  const { a } = fresh();
  tx({ type: 'expense', amount: '200', categoryId: 'cat_shopping', accountId: a.id });
  tx({ type: 'refund', amount: '50', categoryId: 'cat_shopping', accountId: a.id });
  const t = F.periodTotals(S(), month);
  assert.equal(t.income, 0); assert.equal(t.expense, M(150)); assert.equal(t.refunds, M(50)); assert.equal(t.net, -M(150));
  assert.equal(F.accountBalance(S(), a.id), M(850));
  assert.equal(F.categoryTotals(S(), month)[0].amount, M(150));
});

test('8. budgets follow transactions, exclude transfers, include refunds, states', () => {
  const { a, b } = fresh();
  const bud = A.saveBudget({ name: 'Food', period: 'monthly', categoryIds: ['cat_food'], limit: '100' }).item;
  assert.equal(F.budgetUsage(S(), bud, TODAY).state, 'ok');
  const id = tx({ amount: '85', accountId: a.id }).item.id;
  let u = F.budgetUsage(S(), bud, TODAY);
  assert.equal(u.state, 'warn'); assert.equal(u.remaining, M(15));
  tx({ amount: '30', accountId: a.id });
  assert.equal(F.budgetUsage(S(), bud, TODAY).state, 'over');
  tx({ type: 'refund', amount: '30', accountId: a.id });
  assert.equal(F.budgetUsage(S(), bud, TODAY).spent, M(85));
  A.saveTransaction({ type: 'transfer', amount: '500', date: '2026-10-07', accountId: a.id, toAccountId: b.id });
  assert.equal(F.budgetUsage(S(), bud, TODAY).spent, M(85));
  A.deleteTransaction(id);
  assert.equal(F.budgetUsage(S(), bud, TODAY).spent, 0);
});

test('budget rollover carries unspent amount of previous month', () => {
  const { a } = fresh();
  const bud = A.saveBudget({ period: 'monthly', categoryIds: ['cat_food'], limit: '100', rollover: true }).item;
  tx({ amount: '40', date: '2026-09-10', accountId: a.id });
  const u = F.budgetUsage(S(), bud, TODAY);
  assert.equal(u.rollover, M(60)); assert.equal(u.limit, M(160));
});

test('9-11. dashboard stats, goals, period totals', () => {
  const { a } = fresh();
  tx({ type: 'income', amount: '1000', categoryId: 'cat_salary', accountId: a.id, date: '2026-09-28' });
  tx({ type: 'income', amount: '800', categoryId: 'cat_salary', accountId: a.id, date: '2026-10-02' });
  tx({ type: 'expense', amount: '200', accountId: a.id, date: '2026-10-03' });
  tx({ type: 'expense', amount: '100', accountId: a.id, date: '2026-09-30' });
  assert.equal(F.periodTotals(S(), month).income, M(800));
  assert.equal(F.periodTotals(S(), dates.range('lastMonth', TODAY)).income, M(1000));
  assert.equal(F.periodTotals(S(), dates.range('year', TODAY)).net, M(1500));
  assert.equal(F.periodTotals(S(), month).savingsRate, 0.75);
  const series = F.monthlySeries(S(), TODAY, 3);
  assert.deepEqual(series.map((s) => s.key), ['2026-08', '2026-09', '2026-10']);
  const g = A.saveGoal({ name: 'Laptop', target: '1000', targetDate: '2027-01-15' }).item;
  A.addContribution(g.id, '250', TODAY, '');
  let p = F.goalProgress(S().goals[0], TODAY);
  assert.equal(p.pct, 25); assert.equal(p.remaining, M(750)); assert.equal(p.monthsLeft, 4); assert.equal(p.suggestedMonthly, M(187.5));
  assert.equal(A.addContribution(g.id, '300', TODAY, '', true).ok, false); // withdraw > saved
  assert.ok(A.addContribution(g.id, '50', TODAY, '', true).ok);
  assert.equal(F.goalProgress(S().goals[0], TODAY).pct, 20);
  A.addContribution(g.id, '5000', TODAY, '');
  assert.equal(F.goalProgress(S().goals[0], TODAY).pct, 100); assert.ok(F.goalProgress(S().goals[0], TODAY).done);
});

test('12-13. empty and invalid data', () => {
  mem.clear(); store._reload();
  const d = S();
  assert.equal(F.totalBalance(d), 0);
  assert.equal(F.periodTotals(d, month).savingsRate, null);
  assert.equal(F.healthScore(d, TODAY).score, null);
  assert.equal(F.dailyGuideline(d, TODAY), null);
  assert.equal(F.whatIf(d, TODAY, {}), null);
  assert.deepEqual(F.insights(d, TODAY), []);
  const { a } = fresh();
  for (const bad of [{ amount: '0' }, { amount: '-5' }, { amount: 'x' }, { date: '2026-02-30' }, { date: '' }, { categoryId: 'nope' }, { accountId: 'nope' }, { type: 'bogus' }]) {
    const r = tx(Object.assign({ type: 'expense', accountId: a.id }, bad));
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  assert.equal(tx({ type: 'income', accountId: a.id, categoryId: 'cat_food' }).ok, false); // wrong category kind
  assert.equal(S().transactions.length, 0);
});

test('14. JSON export/import round trip, validation rejects bad input, replace keeps a backup', () => {
  const { a } = fresh();
  tx({ type: 'expense', amount: '12.34', accountId: a.id, description: '<img src=x onerror=alert(1)>' });
  const json = store.exportJSON();
  const insp = store.inspectImport(json);
  assert.ok(insp.ok); assert.equal(insp.counts.transactions, 1);
  assert.equal(insp.data.transactions[0].amount, 1234);
  assert.equal(store.inspectImport('not json').ok, false);
  assert.equal(store.inspectImport(JSON.stringify({ schemaVersion: 999 })).ok, false);
  const broken = JSON.parse(json); broken.transactions.push({ id: 'x', type: 'expense', amount: 1.5, date: '2026-01-01', accountId: a.id, categoryId: 'cat_food' }, { id: 'y', type: 'expense', amount: 100, date: 'bad', accountId: a.id, categoryId: 'cat_food' }, { id: 'z', type: 'expense', amount: 100, date: '2026-01-01', accountId: 'ghost', categoryId: 'cat_food' });
  const r = store.inspectImport(JSON.stringify(broken));
  assert.ok(r.ok); assert.equal(r.counts.transactions, 1); assert.equal(r.errors.length, 3);
  const evil = JSON.parse(json); evil.settings.language = 'xx'; evil.settings.currency = 'BTC'; evil.settings.theme = '<script>';
  const e = store.inspectImport(JSON.stringify(evil)); assert.equal(e.data.settings.language, 'en'); assert.equal(e.data.settings.currency, 'DZD');
  store.replaceAll(insp.data);
  assert.ok(store.hasBackup());
  A.deleteTransaction(S().transactions[0].id);
  assert.equal(S().transactions.length, 0);
  assert.ok(store.restoreBackup());
});

test('corrupted storage is preserved, not silently overwritten', () => {
  mem.clear(); mem.set('smm.v1.data', '{broken');
  store._reload();
  assert.equal(store.report().status, 'corrupt');
  assert.ok([...mem.keys()].some((k) => k.startsWith('smm.v1.corrupt')));
});

test('CSV export/import round trip, injection-safe, rejects bad rows', () => {
  const { a, b } = fresh();
  tx({ type: 'expense', amount: '12.5', accountId: a.id, description: '=HYPERLINK("http://x")', notes: 'a,"b"\nc' });
  tx({ type: 'income', amount: '99', categoryId: 'cat_salary', accountId: b.id });
  A.saveTransaction({ type: 'transfer', amount: '5', date: '2026-10-07', accountId: a.id, toAccountId: b.id });
  const text = csv.exportTransactions(S(), S().transactions);
  assert.ok(text.includes("'=HYPERLINK"));
  const copy = JSON.parse(JSON.stringify(S())); copy.transactions = [];
  const res = csv.importTransactions(text, copy, () => store.uid('tx'));
  assert.equal(res.errors.length, 0); assert.equal(res.rows.length, 3);
  const ex = res.rows.find((t) => t.type === 'expense');
  assert.equal(ex.description, '=HYPERLINK("http://x")'); assert.equal(ex.notes, 'a,"b"\nc'); assert.equal(ex.amount, 1250);
  const dup = csv.importTransactions(text, S(), () => 'n'); assert.equal(dup.rows.length, 0); assert.equal(dup.errors.length, 3);
  const bad = 'date,type,amount,category,account\n2026-10-01,expense,abc,food,Bank\n2026-13-01,expense,5,food,Bank\n2026-10-01,expense,5,nocat,Bank\n2026-10-01,expense,5,food,Nope\n2026-10-01,expense,7,food,Bank\n';
  const r2 = csv.importTransactions(bad, S(), () => store.uid('tx'));
  assert.deepEqual(r2.errors.map((x) => x.reason), ['amount', 'date', 'category', 'account']); assert.equal(r2.rows.length, 1);
  assert.equal(csv.importTransactions('foo,bar\n1,2', S(), () => 'x').errors[0].reason, 'headers');
});

test('15. balances stay consistent after many mixed transactions', () => {
  const { a, b } = fresh();
  let expectA = M(1000), expectB = M(200);
  const ops = [['income', 100, a], ['expense', 33.33, a], ['expense', 10, b], ['refund', 3.33, a], ['income', 7.77, b]];
  ops.forEach(([type, amt, acc]) => { tx({ type, amount: String(amt), accountId: acc.id, categoryId: type === 'income' ? 'cat_salary' : 'cat_food' }); const v = M(amt); const sign = type === 'income' || type === 'refund' ? 1 : -1; if (acc === a) expectA += sign * v; else expectB += sign * v; });
  A.saveTransaction({ type: 'transfer', amount: '50.25', date: '2026-10-08', accountId: b.id, toAccountId: a.id }); expectB -= M(50.25); expectA += M(50.25);
  assert.equal(F.accountBalance(S(), a.id), expectA); assert.equal(F.accountBalance(S(), b.id), expectB);
  assert.equal(F.totalBalance(S()), expectA + expectB);
  assert.equal(F.accountBalance(S(), a.id, '2026-10-04'), M(1000)); // as-of date excludes later tx
  // archived accounts leave the total but not history
  A.setAccountArchived(b.id, true); assert.equal(F.totalBalance(S()), expectA);
});

test('accounts: delete blocked when used, currency isolation', () => {
  const { a, b } = fresh();
  tx({ accountId: a.id });
  assert.equal(A.deleteAccount(a.id).ok, false);
  assert.ok(A.deleteAccount(b.id).ok);
  const usd = A.saveAccount({ name: 'USD stash', type: 'other', openingBalance: '100', currency: 'USD' }).item;
  assert.equal(F.totalBalance(S()), M(990)); // 1000 opening - 10 expense; USD account not mixed into DZD total
  tx({ accountId: usd.id, amount: '40' });
  assert.equal(F.periodTotals(S(), month).expense, M(10)); // the USD expense is excluded; only the earlier DZD expense counts
  assert.equal(A.saveTransaction({ type: 'transfer', amount: '5', date: TODAY, accountId: a.id, toAccountId: usd.id }).ok, false);
});

test('categories: in-use categories cannot be deleted; ids are stable', () => {
  const { a } = fresh();
  tx({ accountId: a.id });
  assert.equal(A.deleteCategory('cat_food').ok, false);
  const c = A.saveCategory({ kind: 'expense', name: 'Pets', color: '#112233' }).item;
  assert.ok(A.deleteCategory(c.id).ok);
  assert.equal(A.saveCategory({ kind: 'expense', name: 'pets' }).ok, true);
  assert.equal(A.saveCategory({ kind: 'expense', name: 'PETS' }).ok, false);
});

test('recurring: schedule, month-end anchoring, user-confirmed recording without duplicates', () => {
  const { a } = fresh();
  const r = A.saveRecurring({ name: 'Rent', type: 'expense', amount: '300', categoryId: 'cat_housing', accountId: a.id, frequency: 'monthly', interval: 1, startDate: '2026-01-31', remindDays: 3 }).item;
  const occ = F.occurrences(S().recurring[0], '2026-01-01', '2026-05-31');
  assert.deepEqual(occ, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  A.saveRecurring({ name: 'Gym', type: 'expense', amount: '20', categoryId: 'cat_fitness', accountId: a.id, frequency: 'weekly', interval: 2, startDate: TODAY });
  const gym = S().recurring[1];
  assert.deepEqual(F.occurrences(gym, TODAY, '2026-11-20'), ['2026-10-15', '2026-10-29', '2026-11-12']);
  assert.equal(F.monthlyEquivalent(gym), Math.round((M(20) * 26) / 12));
  const before = S().transactions.length;
  assert.ok(A.recordRecurring(gym.id, TODAY).ok);
  assert.equal(S().transactions.length, before + 1);
  assert.equal(S().recurring[1].nextDue, '2026-10-29');
  assert.equal(S().transactions.at(-1).recurringId, gym.id);
  assert.ok(F.isOverdue(S().recurring[0], TODAY));
  const ended = A.saveRecurring({ name: 'Short', type: 'expense', amount: '5', categoryId: 'cat_bills', accountId: a.id, frequency: 'daily', interval: 1, startDate: '2026-10-10', endDate: '2026-10-12' });
  assert.ok(ended.ok); assert.equal(F.occurrences(S().recurring[2], '2026-10-01', '2026-12-31').length, 3);
});

test('health score: insufficient data explained; transparent factors when data exists', () => {
  const { a } = fresh();
  assert.equal(F.healthScore(S(), TODAY).reason, 'insufficient');
  tx({ type: 'income', amount: '1000', categoryId: 'cat_salary', accountId: a.id, date: '2026-09-02' });
  tx({ type: 'expense', amount: '700', accountId: a.id, date: '2026-09-10' });
  tx({ type: 'income', amount: '1000', categoryId: 'cat_salary', accountId: a.id, date: '2026-08-02' });
  tx({ type: 'expense', amount: '700', accountId: a.id, date: '2026-08-10' });
  A.saveBudget({ period: 'monthly', categoryIds: [], limit: '900' });
  const h = F.healthScore(S(), TODAY);
  assert.ok(h.score != null && h.score >= 0 && h.score <= 100);
  const sr = h.factors.find((f) => f.key === 'savingsRate'); assert.equal(sr.value, 100 * 0.5 > 100 ? 100 : Math.round((0.3 / 0.2) * 100) > 100 ? 100 : sr.value);
  assert.equal(h.factors.find((f) => f.key === 'emergencyFund').value, null); // missing data is not penalised
});

test('daily guideline and what-if use documented assumptions and never mutate data', () => {
  const { a } = fresh();
  tx({ type: 'income', amount: '3000', categoryId: 'cat_salary', accountId: a.id, date: '2026-09-02' });
  tx({ type: 'expense', amount: '1000', accountId: a.id, date: '2026-09-10', categoryId: 'cat_food' });
  A.saveRecurring({ name: 'Net', type: 'expense', amount: '100', categoryId: 'cat_bills', accountId: a.id, frequency: 'monthly', interval: 1, startDate: '2026-10-20' });
  const g = F.dailyGuideline(S(), TODAY);
  assert.equal(g.daysLeft, 17); assert.equal(g.upcoming, M(100));
  assert.equal(g.byFunds, Math.floor((M(1000 + 2000 - 100)) / 17 / 1) > 0 ? Math.floor((F.totalBalance(S()) - M(100)) / 17) : 0);
  const snapshot = JSON.stringify(S());
  const w = F.whatIf(S(), TODAY, { months: 6, cat: 'cat_food', reducePct: 50, purchase: M(500), saveFixed: M(100), incomeChangePct: -10 });
  assert.equal(w.avgIncome, M(3000)); assert.equal(w.avgCat, M(1000));
  assert.equal(w.scNet, M(2700) - M(500)); assert.equal(w.scenario[0], F.totalBalance(S()) - M(500)); assert.equal(w.savedFixed, M(600));
  assert.equal(JSON.stringify(S()), snapshot);
});

test('student summary reuses the same engine', () => {
  const { a } = fresh();
  A.saveStudent({ semesterStart: '2026-09-01', semesterEnd: '2027-01-31', semesterBudget: '5000', allowance: '400', allowanceFreq: 'monthly' });
  tx({ amount: '300', categoryId: 'cat_food', accountId: a.id, date: '2026-10-02' });
  tx({ amount: '100', categoryId: 'cat_entertainment', accountId: a.id, date: '2026-10-03' }); // not a student category
  tx({ type: 'income', amount: '200', categoryId: 'cat_scholarship', accountId: a.id, date: '2026-10-04' });
  const s = F.studentSummary(S(), TODAY);
  assert.equal(s.spent, M(300)); assert.equal(s.remaining, M(4700)); assert.equal(s.incomeReceived, M(200)); assert.equal(s.monthSpent, M(300));
  assert.equal(s.spent, F.budgetSpent(S(), { categoryIds: F.studentCategoryIds(S(), 'expense') }, s.range)); // identical to the budget engine
  assert.equal(A.saveStudent({ semesterStart: '2027-02-01', semesterEnd: '2026-01-01' }).ok, false);
});

test('demo data loads, is flagged, and removes cleanly without touching user data', () => {
  const { a } = fresh();
  tx({ accountId: a.id });
  assert.ok(A.loadDemo(TODAY).ok);
  assert.ok(A.hasDemo()); assert.equal(A.loadDemo(TODAY).ok, false);
  assert.ok(S().transactions.length > 50);
  A.removeDemo();
  assert.equal(S().transactions.length, 1); assert.equal(S().accounts.length, 2); assert.equal(S().budgets.length, 0); assert.ok(!A.hasDemo());
  assert.equal(S().settings.student.semesterBudget, 0);
});

test('notifications: derived from data, read state persists', () => {
  const { a } = fresh();
  A.saveRecurring({ name: 'Phone', type: 'expense', amount: '20', categoryId: 'cat_bills', accountId: a.id, frequency: 'monthly', interval: 1, startDate: '2026-10-10', remindDays: 3 });
  const n = F.notifications(S(), TODAY);
  assert.equal(n.length, 1); assert.equal(n[0].text, 'n.overdue');
  A.markNotificationsRead([n[0].key]); assert.ok(S().readNotifications.includes(n[0].key));
});

test('settings sanitising keeps invalid values out', () => {
  const r = defaults.validateData({ settings: { language: 'de', theme: 'neon', mode: 'x', currency: 'JPY', alertWarn: 500, assistantEndpoint: 'javascript:alert(1)' } });
  assert.ok(r.ok);
  const s = r.data.settings;
  assert.deepEqual([s.language, s.theme, s.mode, s.currency, s.alertWarn, s.assistantEndpoint], ['en', 'midnight', 'system', 'DZD', 99, '']);
});
