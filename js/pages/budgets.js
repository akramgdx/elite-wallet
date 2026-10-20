/* Budgets + categories + income sources + recurring payments. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, charts } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const m = (v) => '<span class="ltr">' + ui.esc(SMM.i18n.money(v)) + '</span>';
  const bName = (d, b) => b.name || (b.categoryIds.length === 1 ? view.catName(view.catById(d, b.categoryIds[0])) : b.categoryIds.length ? b.categoryIds.map((c) => view.catName(view.catById(d, c))).join(', ') : t('budgets.overall'));

  /* ---------------- budgets ---------------- */
  SMM.pages.budgets = {
    title: 'nav.budgets',
    render() {
      const d = store.get(); const today = dates.today();
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.budgets')) + '</h1><p>' + ui.esc(t('budgets.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('budgets.add')) + '</button></div></div>';
      if (!d.budgets.length) return h + view.empty('target', t('budgets.emptyTitle'), t('budgets.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('budgets.add')) + '</button>');
      const rows = d.budgets.map((b) => ({ b, u: F.budgetUsage(d, b, today) }));
      const alerts = rows.filter((r) => r.u.state !== 'ok');
      if (alerts.length) h += '<div class="callout warn" style="margin-bottom:18px">' + SMM.icon('alert') + '<div><b>' + ui.esc(t('budgets.alerts')) + '</b><ul style="margin-top:4px">' + alerts.map((r) => '<li>' + ui.esc(r.u.state === 'over' ? t('budgets.alertOver', { name: bName(d, r.b), m: SMM.i18n.money(-r.u.remaining) }) : t('budgets.alertWarn', { name: bName(d, r.b), p: SMM.i18n.num(Math.round(r.u.pct)) })) + '</li>').join('') + '</ul></div></div>';
      h += '<div class="grid-cards">' + rows.map(({ b, u }) => '<div class="card item-card"><div class="top"><div style="min-width:0"><div class="row-title" style="font-size:16px">' + ui.esc(bName(d, b)) + (b.demo ? ' <span class="demo-pill">' + ui.esc(t('demo.label')) + '</span>' : '') + '</div><div class="row-sub">' + ui.esc(t('budgets.period.' + b.period)) + ' · ' + ui.esc(SMM.i18n.date(u.range.start, 'short')) + ' – ' + ui.esc(SMM.i18n.date(u.range.end, 'short')) + '</div></div><span style="margin-inline-start:auto">' + view.stateBadge(u.state) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline"><div class="big-amount">' + m(u.spent) + '</div><span class="muted">/ ' + m(u.limit) + '</span></div>' + view.progress(u.pct, u.state, true)
        + '<div class="kv"><span>' + ui.esc(u.remaining >= 0 ? t('budgets.remaining') : t('budgets.overBy')) + '</span><b style="color:' + (u.remaining >= 0 ? 'var(--text)' : 'var(--danger)') + '">' + m(Math.abs(u.remaining)) + '</b></div>'
        + (u.rollover ? '<div class="hint">' + ui.esc(t('budgets.rolloverNote', { m: SMM.i18n.money(u.rollover) })) + '</div>' : '')
        + '<div class="chips">' + (b.categoryIds.length ? b.categoryIds.map((c) => '<span class="chip"><i class="swatch" style="background:' + ui.esc((view.catById(d, c) || {}).color) + '"></i>' + ui.esc(view.catName(view.catById(d, c))) + '</span>').join('') : '<span class="chip">' + ui.esc(t('budgets.allCategories')) + '</span>') + '</div>'
        + '<div class="actions" style="margin:0"><button class="btn btn-secondary btn-sm" data-action="history" data-id="' + b.id + '">' + SMM.icon('chart', 'icon-sm') + ui.esc(t('budgets.history')) + '</button><button class="btn btn-secondary btn-sm" data-action="edit" data-id="' + b.id + '">' + SMM.icon('edit', 'icon-sm') + ui.esc(t('common.edit')) + '</button><button class="btn btn-ghost btn-sm" data-action="del" data-id="' + b.id + '">' + SMM.icon('trash', 'icon-sm') + ui.esc(t('common.delete')) + '</button></div></div>').join('') + '</div>'
        + '<p class="hint" style="margin-top:14px">' + ui.esc(t('budgets.rules', { w: SMM.i18n.num(d.settings.alertWarn) })) + '</p>';
      return h;
    },
    actions: {
      add: () => dlg.budget(), edit: (el) => dlg.budget(el.dataset.id),
      async del(el) { if (await dlg.confirmDelete(t('budgets.deleteConfirm'))) { A.deleteBudget(el.dataset.id); ui.toast(t('budgets.deleted'), 'success'); } },
      history(el) {
        const d = store.get(); const b = d.budgets.find((x) => x.id === el.dataset.id); if (!b) return;
        const today = dates.today(); const custom = b.period === 'semester' || b.period === 'custom';
        const out = [];
        if (custom) { const u = F.budgetUsage(d, b, today); out.push({ label: SMM.i18n.date(u.range.start, 'short') + ' – ' + SMM.i18n.date(u.range.end, 'short'), spent: u.spent, limit: b.limit }); }
        else for (let i = 5; i >= 0; i--) {
          const ref = b.period === 'monthly' ? dates.addMonths(dates.startOfMonth(today), -i, 1) : dates.addDays(today, -7 * i);
          const u = F.budgetUsage(d, b, ref, {}); out.push({ label: b.period === 'monthly' ? SMM.i18n.monthShort(u.range.start) : SMM.i18n.date(u.range.start, 'short'), spent: u.spent, limit: b.limit });
        }
        ui.modal({ title: t('budgets.history') + ' · ' + bName(d, b), wide: true, body: charts.bar({ labels: out.map((x) => x.label), series: [{ name: t('budgets.spent'), values: out.map((x) => x.spent), color: 'var(--chart-1)' }, { name: t('budgets.limit'), values: out.map((x) => x.limit), color: 'var(--c3)' }], fmt: (v) => SMM.i18n.money(v), aria: t('budgets.history') }) + '<p class="hint" style="margin-top:10px">' + ui.esc(t('budgets.historyHint')) + '</p>' });
      },
    },
  };

  /* ---------------- categories ---------------- */
  SMM.pages.categories = {
    title: 'nav.categories',
    render() {
      const d = store.get();
      const block = (kind) => {
        const list = d.categories.filter((c) => c.kind === kind);
        return '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t(kind === 'income' ? 'cat.incomeSources' : 'cat.expenseCategories')) + '</div><button class="btn btn-secondary btn-sm" data-action="add" data-kind="' + kind + '">' + SMM.icon('plus', 'icon-sm') + ui.esc(t('common.add')) + '</button></div><ul class="rows">'
          + list.map((c) => '<li' + (c.archived ? ' style="opacity:.55"' : '') + '>' + view.catChip(c) + '<div class="row-main"><div class="row-title">' + ui.esc(view.catName(c)) + '</div><div class="row-sub">' + [c.essential ? t('cat.need') : kind === 'expense' ? t('cat.want') : '', c.student ? t('cat.studentTag') : '', c.archived ? t('common.archived') : ''].filter(Boolean).map(ui.esc).join(' · ') + '</div></div>'
            + '<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="' + c.id + '" aria-label="' + ui.esc(t('common.edit')) + '">' + SMM.icon('edit', 'icon-sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="archive" data-id="' + c.id + '" aria-label="' + ui.esc(c.archived ? t('common.unarchive') : t('common.archive')) + '">' + SMM.icon('archive', 'icon-sm') + '</button>'
            + (A.categoryInUse(c.id) ? '' : '<button class="btn btn-ghost btn-icon btn-sm" data-action="del" data-id="' + c.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button>') + '</li>').join('') + '</ul></div>';
      };
      return '<div class="page-head"><div><h1>' + ui.esc(t('nav.categories')) + '</h1><p>' + ui.esc(t('cat.subtitle')) + '</p></div></div><div class="grid-2">' + block('expense') + block('income') + '</div><p class="hint" style="margin-top:14px">' + ui.esc(t('cat.stableIds')) + '</p>';
    },
    actions: {
      add: (el) => dlg.category(null, el.dataset.kind), edit: (el) => dlg.category(el.dataset.id),
      archive(el) { const c = store.get().categories.find((x) => x.id === el.dataset.id); A.setCategoryArchived(c.id, !c.archived); },
      async del(el) { if (await dlg.confirmDelete(t('cat.deleteConfirm'))) { const r = A.deleteCategory(el.dataset.id); ui.toast(r.ok ? t('cat.deleted') : t(r.errors._), r.ok ? 'success' : 'error'); } },
    },
  };

  /* ---------------- income ---------------- */
  SMM.pages.income = {
    title: 'nav.income',
    render() {
      const d = store.get(); const today = dates.today();
      const month = dates.range('month', today), year = dates.range('year', today);
      const mTot = F.periodTotals(d, month), yTot = F.periodTotals(d, year);
      const bySrc = F.categoryTotals(d, year, 'income');
      const recs = d.recurring.filter((r) => r.type === 'income' && r.active);
      const recent = d.transactions.filter((x) => x.type === 'income').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.income')) + '</h1><p>' + ui.esc(t('inc.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="addRecurring">' + SMM.icon('repeat') + ui.esc(t('inc.addRecurring')) + '</button><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('inc.add')) + '</button></div></div>';
      if (!d.accounts.length) return h + view.empty('wallet', t('ov.emptyTitle'), t('ov.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('acc.add')) + '</button>');
      h += '<div class="stack"><div class="grid-kpi"><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('inc.thisMonth')) + '</div><div class="k-value" style="color:var(--income)">' + m(mTot.income) + '</div></div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('inc.thisYear')) + '</div><div class="k-value">' + m(yTot.income) + '</div></div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('inc.expectedMonthly')) + '</div><div class="k-value">' + m(recs.reduce((a, r) => a + F.monthlyEquivalent(r), 0)) + '</div><div class="k-sub">' + ui.esc(t('inc.expectedHint')) + '</div></div></div>';
      h += '<div class="grid-2"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('inc.bySource')) + '</div><span class="muted" style="font-size:12.5px">' + ui.esc(t('inc.thisYear')) + '</span></div>' + (bySrc.length ? charts.donut({ slices: bySrc.map((c) => { const cc = view.catById(d, c.categoryId); return { label: view.catName(cc), value: c.amount, color: cc && cc.color }; }), fmt: (v) => SMM.i18n.money(v), aria: t('inc.bySource') }) : '<p class="muted">' + ui.esc(t('inc.none')) + '</p>') + '</div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('inc.recurring')) + '</div></div>' + (recs.length ? '<ul class="rows">' + recs.map((r) => '<li><span class="dot-icon" style="background:var(--success)">' + SMM.icon('repeat') + '</span><div class="row-main"><div class="row-title">' + ui.esc(r.name) + '</div><div class="row-sub">' + ui.esc(t('rec.freq.' + r.frequency)) + ' · ' + ui.esc(t('rec.next')) + ' ' + ui.esc(SMM.i18n.date(r.nextDue, 'short')) + '</div></div>' + view.signed(r.amount, 'income') + '</li>').join('') + '</ul>' : '<p class="muted">' + ui.esc(t('inc.noRecurring')) + '</p>') + '</div></div>';
      h += '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('inc.recent')) + '</div><a class="btn btn-ghost btn-sm" href="#/categories">' + ui.esc(t('inc.manageSources')) + '</a></div>' + (recent.length ? '<ul class="rows">' + recent.map((x) => '<li data-action="detail" data-id="' + x.id + '" style="cursor:pointer">' + view.catChip(view.catById(d, x.categoryId)) + '<div class="row-main"><div class="row-title">' + ui.esc(x.description || view.catName(view.catById(d, x.categoryId))) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(x.date)) + '</div></div>' + view.signed(x.amount, 'income') + '</li>').join('') + '</ul>' : '<p class="muted">' + ui.esc(t('inc.none')) + '</p>') + '</div></div>';
      return h;
    },
    actions: { add: () => dlg.transaction(null, { type: 'income' }), addRecurring: () => dlg.recurring(null, { type: 'income' }), detail: (el) => dlg.transactionDetail(el.dataset.id) },
  };

  /* ---------------- recurring ---------------- */
  SMM.pages.recurring = {
    title: 'nav.recurring',
    render() {
      const d = store.get(); const today = dates.today();
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.recurring')) + '</h1><p>' + ui.esc(t('rec.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('rec.add')) + '</button></div></div>';
      if (!d.recurring.length) return h + view.empty('repeat', t('rec.emptyTitle'), t('rec.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('rec.add')) + '</button>');
      const exp = d.recurring.filter((r) => r.active && r.type === 'expense'), inc = d.recurring.filter((r) => r.active && r.type === 'income');
      const mExp = exp.reduce((a, r) => a + F.monthlyEquivalent(r), 0), mInc = inc.reduce((a, r) => a + F.monthlyEquivalent(r), 0);
      const due = d.recurring.filter((r) => F.isOverdue(r, today) || (r.active && r.nextDue === today));
      h += '<div class="stack"><div class="grid-kpi"><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('rec.monthlyExpenses')) + '</div><div class="k-value" style="color:var(--expense)">' + m(mExp) + '</div><div class="k-sub">' + ui.esc(t('rec.perYear', { m: SMM.i18n.money(mExp * 12) })) + '</div></div><div class="card kpi-card kpi"><div class="k-label">' + ui.esc(t('rec.monthlyIncome')) + '</div><div class="k-value" style="color:var(--income)">' + m(mInc) + '</div></div></div>';
      if (due.length) h += '<div class="callout warn">' + SMM.icon('alert') + '<div>' + ui.esc(t('rec.dueNotice', { n: SMM.i18n.num(due.length) })) + '</div></div>';
      h += '<div class="callout">' + SMM.icon('info') + '<div>' + ui.esc(t('rec.noAuto')) + '</div></div>';
      h += '<div class="card"><table class="table responsive"><thead><tr><th>' + ui.esc(t('rec.name')) + '</th><th>' + ui.esc(t('rec.frequency')) + '</th><th>' + ui.esc(t('rec.next')) + '</th><th class="end">' + ui.esc(t('tx.amount')) + '</th><th></th></tr></thead><tbody>'
        + d.recurring.slice().sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1)).map((r) => { const over = F.isOverdue(r, today); const c = view.catById(d, r.categoryId); return '<tr' + (r.active ? '' : ' style="opacity:.55"') + '><td class="main-cell"><div class="tx-desc">' + view.catChip(c) + '<div><div class="row-title">' + ui.esc(r.name) + '</div><div class="row-sub">' + ui.esc(view.catName(c)) + ' · ' + ui.esc(view.accName(d, r.accountId)) + (r.active ? '' : ' · ' + ui.esc(t('rec.paused'))) + '</div></div></div></td><td data-label="' + ui.esc(t('rec.frequency')) + '">' + ui.esc(t('rec.freq.' + r.frequency)) + (r.interval > 1 ? ' ×' + SMM.i18n.num(r.interval) : '') + '</td><td data-label="' + ui.esc(t('rec.next')) + '">' + ui.esc(SMM.i18n.date(r.nextDue)) + (over ? ' <span class="badge badge-over">' + ui.esc(t('rec.overdue')) + '</span>' : '') + '</td><td class="end amt-cell">' + view.signed(r.amount, r.type) + '</td><td class="end extra"><span style="display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">'
          + (r.active ? '<button class="btn btn-primary btn-sm" data-action="record" data-id="' + r.id + '">' + SMM.icon('check', 'icon-sm') + ui.esc(t('rec.record')) + '</button><button class="btn btn-ghost btn-sm" data-action="skip" data-id="' + r.id + '">' + SMM.icon('skip', 'icon-sm') + ui.esc(t('rec.skip')) + '</button>' : '')
          + '<button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="' + r.id + '" aria-label="' + ui.esc(t('common.edit')) + '">' + SMM.icon('edit', 'icon-sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="del" data-id="' + r.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></span></td></tr>'; }).join('') + '</tbody></table></div></div>';
      return h;
    },
    actions: {
      add: () => dlg.recurring(), edit: (el) => dlg.recurring(el.dataset.id), record: (el) => dlg.recordRecurring(el.dataset.id),
      async skip(el) { if (await ui.confirm({ title: t('rec.skip'), message: t('rec.skipConfirm'), okLabel: t('rec.skip') })) { A.skipRecurring(el.dataset.id); ui.toast(t('rec.skipped'), 'success'); } },
      async del(el) { if (await dlg.confirmDelete(t('rec.deleteConfirm'), t('rec.deleteDetail'))) { A.deleteRecurring(el.dataset.id); ui.toast(t('rec.deleted'), 'success'); } },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
