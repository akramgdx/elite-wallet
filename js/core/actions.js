/* Domain actions: validate input, then mutate through the store. All return {ok, errors:{field:i18nKey}, item?}.
 * Error values are i18n keys so the UI can show them in the selected language. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { money, dates, store, finance: F, defaults: D } = SMM;
  const fail = (errors) => ({ ok: false, errors });
  const done = (item) => ({ ok: true, errors: {}, item });
  const S = () => store.get();
  const text = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const A = {};

  /** like money.parse but allows a leading minus (opening balances / withdrawals) */
  A.parseSigned = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (s.startsWith('-')) { const p = money.parse(s.slice(1)); return p == null ? null : -p; }
    return money.parse(s);
  };

  /* ---------------- transactions ---------------- */
  A.validateTransaction = (d, i, editingId) => {
    const e = {};
    const type = i.type;
    if (!D.TX_TYPES.includes(type)) e.type = 'err.type';
    const amount = typeof i.amount === 'number' ? i.amount : money.parse(i.amount);
    if (!money.isAmount(amount)) e.amount = 'err.amount';
    if (!dates.isValid(i.date)) e.date = 'err.date';
    const acc = d.accounts.find((a) => a.id === i.accountId);
    if (!acc) e.accountId = 'err.account';
    if (type === 'transfer') {
      const to = d.accounts.find((a) => a.id === i.toAccountId);
      if (!to) e.toAccountId = 'err.account';
      else if (acc && to.id === acc.id) e.toAccountId = 'err.sameAccount';
      else if (acc && to.currency !== acc.currency) e.toAccountId = 'err.currencyMismatch';
    } else if (D.TX_TYPES.includes(type)) {
      const cat = d.categories.find((c) => c.id === i.categoryId);
      if (!cat || cat.kind !== (type === 'income' ? 'income' : 'expense')) e.categoryId = 'err.category';
    }
    if (Object.keys(e).length) return { errors: e };
    const tags = (Array.isArray(i.tags) ? i.tags : String(i.tags || '').split(/[,|]/)).map((x) => text(x, 30)).filter(Boolean).slice(0, 10);
    return { errors: {}, tx: { id: editingId || '', type, amount, date: i.date, accountId: i.accountId, toAccountId: type === 'transfer' ? i.toAccountId : '', categoryId: type === 'transfer' ? '' : i.categoryId, description: text(i.description, 200), notes: text(i.notes, 1000), merchant: text(i.merchant, 100), tags, recurringId: text(i.recurringId, 80) } };
  };
  A.saveTransaction = (input, id) => {
    const r = A.validateTransaction(S(), input, id);
    if (Object.keys(r.errors).length) return fail(r.errors);
    if (id) { const old = S().transactions.find((t) => t.id === id); if (!old) return fail({ _: 'err.notFound' }); r.tx.demo = old.demo; store.update((s) => { s.transactions[s.transactions.indexOf(s.transactions.find((t) => t.id === id))] = r.tx; }, 'transactions'); return done(r.tx); }
    r.tx.id = store.uid('tx');
    store.add('transactions', r.tx);
    return done(r.tx);
  };
  A.deleteTransaction = (id) => { store.remove('transactions', id); return done(); };
  A.addImportedTransactions = (rows) => { store.update((s) => { rows.forEach((t) => s.transactions.push(t)); }, 'transactions'); return rows.length; };

  /* ---------------- accounts ---------------- */
  A.saveAccount = (i, id) => {
    const e = {}; const d = S();
    const name = text(i.name, 60);
    if (!name) e.name = 'err.required';
    else if (d.accounts.some((a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) e.name = 'err.duplicateName';
    const opening = i.openingBalance === '' || i.openingBalance == null ? 0 : A.parseSigned(i.openingBalance);
    if (opening == null) e.openingBalance = 'err.amount';
    if (!D.ACCOUNT_TYPES.includes(i.type)) e.type = 'err.type';
    if (Object.keys(e).length) return fail(e);
    const hasTx = id && d.transactions.some((t) => t.accountId === id || t.toAccountId === id);
    const cur = money.CURRENCIES.includes(i.currency) ? i.currency : d.settings.currency;
    const item = { name, type: i.type, openingBalance: opening, currency: cur, description: text(i.description, 200), color: /^#[0-9a-f]{6}$/i.test(i.color) ? i.color : D.COLORS[0], archived: !!i.archived };
    if (id) {
      const old = d.accounts.find((a) => a.id === id);
      if (hasTx && old.currency !== cur) item.currency = old.currency; // currency is locked once transactions exist
      store.patch('accounts', id, item); return done(Object.assign({ id }, item));
    }
    item.id = store.uid('acc');
    store.add('accounts', item); return done(item);
  };
  A.setAccountArchived = (id, v) => { store.patch('accounts', id, { archived: !!v }); return done(); };
  A.deleteAccount = (id) => {
    if (S().transactions.some((t) => t.accountId === id || t.toAccountId === id) || S().recurring.some((r) => r.accountId === id)) return fail({ _: 'err.accountInUse' });
    store.remove('accounts', id); return done();
  };

  /* ---------------- categories ---------------- */
  A.saveCategory = (i, id) => {
    const e = {}; const d = S();
    const name = text(i.name, 60);
    const existing = id && d.categories.find((c) => c.id === id);
    if (!name && !(existing && existing.key)) e.name = 'err.required';
    const kind = existing ? existing.kind : i.kind === 'income' ? 'income' : 'expense';
    if (name && d.categories.some((c) => c.id !== id && c.kind === kind && (c.name || '').toLowerCase() === name.toLowerCase())) e.name = 'err.duplicateName';
    if (Object.keys(e).length) return fail(e);
    const item = { name: existing && existing.key && !i.renamed ? '' : name, color: /^#[0-9a-f]{6}$/i.test(i.color) ? i.color : D.COLORS[0], icon: text(i.icon, 20) || 'tag', essential: !!i.essential, student: !!i.student };
    if (id) { store.patch('categories', id, item); return done(item); }
    Object.assign(item, { id: store.uid('cat'), kind, key: '', archived: false });
    store.add('categories', item); return done(item);
  };
  A.categoryInUse = (id) => { const d = S(); return d.transactions.some((t) => t.categoryId === id) || d.budgets.some((b) => b.categoryIds.includes(id)) || d.recurring.some((r) => r.categoryId === id); };
  A.setCategoryArchived = (id, v) => { store.patch('categories', id, { archived: !!v }); return done(); };
  A.deleteCategory = (id) => { if (A.categoryInUse(id)) return fail({ _: 'err.categoryInUse' }); store.remove('categories', id); return done(); };

  /* ---------------- budgets ---------------- */
  A.saveBudget = (i, id) => {
    const e = {};
    const limit = money.parse(i.limit);
    if (!money.isAmount(limit)) e.limit = 'err.amount';
    if (!D.BUDGET_PERIODS.includes(i.period)) e.period = 'err.type';
    if ((i.period === 'semester' || i.period === 'custom') && (!dates.isValid(i.start) || !dates.isValid(i.end) || i.start > i.end)) e.start = 'err.dateRange';
    if (Object.keys(e).length) return fail(e);
    const cats = (Array.isArray(i.categoryIds) ? i.categoryIds : []).filter((c) => S().categories.some((x) => x.id === c && x.kind === 'expense'));
    const custom = i.period === 'semester' || i.period === 'custom';
    const item = { name: text(i.name, 60), period: i.period, categoryIds: cats, limit, start: custom ? i.start : '', end: custom ? i.end : '', rollover: !!i.rollover && !custom };
    if (id) { store.patch('budgets', id, item); return done(item); }
    item.id = store.uid('bud'); store.add('budgets', item); return done(item);
  };
  A.deleteBudget = (id) => { store.remove('budgets', id); return done(); };

  /* ---------------- recurring ---------------- */
  A.saveRecurring = (i, id) => {
    const e = {}; const d = S();
    const name = text(i.name, 80);
    if (!name) e.name = 'err.required';
    const amount = money.parse(i.amount);
    if (!money.isAmount(amount)) e.amount = 'err.amount';
    if (!dates.isValid(i.startDate)) e.startDate = 'err.date';
    if (i.endDate && (!dates.isValid(i.endDate) || i.endDate < i.startDate)) e.endDate = 'err.dateRange';
    const type = i.type === 'income' ? 'income' : 'expense';
    const cat = d.categories.find((c) => c.id === i.categoryId);
    if (!cat || cat.kind !== type) e.categoryId = 'err.category';
    if (!d.accounts.some((a) => a.id === i.accountId)) e.accountId = 'err.account';
    if (!D.FREQS.includes(i.frequency)) e.frequency = 'err.type';
    const interval = Math.min(365, Math.max(1, parseInt(i.interval, 10) || 1));
    if (Object.keys(e).length) return fail(e);
    const item = { name, type, amount, categoryId: i.categoryId, accountId: i.accountId, frequency: i.frequency, interval, startDate: i.startDate, endDate: i.endDate || '', active: i.active !== false, remindDays: Math.min(30, Math.max(0, parseInt(i.remindDays, 10) || 0)) };
    if (id) {
      const old = d.recurring.find((r) => r.id === id);
      item.nextDue = old.startDate === item.startDate && old.frequency === item.frequency && old.interval === item.interval ? old.nextDue : item.startDate;
      store.patch('recurring', id, item); return done(item);
    }
    item.id = store.uid('rec'); item.nextDue = item.startDate;
    store.add('recurring', item); return done(item);
  };
  A.deleteRecurring = (id) => { store.remove('recurring', id); return done(); };
  /** user-confirmed recording: creates ONE transaction and advances nextDue (no silent duplicates). */
  A.recordRecurring = (id, date, amountStr) => {
    const d = S(); const r = d.recurring.find((x) => x.id === id);
    if (!r) return fail({ _: 'err.notFound' });
    if (r.endDate && r.nextDue > r.endDate) return fail({ _: 'err.recurringEnded' });
    const res = A.saveTransaction({ type: r.type, amount: amountStr != null ? amountStr : r.amount, date: date || r.nextDue, categoryId: r.categoryId, accountId: r.accountId, description: r.name, recurringId: r.id });
    if (!res.ok) return res;
    store.patch('recurring', id, { nextDue: F.advance(r, r.nextDue) });
    return res;
  };
  A.skipRecurring = (id) => { const r = S().recurring.find((x) => x.id === id); if (!r) return fail({ _: 'err.notFound' }); store.patch('recurring', id, { nextDue: F.advance(r, r.nextDue) }); return done(); };

  /* ---------------- goals & challenges ---------------- */
  A.saveGoal = (i, id) => {
    const e = {};
    const name = text(i.name, 80); if (!name) e.name = 'err.required';
    const target = money.parse(i.target); if (!money.isAmount(target)) e.target = 'err.amount';
    if (i.targetDate && !dates.isValid(i.targetDate)) e.targetDate = 'err.date';
    if (Object.keys(e).length) return fail(e);
    const item = { name, target, targetDate: i.targetDate || '', description: text(i.description, 300), color: /^#[0-9a-f]{6}$/i.test(i.color) ? i.color : D.COLORS[0], emergency: !!i.emergency };
    if (id) { store.patch('goals', id, item); return done(item); }
    item.id = store.uid('goal'); item.contributions = [];
    store.add('goals', item); return done(item);
  };
  A.deleteGoal = (id) => { store.remove('goals', id); return done(); };
  /** signed: positive = contribution, negative = withdrawal */
  A.addContribution = (goalId, amountStr, date, note, withdraw) => {
    const e = {}; const gl = S().goals.find((x) => x.id === goalId);
    if (!gl) return fail({ _: 'err.notFound' });
    let amount = money.parse(amountStr);
    if (!money.isAmount(amount)) e.amount = 'err.amount';
    if (!dates.isValid(date)) e.date = 'err.date';
    if (!e.amount && withdraw) { amount = -amount; if (-amount > F.goalCurrent(gl)) e.amount = 'err.withdrawTooMuch'; }
    if (Object.keys(e).length) return fail(e);
    store.update((s) => { s.goals.find((x) => x.id === goalId).contributions.push({ id: store.uid('c'), date, amount, note: text(note, 100) }); }, 'goals');
    return done();
  };
  A.deleteContribution = (goalId, cid) => { store.update((s) => { const gl = s.goals.find((x) => x.id === goalId); gl.contributions = gl.contributions.filter((c) => c.id !== cid); }, 'goals'); return done(); };
  A.saveChallenge = (i) => {
    const e = {};
    const kind = ['weekly', 'monthly', 'nospend'].includes(i.kind) ? i.kind : 'weekly';
    const amount = kind === 'nospend' ? 0 : money.parse(i.amount);
    if (kind !== 'nospend' && !money.isAmount(amount)) e.amount = 'err.amount';
    const count = parseInt(i.count, 10);
    if (!(count >= 1 && count <= 366)) e.count = 'err.count';
    if (Object.keys(e).length) return fail(e);
    const item = { id: store.uid('chal'), kind, name: text(i.name, 80), amount, count, start: dates.today(), checkins: [] };
    store.add('challenges', item); return done(item);
  };
  A.checkinChallenge = (id, today) => {
    const c = S().challenges.find((x) => x.id === id); if (!c) return fail({ _: 'err.notFound' });
    const p = F.challengeProgress(c, today);
    if (p.checkedThisPeriod || p.complete) return fail({ _: 'err.alreadyChecked' });
    store.update((s) => { s.challenges.find((x) => x.id === id).checkins.push(today); }, 'challenges'); return done();
  };
  A.deleteChallenge = (id) => { store.remove('challenges', id); return done(); };

  /* ---------------- events, journal, notifications ---------------- */
  A.saveEvent = (i, id) => {
    const e = {}; const title = text(i.title, 80);
    if (!title) e.title = 'err.required';
    if (!dates.isValid(i.date)) e.date = 'err.date';
    const amount = i.amount === '' || i.amount == null ? 0 : money.parse(i.amount);
    if (amount == null) e.amount = 'err.amount';
    if (Object.keys(e).length) return fail(e);
    const item = { title, date: i.date, type: D.EVENT_TYPES.includes(i.type) ? i.type : 'other', amount };
    if (id) { store.patch('events', id, item); return done(item); }
    item.id = store.uid('ev'); store.add('events', item); return done(item);
  };
  A.deleteEvent = (id) => { store.remove('events', id); return done(); };
  A.addJournal = (txt, date) => { const t = text(txt, 2000); if (!t) return fail({ text: 'err.required' }); const item = { id: store.uid('j'), date: date || dates.today(), text: t }; store.add('journal', item); return done(item); };
  A.deleteJournal = (id) => { store.remove('journal', id); return done(); };
  A.markNotificationsRead = (keys) => { store.update((s) => { s.readNotifications = Array.from(new Set(s.readNotifications.concat(keys))).slice(-500); }, 'notifications'); };

  /* ---------------- student settings ---------------- */
  A.saveStudent = (i) => {
    const e = {};
    const budget = i.semesterBudget === '' ? 0 : money.parse(i.semesterBudget);
    const allowance = i.allowance === '' ? 0 : money.parse(i.allowance);
    if (budget == null) e.semesterBudget = 'err.amount';
    if (allowance == null) e.allowance = 'err.amount';
    if ((i.semesterStart || i.semesterEnd) && (!dates.isValid(i.semesterStart) || !dates.isValid(i.semesterEnd) || i.semesterStart > i.semesterEnd)) e.semesterStart = 'err.dateRange';
    if (Object.keys(e).length) return fail(e);
    store.setSettings({ student: { semesterStart: i.semesterStart || '', semesterEnd: i.semesterEnd || '', semesterBudget: budget, allowance, allowanceFreq: i.allowanceFreq === 'weekly' ? 'weekly' : 'monthly', emergencyTarget: S().settings.student.emergencyTarget, demo: false } });
    return done();
  };

  /* ---------------- demo data (always flagged, always removable) ---------------- */
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  A.hasDemo = () => { const d = S(); return d.accounts.some((a) => a.demo) || d.transactions.some((t) => t.demo) || d.settings.student.demo === true; };
  A.loadDemo = (today) => {
    if (A.hasDemo()) return fail({ _: 'err.demoExists' });
    const r = rng(20261015); const m = (n) => n * 100;
    const cur = S().settings.currency;
    store.update((s) => {
      const acc = (name, type, open, color) => { const a = { id: store.uid('acc'), name, type, openingBalance: m(open), currency: cur, description: '', color, archived: false, demo: true }; s.accounts.push(a); return a; };
      const cash = acc('Demo · Cash', 'cash', 6000, '#f59e0b'), bank = acc('Demo · Bank', 'bank', 45000, '#3b82f6'), sav = acc('Demo · Savings', 'savings', 20000, '#22c55e');
      const tx = (type, date, amount, cat, a, desc, extra) => { if (date > today) return; s.transactions.push(Object.assign({ id: store.uid('tx'), type, amount: m(amount), date, accountId: a.id, toAccountId: '', categoryId: cat ? 'cat_' + cat : '', description: desc || '', notes: '', merchant: '', tags: [], recurringId: '', demo: true }, extra || {})); };
      const start = dates.addMonths(dates.startOfMonth(today), -3, 1);
      const days = dates.diffDays(start, today);
      for (let i = 0; i <= days; i++) {
        const day = dates.addDays(start, i), dom = +day.slice(8);
        if (r() < 0.55) tx('expense', day, Math.round((250 + r() * 800) / 10) * 10, 'food', r() < 0.6 ? cash : bank, ['Groceries', 'Lunch', 'Cafeteria', 'Bakery'][Math.floor(r() * 4)]);
        if (r() < 0.35) tx('expense', day, Math.round((50 + r() * 200) / 10) * 10, 'transport', cash, ['Bus', 'Tram', 'Taxi'][Math.floor(r() * 3)]);
        if (r() < 0.06) tx('expense', day, Math.round(800 + r() * 2500), 'books', bank, 'Course materials');
        if (r() < 0.07) tx('expense', day, Math.round(500 + r() * 2500), 'entertainment', cash, 'Cinema / outing');
        if (r() < 0.04) tx('expense', day, Math.round(1200 + r() * 3000), 'shopping', bank, 'Clothes');
        if (r() < 0.03) tx('expense', day, Math.round(600 + r() * 1500), 'health', bank, 'Pharmacy');
        if (dom === 1) { tx('expense', day, 12000, 'housing', bank, 'Student housing'); }
        if (dom === 3) { tx('expense', day, 2000, 'bills', bank, 'Internet'); tx('expense', day, 1000, 'subscriptions', bank, 'Streaming'); }
        if (dom === 5) { tx('income', day, 40000, 'allowance', bank, 'Monthly allowance'); tx('transfer', day, 10000, '', bank, 'Cash withdrawal', { toAccountId: cash.id, categoryId: '' }); }
        if (dom === 20) tx('income', day, 15000, 'parttime', bank, 'Part-time job');
        if (dom === 12) tx('transfer', day, 5000, '', bank, 'To savings', { toAccountId: sav.id, categoryId: '' });
      }
      tx('refund', dates.addDays(today, -9), 1800, 'shopping', bank, 'Returned item');
      tx('income', dates.addDays(start, 40), 9000, 'scholarship', bank, 'Scholarship installment');
      const bud = (name, cats, lim) => s.budgets.push({ id: store.uid('bud'), name, period: 'monthly', categoryIds: cats.map((c) => 'cat_' + c), limit: m(lim), start: '', end: '', rollover: false, demo: true });
      bud('Demo · Total monthly budget', [], 45000); bud('Demo · Food', ['food'], 12000); bud('Demo · Transport', ['transport'], 3500); bud('Demo · Leisure', ['entertainment', 'shopping'], 5000);
      const rec = (name, type, amount, cat, a, freq, due) => s.recurring.push({ id: store.uid('rec'), name, type, amount: m(amount), categoryId: 'cat_' + cat, accountId: a.id, frequency: freq, interval: 1, startDate: due, nextDue: due, endDate: '', active: true, remindDays: 3, demo: true });
      const nextDom = (dd) => { const t = dates.addMonths(dates.startOfMonth(today), 0, dd); return t >= today ? t : dates.addMonths(dates.startOfMonth(today), 1, dd); };
      rec('Internet', 'expense', 2000, 'bills', bank, 'monthly', nextDom(3)); rec('Streaming', 'expense', 1000, 'subscriptions', bank, 'monthly', nextDom(3)); rec('Student housing', 'expense', 12000, 'housing', bank, 'monthly', nextDom(1)); rec('Monthly allowance', 'income', 40000, 'allowance', bank, 'monthly', nextDom(5));
      s.goals.push({ id: store.uid('goal'), name: 'Demo · New laptop', target: m(120000), targetDate: dates.addMonths(today, 8, 1), description: '', color: '#8b5cf6', emergency: false, demo: true, contributions: [{ id: store.uid('c'), date: dates.addDays(today, -40), amount: m(20000), note: '' }, { id: store.uid('c'), date: dates.addDays(today, -10), amount: m(15000), note: '' }] });
      s.goals.push({ id: store.uid('goal'), name: 'Demo · Emergency fund', target: m(50000), targetDate: '', description: '', color: '#ef4444', emergency: true, demo: true, contributions: [{ id: store.uid('c'), date: dates.addDays(today, -30), amount: m(12000), note: '' }] });
      s.events.push({ id: store.uid('ev'), title: 'Demo · Semester registration fee', date: dates.addDays(today, 10), type: 'student', amount: m(6000), demo: true }, { id: store.uid('ev'), title: 'Demo · Monthly budget review', date: dates.endOfMonth(today), type: 'review', amount: 0, demo: true });
      const st = s.settings.student;
      if (!st.semesterStart && !st.semesterEnd && !st.semesterBudget && !st.allowance) {
        s.settings.student = { semesterStart: dates.addMonths(dates.startOfMonth(today), -2, 1), semesterEnd: dates.endOfMonth(dates.addMonths(today, 2, 1)), semesterBudget: m(230000), allowance: m(40000), allowanceFreq: 'monthly', emergencyTarget: m(50000), demo: true };
      }
    }, 'demo');
    return done();
  };
  A.removeDemo = () => {
    store.update((s) => {
      const demoAcc = new Set(s.accounts.filter((a) => a.demo).map((a) => a.id));
      s.transactions = s.transactions.filter((t) => !t.demo && !demoAcc.has(t.accountId) && !demoAcc.has(t.toAccountId));
      s.recurring = s.recurring.filter((x) => !x.demo && !demoAcc.has(x.accountId));
      s.accounts = s.accounts.filter((a) => !a.demo);
      s.budgets = s.budgets.filter((b) => !b.demo); s.goals = s.goals.filter((x) => !x.demo); s.events = s.events.filter((e) => !e.demo);
      if (s.settings.student.demo) s.settings.student = SMM.defaults.defaultSettings().student;
    }, 'demo');
    return done();
  };

  SMM.actions = A;
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
