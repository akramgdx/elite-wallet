/* Accounts & wallets. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, charts } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const ICON = { cash: 'coins', bank: 'wallet', savings: 'piggy', student: 'cap', other: 'tag' };
  let showArchived = false;

  SMM.pages.accounts = {
    title: 'nav.accounts',
    render() {
      const d = store.get(); const today = dates.today();
      const list = d.accounts.filter((a) => showArchived || !a.archived);
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.accounts')) + '</h1><p>' + ui.esc(t('acc.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('acc.add')) + '</button></div></div>';
      if (!d.accounts.length) return h + view.empty('wallet', t('acc.emptyTitle'), t('acc.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('acc.add')) + '</button>');
      h += '<div class="stack"><div class="card kpi-card hero kpi"><div class="k-label">' + ui.esc(t('acc.total')) + '</div><div class="k-value"><span class="ltr">' + ui.esc(SMM.i18n.money(F.totalBalance(d))) + '</span></div><div class="k-sub">' + ui.esc(t('acc.totalHint')) + '</div></div>';
      h += '<div class="callout">' + SMM.icon('info') + '<div>' + ui.esc(t('acc.howBalance')) + '</div></div>';
      h += '<div class="grid-cards">' + list.map((a) => {
        const bal = F.accountBalance(d, a.id);
        const n = d.transactions.filter((x) => x.accountId === a.id || x.toAccountId === a.id).length;
        const spark = []; for (let i = 5; i >= 0; i--) spark.push(F.accountBalance(d, a.id, dates.addDays(today, -i * 6)));
        return '<div class="card item-card"' + (a.archived ? ' style="opacity:.65"' : '') + '><div class="top"><span class="dot-icon" style="background:' + ui.esc(a.color) + '">' + SMM.icon(ICON[a.type] || 'tag') + '</span><div style="min-width:0"><div class="row-title">' + ui.esc(a.name) + (a.demo ? ' <span class="demo-pill">' + ui.esc(t('demo.label')) + '</span>' : '') + '</div><div class="row-sub">' + ui.esc(t('acc.type.' + a.type)) + ' · ' + ui.esc(a.currency) + (a.archived ? ' · ' + ui.esc(t('common.archived')) : '') + '</div></div></div>'
          + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px"><div class="big-amount" style="color:' + (bal < 0 ? 'var(--expense)' : 'var(--text)') + '"><span class="ltr">' + ui.esc(SMM.i18n.money(bal, a.currency)) + '</span></div>' + charts.spark(spark, ui.esc(a.color)) + '</div>'
          + '<div class="kv"><span>' + ui.esc(t('acc.opening')) + '</span><b><span class="ltr">' + ui.esc(SMM.i18n.money(a.openingBalance, a.currency)) + '</span></b></div><div class="kv"><span>' + ui.esc(t('acc.txCount')) + '</span><b>' + SMM.i18n.num(n) + '</b></div>' + (a.description ? '<div class="hint">' + ui.esc(a.description) + '</div>' : '')
          + '<div class="actions" style="margin:0"><button class="btn btn-secondary btn-sm" data-action="edit" data-id="' + a.id + '">' + SMM.icon('edit', 'icon-sm') + ui.esc(t('common.edit')) + '</button><button class="btn btn-ghost btn-sm" data-action="archive" data-id="' + a.id + '">' + SMM.icon('archive', 'icon-sm') + ui.esc(a.archived ? t('common.unarchive') : t('common.archive')) + '</button>' + (n === 0 ? '<button class="btn btn-ghost btn-sm" data-action="del" data-id="' + a.id + '">' + SMM.icon('trash', 'icon-sm') + ui.esc(t('common.delete')) + '</button>' : '') + '</div></div>';
      }).join('') + '</div>';
      if (d.accounts.some((a) => a.archived)) h += '<label class="check"><input type="checkbox" data-action="toggleArchived"' + (showArchived ? ' checked' : '') + '><span>' + ui.esc(t('acc.showArchived')) + '</span></label>';
      return h + '</div>';
    },
    actions: {
      add: () => dlg.account(), edit: (el) => dlg.account(el.dataset.id),
      toggleArchived(el) { showArchived = el.checked; SMM.app.render(); },
      archive(el) { const a = store.get().accounts.find((x) => x.id === el.dataset.id); A.setAccountArchived(a.id, !a.archived); ui.toast(t(a.archived ? 'acc.unarchived' : 'acc.archived'), 'success'); },
      async del(el) { if (await dlg.confirmDelete(t('acc.deleteConfirm'))) { const r = A.deleteAccount(el.dataset.id); ui.toast(r.ok ? t('acc.deleted') : t(r.errors._), r.ok ? 'success' : 'error'); } },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
