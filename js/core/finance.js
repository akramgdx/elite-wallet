/* Centralised financial engine. PURE functions of (data, today/range) -> numbers. No DOM, no storage.
 *
 * METRIC DEFINITIONS (single source of truth)
 *  - Account balance      = openingBalance + income + refunds - expenses - transfersOut + transfersIn   (transactions up to a date, inclusive)
 *  - Total balance        = sum of balances of NON-archived accounts whose currency equals the base (settings) currency
 *  - Income (period)      = sum of 'income' transactions. Transfers and refunds are NOT income.
 *  - Expense (period)     = sum of 'expense' transactions MINUS 'refund' transactions (refunds reduce the expense of their category). Transfers are NOT expenses.
 *  - Net cash flow        = income - expense (as defined above)
 *  - Savings rate         = net / income (null when income is 0)
 *  - Budget spent         = expense - refunds in the budget's categories within its period (empty category list = all expense categories)
 * Transactions in accounts of a non-base currency are excluded from every aggregate (no FX conversion is performed).
 */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { dates } = SMM;
  const F = {};

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  F.weekStart = (d) => (d.settings.language === 'ar' ? 0 : 1);
  F.base = (d) => d.settings.currency;
  F.cat = (d, id) => d.categories.find((c) => c.id === id);
  F.acc = (d, id) => d.accounts.find((a) => a.id === id);

  /** transactions that participate in aggregates (account currency == base currency) */
  F.ledger = (d) => {
    const ok = new Set(d.accounts.filter((a) => a.currency === F.base(d)).map((a) => a.id));
    return d.transactions.filter((t) => ok.has(t.accountId));
  };

  /* ---------------- balances ---------------- */
  F.accountBalance = (d, accountId, upTo) => {
    const a = F.acc(d, accountId);
    if (!a) return 0;
    let b = a.openingBalance;
    for (const t of d.transactions) {
      if (upTo && t.date > upTo) continue;
      if (t.accountId === accountId) {
        if (t.type === 'income' || t.type === 'refund') b += t.amount;
        else b -= t.amount; // expense or transfer out
      }
      if (t.type === 'transfer' && t.toAccountId === accountId) b += t.amount;
    }
    return b;
  };
  F.activeBaseAccounts = (d) => d.accounts.filter((a) => !a.archived && a.currency === F.base(d));
  F.totalBalance = (d, upTo) => sum(F.activeBaseAccounts(d).map((a) => F.accountBalance(d, a.id, upTo)));
  F.balanceTrend = (d, range, maxPoints) => {
    const days = dates.diffDays(range.start, range.end);
    const step = days <= 45 ? 1 : days <= 200 ? 7 : 30;
    const pts = [];
    for (let i = 0; i <= days; i += step) { const dt = dates.addDays(range.start, i); pts.push({ date: dt, value: F.totalBalance(d, dt) }); }
    if (pts[pts.length - 1].date !== range.end) pts.push({ date: range.end, value: F.totalBalance(d, range.end) });
    return maxPoints && pts.length > maxPoints ? pts.slice(-maxPoints) : pts;
  };

  /* ---------------- period aggregates ---------------- */
  F.periodTotals = (d, range) => {
    let income = 0, expense = 0, refunds = 0;
    for (const t of F.ledger(d)) {
      if (!dates.inRange(t.date, range)) continue;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      else if (t.type === 'refund') refunds += t.amount;
    }
    const netExpense = expense - refunds;
    const net = income - netExpense;
    return { income, expense: netExpense, grossExpense: expense, refunds, net, savingsRate: income > 0 ? net / income : null };
  };
  F.categoryTotals = (d, range, kind) => {
    kind = kind || 'expense';
    const m = new Map();
    for (const t of F.ledger(d)) {
      if (!dates.inRange(t.date, range) || t.type === 'transfer') continue;
      let v = 0;
      if (kind === 'expense') v = t.type === 'expense' ? t.amount : t.type === 'refund' ? -t.amount : 0;
      else v = t.type === 'income' ? t.amount : 0;
      if (v) m.set(t.categoryId, (m.get(t.categoryId) || 0) + v);
    }
    return [...m].map(([categoryId, amount]) => ({ categoryId, amount })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  };
  F.monthRanges = (today, n, includeCurrent) => {
    const out = [];
    const first = dates.startOfMonth(today);
    for (let i = (includeCurrent ? n - 1 : n); i >= (includeCurrent ? 0 : 1); i--) {
      const s = dates.addMonths(first, -i, 1);
      out.push({ key: s.slice(0, 7), start: s, end: dates.endOfMonth(s) });
    }
    return out;
  };
  F.monthlySeries = (d, endDate, n) =>
    F.monthRanges(endDate, n, true).map((r) => Object.assign({ key: r.key, start: r.start, end: r.end }, F.periodTotals(d, r)));
  F.comparePeriods = (d, a, b) => {
    const A = F.periodTotals(d, a), B = F.periodTotals(d, b);
    const pct = (x, y) => (y ? Math.round(((x - y) / Math.abs(y)) * 100) : null);
    return { a: A, b: B, delta: { income: A.income - B.income, expense: A.expense - B.expense, net: A.net - B.net }, pct: { income: pct(A.income, B.income), expense: pct(A.expense, B.expense), net: pct(A.net, B.net) } };
  };
  F.previousRange = (r) => { const len = dates.diffDays(r.start, r.end) + 1; return { start: dates.addDays(r.start, -len), end: dates.addDays(r.start, -1) }; };
  F.needsWants = (d, range) => {
    let needs = 0, wants = 0;
    for (const c of F.categoryTotals(d, range, 'expense')) { if ((F.cat(d, c.categoryId) || {}).essential) needs += c.amount; else wants += c.amount; }
    return { needs, wants, total: needs + wants };
  };

  /* ---------------- budgets ---------------- */
  F.budgetRange = (b, ref, weekStart) => {
    if (b.period === 'weekly') return dates.range('week', ref, { weekStart });
    if ((b.period === 'semester' || b.period === 'custom') && b.start && b.end) return { start: b.start, end: b.end };
    return dates.range('month', ref);
  };
  F.budgetSpent = (d, b, range) => {
    const all = !b.categoryIds.length;
    let s = 0;
    for (const t of F.ledger(d)) {
      if (!dates.inRange(t.date, range) || (t.type !== 'expense' && t.type !== 'refund')) continue;
      if (!all && !b.categoryIds.includes(t.categoryId)) continue;
      s += t.type === 'expense' ? t.amount : -t.amount;
    }
    return Math.max(0, s);
  };
  F.budgetUsage = (d, b, ref, opts) => {
    opts = opts || {};
    const warn = opts.warn || d.settings.alertWarn;
    const ws = F.weekStart(d);
    const range = F.budgetRange(b, ref, ws);
    const spent = F.budgetSpent(d, b, range);
    let rollover = 0;
    if (b.rollover && (b.period === 'monthly' || b.period === 'weekly')) {
      const prevRef = b.period === 'monthly' ? dates.addMonths(range.start, -1, 1) : dates.addDays(range.start, -7);
      const pr = F.budgetRange(b, prevRef, ws);
      rollover = Math.max(0, b.limit - F.budgetSpent(d, b, pr));
    }
    const limit = b.limit + rollover;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const state = spent > limit ? 'over' : pct >= warn ? 'warn' : 'ok';
    return { range, spent, rollover, limit, remaining: limit - spent, pct, state };
  };

  /* ---------------- recurring ---------------- */
  F.advance = (rec, from) => {
    const n = rec.interval || 1;
    const anchor = dates.parse(rec.startDate).getDate();
    switch (rec.frequency) {
      case 'daily': return dates.addDays(from, n);
      case 'weekly': return dates.addDays(from, 7 * n);
      case 'monthly': return dates.addMonths(from, n, anchor);
      case 'yearly': return dates.addMonths(from, 12 * n, anchor);
      default: return dates.addDays(from, n); // custom = every n days
    }
  };
  F.occurrences = (rec, from, to) => {
    const out = [];
    if (!rec.active) return out;
    let dt = rec.nextDue;
    for (let i = 0; i < 800 && dt <= to; i++) {
      if (rec.endDate && dt > rec.endDate) break;
      if (dt >= from) out.push(dt);
      dt = F.advance(rec, dt);
    }
    return out;
  };
  F.upcoming = (d, from, to) => {
    const out = [];
    for (const r of d.recurring) for (const date of F.occurrences(r, from, to)) out.push({ date, rec: r });
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  };
  F.isOverdue = (rec, today) => rec.active && rec.nextDue < today && (!rec.endDate || rec.nextDue <= rec.endDate);
  F.perYear = (rec) => { const n = rec.interval || 1; return { daily: 365 / n, weekly: 52 / n, monthly: 12 / n, yearly: 1 / n, custom: 365 / n }[rec.frequency]; };
  F.monthlyEquivalent = (rec) => Math.round((rec.amount * F.perYear(rec)) / 12);

  /* ---------------- goals ---------------- */
  F.goalCurrent = (goal) => Math.max(0, sum(goal.contributions.map((c) => c.amount)));
  F.goalProgress = (goal, today) => {
    const current = F.goalCurrent(goal);
    const remaining = Math.max(0, goal.target - current);
    const pct = goal.target > 0 ? Math.min(100, Math.floor((current * 100) / goal.target)) : 0;
    const daysLeft = goal.targetDate ? dates.diffDays(today, goal.targetDate) : null;
    const monthsLeft = daysLeft != null && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30.4375)) : null;
    const weeksLeft = daysLeft != null && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 7)) : null;
    return {
      current, remaining, pct, daysLeft, monthsLeft, done: remaining === 0,
      suggestedMonthly: remaining > 0 && monthsLeft ? Math.ceil(remaining / monthsLeft) : null,
      suggestedWeekly: remaining > 0 && weeksLeft ? Math.ceil(remaining / weeksLeft) : null,
    };
  };
  F.challengeProgress = (c, today) => {
    const done = c.checkins.length;
    const pct = Math.min(100, Math.floor((done * 100) / c.count));
    const periodDays = c.kind === 'weekly' ? 7 : c.kind === 'monthly' ? 30 : 1;
    const lastIdx = Math.min(c.count - 1, Math.floor(Math.max(0, dates.diffDays(c.start, today)) / periodDays));
    const checkedThisPeriod = c.checkins.some((x) => Math.floor(dates.diffDays(c.start, x) / periodDays) === lastIdx);
    return { done, pct, saved: c.kind === 'nospend' ? 0 : done * c.amount, complete: done >= c.count, checkedThisPeriod };
  };

  /* ---------------- health score ---------------- */
  F.healthScore = (d, today) => {
    const months = F.monthRanges(today, 3, false);
    const totals = months.map((r) => F.periodTotals(d, r));
    const factors = [];
    const add = (key, weight, value, extra) => factors.push(Object.assign({ key, weight, value: value == null ? null : Math.round(clamp(value, 0, 100)) }, extra || {}));
    const inc = sum(totals.map((t) => t.income)), exp = sum(totals.map((t) => t.expense));
    const rate = inc > 0 ? (inc - exp) / inc : null;
    add('savingsRate', 30, rate == null ? null : (rate / 0.2) * 100, { raw: rate });
    const monthlyBudgets = d.budgets.map((b) => F.budgetUsage(d, b, today));
    add('budgetAdherence', 25, monthlyBudgets.length ? sum(monthlyBudgets.map((u) => (u.state === 'ok' ? 100 : u.state === 'warn' ? 70 : Math.max(0, 100 - (u.pct - 100) * 2)))) / monthlyBudgets.length : null, { raw: monthlyBudgets.length });
    const exps = totals.map((t) => t.expense).filter((x) => x > 0);
    let cv = null;
    if (exps.length >= 2) { const m = sum(exps) / exps.length; cv = Math.sqrt(sum(exps.map((x) => (x - m) ** 2)) / exps.length) / m; }
    add('expenseStability', 15, cv == null ? null : 100 - cv * 150, { raw: cv });
    const em = d.goals.find((x) => x.emergency);
    add('emergencyFund', 15, em ? F.goalProgress(em, today).pct : null, { raw: em ? em.id : null });
    const upc = sum(F.upcoming(d, today, dates.addDays(today, 30)).filter((u) => u.rec.type === 'expense').map((u) => u.rec.amount));
    add('preparedness', 15, upc > 0 && d.accounts.length ? (F.totalBalance(d) / upc) * 100 : null, { raw: upc });
    const avail = factors.filter((f) => f.value != null);
    if (avail.length < 2) return { score: null, factors, reason: 'insufficient' };
    const score = Math.round(sum(avail.map((f) => f.value * f.weight)) / sum(avail.map((f) => f.weight)));
    return { score, factors, reason: null };
  };

  /* ---------------- guidance ---------------- */
  F.dailyGuideline = (d, today) => {
    if (!F.activeBaseAccounts(d).length) return null;
    const end = dates.endOfMonth(today);
    const daysLeft = dates.diffDays(today, end) + 1;
    const upcoming = sum(F.upcoming(d, today, end).filter((u) => u.rec.type === 'expense').map((u) => u.rec.amount));
    const available = F.totalBalance(d) - upcoming;
    const byFunds = Math.max(0, Math.floor(available / daysLeft));
    const mb = d.budgets.filter((b) => b.period === 'monthly').map((b) => ({ b, u: F.budgetUsage(d, b, today) }));
    let byBudget = null, budgetRemaining = null;
    if (mb.length) {
      const overall = mb.find((x) => !x.b.categoryIds.length);
      budgetRemaining = overall ? Math.max(0, overall.u.remaining) : sum(mb.map((x) => Math.max(0, x.u.remaining)));
      byBudget = Math.floor(budgetRemaining / daysLeft);
    }
    const suggested = byBudget == null ? byFunds : Math.min(byFunds, byBudget);
    return { daysLeft, available, upcoming, byFunds, byBudget, budgetRemaining, suggested, basis: byBudget != null && byBudget < byFunds ? 'budget' : 'funds' };
  };

  F.whatIf = (d, today, sc) => {
    const months = F.monthRanges(today, 3, false).map((r) => ({ r, t: F.periodTotals(d, r) })).filter((x) => x.t.income || x.t.expense);
    if (!months.length) return null;
    const n = months.length;
    const avgIncome = Math.round(sum(months.map((m) => m.t.income)) / n);
    const avgExpense = Math.round(sum(months.map((m) => m.t.expense)) / n);
    const avgCat = sc.cat ? Math.round(sum(months.map((m) => (F.categoryTotals(d, m.r, 'expense').find((c) => c.categoryId === sc.cat) || { amount: 0 }).amount)) / n) : 0;
    const M = clamp(sc.months || 6, 1, 36);
    const sIncome = Math.round(avgIncome * (1 + (sc.incomeChangePct || 0) / 100));
    const sExpense = avgExpense - Math.round((avgCat * clamp(sc.reducePct || 0, 0, 100)) / 100);
    const baseNet = avgIncome - avgExpense, scNet = sIncome - sExpense;
    const b0 = F.totalBalance(d), purchase = sc.purchase || 0;
    const baseline = [], scenario = [];
    for (let i = 0; i <= M; i++) { baseline.push(b0 + i * baseNet); scenario.push(b0 - purchase + i * scNet); }
    const need = purchase - b0;
    return { monthsUsed: n, avgIncome, avgExpense, avgCat, baseNet, scNet, baseline, scenario, months: M, savedFixed: (sc.saveFixed || 0) * M, fixedFits: (sc.saveFixed || 0) <= scNet, affordableNow: b0 >= purchase, monthsToAfford: need > 0 && baseNet > 0 ? Math.ceil(need / baseNet) : null };
  };

  /* ---------------- student finance (same engine, different lens) ---------------- */
  F.studentCategoryIds = (d, kind) => d.categories.filter((c) => c.student && c.kind === kind).map((c) => c.id);
  F.studentSummary = (d, today) => {
    const st = d.settings.student;
    const hasSem = !!(st.semesterStart && st.semesterEnd && st.semesterStart <= st.semesterEnd);
    const expIds = F.studentCategoryIds(d, 'expense'), incIds = F.studentCategoryIds(d, 'income');
    const range = hasSem ? { start: st.semesterStart, end: st.semesterEnd } : null;
    const out = { hasSem, range, budget: st.semesterBudget, expIds, incIds };
    const studentExpenseTotal = (r) => sum(F.categoryTotals(d, r, 'expense').filter((c) => expIds.includes(c.categoryId)).map((c) => c.amount));
    const month = dates.range('month', today);
    out.monthSpent = studentExpenseTotal(month);
    out.allowanceMonthly = st.allowanceFreq === 'weekly' ? Math.round((st.allowance * 52) / 12) : st.allowance;
    out.monthLeft = out.allowanceMonthly - out.monthSpent;
    const horizon = dates.addDays(today, 60);
    const upc = F.upcoming(d, today, horizon).filter((u) => (u.rec.type === 'expense' ? expIds : incIds).includes(u.rec.categoryId)).map((u) => ({ date: u.date, title: u.rec.name, amount: u.rec.amount, kind: u.rec.type }));
    d.events.filter((e) => e.type === 'student' && e.date >= today && e.date <= horizon).forEach((e) => upc.push({ date: e.date, title: e.title, amount: e.amount, kind: 'expense' }));
    out.upcoming = upc.sort((a, b) => (a.date < b.date ? -1 : 1));
    const em = d.goals.find((x) => x.emergency);
    out.emergency = em ? Object.assign({ goal: em }, F.goalProgress(em, today)) : null;
    if (hasSem) {
      out.byCategory = F.categoryTotals(d, range, 'expense').filter((c) => expIds.includes(c.categoryId));
      out.spent = sum(out.byCategory.map((c) => c.amount));
      out.remaining = st.semesterBudget - out.spent;
      out.pct = st.semesterBudget > 0 ? (out.spent / st.semesterBudget) * 100 : 0;
      const total = dates.diffDays(range.start, range.end) + 1;
      const elapsed = clamp(dates.diffDays(range.start, today) + 1, 0, total);
      out.daysTotal = total; out.daysElapsed = elapsed; out.daysLeft = total - elapsed;
      out.timePct = (elapsed / total) * 100;
      out.dailyAllowed = out.daysLeft > 0 ? Math.max(0, Math.floor(out.remaining / out.daysLeft)) : 0;
      const incByCat = F.categoryTotals(d, range, 'income').filter((c) => incIds.includes(c.categoryId));
      out.incomeReceived = sum(incByCat.map((c) => c.amount));
      out.incomeByCategory = incByCat;
      const after = dates.addDays(today, 1) > range.end ? null : { from: today, to: range.end };
      out.incomeExpected = after ? sum(F.upcoming(d, after.from, after.to).filter((u) => u.rec.type === 'income' && incIds.includes(u.rec.categoryId)).map((u) => u.rec.amount)) : 0;
    }
    out.insights = [];
    if (out.hasSem && st.semesterBudget > 0) {
      if (out.spent > st.semesterBudget) out.insights.push({ key: 'sins.over', level: 'warn', params: { m_amount: out.spent - st.semesterBudget } });
      else if (out.pct > out.timePct + 10 && out.daysElapsed > 7) out.insights.push({ key: 'sins.ahead', level: 'warn', params: { spentPct: Math.round(out.pct), timePct: Math.round(out.timePct) } });
      else if (out.daysElapsed > 7) out.insights.push({ key: 'sins.onTrack', level: 'good', params: { spentPct: Math.round(out.pct), timePct: Math.round(out.timePct) } });
      if (out.byCategory.length) out.insights.push({ key: 'sins.topCat', level: 'info', params: { cat: out.byCategory[0].categoryId, m_amount: out.byCategory[0].amount } });
    }
    if (out.allowanceMonthly > 0 && out.monthSpent > out.allowanceMonthly) out.insights.push({ key: 'sins.allowanceOver', level: 'warn', params: { m_amount: out.monthSpent - out.allowanceMonthly } });
    if (out.emergency && !out.emergency.done) out.insights.push({ key: 'sins.emergency', level: 'info', params: { pct: out.emergency.pct } });
    return out;
  };

  /* ---------------- insights, review, notifications ---------------- */
  F.insights = (d, today) => {
    const out = [];
    const thisM = dates.range('month', today), lastM = dates.range('lastMonth', today);
    const cur = F.categoryTotals(d, thisM, 'expense'), prev = F.categoryTotals(d, lastM, 'expense');
    const tot = F.periodTotals(d, thisM);
    const up = cur.find((c) => { const p = (prev.find((x) => x.categoryId === c.categoryId) || {}).amount; return p && c.amount >= p * 1.2 && c.amount - p >= 1000; });
    if (up) { const p = prev.find((x) => x.categoryId === up.categoryId).amount; out.push({ id: 'catUp', level: 'warn', key: 'ins.catUp', params: { cat: up.categoryId, pct: Math.round(((up.amount - p) / p) * 100) } }); }
    d.budgets.forEach((b) => {
      const u = F.budgetUsage(d, b, today);
      const name = b.name || (b.categoryIds.length === 1 ? { cat: b.categoryIds[0] } : '');
      if (u.state === 'over') out.push({ id: 'bo' + b.id, level: 'warn', key: 'ins.budgetOver', params: { budget: b.id, m_over: -u.remaining } });
      else if (u.state === 'warn') out.push({ id: 'bw' + b.id, level: 'warn', key: 'ins.budgetWarn', params: { budget: b.id, pct: Math.round(u.pct) } });
    });
    d.goals.filter((x) => F.goalCurrent(x) > 0).slice(0, 2).forEach((gl) => out.push({ id: 'g' + gl.id, level: 'good', key: 'ins.goalPct', params: { goal: gl.name, pct: F.goalProgress(gl, today).pct } }));
    F.upcoming(d, today, dates.addDays(today, 7)).filter((u) => u.rec.type === 'expense').slice(0, 2).forEach((u) => out.push({ id: 'due' + u.rec.id, level: 'info', key: 'ins.dueSoon', params: { name: u.rec.name, days: dates.diffDays(today, u.date) } }));
    if (tot.income > 0) out.push(tot.net >= 0 ? { id: 'saved', level: 'good', key: 'ins.saved', params: { pct: Math.round((tot.net / tot.income) * 100) } } : { id: 'overspent', level: 'warn', key: 'ins.overspent', params: { m_amount: -tot.net } });
    if (cur.length && tot.expense > 0 && cur[0].amount / tot.expense >= 0.4) out.push({ id: 'top', level: 'info', key: 'ins.topCat', params: { cat: cur[0].categoryId, pct: Math.round((cur[0].amount / tot.expense) * 100) } });
    const rank = { warn: 0, info: 1, good: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  };

  F.monthlyReview = (d, monthRef, today) => {
    const r = dates.range('month', monthRef), pr = dates.range('lastMonth', monthRef);
    const totals = F.periodTotals(d, r), prev = F.periodTotals(d, pr);
    const budgets = d.budgets.map((b) => ({ b, u: F.budgetUsage(d, b, monthRef) }));
    const recs = [];
    if (totals.income > 0 && totals.net < 0) recs.push('rev.rec.overspent');
    if (budgets.some((x) => x.u.state === 'over')) recs.push('rev.rec.overBudget');
    if (totals.savingsRate != null && totals.savingsRate >= 0 && totals.savingsRate < 0.1) recs.push('rev.rec.saveMore');
    if (totals.savingsRate != null && totals.savingsRate >= 0.2) recs.push('rev.rec.good');
    if (!d.budgets.length) recs.push('rev.rec.setBudget');
    return { range: r, totals, prev, topCategories: F.categoryTotals(d, r, 'expense').slice(0, 3), budgets, goals: d.goals.map((gl) => ({ gl, p: F.goalProgress(gl, today) })), commitments: F.upcoming(d, today, dates.addDays(today, 30)), recs };
  };

  F.notifications = (d, today) => {
    const out = [];
    d.recurring.filter((r) => r.active).forEach((r) => {
      const days = dates.diffDays(today, r.nextDue);
      if (F.isOverdue(r, today)) out.push({ key: 'due:' + r.id + ':' + r.nextDue, level: 'warn', text: 'n.overdue', params: { name: r.name, days: -days } });
      else if (days <= r.remindDays && (!r.endDate || r.nextDue <= r.endDate)) out.push({ key: 'due:' + r.id + ':' + r.nextDue, level: 'info', text: days === 0 ? 'n.dueToday' : 'n.dueSoon', params: { name: r.name, days } });
    });
    d.budgets.forEach((b) => {
      const u = F.budgetUsage(d, b, today);
      if (u.state !== 'ok') out.push({ key: 'bud:' + b.id + ':' + u.state + ':' + u.range.start, level: 'warn', text: u.state === 'over' ? 'n.budgetOver' : 'n.budgetWarn', params: { budget: b.id, pct: Math.round(u.pct) } });
    });
    d.goals.forEach((gl) => { if (F.goalProgress(gl, today).done) out.push({ key: 'goal:' + gl.id, level: 'good', text: 'n.goalDone', params: { goal: gl.name } }); });
    d.events.filter((e) => e.date >= today && dates.diffDays(today, e.date) <= 3).forEach((e) => out.push({ key: 'ev:' + e.id, level: 'info', text: 'n.event', params: { title: e.title, days: dates.diffDays(today, e.date) } }));
    return out;
  };

  /** aggregate-only summary sent to an assistant backend (never the raw ledger) */
  F.assistantContext = (d, today) => {
    const m = dates.range('month', today), lm = dates.range('lastMonth', today);
    return {
      currency: F.base(d), today, totalBalance: F.totalBalance(d), thisMonth: F.periodTotals(d, m), lastMonth: F.periodTotals(d, lm),
      topCategories: F.categoryTotals(d, m, 'expense').slice(0, 5).map((c) => ({ category: (F.cat(d, c.categoryId) || {}).key || (F.cat(d, c.categoryId) || {}).name, amount: c.amount })),
      budgets: d.budgets.map((b) => { const u = F.budgetUsage(d, b, today); return { name: b.name, limit: u.limit, spent: u.spent, state: u.state }; }),
      goals: d.goals.map((gl) => ({ name: gl.name, target: gl.target, current: F.goalCurrent(gl) })),
      upcoming: F.upcoming(d, today, dates.addDays(today, 30)).map((u) => ({ name: u.rec.name, date: u.date, amount: u.rec.amount, type: u.rec.type })),
    };
  };

  SMM.finance = F;
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
