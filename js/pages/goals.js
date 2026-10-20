/* Savings goals + optional savings challenges. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg, actions: A, charts } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const m = (v) => '<span class="ltr">' + ui.esc(SMM.i18n.money(v)) + '</span>';

  SMM.pages.goals = {
    title: 'nav.goals',
    render() {
      const d = store.get(); const today = dates.today();
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.goals')) + '</h1><p>' + ui.esc(t('goals.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="addChallenge">' + SMM.icon('flag') + ui.esc(t('chal.add')) + '</button><button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('goals.add')) + '</button></div></div>';
      h += '<div class="stack">';
      if (!d.goals.length) h += view.empty('target', t('goals.emptyTitle'), t('goals.emptyText'), '<button class="btn btn-primary" data-action="add">' + SMM.icon('plus') + ui.esc(t('goals.add')) + '</button>');
      else h += '<div class="grid-cards">' + d.goals.map((gl) => {
        const p = F.goalProgress(gl, today);
        let time = '';
        if (gl.targetDate) time = p.daysLeft > 0 ? t('goals.daysLeft', { n: SMM.i18n.num(p.daysLeft), date: SMM.i18n.date(gl.targetDate) }) : p.done ? '' : t('goals.pastDue', { date: SMM.i18n.date(gl.targetDate) });
        return '<div class="card item-card"><div class="top"><span class="dot-icon" style="background:' + ui.esc(gl.color) + '">' + SMM.icon(gl.emergency ? 'shield' : 'target') + '</span><div style="min-width:0"><div class="row-title" style="font-size:16px">' + ui.esc(gl.name) + (gl.demo ? ' <span class="demo-pill">' + ui.esc(t('demo.label')) + '</span>' : '') + '</div><div class="row-sub">' + (gl.emergency ? ui.esc(t('goals.emergencyTag')) + ' · ' : '') + ui.esc(time || t('goals.noDate')) + '</div></div>' + (p.done ? '<span class="badge badge-ok" style="margin-inline-start:auto">' + SMM.icon('check', 'icon-sm') + ui.esc(t('goals.reached')) + '</span>' : '') + '</div>'
          + '<div style="display:flex;justify-content:space-between;align-items:baseline"><div class="big-amount">' + m(p.current) + '</div><span class="muted">/ ' + m(gl.target) + '</span></div>' + view.progress(p.pct, p.done ? 'ok' : '')
          + '<div class="kv"><span>' + ui.esc(t('goals.progress')) + '</span><b>' + SMM.i18n.num(p.pct) + '%</b></div><div class="kv"><span>' + ui.esc(t('goals.remaining')) + '</span><b>' + m(p.remaining) + '</b></div>'
          + (p.suggestedMonthly ? '<div class="card-flat" style="font-size:13px">' + ui.esc(t('goals.suggest', { monthly: SMM.i18n.money(p.suggestedMonthly), weekly: SMM.i18n.money(p.suggestedWeekly) })) + '</div>' : '')
          + '<div class="actions" style="margin:0"><button class="btn btn-primary btn-sm" data-action="contribute" data-id="' + gl.id + '">' + SMM.icon('plus', 'icon-sm') + ui.esc(t('goals.contribute')) + '</button><button class="btn btn-secondary btn-sm" data-action="withdraw" data-id="' + gl.id + '"' + (p.current ? '' : ' disabled') + '>' + SMM.icon('minus', 'icon-sm') + ui.esc(t('goals.withdraw')) + '</button><button class="btn btn-ghost btn-sm" data-action="history" data-id="' + gl.id + '">' + SMM.icon('list', 'icon-sm') + ui.esc(t('goals.history')) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="' + gl.id + '" aria-label="' + ui.esc(t('common.edit')) + '">' + SMM.icon('edit', 'icon-sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="del" data-id="' + gl.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></div></div>';
      }).join('') + '</div><div class="callout">' + SMM.icon('info') + '<div>' + ui.esc(t('goals.notLedger')) + '</div></div>';

      h += '<div class="card"><div class="card-head"><div><div class="card-title">' + ui.esc(t('chal.title')) + '</div><div class="hint">' + ui.esc(t('chal.subtitle')) + '</div></div></div>';
      if (!d.challenges.length) h += '<p class="muted">' + ui.esc(t('chal.none')) + '</p>';
      else h += '<ul class="rows">' + d.challenges.map((c) => {
        const p = F.challengeProgress(c, today);
        return '<li><span class="dot-icon" style="background:var(--primary);color:var(--on-primary)">' + SMM.icon('flag') + '</span><div class="row-main"><div class="row-title">' + ui.esc(c.name || t('chal.kind.' + c.kind)) + '</div><div class="row-sub">' + ui.esc(t('chal.progress', { done: SMM.i18n.num(p.done), n: SMM.i18n.num(c.count) })) + (c.kind !== 'nospend' ? ' · ' + ui.esc(t('chal.saved', { m: SMM.i18n.money(p.saved) })) : '') + '</div>' + view.progress(p.pct, p.complete ? 'ok' : '') + '</div>'
          + (p.complete ? '<span class="badge badge-ok">' + ui.esc(t('chal.done')) + '</span>' : '<button class="btn btn-primary btn-sm" data-action="checkin" data-id="' + c.id + '"' + (p.checkedThisPeriod ? ' disabled' : '') + '>' + SMM.icon('check', 'icon-sm') + ui.esc(p.checkedThisPeriod ? t('chal.checkedIn') : t('chal.checkin')) + '</button>')
          + '<button class="btn btn-ghost btn-icon btn-sm" data-action="delChallenge" data-id="' + c.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></li>';
      }).join('') + '</ul>';
      return h + '</div></div>';
    },
    actions: {
      add: () => dlg.goal(), edit: (el) => dlg.goal(el.dataset.id), contribute: (el) => dlg.contribution(el.dataset.id, false), withdraw: (el) => dlg.contribution(el.dataset.id, true),
      async del(el) { if (await dlg.confirmDelete(t('goals.deleteConfirm'))) { A.deleteGoal(el.dataset.id); ui.toast(t('goals.deleted'), 'success'); } },
      history(el) {
        const gl = store.get().goals.find((x) => x.id === el.dataset.id); if (!gl) return;
        const list = gl.contributions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
        const api = ui.modal({ title: t('goals.history') + ' · ' + gl.name, body: list.length ? '<ul class="rows">' + list.map((c) => '<li><div class="row-main"><div class="row-title">' + ui.esc(c.note || (c.amount > 0 ? t('goals.contribute') : t('goals.withdraw'))) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(c.date)) + '</div></div><span class="amt ' + (c.amount > 0 ? 'pos' : 'neg') + '"><span class="ltr">' + (c.amount > 0 ? '+' : '−') + ui.esc(SMM.i18n.money(Math.abs(c.amount))) + '</span></span><button class="btn btn-ghost btn-icon btn-sm" data-delc="' + c.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></li>').join('') + '</ul>' : '<p class="muted">' + ui.esc(t('goals.noContrib')) + '</p>',
          onMount(box, a) { box.addEventListener('click', async (e) => { const b = e.target.closest('[data-delc]'); if (!b) return; if (await dlg.confirmDelete(t('goals.deleteContribConfirm'))) { A.deleteContribution(gl.id, b.dataset.delc); a.close(); ui.toast(t('goals.contribDeleted'), 'success'); } }); } });
      },
      addChallenge() {
        const kinds = ['weekly', 'monthly', 'nospend'];
        ui.formModal({
          title: t('chal.add'), body: '<div class="form-grid">' + ui.field({ name: 'kind', label: t('chal.kind'), type: 'select', value: 'weekly', options: kinds.map((k) => ({ value: k, label: t('chal.kind.' + k) })), span2: true }) + ui.field({ name: 'name', label: t('chal.name'), value: '', span2: true }) + ui.field({ name: 'amount', label: t('chal.amount'), type: 'money', value: '', hint: t('chal.amountHint') }) + ui.field({ name: 'count', label: t('chal.count'), type: 'number', value: 8, attrs: 'min="1" max="366"', hint: t('chal.countHint') }) + '</div><p class="hint" style="margin-top:12px">' + ui.esc(t('chal.gentle')) + '</p>',
          onSubmit(data) { const r = A.saveChallenge(data); if (!r.ok) return r.errors; ui.toast(t('chal.created'), 'success'); return null; },
        });
      },
      checkin(el) { const r = A.checkinChallenge(el.dataset.id, dates.today()); ui.toast(r.ok ? t('chal.nice') : t(r.errors._), r.ok ? 'success' : 'warn'); },
      async delChallenge(el) { if (await dlg.confirmDelete(t('chal.deleteConfirm'))) A.deleteChallenge(el.dataset.id); },
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
