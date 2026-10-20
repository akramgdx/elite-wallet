/* Overview (dashboard): every number is derived from the ledger through SMM.finance. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, charts } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const m = (v) => '<span class="ltr">' + ui.esc(SMM.i18n.money(v)) + '</span>';

  function delta(cur, prev, invert) {
    if (!prev) return '';
    const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
    if (!p) return '<span class="delta">= ' + t('ov.vsLast') + '</span>';
    const good = invert ? p < 0 : p > 0;
    return '<span class="delta ' + (good ? 'up' : 'down') + '">' + SMM.icon(p > 0 ? 'arrow-up' : 'arrow-down', 'icon-sm') + SMM.i18n.num(Math.abs(p)) + '% <span class="muted" style="font-weight:600">' + ui.esc(t('ov.vsLast')) + '</span></span>';
  }

  SMM.pages = SMM.pages || {};
  SMM.pages.overview = {
    title: 'nav.overview',
    render() {
      const d = store.get(); const today = dates.today();
      if (!d.accounts.length) {
        return '<div class="page-head"><div><h1>' + ui.esc(t('nav.overview')) + '</h1><p>' + ui.esc(t('ov.welcomeText')) + '</p></div></div>'
          + view.empty('wallet', t('ov.emptyTitle'), t('ov.emptyText'), '<button class="btn btn-primary" data-action="addAccount">' + SMM.icon('plus') + ui.esc(t('acc.add')) + '</button><button class="btn btn-secondary" data-action="loadDemo">' + SMM.icon('play') + ui.esc(t('demo.load')) + '</button>')
          + '<p class="hint" style="margin-top:12px;text-align:center">' + ui.esc(t('demo.loadHint')) + '</p>';
      }
      const month = dates.range('month', today), last = dates.range('lastMonth', today);
      const cur = F.periodTotals(d, month), prev = F.periodTotals(d, last);
      const total = F.totalBalance(d);
      const series = F.monthlySeries(d, today, 6);
      const cats = F.categoryTotals(d, month, 'expense');
      const budgets = d.budgets.map((b) => ({ b, u: F.budgetUsage(d, b, today) }));
      const overall = budgets.find((x) => !x.b.categoryIds.length && x.b.period === 'monthly');
      const remainingBudget = overall ? overall.u.remaining : budgets.filter((x) => x.b.period === 'monthly').length ? budgets.filter((x) => x.b.period === 'monthly').reduce((a, x) => a + x.u.remaining, 0) : null;
      const recent = d.transactions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6);
      const upcoming = F.upcoming(d, today, dates.addDays(today, 30)).slice(0, 5);
      const goals = d.goals.slice(0, 3);
      const insights = F.insights(d, today).slice(0, 4);
      const guide = F.dailyGuideline(d, today);
      const trend = F.balanceTrend(d, { start: dates.addDays(today, -59), end: today });
      const demo = A.hasDemo();
      const otherCur = d.accounts.some((a) => a.currency !== F.base(d) && !a.archived);

      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.overview')) + '</h1><p>' + ui.esc(SMM.i18n.monthYear(today)) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="addTx">' + SMM.icon('plus') + ui.esc(t('tx.add')) + '</button></div></div>';
      if (demo) h += '<div class="callout warn" style="margin-bottom:18px">' + SMM.icon('info') + '<div style="flex:1">' + ui.esc(t('demo.banner')) + '</div><button class="btn btn-secondary btn-sm" data-action="removeDemo">' + ui.esc(t('demo.remove')) + '</button></div>';
      if (otherCur) h += '<div class="callout" style="margin-bottom:18px">' + SMM.icon('info') + '<div>' + ui.esc(t('acc.otherCurrencyNote', { c: F.base(d) })) + '</div></div>';

      h += '<div class="stack"><div class="grid-kpi">'
        + '<div class="card kpi-card hero kpi"><div class="k-label">' + SMM.icon('wallet', 'icon-sm') + ui.esc(t('ov.balance')) + '</div><div class="k-value">' + m(total) + '</div><div class="k-sub">' + ui.esc(t('ov.balanceSub', { n: F.activeBaseAccounts(d).length })) + '</div></div>'
        + '<div class="card kpi-card kpi"><div class="k-label">' + SMM.icon('arrow-down', 'icon-sm') + ui.esc(t('ov.income')) + '</div><div class="k-value" style="color:var(--income)">' + m(cur.income) + '</div><div class="k-sub">' + delta(cur.income, prev.income, false) + '</div></div>'
        + '<div class="card kpi-card kpi"><div class="k-label">' + SMM.icon('arrow-up', 'icon-sm') + ui.esc(t('ov.expenses')) + '</div><div class="k-value" style="color:var(--expense)">' + m(cur.expense) + '</div><div class="k-sub">' + delta(cur.expense, prev.expense, true) + '</div></div>'
        + '<div class="card kpi-card kpi"><div class="k-label">' + SMM.icon('trending', 'icon-sm') + ui.esc(t('ov.net')) + '</div><div class="k-value" style="color:' + (cur.net >= 0 ? 'var(--income)' : 'var(--expense)') + '">' + (cur.net >= 0 ? '+' : '−') + m(Math.abs(cur.net)) + '</div><div class="k-sub">' + (cur.savingsRate == null ? ui.esc(t('ov.noIncomeYet')) : ui.esc(t('ov.savingsRate', { p: SMM.i18n.num(Math.round(cur.savingsRate * 100)) }))) + '</div></div>'
        + '<div class="card kpi-card kpi"><div class="k-label">' + SMM.icon('target', 'icon-sm') + ui.esc(t('ov.budgetLeft')) + '</div>' + (remainingBudget == null ? '<div class="k-value muted">—</div><div class="k-sub"><a href="#/budgets">' + ui.esc(t('ov.setBudget')) + '</a></div>' : '<div class="k-value" style="color:' + (remainingBudget >= 0 ? 'var(--text)' : 'var(--expense)') + '">' + (remainingBudget < 0 ? '−' : '') + m(Math.abs(remainingBudget)) + '</div><div class="k-sub">' + ui.esc(remainingBudget < 0 ? t('ov.overBudget') : t('ov.thisMonth')) + '</div>') + '</div>'
        + '</div>';

      h += '<div class="grid-2-1"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.incomeVsExpenses')) + '</div></div>'
        + charts.bar({ labels: series.map((s) => SMM.i18n.monthShort(s.start)), series: [{ name: t('ov.income'), values: series.map((s) => s.income), color: 'var(--income)' }, { name: t('ov.expenses'), values: series.map((s) => s.expense), color: 'var(--expense)' }], fmt: (v) => SMM.i18n.money(v), aria: t('ov.incomeVsExpenses') }) + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.spendingByCategory')) + '</div><a href="#/reports" class="btn btn-ghost btn-sm">' + ui.esc(t('common.details')) + '</a></div>'
        + (cats.length ? charts.donut({ slices: cats.map((c) => { const cc = view.catById(d, c.categoryId); return { label: view.catName(cc), value: c.amount, color: cc && cc.color }; }), fmt: (v) => SMM.i18n.money(v), center: { label: t('ov.expenses'), value: SMM.i18n.moneyShort(cur.expense) }, aria: t('ov.spendingByCategory') }) : '<p class="muted">' + ui.esc(t('ov.noSpendingYet')) + '</p>') + '</div></div>';

      h += '<div class="grid-2"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.balanceTrend')) + '</div><span class="muted" style="font-size:12.5px">' + ui.esc(t('ov.last60')) + '</span></div>'
        + charts.line({ labels: trend.map((p) => SMM.i18n.date(p.date, 'short')), series: [{ name: t('ov.balance'), values: trend.map((p) => p.value) }], area: true, fmt: (v) => SMM.i18n.money(v), aria: t('ov.balanceTrend') }) + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.insights')) + '</div></div>'
        + (insights.length ? '<div class="stack" style="gap:10px">' + insights.map((i) => '<div class="insight ' + i.level + '"><span class="i-ic">' + SMM.icon(i.level === 'warn' ? 'alert' : i.level === 'good' ? 'check' : 'info', 'icon-sm') + '</span><span>' + ui.esc(view.text(i.key, i.params, d)) + '</span></div>').join('') + '</div>' : '<p class="muted">' + ui.esc(t('ov.noInsights')) + '</p>')
        + (guide ? '<div class="card-flat" style="margin-top:14px"><div class="kv"><span>' + ui.esc(t('ov.dailyGuide')) + '</span><b>' + m(guide.suggested) + '</b></div><div class="hint" style="margin-top:6px">' + ui.esc(t(guide.basis === 'budget' ? 'ov.dailyGuideBudget' : 'ov.dailyGuideFunds', { days: SMM.i18n.num(guide.daysLeft), up: SMM.i18n.money(guide.upcoming) })) + '</div></div>' : '') + '</div></div>';

      h += '<div class="grid-3">'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.recent')) + '</div><a href="#/transactions" class="btn btn-ghost btn-sm">' + ui.esc(t('common.viewAll')) + '</a></div>'
        + (recent.length ? '<ul class="rows">' + recent.map((x) => { const c = view.catById(d, x.categoryId); return '<li data-action="txDetail" data-id="' + x.id + '" style="cursor:pointer">' + (x.type === 'transfer' ? '<span class="dot-icon" style="background:var(--muted)">' + SMM.icon('swap') + '</span>' : view.catChip(c)) + '<div class="row-main"><div class="row-title">' + ui.esc(x.description || (x.type === 'transfer' ? t('tx.type.transfer') : view.catName(c))) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(x.date, 'short')) + ' · ' + ui.esc(view.accName(d, x.accountId)) + '</div></div>' + view.signed(x.amount, x.type === 'refund' ? 'income' : x.type) + '</li>'; }).join('') + '</ul>' : '<p class="muted">' + ui.esc(t('tx.none')) + '</p>') + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.upcoming')) + '</div><a href="#/recurring" class="btn btn-ghost btn-sm">' + ui.esc(t('common.viewAll')) + '</a></div>'
        + (upcoming.length ? '<ul class="rows">' + upcoming.map((u) => '<li><span class="dot-icon" style="background:' + (u.rec.type === 'income' ? 'var(--success)' : 'var(--danger)') + '">' + SMM.icon(u.rec.type === 'income' ? 'arrow-down' : 'repeat') + '</span><div class="row-main"><div class="row-title">' + ui.esc(u.rec.name) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(u.date, 'short')) + '</div></div>' + view.signed(u.rec.amount, u.rec.type) + '</li>').join('') + '</ul>' : '<p class="muted">' + ui.esc(t('ov.noUpcoming')) + '</p>') + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.budgets')) + '</div><a href="#/budgets" class="btn btn-ghost btn-sm">' + ui.esc(t('common.viewAll')) + '</a></div>'
        + (budgets.length ? '<div class="stack" style="gap:14px">' + budgets.slice(0, 4).map((x) => '<div><div class="kv"><span style="color:var(--text);font-weight:700">' + ui.esc(x.b.name || (x.b.categoryIds.length === 1 ? view.catName(view.catById(d, x.b.categoryIds[0])) : t('budgets.overall'))) + '</span><b>' + SMM.i18n.num(Math.round(x.u.pct)) + '%</b></div>' + view.progress(x.u.pct, x.u.state, true) + '</div>').join('') + '</div>' : '<p class="muted">' + ui.esc(t('budgets.none')) + '</p>') + '</div></div>';

      h += '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.goals')) + '</div><a href="#/goals" class="btn btn-ghost btn-sm">' + ui.esc(t('common.viewAll')) + '</a></div>'
        + (goals.length ? '<div class="grid-3">' + goals.map((gl) => { const p = F.goalProgress(gl, today); return '<div><div class="kv"><span style="color:var(--text);font-weight:700">' + ui.esc(gl.name) + '</span><b>' + SMM.i18n.num(p.pct) + '%</b></div>' + view.progress(p.pct, p.done ? 'ok' : '') + '<div class="hint" style="margin-top:6px">' + m(p.current) + ' / ' + m(gl.target) + '</div></div>'; }).join('') + '</div>' : '<p class="muted">' + ui.esc(t('goals.none')) + '</p>') + '</div></div>';
      return h;
    },
    actions: {
      addAccount: () => dlg.account(), addTx: () => dlg.transaction(), txDetail: (el) => dlg.transactionDetail(el.dataset.id),
      loadDemo() { const r = A.loadDemo(dates.today()); if (r.ok) ui.toast(t('demo.loaded'), 'success'); else ui.toast(t(r.errors._ || 'err.generic'), 'error'); },
      async removeDemo() { if (await ui.confirm({ title: t('demo.remove'), message: t('demo.removeConfirm'), danger: true, okLabel: t('demo.remove') })) { A.removeDemo(); ui.toast(t('demo.removed'), 'success'); } },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
