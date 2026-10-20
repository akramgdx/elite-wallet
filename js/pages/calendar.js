/* Financial calendar (month grid + list view) built from recurring items, custom events and student dates. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, finance: F, dates, dialogs: dlg } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const st = { month: null, mode: 'month', sel: null };

  function eventsFor(d, from, to) {
    const out = [];
    F.upcoming(d, from, to).forEach((u) => out.push({ date: u.date, title: u.rec.name, kind: u.rec.type === 'income' ? 'income' : 'bill', amount: u.rec.amount, recId: u.rec.id }));
    d.events.filter((e) => e.date >= from && e.date <= to).forEach((e) => out.push({ date: e.date, title: e.title, kind: e.type, amount: e.amount, evId: e.id }));
    d.goals.filter((gl) => gl.targetDate && gl.targetDate >= from && gl.targetDate <= to).forEach((gl) => out.push({ date: gl.targetDate, title: gl.name, kind: 'review', amount: gl.target, milestone: true }));
    const mEnd = dates.endOfMonth(from); if (mEnd >= from && mEnd <= to && d.budgets.length) out.push({ date: mEnd, title: t('cal.budgetReview'), kind: 'review', amount: 0, auto: true });
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  SMM.pages.calendar = {
    title: 'nav.calendar',
    render() {
      const d = store.get(); const today = dates.today();
      if (!st.month) st.month = dates.startOfMonth(today);
      const first = st.month, last = dates.endOfMonth(first), ws = F.weekStart(d);
      const gridStart = dates.startOfWeek(first, ws), gridEnd = dates.addDays(dates.startOfWeek(last, ws), 6);
      const evs = eventsFor(d, gridStart, gridEnd);
      const byDay = {}; evs.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.calendar')) + '</h1><p>' + ui.esc(t('cal.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="addEvent">' + SMM.icon('plus') + ui.esc(t('cal.addEvent')) + '</button></div></div>';
      h += '<div class="card"><div class="card-head"><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-secondary btn-icon btn-sm" data-action="prev" aria-label="' + ui.esc(t('common.prev')) + '">' + SMM.icon('chevron-left', 'icon-sm flip') + '</button><h2 style="font-size:18px;min-width:160px;text-align:center" aria-live="polite">' + ui.esc(SMM.i18n.monthYear(first)) + '</h2><button class="btn btn-secondary btn-icon btn-sm" data-action="next" aria-label="' + ui.esc(t('common.next')) + '">' + SMM.icon('chevron-right', 'icon-sm flip') + '</button><button class="btn btn-ghost btn-sm" data-action="today">' + ui.esc(t('common.today')) + '</button></div>'
        + '<div class="seg" role="group"><button data-action="mode" data-mode="month" aria-pressed="' + (st.mode === 'month') + '">' + ui.esc(t('cal.monthView')) + '</button><button data-action="mode" data-mode="list" aria-pressed="' + (st.mode === 'list') + '">' + ui.esc(t('cal.listView')) + '</button></div></div>';
      if (st.mode === 'month') {
        h += '<div class="cal" role="grid" aria-label="' + ui.esc(SMM.i18n.monthYear(first)) + '">' + SMM.i18n.weekdays(ws).map((w) => '<div class="dow" role="columnheader">' + ui.esc(w) + '</div>').join('');
        for (let dt = gridStart; dt <= gridEnd; dt = dates.addDays(dt, 1)) {
          const list = byDay[dt] || [];
          h += '<button type="button" class="day' + (dt.slice(0, 7) !== first.slice(0, 7) ? ' out' : '') + (dt === today ? ' today' : '') + (dt === st.sel ? ' sel' : '') + '" role="gridcell" data-action="pick" data-date="' + dt + '" aria-label="' + ui.esc(SMM.i18n.date(dt, 'long') + (list.length ? ' · ' + t('cal.nEvents', { n: SMM.i18n.num(list.length) }) : '')) + '"><span class="dn">' + SMM.i18n.num(+dt.slice(8)) + '</span>' + list.slice(0, 2).map((e) => '<span class="ev ' + e.kind + '">' + ui.esc(e.title) + '</span>').join('') + (list.length > 2 ? '<span class="ev" style="background:transparent;color:var(--muted)">+' + SMM.i18n.num(list.length - 2) + '</span>' : '') + '<span class="dots">' + list.slice(0, 4).map((e) => '<i class="' + e.kind + '"></i>').join('') + '</span></button>';
        }
        h += '</div><div class="legend" style="margin-top:12px"><span><i class="swatch" style="background:var(--danger)"></i>' + ui.esc(t('cal.legend.bill')) + '</span><span><i class="swatch" style="background:var(--success)"></i>' + ui.esc(t('cal.legend.income')) + '</span><span><i class="swatch" style="background:var(--info)"></i>' + ui.esc(t('cal.legend.student')) + '</span><span><i class="swatch" style="background:var(--warning)"></i>' + ui.esc(t('cal.legend.review')) + '</span></div>';
        if (st.sel) {
          const list = byDay[st.sel] || [];
          h += '<div class="card-flat" style="margin-top:14px"><div class="card-head"><b>' + ui.esc(SMM.i18n.date(st.sel, 'long')) + '</b><button class="btn btn-secondary btn-sm" data-action="addEventOn" data-date="' + st.sel + '">' + SMM.icon('plus', 'icon-sm') + ui.esc(t('cal.addEvent')) + '</button></div>' + (list.length ? '<ul class="rows">' + list.map(row).join('') + '</ul>' : '<p class="muted">' + ui.esc(t('cal.noEventsDay')) + '</p>') + '</div>';
        }
      } else {
        const inMonth = evs.filter((e) => e.date >= first && e.date <= last);
        h += inMonth.length ? '<ul class="rows">' + inMonth.map(row).join('') + '</ul>' : '<p class="muted">' + ui.esc(t('cal.noEvents')) + '</p>';
      }
      h += '</div>';
      function row(e) {
        const ic = e.kind === 'income' ? 'arrow-down' : e.kind === 'bill' ? 'repeat' : e.kind === 'student' ? 'cap' : e.kind === 'review' ? 'flag' : 'calendar';
        return '<li><span class="ev ' + e.kind + '" style="padding:6px;border-radius:9px;display:grid;place-items:center">' + SMM.icon(ic, 'icon-sm') + '</span><div class="row-main"><div class="row-title">' + ui.esc(e.title) + '</div><div class="row-sub">' + ui.esc(SMM.i18n.date(e.date)) + ' · ' + ui.esc(t(e.recId ? 'cal.recurring' : e.milestone ? 'cal.goalDate' : e.auto ? 'cal.auto' : 'cal.type.' + e.kind)) + '</div></div>' + (e.amount ? view.signed(e.amount, e.kind === 'income' ? 'income' : 'expense') : '') + (e.evId ? '<button class="btn btn-ghost btn-icon btn-sm" data-action="editEvent" data-id="' + e.evId + '" aria-label="' + ui.esc(t('common.edit')) + '">' + SMM.icon('edit', 'icon-sm') + '</button>' : '') + (e.recId ? '<button class="btn btn-secondary btn-sm" data-action="record" data-id="' + e.recId + '">' + ui.esc(t('rec.record')) + '</button>' : '') + '</li>';
      }
      return h;
    },
    actions: {
      prev() { st.month = dates.addMonths(st.month, -1, 1); SMM.app.render(); }, next() { st.month = dates.addMonths(st.month, 1, 1); SMM.app.render(); },
      today() { st.month = dates.startOfMonth(dates.today()); st.sel = dates.today(); SMM.app.render(); },
      mode(el) { st.mode = el.dataset.mode; SMM.app.render(); }, pick(el) { st.sel = el.dataset.date; SMM.app.render(); },
      addEvent: () => dlg.event(null, st.sel ? { date: st.sel } : null), addEventOn: (el) => dlg.event(null, { date: el.dataset.date }), editEvent: (el) => dlg.event(el.dataset.id), record: (el) => dlg.recordRecurring(el.dataset.id),
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
