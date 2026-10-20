/* Reports & analytics, financial health score, monthly review, what-if simulator, needs-vs-wants, journal. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, charts, csv, money } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const m = (v) => '<span class="ltr">' + ui.esc(SMM.i18n.money(v)) + '</span>';
  const st = { tab: 'overview', period: 'month', from: '', to: '', compare: false, sc: { cat: '', reducePct: 15, saveFixed: '', purchase: '', incomeChangePct: 0, months: 6 } };

  function range(today, d) {
    if (st.period === 'custom') { const a = dates.isValid(st.from) ? st.from : dates.addDays(today, -29), b = dates.isValid(st.to) ? st.to : today; return a <= b ? { start: a, end: b } : { start: b, end: a }; }
    return dates.range(st.period, today, { weekStart: F.weekStart(d) });
  }
  const tabs = ['overview', 'budgets', 'accounts', 'recurring', 'health', 'review', 'whatif', 'journal'];

  const body = {
    overview(d, today, r) {
      const tot = F.periodTotals(d, r); const prevR = F.previousRange(r); const cmp = F.comparePeriods(d, r, prevR);
      const cats = F.categoryTotals(d, r, 'expense'), inc = F.categoryTotals(d, r, 'income');
      const series = F.monthlySeries(d, today, 6); const nw = F.needsWants(d, r);
      const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + SMM.i18n.num(v) + '%');
      let h = '<div class="grid-kpi"><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('ov.income')) + '</div><div class="k-value" style="color:var(--income)">' + m(tot.income) + '</div>' + (st.compare ? '<div class="k-sub">' + ui.esc(t('rep.vsPrev')) + ' ' + pct(cmp.pct.income) + '</div>' : '') + '</div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('ov.expenses')) + '</div><div class="k-value" style="color:var(--expense)">' + m(tot.expense) + '</div>' + (tot.refunds ? '<div class="k-sub">' + ui.esc(t('rep.refundsIncluded', { m: SMM.i18n.money(tot.refunds) })) + '</div>' : '') + (st.compare ? '<div class="k-sub">' + ui.esc(t('rep.vsPrev')) + ' ' + pct(cmp.pct.expense) + '</div>' : '') + '</div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('ov.net')) + '</div><div class="k-value" style="color:' + (tot.net >= 0 ? 'var(--income)' : 'var(--expense)') + '">' + (tot.net < 0 ? '−' : '') + m(Math.abs(tot.net)) + '</div>' + (st.compare ? '<div class="k-sub">' + ui.esc(t('rep.vsPrev')) + ' ' + pct(cmp.pct.net) + '</div>' : '') + '</div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('rep.savingsRate')) + '</div><div class="k-value">' + (tot.savingsRate == null ? '—' : SMM.i18n.num(Math.round(tot.savingsRate * 100)) + '%') + '</div></div></div>';
      if (st.compare) h += '<div class="card" style="margin-top:20px"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.compare')) + '</div><span class="muted" style="font-size:12.5px">' + ui.esc(SMM.i18n.date(prevR.start, 'short') + ' – ' + SMM.i18n.date(prevR.end, 'short')) + ' ⟷ ' + ui.esc(SMM.i18n.date(r.start, 'short') + ' – ' + SMM.i18n.date(r.end, 'short')) + '</span></div>' + charts.bar({ labels: [t('ov.income'), t('ov.expenses'), t('ov.net')], series: [{ name: t('rep.previous'), values: [cmp.b.income, cmp.b.expense, cmp.b.net], color: 'var(--c2)' }, { name: t('rep.current'), values: [cmp.a.income, cmp.a.expense, cmp.a.net], color: 'var(--chart-1)' }], fmt: (v) => SMM.i18n.money(v), aria: t('rep.compare') }) + '</div>';
      h += '<div class="grid-2" style="margin-top:20px"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('ov.spendingByCategory')) + '</div></div>' + (cats.length ? charts.donut({ slices: cats.map((c) => { const cc = view.catById(d, c.categoryId); return { label: view.catName(cc), value: c.amount, color: cc && cc.color }; }), fmt: (v) => SMM.i18n.money(v), aria: t('ov.spendingByCategory') }) : '<p class="muted">' + ui.esc(t('rep.noData')) + '</p>') + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.monthly')) + '</div></div>' + charts.bar({ labels: series.map((s) => SMM.i18n.monthShort(s.start)), series: [{ name: t('ov.income'), values: series.map((s) => s.income), color: 'var(--income)' }, { name: t('ov.expenses'), values: series.map((s) => s.expense), color: 'var(--expense)' }], fmt: (v) => SMM.i18n.money(v), aria: t('rep.monthly') }) + '</div></div>';
      h += '<div class="grid-2" style="margin-top:20px"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.netTrend')) + '</div></div>' + charts.line({ labels: series.map((s) => SMM.i18n.monthShort(s.start)), series: [{ name: t('ov.net'), values: series.map((s) => s.net) }], fmt: (v) => SMM.i18n.money(v), area: true, aria: t('rep.netTrend') }) + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.needsWants')) + '</div></div>' + (nw.total ? view.progress((nw.needs / nw.total) * 100, '') + '<div class="kv" style="margin-top:10px"><span>' + ui.esc(t('cat.need')) + '</span><b>' + m(nw.needs) + ' · ' + SMM.i18n.num(Math.round((nw.needs / nw.total) * 100)) + '%</b></div><div class="kv"><span>' + ui.esc(t('cat.want')) + '</span><b>' + m(nw.wants) + ' · ' + SMM.i18n.num(Math.round((nw.wants / nw.total) * 100)) + '%</b></div><p class="hint" style="margin-top:10px">' + ui.esc(t('rep.needsWantsHint')) + '</p>' : '<p class="muted">' + ui.esc(t('rep.noData')) + '</p>') + (inc.length ? '<div class="card-head" style="margin-top:18px"><div class="card-title">' + ui.esc(t('inc.bySource')) + '</div></div><ul class="rows">' + inc.map((c) => '<li>' + view.catChip(view.catById(d, c.categoryId)) + '<div class="row-main"><div class="row-title">' + ui.esc(view.catName(view.catById(d, c.categoryId))) + '</div></div><b>' + m(c.amount) + '</b></li>').join('') + '</ul>' : '') + '</div></div>';
      h += '<div class="card" style="margin-top:20px"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.topCategories')) + '</div><button class="btn btn-secondary btn-sm" data-action="exportReport">' + SMM.icon('download', 'icon-sm') + ui.esc(t('rep.exportCsv')) + '</button></div>' + (cats.length ? '<table class="table"><thead><tr><th>' + ui.esc(t('tx.category')) + '</th><th class="end">' + ui.esc(t('tx.amount')) + '</th><th class="end">%</th></tr></thead><tbody>' + cats.map((c) => '<tr><td>' + ui.esc(view.catName(view.catById(d, c.categoryId))) + '</td><td class="end">' + m(c.amount) + '</td><td class="end">' + SMM.i18n.num(Math.round((c.amount / tot.expense) * 100)) + '%</td></tr>').join('') + '</tbody></table>' : '<p class="muted">' + ui.esc(t('rep.noData')) + '</p>') + '</div>';
      return h;
    },
    budgets(d, today) {
      if (!d.budgets.length) return '<div class="card">' + view.empty('target', t('budgets.emptyTitle'), t('budgets.emptyText'), '<a class="btn btn-primary" href="#/budgets">' + ui.esc(t('nav.budgets')) + '</a>') + '</div>';
      return '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.budgetPerformance')) + '</div></div><ul class="rows">' + d.budgets.map((b) => { const u = F.budgetUsage(d, b, today); return '<li style="flex-wrap:wrap"><div class="row-main" style="min-width:200px"><div class="row-title">' + ui.esc(b.name || (b.categoryIds.length === 1 ? view.catName(view.catById(d, b.categoryIds[0])) : t('budgets.overall'))) + '</div><div class="row-sub">' + m(u.spent) + ' / ' + m(u.limit) + '</div></div>' + view.stateBadge(u.state) + '<div style="flex-basis:100%">' + view.progress(u.pct, u.state, true) + '</div></li>'; }).join('') + '</ul></div>';
    },
    accounts(d) {
      const act = d.accounts.filter((a) => !a.archived);
      if (!act.length) return '<div class="card"><p class="muted">' + ui.esc(t('rep.noData')) + '</p></div>';
      return '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.accountBalances')) + '</div></div>' + charts.bar({ labels: act.map((a) => a.name), series: [{ name: t('acc.balance'), values: act.map((a) => F.accountBalance(d, a.id)), color: 'var(--chart-1)' }], fmt: (v) => SMM.i18n.money(v), aria: t('rep.accountBalances') }) + '<table class="table" style="margin-top:14px"><tbody>' + act.map((a) => '<tr><td>' + ui.esc(a.name) + '</td><td class="end"><b>' + ui.esc(SMM.i18n.money(F.accountBalance(d, a.id), a.currency)) + '</b></td></tr>').join('') + '</tbody></table></div>';
    },
    recurring(d, today) {
      const list = d.recurring.filter((r) => r.active && r.type === 'expense');
      if (!list.length) return '<div class="card"><p class="muted">' + ui.esc(t('rep.noData')) + '</p></div>';
      const tot = list.reduce((a, r) => a + F.monthlyEquivalent(r), 0);
      return '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('rep.recurringExpenses')) + '</div><b>' + m(tot) + ' / ' + ui.esc(t('common.month')) + '</b></div><ul class="rows">' + list.slice().sort((a, b) => F.monthlyEquivalent(b) - F.monthlyEquivalent(a)).map((r) => '<li><div class="row-main"><div class="row-title">' + ui.esc(r.name) + '</div><div class="row-sub">' + ui.esc(t('rec.freq.' + r.frequency)) + '</div></div><b>' + m(F.monthlyEquivalent(r)) + '</b></li>').join('') + '</ul><p class="hint" style="margin-top:10px">' + ui.esc(t('rep.recurringHint')) + '</p></div>';
    },
    health(d, today) {
      const h = F.healthScore(d, today);
      let out = '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('health.title')) + '</div></div>';
      if (h.score == null) out += '<div class="callout">' + SMM.icon('info') + '<div>' + ui.esc(t('health.insufficient')) + '</div></div>';
      else out += '<div class="score-ring">' + charts.ring(h.score, { aria: t('health.title') + ' ' + h.score }) + '<div style="flex:1;min-width:220px"><div class="big-amount">' + SMM.i18n.num(h.score) + ' / 100</div><p class="muted">' + ui.esc(t(h.score >= 70 ? 'health.good' : h.score >= 40 ? 'health.fair' : 'health.low')) + '</p></div></div>';
      out += '<div style="margin-top:14px">' + h.factors.map((f) => '<div class="factor"><div><b>' + ui.esc(t('health.f.' + f.key)) + '</b><div class="hint">' + ui.esc(t('health.f.' + f.key + '.how')) + '</div></div><b>' + (f.value == null ? '<span class="muted">' + ui.esc(t('health.noData')) + '</span>' : SMM.i18n.num(f.value) + '/100') + '</b>' + (f.value == null ? '' : view.progress(f.value, f.value >= 70 ? 'ok' : f.value >= 40 ? 'warn' : 'over')) + '<div class="hint" style="grid-column:1/-1">' + ui.esc(t('health.weight', { w: SMM.i18n.num(f.weight) })) + '</div></div>').join('') + '</div>';
      out += '<div class="callout" style="margin-top:14px">' + SMM.icon('info') + '<div>' + ui.esc(t('health.disclaimer')) + '</div></div></div>';
      return out;
    },
    review(d, today) {
      const ref = st.reviewMonth || dates.startOfMonth(today); const r = F.monthlyReview(d, ref, today);
      let h = '<div class="card"><div class="card-head"><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-secondary btn-icon btn-sm" data-action="revPrev" aria-label="' + ui.esc(t('common.prev')) + '">' + SMM.icon('chevron-left', 'icon-sm flip') + '</button><h2 style="font-size:18px">' + ui.esc(SMM.i18n.monthYear(ref)) + '</h2><button class="btn btn-secondary btn-icon btn-sm" data-action="revNext" aria-label="' + ui.esc(t('common.next')) + '">' + SMM.icon('chevron-right', 'icon-sm flip') + '</button></div></div>';
      if (!d.transactions.length) return h + '<p class="muted">' + ui.esc(t('rep.noData')) + '</p></div>';
      h += '<h3 style="font-size:15px;margin-bottom:8px">' + ui.esc(t('rev.facts')) + '</h3><ul class="rows"><li><span>' + ui.esc(t('ov.income')) + '</span><b style="margin-inline-start:auto">' + m(r.totals.income) + '</b></li><li><span>' + ui.esc(t('ov.expenses')) + '</span><b style="margin-inline-start:auto">' + m(r.totals.expense) + '</b></li><li><span>' + ui.esc(t('ov.net')) + '</span><b style="margin-inline-start:auto;color:' + (r.totals.net >= 0 ? 'var(--income)' : 'var(--expense)') + '">' + (r.totals.net < 0 ? '−' : '') + m(Math.abs(r.totals.net)) + '</b></li><li><span>' + ui.esc(t('rep.vsPrevMonth')) + '</span><b style="margin-inline-start:auto">' + (r.prev.expense ? (r.totals.expense >= r.prev.expense ? '+' : '−') + SMM.i18n.num(Math.round((Math.abs(r.totals.expense - r.prev.expense) / r.prev.expense) * 100)) + '%' : '—') + ' ' + ui.esc(t('ov.expenses')) + '</b></li></ul>';
      if (r.topCategories.length) h += '<h3 style="font-size:15px;margin:16px 0 8px">' + ui.esc(t('rev.top')) + '</h3><ul class="rows">' + r.topCategories.map((c) => '<li>' + view.catChip(view.catById(d, c.categoryId)) + '<div class="row-main"><div class="row-title">' + ui.esc(view.catName(view.catById(d, c.categoryId))) + '</div></div><b>' + m(c.amount) + '</b></li>').join('') + '</ul>';
      if (r.budgets.length) h += '<h3 style="font-size:15px;margin:16px 0 8px">' + ui.esc(t('nav.budgets')) + '</h3><ul class="rows">' + r.budgets.map((x) => '<li><div class="row-main"><div class="row-title">' + ui.esc(x.b.name || (x.b.categoryIds.length === 1 ? view.catName(view.catById(d, x.b.categoryIds[0])) : t('budgets.overall'))) + '</div></div>' + view.stateBadge(x.u.state) + '<b>' + SMM.i18n.num(Math.round(x.u.pct)) + '%</b></li>').join('') + '</ul>';
      if (r.goals.length) h += '<h3 style="font-size:15px;margin:16px 0 8px">' + ui.esc(t('nav.goals')) + '</h3><ul class="rows">' + r.goals.map((x) => '<li><div class="row-main"><div class="row-title">' + ui.esc(x.gl.name) + '</div></div><b>' + SMM.i18n.num(x.p.pct) + '%</b></li>').join('') + '</ul>';
      if (r.commitments.length) h += '<h3 style="font-size:15px;margin:16px 0 8px">' + ui.esc(t('rev.upcoming')) + '</h3><ul class="rows">' + r.commitments.slice(0, 6).map((u) => '<li><div class="row-main"><div class="row-title">' + ui.esc(u.rec.name) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(u.date, 'short')) + '</div></div>' + view.signed(u.rec.amount, u.rec.type) + '</li>').join('') + '</ul>';
      h += '<h3 style="font-size:15px;margin:16px 0 8px">' + ui.esc(t('rev.recs')) + '</h3><div class="stack" style="gap:8px">' + (r.recs.length ? r.recs.map((k) => '<div class="insight info"><span class="i-ic">' + SMM.icon('spark', 'icon-sm') + '</span><span>' + ui.esc(t(k)) + '</span></div>').join('') : '<p class="muted">' + ui.esc(t('rev.noRecs')) + '</p>') + '</div><p class="hint" style="margin-top:10px">' + ui.esc(t('rev.factsVsRecs')) + '</p></div>';
      return h;
    },
    whatif(d, today) {
      const s = st.sc; const expCats = d.categories.filter((c) => c.kind === 'expense' && !c.archived);
      const res = F.whatIf(d, today, { cat: s.cat, reducePct: Number(s.reducePct) || 0, saveFixed: money.parse(s.saveFixed) || 0, purchase: money.parse(s.purchase) || 0, incomeChangePct: Number(s.incomeChangePct) || 0, months: Number(s.months) || 6 });
      let h = '<div class="card"><div class="card-head"><div><div class="card-title">' + ui.esc(t('wi.title')) + '</div><div class="hint">' + ui.esc(t('wi.subtitle')) + '</div></div></div><form id="whatifForm" class="form-grid" novalidate>'
        + ui.field({ name: 'cat', label: t('wi.category'), type: 'select', value: s.cat, options: [{ value: '', label: '—' }].concat(expCats.map((c) => ({ value: c.id, label: view.catName(c) }))) }) + ui.field({ name: 'reducePct', label: t('wi.reducePct'), type: 'number', value: s.reducePct, attrs: 'min="0" max="100"' })
        + ui.field({ name: 'incomeChangePct', label: t('wi.incomeChange'), type: 'number', value: s.incomeChangePct, attrs: 'min="-100" max="500"', hint: t('wi.incomeChangeHint') }) + ui.field({ name: 'purchase', label: t('wi.purchase'), type: 'money', value: s.purchase })
        + ui.field({ name: 'saveFixed', label: t('wi.saveFixed'), type: 'money', value: s.saveFixed }) + ui.field({ name: 'months', label: t('wi.months'), type: 'number', value: s.months, attrs: 'min="1" max="36"' }) + '</form>';
      if (!res) h += '<div class="callout" style="margin-top:14px">' + SMM.icon('info') + '<div>' + ui.esc(t('wi.noData')) + '</div></div>';
      else {
        const labels = res.baseline.map((_, i) => SMM.i18n.num(i));
        h += '<div class="grid-kpi" style="margin-top:18px"><div class="card-flat kpi"><div class="k-label">' + ui.esc(t('wi.avgIncome')) + '</div><div class="k-value" style="font-size:20px">' + m(res.avgIncome) + '</div></div><div class="card-flat kpi"><div class="k-label">' + ui.esc(t('wi.avgExpense')) + '</div><div class="k-value" style="font-size:20px">' + m(res.avgExpense) + '</div></div><div class="card-flat kpi"><div class="k-label">' + ui.esc(t('wi.baseNet')) + '</div><div class="k-value" style="font-size:20px">' + m(res.baseNet) + '</div></div><div class="card-flat kpi"><div class="k-label">' + ui.esc(t('wi.scNet')) + '</div><div class="k-value" style="font-size:20px;color:' + (res.scNet >= res.baseNet ? 'var(--income)' : 'var(--expense)') + '">' + m(res.scNet) + '</div></div></div>'
          + '<div style="margin-top:16px">' + charts.line({ labels: labels, series: [{ name: t('wi.baseline'), values: res.baseline, color: 'var(--c2)', dashed: true }, { name: t('wi.scenario'), values: res.scenario, color: 'var(--chart-1)' }], fmt: (v) => SMM.i18n.money(v), aria: t('wi.title') }) + '<div class="hint" style="text-align:center">' + ui.esc(t('wi.axisMonths')) + '</div></div>';
        const notes = [];
        if (money.parse(s.purchase)) notes.push(res.affordableNow ? t('wi.canAfford') : res.monthsToAfford ? t('wi.afford', { n: SMM.i18n.num(res.monthsToAfford) }) : t('wi.cannotAfford'));
        if (money.parse(s.saveFixed)) notes.push(res.fixedFits ? t('wi.saveFits', { m: SMM.i18n.money(res.savedFixed), n: SMM.i18n.num(res.months) }) : t('wi.saveTooMuch'));
        h += (notes.length ? '<div class="stack" style="gap:8px;margin-top:12px">' + notes.map((n) => '<div class="insight info"><span class="i-ic">' + SMM.icon('info', 'icon-sm') + '</span><span>' + ui.esc(n) + '</span></div>').join('') + '</div>' : '') + '<p class="hint" style="margin-top:12px">' + ui.esc(t('wi.assumptions', { n: SMM.i18n.num(res.monthsUsed) })) + '</p>';
      }
      return h + '<div class="callout" style="margin-top:14px">' + SMM.icon('shield') + '<div>' + ui.esc(t('wi.readOnly')) + '</div></div></div>';
    },
    journal(d) {
      const list = d.journal.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      return '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('jr.title')) + '</div></div><form id="journalForm" class="stack" style="gap:10px" novalidate>' + ui.field({ name: 'text', label: t('jr.new'), type: 'textarea', value: '', max: 2000, placeholder: t('jr.placeholder') }) + '<div><button class="btn btn-primary" type="submit">' + SMM.icon('plus') + ui.esc(t('jr.add')) + '</button></div></form>'
        + (list.length ? '<ul class="rows" style="margin-top:14px">' + list.map((j) => '<li style="align-items:flex-start"><div class="row-main"><div class="row-sub">' + ui.esc(SMM.i18n.date(j.date, 'long')) + '</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + ui.esc(j.text) + '</div></div><button class="btn btn-ghost btn-icon btn-sm" data-action="delJournal" data-id="' + j.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></li>').join('') + '</ul>' : '<p class="muted" style="margin-top:14px">' + ui.esc(t('jr.none')) + '</p>') + '</div>';
    },
  };

  SMM.pages.reports = {
    title: 'nav.reports',
    render() {
      const d = store.get(); const today = dates.today(); const r = range(today, d);
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.reports')) + '</h1><p>' + ui.esc(t('rep.subtitle')) + '</p></div></div>';
      h += '<div class="seg" role="tablist" style="margin-bottom:16px;max-width:100%;overflow:auto">' + tabs.map((k) => '<button role="tab" data-action="tab" data-tab="' + k + '" aria-selected="' + (st.tab === k) + '">' + ui.esc(t('rep.tab.' + k)) + '</button>').join('') + '</div>';
      if (st.tab === 'overview') {
        h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px"><div class="seg" role="group" aria-label="' + ui.esc(t('rep.period')) + '">' + ['week', 'month', 'lastMonth', 'year', 'custom'].map((p) => '<button data-action="period" data-period="' + p + '" aria-pressed="' + (st.period === p) + '">' + ui.esc(t('rep.period.' + p)) + '</button>').join('') + '</div>'
          + (st.period === 'custom' ? '<div class="field"><label for="rf">' + ui.esc(t('common.from')) + '</label><input id="rf" class="input" type="date" data-range="from" value="' + (st.from || r.start) + '"></div><div class="field"><label for="rt">' + ui.esc(t('common.to')) + '</label><input id="rt" class="input" type="date" data-range="to" value="' + (st.to || r.end) + '"></div>' : '')
          + '<label class="check" style="margin-inline-start:auto"><input type="checkbox" data-action="compare"' + (st.compare ? ' checked' : '') + '><span>' + ui.esc(t('rep.comparePrev')) + '</span></label></div>';
      }
      if (!d.transactions.length && ['overview', 'review'].includes(st.tab)) return h + view.empty('chart', t('rep.emptyTitle'), t('rep.emptyText'), '<button class="btn btn-primary" data-action="addTx">' + SMM.icon('plus') + ui.esc(t('tx.add')) + '</button>');
      return h + body[st.tab](d, today, r);
    },
    mount(root) {
      const wf = root.querySelector('#whatifForm');
      if (wf) { const on = ui.debounce(() => { Object.assign(st.sc, ui.formData(wf)); const el = document.activeElement; const nm = el && el.name; SMM.app.render(); if (nm) { const n = document.querySelector('#whatifForm [name="' + nm + '"]'); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) {} } } }, 350); wf.addEventListener('input', on); wf.addEventListener('change', on); wf.addEventListener('submit', (e) => e.preventDefault()); }
      const jf = root.querySelector('#journalForm');
      if (jf) jf.addEventListener('submit', (e) => { e.preventDefault(); const r = A.addJournal(jf.elements.text.value); if (!r.ok) ui.showErrors(jf, r.errors); else ui.toast(t('jr.added'), 'success'); });
    },
    onFilter(root, el) { if (el.dataset.range) { st[el.dataset.range] = el.value; SMM.app.render(); } },
    actions: {
      tab(el) { st.tab = el.dataset.tab; SMM.app.render(); }, period(el) { st.period = el.dataset.period; SMM.app.render(); }, compare(el) { st.compare = el.checked; SMM.app.render(); },
      addTx: () => dlg.transaction(), delJournal(el) { A.deleteJournal(el.dataset.id); ui.toast(t('jr.deleted'), 'success'); },
      revPrev() { st.reviewMonth = dates.addMonths(st.reviewMonth || dates.startOfMonth(dates.today()), -1, 1); SMM.app.render(); }, revNext() { st.reviewMonth = dates.addMonths(st.reviewMonth || dates.startOfMonth(dates.today()), 1, 1); SMM.app.render(); },
      exportReport() {
        const d = store.get(); const r = range(dates.today(), d);
        const rows = F.categoryTotals(d, r, 'expense').map((c) => [(view.catName(view.catById(d, c.categoryId))).replace(/^[=+\-@]/, "'$&"), money.toDecimal(c.amount)]);
        const tot = F.periodTotals(d, r);
        rows.push([t('ov.income'), money.toDecimal(tot.income)], [t('ov.expenses'), money.toDecimal(tot.expense)], [t('ov.net'), money.toDecimal(tot.net)]);
        ui.download('smart-money-report-' + r.start + '_' + r.end + '.csv', csv.toCSV(rows, [t('tx.category'), t('tx.amount')]), 'text/csv;charset=utf-8'); ui.toast(t('rep.exported'), 'success');
      },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
