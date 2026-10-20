/* Transactions: search, filters, sort, pagination, CSV import/export. Filters live in module state and survive re-renders. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, csv, money } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const PAGE = 20;
  const f = { q: '', type: '', cat: '', acc: '', from: '', to: '', sort: 'date-desc', page: 1 };

  function filtered(d) {
    const q = f.q.trim().toLowerCase();
    let list = d.transactions.filter((x) => {
      if (f.type && x.type !== f.type) return false;
      if (f.cat && x.categoryId !== f.cat) return false;
      if (f.acc && x.accountId !== f.acc && x.toAccountId !== f.acc) return false;
      if (f.from && x.date < f.from) return false;
      if (f.to && x.date > f.to) return false;
      if (q) {
        const c = view.catById(d, x.categoryId);
        const hay = [x.description, x.merchant, x.notes, (x.tags || []).join(' '), view.catName(c), view.accName(d, x.accountId), money.toDecimal(x.amount)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const cmp = { 'date-desc': (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0), 'date-asc': (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0), 'amount-desc': (a, b) => b.amount - a.amount, 'amount-asc': (a, b) => a.amount - b.amount }[f.sort];
    return list.sort(cmp);
  }
  const m = (v) => '<span class="ltr">' + ui.esc(SMM.i18n.money(v)) + '</span>';

  function rowsHtml(d, list) {
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); if (f.page > pages) f.page = pages;
    const slice = list.slice((f.page - 1) * PAGE, f.page * PAGE);
    if (!list.length) return view.empty('search', t('tx.noResults'), t('tx.noResultsText'), '<button class="btn btn-secondary" data-action="clear">' + ui.esc(t('tx.clearFilters')) + '</button>');
    let h = '<table class="table responsive"><thead><tr><th>' + ui.esc(t('tx.description')) + '</th><th>' + ui.esc(t('tx.category')) + '</th><th>' + ui.esc(t('tx.account')) + '</th><th>' + ui.esc(t('tx.date')) + '</th><th class="end">' + ui.esc(t('tx.amount')) + '</th><th></th></tr></thead><tbody>';
    slice.forEach((x) => {
      const c = view.catById(d, x.categoryId);
      const acc = x.type === 'transfer' ? ui.esc(view.accName(d, x.accountId)) + ' ' + '<span class="flip" style="display:inline-block">→</span>' + ' ' + ui.esc(view.accName(d, x.toAccountId)) : ui.esc(view.accName(d, x.accountId));
      h += '<tr data-action="txDetail" data-id="' + x.id + '"><td class="main-cell"><div class="tx-desc">' + (x.type === 'transfer' ? '<span class="dot-icon" style="background:var(--muted)">' + SMM.icon('swap') + '</span>' : view.catChip(c)) + '<div style="min-width:0"><div class="row-title">' + ui.esc(x.description || (x.type === 'transfer' ? t('tx.type.transfer') : view.catName(c))) + (x.demo ? ' <span class="demo-pill">' + ui.esc(t('demo.label')) + '</span>' : '') + '</div>' + (x.merchant ? '<div class="row-sub">' + ui.esc(x.merchant) + '</div>' : '') + '</div></div></td>'
        + '<td data-label="' + ui.esc(t('tx.category')) + '">' + (x.type === 'transfer' ? '<span class="badge">' + ui.esc(t('tx.type.transfer')) + '</span>' : '<span class="badge">' + ui.esc(view.catName(c)) + '</span>' + (x.type === 'refund' ? ' <span class="badge badge-info">' + ui.esc(t('tx.type.refund')) + '</span>' : '')) + '</td>'
        + '<td data-label="' + ui.esc(t('tx.account')) + '">' + acc + '</td><td data-label="' + ui.esc(t('tx.date')) + '">' + ui.esc(SMM.i18n.date(x.date)) + '</td>'
        + '<td class="end amt-cell">' + view.signed(x.amount, x.type === 'refund' ? 'income' : x.type) + '</td>'
        + '<td class="end extra"><button class="btn btn-ghost btn-icon btn-sm" data-action="txEdit" data-id="' + x.id + '" aria-label="' + ui.esc(t('common.edit')) + '">' + SMM.icon('edit', 'icon-sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="txDelete" data-id="' + x.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></td></tr>';
    });
    h += '</tbody></table><div class="pager"><span>' + ui.esc(t('tx.showing', { a: SMM.i18n.num((f.page - 1) * PAGE + 1), b: SMM.i18n.num(Math.min(list.length, f.page * PAGE)), n: SMM.i18n.num(list.length) })) + '</span><span style="display:flex;gap:8px;align-items:center"><button class="btn btn-secondary btn-sm" data-action="page" data-dir="-1"' + (f.page <= 1 ? ' disabled' : '') + ' aria-label="' + ui.esc(t('common.prev')) + '">' + SMM.icon('chevron-left', 'icon-sm flip') + '</button><span>' + ui.esc(t('common.pageOf', { p: SMM.i18n.num(f.page), n: SMM.i18n.num(pages) })) + '</span><button class="btn btn-secondary btn-sm" data-action="page" data-dir="1"' + (f.page >= pages ? ' disabled' : '') + ' aria-label="' + ui.esc(t('common.next')) + '">' + SMM.icon('chevron-right', 'icon-sm flip') + '</button></span></div>';
    return h;
  }
  function summaryHtml(list) {
    let inc = 0, exp = 0;
    list.forEach((x) => { if (x.type === 'income') inc += x.amount; else if (x.type === 'expense') exp += x.amount; else if (x.type === 'refund') exp -= x.amount; });
    return '<span class="chip">' + ui.esc(t('ov.income')) + ': ' + m(inc) + '</span><span class="chip">' + ui.esc(t('ov.expenses')) + ': ' + m(exp) + '</span><span class="chip">' + ui.esc(t('tx.count', { n: SMM.i18n.num(list.length) })) + '</span>';
  }

  SMM.pages.transactions = {
    title: 'nav.transactions',
    render() {
      const d = store.get();
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.transactions')) + '</h1><p>' + ui.esc(t('tx.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="import">' + SMM.icon('upload') + ui.esc(t('tx.importCsv')) + '</button><button class="btn btn-secondary" data-action="export">' + SMM.icon('download') + ui.esc(t('tx.exportCsv')) + '</button><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('tx.add')) + '</button></div></div>';
      if (!d.transactions.length) return h + view.empty('swap', t('tx.emptyTitle'), t('tx.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('tx.add')) + '</button><button class="btn btn-secondary" data-action="import">' + SMM.icon('upload') + ui.esc(t('tx.importCsv')) + '</button>');
      const catOpts = '<option value="">' + ui.esc(t('tx.allCategories')) + '</option>' + d.categories.map((c) => '<option value="' + c.id + '"' + (f.cat === c.id ? ' selected' : '') + '>' + ui.esc(view.catName(c)) + '</option>').join('');
      const accOpts = '<option value="">' + ui.esc(t('tx.allAccounts')) + '</option>' + d.accounts.map((a) => '<option value="' + a.id + '"' + (f.acc === a.id ? ' selected' : '') + '>' + ui.esc(a.name) + '</option>').join('');
      const typeOpts = '<option value="">' + ui.esc(t('tx.allTypes')) + '</option>' + SMM.defaults.TX_TYPES.map((x) => '<option value="' + x + '"' + (f.type === x ? ' selected' : '') + '>' + ui.esc(t('tx.type.' + x)) + '</option>').join('');
      const sortOpts = ['date-desc', 'date-asc', 'amount-desc', 'amount-asc'].map((s) => '<option value="' + s + '"' + (f.sort === s ? ' selected' : '') + '>' + ui.esc(t('tx.sort.' + s)) + '</option>').join('');
      h += '<div class="card"><div class="filters" role="search"><div class="field"><label class="sr-only" for="fq">' + ui.esc(t('common.search')) + '</label><input id="fq" class="input" type="search" data-filter="q" value="' + ui.esc(f.q) + '" placeholder="' + ui.esc(t('tx.searchPlaceholder')) + '"></div>'
        + '<div class="field"><label class="sr-only" for="ft">' + ui.esc(t('tx.type')) + '</label><select id="ft" class="select" data-filter="type">' + typeOpts + '</select></div>'
        + '<div class="field"><label class="sr-only" for="fc">' + ui.esc(t('tx.category')) + '</label><select id="fc" class="select" data-filter="cat">' + catOpts + '</select></div>'
        + '<div class="field"><label class="sr-only" for="fa">' + ui.esc(t('tx.account')) + '</label><select id="fa" class="select" data-filter="acc">' + accOpts + '</select></div>'
        + '<div class="field"><label class="sr-only" for="ff">' + ui.esc(t('common.from')) + '</label><input id="ff" class="input" type="date" data-filter="from" value="' + f.from + '" title="' + ui.esc(t('common.from')) + '"></div>'
        + '<div class="field"><label class="sr-only" for="fto">' + ui.esc(t('common.to')) + '</label><input id="fto" class="input" type="date" data-filter="to" value="' + f.to + '" title="' + ui.esc(t('common.to')) + '"></div>'
        + '<div class="field"><label class="sr-only" for="fs">' + ui.esc(t('tx.sortBy')) + '</label><select id="fs" class="select" data-filter="sort">' + sortOpts + '</select></div></div>'
        + '<div class="chips" id="txSummary" style="margin-bottom:10px"></div><div id="txList"></div></div>';
      return h;
    },
    mount(root) { this.refreshList(root); },
    refreshList(root) {
      const d = store.get(); const list = filtered(d);
      const box = root.querySelector('#txList'); if (!box) return;
      box.innerHTML = rowsHtml(d, list); root.querySelector('#txSummary').innerHTML = summaryHtml(list);
    },
    onFilter(root, el) {
      const k = el.dataset.filter; f[k] = el.value; f.page = 1; this.refreshList(root);
    },
    actions: {
      add: () => dlg.transaction(), txDetail: (el) => dlg.transactionDetail(el.dataset.id), txEdit: (el, e) => { e.stopPropagation(); dlg.transaction(el.dataset.id); },
      async txDelete(el, e) { e.stopPropagation(); if (await dlg.confirmDelete(t('tx.deleteConfirm'))) { A.deleteTransaction(el.dataset.id); ui.toast(t('tx.deleted'), 'success'); } },
      page(el, e, root) { f.page = Math.max(1, f.page + Number(el.dataset.dir)); SMM.pages.transactions.refreshList(root); },
      clear(el, e, root) { Object.assign(f, { q: '', type: '', cat: '', acc: '', from: '', to: '', page: 1 }); SMM.app.render(); },
      export() {
        const d = store.get(); const list = filtered(d);
        ui.download('smart-money-transactions-' + dates.today() + '.csv', csv.exportTransactions(d, list), 'text/csv;charset=utf-8');
        ui.toast(t('tx.exported', { n: SMM.i18n.num(list.length) }), 'success');
      },
      async import() {
        const d = store.get();
        if (!d.accounts.length) return dlg.transaction(); // prompts to create an account first
        const file = await ui.pickFile('.csv,text/csv'); if (!file) return;
        let text; try { text = await ui.readFile(file, 5 * 1024 * 1024); } catch (e) { return ui.toast(t(e.message === 'too-large' ? 'tx.fileTooLarge' : 'tx.fileReadError'), 'error'); }
        const res = csv.importTransactions(text, d, () => store.uid('tx'));
        const errs = res.errors.slice(0, 8).map((e) => '<li>' + ui.esc(t('tx.importLine', { line: SMM.i18n.num(e.line), reason: t('tx.importReason.' + e.reason) })) + '</li>').join('');
        ui.modal({
          title: t('tx.importPreview'), wide: true,
          body: '<p><b>' + SMM.i18n.num(res.rows.length) + '</b> ' + ui.esc(t('tx.importValid')) + ' · <b>' + SMM.i18n.num(res.errors.length) + '</b> ' + ui.esc(t('tx.importSkipped')) + '</p>' + (errs ? '<ul style="margin:10px 0;padding-inline-start:18px;list-style:disc;font-size:13.5px" class="muted">' + errs + (res.errors.length > 8 ? '<li>…</li>' : '') + '</ul>' : '') + '<p class="hint">' + ui.esc(t('tx.importHint')) + '</p>',
          footer: '<button class="btn btn-secondary" data-close>' + ui.esc(t('common.cancel')) + '</button><button class="btn btn-primary" data-do' + (res.rows.length ? '' : ' disabled') + '>' + ui.esc(t('tx.importConfirm', { n: SMM.i18n.num(res.rows.length) })) + '</button>',
          onMount(box, api) { box.querySelector('[data-do]').addEventListener('click', () => { const n = A.addImportedTransactions(res.rows); api.close(); ui.toast(t('tx.imported', { n: SMM.i18n.num(n) }), 'success'); }); },
        });
      },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
