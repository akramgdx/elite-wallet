/* Shared dialogs (forms) used from several pages. Every form validates through SMM.actions and shows localized errors inline. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, actions: A, finance: F, dates, money, defaults: D } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const S = () => store.get();
  const dlg = {};
  SMM.pages = SMM.pages || {};

  const catOptions = (kind, includeId) => S().categories.filter((c) => c.kind === kind && (!c.archived || c.id === includeId)).map((c) => ({ value: c.id, label: view.catName(c) }));
  const accOptions = (includeId) => S().accounts.filter((a) => !a.archived || a.id === includeId).map((a) => ({ value: a.id, label: a.name + ' · ' + a.currency }));
  const done = (msgKey) => { ui.toast(t(msgKey), 'success'); };

  /* ---------- transaction ---------- */
  dlg.transaction = (editId, preset) => {
    const d = S();
    if (!d.accounts.length) {
      ui.confirm({ title: t('acc.needTitle'), message: t('acc.needText'), okLabel: t('acc.add') }).then((ok) => { if (ok) dlg.account(); });
      return;
    }
    const ex = editId ? d.transactions.find((x) => x.id === editId) : null;
    const v = Object.assign({ type: 'expense', date: dates.today(), accountId: (d.accounts.find((a) => !a.archived) || d.accounts[0]).id, amount: '', description: '', merchant: '', notes: '', tags: '', categoryId: '', toAccountId: '' }, preset || {}, ex ? Object.assign({}, ex, { amount: money.toDecimal(ex.amount), tags: (ex.tags || []).join(', ') }) : {});
    const body = () => '<div class="seg" role="group" aria-label="' + ui.esc(t('tx.type')) + '" id="typeSeg" style="margin-bottom:16px">' + D.TX_TYPES.map((x) => '<button type="button" data-type="' + x + '" aria-pressed="' + (v.type === x) + '">' + ui.esc(t('tx.type.' + x)) + '</button>').join('') + '</div><input type="hidden" name="type" value="' + v.type + '"><div class="form-grid">'
      + ui.field({ name: 'amount', label: t('tx.amount'), type: 'money', value: v.amount, required: true, currency: (d.accounts.find((a) => a.id === v.accountId) || {}).currency })
      + ui.field({ name: 'date', label: t('tx.date'), type: 'date', value: v.date, required: true })
      + ui.field({ name: 'accountId', label: v.type === 'transfer' ? t('tx.fromAccount') : t('tx.account'), type: 'select', value: v.accountId, options: accOptions(v.accountId), required: true })
      + (v.type === 'transfer'
        ? ui.field({ name: 'toAccountId', label: t('tx.toAccount'), type: 'select', value: v.toAccountId, options: [{ value: '', label: '—' }].concat(accOptions().filter((o) => o.value !== v.accountId)), required: true, hint: t('tx.transferHint') })
        : ui.field({ name: 'categoryId', label: v.type === 'income' ? t('tx.source') : t('tx.category'), type: 'select', value: v.categoryId, options: [{ value: '', label: '—' }].concat(catOptions(v.type === 'income' ? 'income' : 'expense', v.categoryId)), required: true }))
      + ui.field({ name: 'description', label: t('tx.description'), value: v.description, span2: true })
      + (v.type !== 'transfer' ? ui.field({ name: 'merchant', label: v.type === 'income' ? t('tx.payer') : t('tx.merchant'), value: v.merchant }) + ui.field({ name: 'tags', label: t('tx.tags'), value: v.tags, hint: t('tx.tagsHint') }) : '')
      + ui.field({ name: 'notes', label: t('tx.notes'), type: 'textarea', value: v.notes, span2: true, max: 1000 })
      + '</div>';
    ui.formModal({
      title: ex ? t('tx.edit') : t('tx.add'), body: body(),
      onMount(box, api, form) {
        const rerender = (type) => { const cur = ui.formData(form); Object.assign(v, cur, { type }); form.innerHTML = body(); bindSeg(); };
        const bindSeg = () => { form.querySelectorAll('#typeSeg button').forEach((b) => b.addEventListener('click', () => rerender(b.dataset.type))); const acc = form.querySelector('[name=accountId]'); acc.addEventListener('change', () => { v.accountId = acc.value; const cur = form.querySelector('.cur'); const a = S().accounts.find((x) => x.id === acc.value); if (cur && a) cur.textContent = a.currency; if (v.type === 'transfer') rerender('transfer'); }); };
        bindSeg();
      },
      onSubmit(data) {
        const res = A.saveTransaction(data, editId);
        if (!res.ok) return res.errors;
        done(ex ? 'tx.updated' : 'tx.added'); return null;
      },
    });
  };

  dlg.transactionDetail = (id) => {
    const d = S(); const x = d.transactions.find((q) => q.id === id); if (!x) return;
    const cat = view.catById(d, x.categoryId);
    const row = (k, val) => (val ? '<div class="kv" style="padding:8px 0;border-bottom:1px solid var(--border)"><span>' + ui.esc(t(k)) + '</span><b style="text-align:end">' + val + '</b></div>' : '');
    const rec = x.recurringId ? d.recurring.find((r) => r.id === x.recurringId) : null;
    ui.modal({
      title: t('tx.details'),
      body: '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">' + (x.type === 'transfer' ? '<span class="dot-icon" style="background:var(--muted)">' + SMM.icon('swap') + '</span>' : view.catChip(cat)) + '<div><div style="font-weight:800;font-size:17px">' + ui.esc(x.description || (x.type === 'transfer' ? t('tx.type.transfer') : view.catName(cat))) + '</div><div class="muted">' + ui.esc(SMM.i18n.date(x.date, 'long')) + '</div></div><div style="margin-inline-start:auto;font-size:20px">' + view.signed(x.amount, x.type === 'refund' ? 'income' : x.type) + '</div></div>'
        + row('tx.type', ui.esc(t('tx.type.' + x.type))) + row('tx.account', ui.esc(view.accName(d, x.accountId))) + row('tx.toAccount', x.toAccountId ? ui.esc(view.accName(d, x.toAccountId)) : '')
        + row('tx.category', x.type !== 'transfer' ? ui.esc(view.catName(cat)) : '') + row('tx.merchant', ui.esc(x.merchant)) + row('tx.tags', (x.tags || []).map((q) => '<span class="chip">' + ui.esc(q) + '</span>').join(' ')) + row('tx.notes', ui.esc(x.notes)) + row('tx.recurringRef', rec ? ui.esc(rec.name) : '') + (x.demo ? '<p style="margin-top:10px"><span class="demo-pill">' + ui.esc(t('demo.label')) + '</span></p>' : ''),
      footer: '<button class="btn btn-danger" data-del>' + SMM.icon('trash') + ui.esc(t('common.delete')) + '</button><button class="btn btn-primary" data-edit>' + SMM.icon('edit') + ui.esc(t('common.edit')) + '</button>',
      onMount(box, api) {
        box.querySelector('[data-edit]').addEventListener('click', () => { api.close(); dlg.transaction(id); });
        box.querySelector('[data-del]').addEventListener('click', async () => { if (await dlg.confirmDelete(t('tx.deleteConfirm'))) { A.deleteTransaction(id); api.close(); ui.toast(t('tx.deleted'), 'success'); } });
      },
    });
  };
  dlg.confirmDelete = (msg, detail) => ui.confirm({ title: t('common.confirmDelete'), message: msg, detail, danger: true, okLabel: t('common.delete') });

  /* ---------- account ---------- */
  dlg.account = (id) => {
    const d = S(); const ex = id ? d.accounts.find((a) => a.id === id) : null;
    const locked = ex && d.transactions.some((x) => x.accountId === id || x.toAccountId === id);
    const v = Object.assign({ name: '', type: 'bank', openingBalance: '', currency: d.settings.currency, description: '', color: D.COLORS[1] }, ex ? Object.assign({}, ex, { openingBalance: money.toDecimal(ex.openingBalance) }) : {});
    ui.formModal({
      title: ex ? t('acc.edit') : t('acc.add'),
      body: '<div class="form-grid">' + ui.field({ name: 'name', label: t('acc.name'), value: v.name, required: true })
        + ui.field({ name: 'type', label: t('acc.type'), type: 'select', value: v.type, options: D.ACCOUNT_TYPES.map((x) => ({ value: x, label: t('acc.type.' + x) })) })
        + ui.field({ name: 'openingBalance', label: t('acc.opening'), type: 'text', value: v.openingBalance, hint: t('acc.openingHint'), attrs: 'inputmode="decimal"' })
        + ui.field({ name: 'currency', label: t('acc.currency'), type: 'select', value: v.currency, options: money.CURRENCIES.map((c) => ({ value: c, label: c })), attrs: locked ? 'disabled' : '', hint: locked ? t('acc.currencyLocked') : t('acc.currencyHint') })
        + ui.field({ name: 'description', label: t('acc.description'), value: v.description, span2: true })
        + '<div class="field span-2"><span class="label">' + ui.esc(t('common.color')) + '</span><div class="accent-row" role="radiogroup">' + D.COLORS.map((c) => '<label class="accent" style="background:' + c + '"><input type="radio" name="color" value="' + c + '" class="sr-only"' + (c === v.color ? ' checked' : '') + '>' + (c === v.color ? SMM.icon('check', 'icon-sm') : '') + '</label>').join('') + '</div></div></div>',
      onMount(box, api, form) { form.addEventListener('change', (e) => { if (e.target.name === 'color') form.querySelectorAll('.accent').forEach((a) => { a.innerHTML = a.querySelector('input').outerHTML + (a.querySelector('input').checked ? SMM.icon('check', 'icon-sm') : ''); }); }); },
      onSubmit(data) {
        if (locked) data.currency = ex.currency;
        const res = A.saveAccount(data, id); if (!res.ok) return res.errors; done(ex ? 'acc.updated' : 'acc.added'); return null;
      },
    });
  };

  /* ---------- category ---------- */
  dlg.category = (id, kind) => {
    const ex = id ? S().categories.find((c) => c.id === id) : null; kind = ex ? ex.kind : kind || 'expense';
    const v = Object.assign({ name: '', color: D.COLORS[0], icon: 'tag', essential: false, student: false }, ex || {});
    if (ex && ex.key && !ex.name) v.name = t('cat.' + ex.key);
    const icons = ['tag', 'utensils', 'bus', 'home', 'cap', 'book', 'heart', 'film', 'bag', 'repeat', 'receipt', 'dumbbell', 'gift', 'briefcase', 'wallet', 'laptop', 'clock', 'coins', 'piggy', 'star'];
    ui.formModal({
      title: ex ? t('cat.edit') : kind === 'income' ? t('cat.addIncome') : t('cat.addExpense'),
      body: '<div class="form-grid">' + ui.field({ name: 'name', label: t('cat.name'), value: v.name, required: true, span2: true })
        + '<div class="field"><span class="label">' + ui.esc(t('common.color')) + '</span><div class="accent-row" role="radiogroup">' + D.COLORS.map((c) => '<label class="accent" style="background:' + c + '"><input type="radio" name="color" value="' + c + '" class="sr-only"' + (c === v.color ? ' checked' : '') + '>' + (c === v.color ? SMM.icon('check', 'icon-sm') : '') + '</label>').join('') + '</div></div>'
        + ui.field({ name: 'icon', label: t('cat.icon'), type: 'select', value: v.icon, options: icons.map((x) => ({ value: x, label: x })) })
        + (kind === 'expense' ? ui.field({ name: 'essential', label: t('cat.essential'), type: 'checkbox', value: v.essential, hint: t('cat.essentialHint') }) : '')
        + ui.field({ name: 'student', label: t('cat.student'), type: 'checkbox', value: v.student, hint: t('cat.studentHint') }) + '</div>',
      onMount(box, api, form) { form.addEventListener('change', (e) => { if (e.target.name === 'color') form.querySelectorAll('.accent').forEach((a) => { a.innerHTML = a.querySelector('input').outerHTML + (a.querySelector('input').checked ? SMM.icon('check', 'icon-sm') : ''); }); }); },
      onSubmit(data) {
        data.kind = kind; data.renamed = !ex || data.name !== (ex.name || (ex.key ? t('cat.' + ex.key) : ''));
        const res = A.saveCategory(data, id); if (!res.ok) return res.errors; done('cat.saved'); return null;
      },
    });
  };

  /* ---------- budget ---------- */
  dlg.budget = (id, preset) => {
    const ex = id ? S().budgets.find((b) => b.id === id) : null;
    const v = Object.assign({ name: '', period: 'monthly', categoryIds: [], limit: '', start: '', end: '', rollover: false }, preset || {}, ex ? Object.assign({}, ex, { limit: money.toDecimal(ex.limit) }) : {});
    const cats = S().categories.filter((c) => c.kind === 'expense' && !c.archived).map((c) => ({ value: c.id, label: view.catName(c), color: c.color }));
    const body = () => '<div class="form-grid">' + ui.field({ name: 'name', label: t('budgets.name'), value: v.name, hint: t('budgets.nameHint'), span2: true })
      + ui.field({ name: 'limit', label: t('budgets.limit'), type: 'money', value: v.limit, required: true })
      + ui.field({ name: 'period', label: t('budgets.period'), type: 'select', value: v.period, options: D.BUDGET_PERIODS.map((p) => ({ value: p, label: t('budgets.period.' + p) })) })
      + ((v.period === 'semester' || v.period === 'custom') ? ui.field({ name: 'start', label: t('common.from'), type: 'date', value: v.start, required: true }) + ui.field({ name: 'end', label: t('common.to'), type: 'date', value: v.end, required: true }) : ui.field({ name: 'rollover', label: t('budgets.rollover'), type: 'checkbox', value: v.rollover, hint: t('budgets.rolloverHint'), span2: true }))
      + '<div class="field span-2"><span class="label">' + ui.esc(t('budgets.categories')) + '</span>' + ui.checkList('categoryIds', cats, v.categoryIds) + '<div class="hint">' + ui.esc(t('budgets.categoriesHint')) + '</div></div></div>';
    ui.formModal({
      title: ex ? t('budgets.edit') : t('budgets.add'), body: body(),
      onMount(box, api, form) { form.addEventListener('change', (e) => { if (e.target.name === 'period') { Object.assign(v, ui.formData(form)); form.innerHTML = body(); } }); },
      onSubmit(data) { const res = A.saveBudget(data, id); if (!res.ok) return res.errors; done('budgets.saved'); return null; },
    });
  };

  /* ---------- recurring ---------- */
  dlg.recurring = (id, preset) => {
    const d = S(); if (!d.accounts.length) { dlg.transaction(); return; }
    const ex = id ? d.recurring.find((r) => r.id === id) : null;
    const v = Object.assign({ name: '', type: 'expense', amount: '', categoryId: '', accountId: d.accounts[0].id, frequency: 'monthly', interval: 1, startDate: dates.today(), endDate: '', remindDays: 3, active: true }, preset || {}, ex ? Object.assign({}, ex, { amount: money.toDecimal(ex.amount) }) : {});
    const body = () => '<div class="form-grid">' + ui.field({ name: 'name', label: t('rec.name'), value: v.name, required: true, span2: true })
      + ui.field({ name: 'type', label: t('tx.type'), type: 'select', value: v.type, options: [{ value: 'expense', label: t('tx.type.expense') }, { value: 'income', label: t('tx.type.income') }] })
      + ui.field({ name: 'amount', label: t('tx.amount'), type: 'money', value: v.amount, required: true })
      + ui.field({ name: 'categoryId', label: v.type === 'income' ? t('tx.source') : t('tx.category'), type: 'select', value: v.categoryId, options: [{ value: '', label: '—' }].concat(catOptions(v.type, v.categoryId)), required: true })
      + ui.field({ name: 'accountId', label: t('tx.account'), type: 'select', value: v.accountId, options: accOptions(v.accountId), required: true })
      + ui.field({ name: 'frequency', label: t('rec.frequency'), type: 'select', value: v.frequency, options: D.FREQS.map((f) => ({ value: f, label: t('rec.freq.' + f) })) })
      + ui.field({ name: 'interval', label: v.frequency === 'custom' ? t('rec.everyDays') : t('rec.every'), type: 'number', value: v.interval, attrs: 'min="1" max="365"', hint: v.frequency === 'custom' ? t('rec.customHint') : t('rec.intervalHint') })
      + ui.field({ name: 'startDate', label: t('rec.start'), type: 'date', value: v.startDate, required: true, hint: ex ? t('rec.startEditHint') : '' })
      + ui.field({ name: 'endDate', label: t('rec.end'), type: 'date', value: v.endDate })
      + ui.field({ name: 'remindDays', label: t('rec.remind'), type: 'number', value: v.remindDays, attrs: 'min="0" max="30"', hint: t('rec.remindHint') })
      + ui.field({ name: 'active', label: t('rec.active'), type: 'checkbox', value: v.active }) + '</div>';
    ui.formModal({
      title: ex ? t('rec.edit') : t('rec.add'), body: body(),
      onMount(box, api, form) { form.addEventListener('change', (e) => { if (e.target.name === 'type' || e.target.name === 'frequency') { const nt = e.target.name === 'type'; Object.assign(v, ui.formData(form)); if (nt) v.categoryId = ''; form.innerHTML = body(); } }); },
      onSubmit(data) { const res = A.saveRecurring(data, id); if (!res.ok) return res.errors; done('rec.saved'); return null; },
    });
  };
  dlg.recordRecurring = (id) => {
    const d = S(); const r = d.recurring.find((x) => x.id === id); if (!r) return;
    ui.formModal({
      title: t('rec.recordTitle', { name: r.name }), submitLabel: t('rec.record'),
      body: '<p class="muted" style="margin-bottom:14px">' + ui.esc(t('rec.recordText')) + '</p><div class="form-grid">' + ui.field({ name: 'date', label: t('tx.date'), type: 'date', value: r.nextDue, required: true }) + ui.field({ name: 'amount', label: t('tx.amount'), type: 'money', value: money.toDecimal(r.amount), required: true }) + '</div>',
      onSubmit(data) { if (!dates.isValid(data.date)) return { date: 'err.date' }; const res = A.recordRecurring(id, data.date, data.amount); if (!res.ok) return res.errors; done('rec.recorded'); return null; },
    });
  };

  /* ---------- goals ---------- */
  dlg.goal = (id, preset) => {
    const ex = id ? S().goals.find((x) => x.id === id) : null;
    const v = Object.assign({ name: '', target: '', targetDate: '', description: '', color: D.COLORS[2], emergency: false }, preset || {}, ex ? Object.assign({}, ex, { target: money.toDecimal(ex.target) }) : {});
    ui.formModal({
      title: ex ? t('goals.edit') : t('goals.add'),
      body: '<div class="form-grid">' + ui.field({ name: 'name', label: t('goals.name'), value: v.name, required: true, span2: true })
        + ui.field({ name: 'target', label: t('goals.target'), type: 'money', value: v.target, required: true }) + ui.field({ name: 'targetDate', label: t('goals.targetDate'), type: 'date', value: v.targetDate, hint: t('goals.targetDateHint') })
        + ui.field({ name: 'description', label: t('tx.description'), value: v.description, span2: true })
        + '<div class="field span-2"><span class="label">' + ui.esc(t('common.color')) + '</span><div class="accent-row" role="radiogroup">' + D.COLORS.map((c) => '<label class="accent" style="background:' + c + '"><input type="radio" name="color" value="' + c + '" class="sr-only"' + (c === v.color ? ' checked' : '') + '>' + (c === v.color ? SMM.icon('check', 'icon-sm') : '') + '</label>').join('') + '</div></div>'
        + ui.field({ name: 'emergency', label: t('goals.emergency'), type: 'checkbox', value: v.emergency, hint: t('goals.emergencyHint'), span2: true }) + '</div>',
      onMount(box, api, form) { form.addEventListener('change', (e) => { if (e.target.name === 'color') form.querySelectorAll('.accent').forEach((a) => { a.innerHTML = a.querySelector('input').outerHTML + (a.querySelector('input').checked ? SMM.icon('check', 'icon-sm') : ''); }); }); },
      onSubmit(data) {
        if (data.emergency) S().goals.filter((x) => x.emergency && x.id !== id).forEach((x) => store.patch('goals', x.id, { emergency: false })); // only one emergency fund
        const res = A.saveGoal(data, id); if (!res.ok) return res.errors; done('goals.saved'); return null;
      },
    });
  };
  dlg.contribution = (goalId, withdraw) => {
    const gl = S().goals.find((x) => x.id === goalId); if (!gl) return;
    ui.formModal({
      title: (withdraw ? t('goals.withdrawTitle') : t('goals.contributeTitle')) + ' · ' + gl.name, submitLabel: withdraw ? t('goals.withdraw') : t('goals.contribute'),
      body: '<div class="form-grid">' + ui.field({ name: 'amount', label: t('tx.amount'), type: 'money', value: '', required: true, hint: withdraw ? t('goals.canWithdraw', { m: SMM.i18n.money(F.goalCurrent(gl)) }) : '' }) + ui.field({ name: 'date', label: t('tx.date'), type: 'date', value: dates.today(), required: true }) + ui.field({ name: 'note', label: t('goals.note'), value: '', span2: true }) + '</div><p class="hint" style="margin-top:12px">' + ui.esc(t('goals.contribHint')) + '</p>',
      onSubmit(data) { const res = A.addContribution(goalId, data.amount, data.date, data.note, withdraw); if (!res.ok) return res.errors; done(withdraw ? 'goals.withdrawn' : 'goals.contributed'); return null; },
    });
  };

  /* ---------- calendar event ---------- */
  dlg.event = (id, preset) => {
    const ex = id ? S().events.find((x) => x.id === id) : null;
    const v = Object.assign({ title: '', date: dates.today(), type: 'other', amount: '' }, preset || {}, ex ? Object.assign({}, ex, { amount: ex.amount ? money.toDecimal(ex.amount) : '' }) : {});
    ui.formModal({
      title: ex ? t('cal.editEvent') : t('cal.addEvent'),
      body: '<div class="form-grid">' + ui.field({ name: 'title', label: t('cal.eventTitle'), value: v.title, required: true, span2: true }) + ui.field({ name: 'date', label: t('tx.date'), type: 'date', value: v.date, required: true })
        + ui.field({ name: 'type', label: t('cal.eventType'), type: 'select', value: v.type, options: D.EVENT_TYPES.map((x) => ({ value: x, label: t('cal.type.' + x) })) }) + ui.field({ name: 'amount', label: t('cal.amountOpt'), type: 'money', value: v.amount }) + '</div>',
      extraFooter: ex ? '<button type="button" class="btn btn-danger" data-del style="margin-inline-end:auto">' + SMM.icon('trash') + ui.esc(t('common.delete')) + '</button>' : '',
      onMount(box, api) { const b = box.querySelector('[data-del]'); if (b) b.addEventListener('click', async () => { if (await dlg.confirmDelete(t('cal.deleteConfirm'))) { A.deleteEvent(id); api.close(); ui.toast(t('cal.deleted'), 'success'); } }); },
      onSubmit(data) { const res = A.saveEvent(data, id); if (!res.ok) return res.errors; done('cal.saved'); return null; },
    });
  };

  SMM.dialogs = dlg;
})(typeof globalThis !== 'undefined' ? globalThis : window);
