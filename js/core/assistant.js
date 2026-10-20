/* Money Assistant — LOCAL DEMONSTRATION engine. Rule-based intent matching over aggregates computed by SMM.finance.
 * It is NOT an AI model. It never invents numbers: every figure is computed deterministically from the ledger, and
 * unknown questions are answered with an explicit "I can't answer that from your data".
 * A real model can be plugged in through settings.assistantEndpoint (see README) — that path sends only aggregates, only with consent. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { finance: F, dates, money } = SMM;

  const RX = {
    afford: /afford|purchase|\bbuy\b|acheter|permettre|achat|شراء|أشتري|اشتري|أستطيع|استطيع/i,
    goal: /save each month|per month|monthly saving|goal|objectif|épargn|epargn|هدف|أدخر|ادخر|ادخار/i,
    compare: /compar|last month|previous month|mois dernier|précédent|precedent|الشهر الماضي|مقارنة|مقارنه|قارن/i,
    upcoming: /upcoming|recurring|coming|next payment|prochain|récurr|recurr|à venir|القادمة|القادمه|متكررة|دفعات|الاشتراكات/i,
    topcat: /largest|biggest|top |most|category|catégorie|categorie|plus grand|plus gros|أكبر|اكبر|فئة|فئه|الأكثر|الاكثر/i,
    income: /income|earn|gagn|revenu|salaire|دخل|ربحت|راتب/i,
    spent: /spent|spend|expens|dépens|depens|صرفت|أنفقت|انفقت|مصروف|صرف|إنفاق|انفاق/i,
    balance: /balance|how much.*(have|money)|solde|رصيد|كم أملك|كم املك|أملك/i,
  };
  const numberIn = (txt) => {
    const mm = String(txt).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\d[\d\s.,]*/g);
    if (!mm) return null;
    const v = mm.map((s) => money.parse(s.trim())).filter((x) => x != null);
    return v.length ? v[v.length - 1] : null;
  };

  function answer(d, text, today) {
    text = String(text || '').trim();
    if (!text) return { key: 'as.a.empty' };
    if (!d.accounts.length || !d.transactions.length) return { key: 'as.a.noData' };
    const month = dates.range('month', today), last = dates.range('lastMonth', today);
    const tot = F.periodTotals(d, month), prev = F.periodTotals(d, last);
    const amount = numberIn(text);

    if (RX.afford.test(text) && amount) {
      const bal = F.totalBalance(d); const guide = F.dailyGuideline(d, today);
      const mb = d.budgets.filter((b) => b.period === 'monthly').map((b) => F.budgetUsage(d, b, today));
      const left = mb.length ? mb.reduce((a, u) => a + Math.max(0, u.remaining), 0) : null;
      return { key: amount <= bal - (guide ? guide.upcoming : 0) && (left == null || amount <= left) ? 'as.a.affordYes' : amount <= bal ? 'as.a.affordTight' : 'as.a.affordNo', params: { m_amount: amount, m_balance: bal, m_upcoming: guide ? guide.upcoming : 0, m_left: left == null ? 0 : left }, extra: left == null ? null : 'as.a.affordBudget' };
    }
    if (RX.goal.test(text) && d.goals.length) {
      const gl = d.goals.find((x) => !F.goalProgress(x, today).done && x.targetDate) || d.goals.find((x) => !F.goalProgress(x, today).done);
      if (!gl) return { key: 'as.a.goalsDone' };
      const p = F.goalProgress(gl, today);
      return p.suggestedMonthly ? { key: 'as.a.goalSave', params: { goal: gl.name, m_monthly: p.suggestedMonthly, m_remaining: p.remaining, n: p.monthsLeft } } : { key: 'as.a.goalNoDate', params: { goal: gl.name, m_remaining: p.remaining } };
    }
    if (RX.compare.test(text)) {
      if (!prev.expense && !prev.income) return { key: 'as.a.noPrev' };
      const diff = tot.expense - prev.expense;
      return { key: diff === 0 ? 'as.a.cmpSame' : diff > 0 ? 'as.a.cmpUp' : 'as.a.cmpDown', params: { m_cur: tot.expense, m_prev: prev.expense, m_diff: Math.abs(diff), pct: prev.expense ? Math.round((Math.abs(diff) / prev.expense) * 100) : 0 } };
    }
    if (RX.upcoming.test(text)) {
      const up = F.upcoming(d, today, dates.addDays(today, 30)).slice(0, 5);
      if (!up.length) return { key: 'as.a.noUpcoming' };
      return { key: 'as.a.upcoming', params: { n: up.length }, lines: up.map((u) => ({ date: u.date, name: u.rec.name, amount: u.rec.amount, type: u.rec.type })) };
    }
    if (RX.topcat.test(text)) {
      const c = F.categoryTotals(d, month, 'expense')[0];
      if (!c) return { key: 'as.a.noSpend' };
      return { key: 'as.a.topCat', params: { cat: c.categoryId, m_amount: c.amount, pct: tot.expense ? Math.round((c.amount / tot.expense) * 100) : 0 } };
    }
    if (RX.income.test(text) && !RX.spent.test(text)) return { key: 'as.a.income', params: { m_amount: tot.income } };
    if (RX.spent.test(text)) return { key: 'as.a.spent', params: { m_amount: tot.expense, m_income: tot.income, m_net: Math.abs(tot.net) }, extra: tot.net >= 0 ? 'as.a.netPos' : 'as.a.netNeg' };
    if (RX.balance.test(text)) return { key: 'as.a.balance', params: { m_amount: F.totalBalance(d) } };
    return { key: 'as.a.unknown' };
  }

  /** request body for an external assistant endpoint: aggregates only, never the raw ledger */
  function buildRequest(d, text, today) { return { question: String(text).slice(0, 1000), context: F.assistantContext(d, today), language: d.settings.language }; }

  SMM.assistant = { answer, buildRequest };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
