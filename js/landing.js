/* Landing page behaviour. Previews are computed by the REAL engine (SMM.finance) from a small, clearly-labelled sample data set. */
(function (g) {
  'use strict';
  const SMM = g.SMM, doc = g.document;
  const { money, dates, finance: F, store, i18n, theme, charts } = SMM;
  const t = i18n.t, esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => doc.getElementById(id);
  const THEME_NAME = { midnight: 'Midnight Dark', light: 'Pure Light', emerald: 'Emerald Finance', ocean: 'Ocean Blue', violet: 'Violet Modern', rose: 'Rose Elegant', graphite: 'Graphite', sand: 'Warm Sand' };
  const reduced = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sample data (fixed, illustrative; reference date = the 20th of the current month) ---------- */
  function buildSample() {
    const real = dates.today();
    const ref = dates.addMonths(dates.startOfMonth(real), 0, 20);
    const d = SMM.defaults.defaultState();
    d.settings.currency = 'DZD';
    const m = (n) => Math.round(n * 100);
    const acc = (id, name, type, open) => d.accounts.push({ id, name, type, openingBalance: m(open), currency: 'DZD', description: '', color: '#3b82f6', archived: false });
    acc('a_bank', 'Bank', 'bank', 45000); acc('a_cash', 'Cash', 'cash', 6000); acc('a_sav', 'Savings', 'savings', 20000);
    let n = 0;
    const tx = (type, date, amount, cat, desc, extra) => d.transactions.push(Object.assign({ id: 'tx' + (++n), type, amount: m(amount), date, accountId: 'a_bank', toAccountId: '', categoryId: cat ? 'cat_' + cat : '', description: desc || '', notes: '', merchant: '', tags: [] }, extra || {}));
    for (let k = 3; k >= 0; k--) {
      const ms = dates.addMonths(dates.startOfMonth(ref), -k, 1), day = (x) => dates.addDays(ms, x - 1), cur = k === 0, f = [1.08, 1.04, 1.0, 0.9][3 - k];
      tx('income', day(5), 40000, 'allowance', 'allowance');
      tx('expense', day(1), 12000, 'housing', 'housing');
      tx('expense', day(3), 2000, 'bills', 'internet');
      tx('expense', day(7), Math.round(6400 * f / 10) * 10, 'food', 'groceries');
      tx('expense', day(12), Math.round(3600 * f / 10) * 10, 'food', 'cafeteria', { accountId: 'a_cash' });
      tx('expense', day(9), Math.round(2500 * f / 10) * 10, 'transport', 'bus', { accountId: 'a_cash' });
      tx('expense', day(14), Math.round(2800 * f / 10) * 10, 'books', 'textbooks');
      tx('expense', day(16), cur ? 900 : 1500, 'health', 'pharmacy');
      if (cur) tx('income', day(10), 15000, 'scholarship', 'scholarship'); else if (k === 2) tx('income', day(10), 15000, 'scholarship', 'scholarship');
      tx('transfer', day(12), 5000, '', 'transfer', { toAccountId: 'a_sav' });
    }
    d.budgets.push({ id: 'b1', name: 'Food', period: 'monthly', categoryIds: ['cat_food'], limit: m(12000), start: '', end: '', rollover: false });
    d.budgets.push({ id: 'b2', name: 'Transport', period: 'monthly', categoryIds: ['cat_transport'], limit: m(3000), start: '', end: '', rollover: false });
    d.budgets.push({ id: 'b3', name: 'Books', period: 'monthly', categoryIds: ['cat_books'], limit: m(2500), start: '', end: '', rollover: false });
    const goal = (id, key, target, saved, months, color) => d.goals.push({ id, nameKey: key, name: key, target: m(target), targetDate: dates.addMonths(ref, months, 1), description: '', color, emergency: false, contributions: [{ id: id + 'c', date: ref, amount: m(saved), note: '' }] });
    goal('g1', 'lp.goal.laptop', 120000, 36000, 8, '#8b5cf6'); goal('g2', 'lp.goal.emergency', 100000, 40000, 12, '#22c55e'); goal('g3', 'lp.goal.trip', 60000, 15000, 5, '#f59e0b');
    return { d, ref };
  }

  /* ---------- preview renderers ---------- */
  const M = (v) => esc(i18n.money(v, 'DZD'));
  const win = (title, body) => '<div class="lp-win-title"><span>' + esc(title) + '</span></div>' + body;
  function monthRange(ref, off) { const s = dates.addMonths(dates.startOfMonth(ref), off, 1); return { start: s, end: dates.endOfMonth(s) }; }
  const monthBadge = (ref) => '<span class="badge badge-primary">' + esc(i18n.monthYear(ref)) + '</span>';

  function renderPreviews() {
    const { d, ref } = buildSample();
    const cur = F.periodTotals(d, monthRange(ref, 0)), prev = F.periodTotals(d, monthRange(ref, -1));
    const balance = F.totalBalance(d, ref);
    const bal = typeof balance === 'object' && balance !== null ? (balance.total != null ? balance.total : balance.amount) : balance;
    const kpis = '<div class="lp-kpis"><div class="kpi"><div class="k-label">' + esc(t('ov.balance')) + '</div><div class="k-value">' + M(bal) + '</div></div>'
      + '<div class="kpi"><div class="k-label">' + esc(t('ov.income')) + '</div><div class="k-value amt pos">+' + M(cur.income) + '</div></div>'
      + '<div class="kpi"><div class="k-label">' + esc(t('ov.expenses')) + '</div><div class="k-value amt neg">−' + M(cur.expense) + '</div></div></div>';
    const series = F.monthlySeries(d, ref, 4);
    const bar = charts.bar({ labels: series.map((s) => i18n.monthShort(s.start)), series: [{ name: t('ov.income'), values: series.map((s) => s.income), color: 'var(--income)' }, { name: t('ov.expenses'), values: series.map((s) => s.expense), color: 'var(--expense)' }], fmt: (v) => i18n.moneyShort(v), aria: t('ov.incomeVsExpenses'), height: 200 });
    $('p-hero').innerHTML = win(t('ov.thisMonth'), kpis + '<div class="card-title" style="margin-bottom:6px">' + esc(t('ov.incomeVsExpenses')) + '</div>' + bar);
    $('p-hero').insertAdjacentHTML('afterbegin', '<div style="display:flex;justify-content:flex-end;margin-bottom:8px">' + monthBadge(ref) + '</div>');

    const cats = F.categoryTotals(d, monthRange(ref, 0), 'expense');
    const name = (c) => t('cat.' + String(c.categoryId).replace('cat_', ''));
    const slices = cats.map((c, i) => ({ label: name(c), value: c.amount, color: charts.slot(i) }));
    const accRows = d.accounts.map((a) => '<div class="lp-row"><span class="dot-icon" style="background:var(--surface-2)">' + SMM.icon(a.type === 'cash' ? 'coins' : a.type === 'savings' ? 'pig' : 'wallet') + '</span><div class="row-main"><div class="row-title">' + esc(t('acc.type.' + a.type)) + '</div></div><span class="amt"><bdi>' + M(F.accountBalance(d, a.id, ref)) + '</bdi></span></div>').join('');
    $('p-clarity').innerHTML = win(t('nav.accounts'), '<div class="lp-kpis"><div class="kpi"><div class="k-label">' + esc(t('ov.balance')) + '</div><div class="k-value">' + M(bal) + '</div></div><div class="kpi"><div class="k-label">' + esc(t('ov.net')) + '</div><div class="k-value amt ' + (cur.net >= 0 ? 'pos' : 'neg') + '">' + (cur.net >= 0 ? '+' : '−') + M(Math.abs(cur.net)) + '</div><div class="k-sub muted">' + esc(cur.savingsRate != null ? t('ov.savingsRate', { p: Math.round(cur.savingsRate * 100) }) : '') + '</div></div></div>' + accRows);

    const txs = d.transactions.filter((x) => x.date >= monthRange(ref, 0).start && x.date <= ref).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
    const descKey = { allowance: 'lp.sample.allowance', cafeteria: 'lp.sample.cafeteria', internet: 'lp.sample.internet', scholarship: 'lp.sample.scholarship', pharmacy: 'lp.sample.pharmacy', groceries: 'lp.sample.groceries', bus: 'lp.sample.bus', textbooks: 'lp.sample.textbooks' };
    $('p-tx').innerHTML = win(t('nav.transactions'), '<div role="list">' + txs.map((x) => {
      const sign = x.type === 'income' || x.type === 'refund' ? '+' : x.type === 'transfer' ? '⇄' : '−';
      const cls = x.type === 'income' || x.type === 'refund' ? 'pos' : x.type === 'transfer' ? 'neu' : 'neg';
      const label = descKey[x.description] ? t(descKey[x.description]) : t('tx.type.' + x.type);
      return '<div class="lp-row" role="listitem"><span class="dot-icon" style="background:var(--surface-2)">' + SMM.icon(x.type === 'transfer' ? 'swap' : x.type === 'income' ? 'trending' : 'tag') + '</span><div class="row-main"><div class="row-title">' + esc(label) + '</div><div class="row-sub muted">' + esc(i18n.date(x.date, 'short')) + ' · ' + esc(t('tx.type.' + x.type)) + (x.categoryId ? ' · ' + esc(t('cat.' + x.categoryId.replace('cat_', ''))) : '') + '</div></div><span class="amt ' + cls + '"><bdi>' + sign + ' ' + M(x.amount) + '</bdi></span></div>';
    }).join('') + '</div>');

    let alertHtml = '';
    const buds = d.budgets.map((b) => ({ b, u: F.budgetUsage(d, b, ref) }));
    const bodyB = buds.map(({ b, u }) => {
      const catName = t('cat.' + b.categoryIds[0].replace('cat_', ''));
      const cls = u.state === 'over' ? 'over' : u.state === 'warn' ? 'warn' : 'ok';
      const badge = u.state === 'over' ? '<span class="badge badge-over">' + SMM.icon('x', 'icon-sm') + esc(t('budgets.overBy')) + '</span>' : u.state === 'warn' ? '<span class="badge badge-warn">' + SMM.icon('flag', 'icon-sm') + ' ' + esc(i18n.pct(u.pct)) + '</span>' : '<span class="badge badge-ok">' + SMM.icon('check', 'icon-sm') + ' ' + esc(i18n.pct(u.pct)) + '</span>';
      if (b.categoryIds[0] === 'cat_food' && u.state !== 'ok') alertHtml = '<div class="lp-alert" role="note">' + SMM.icon('bell') + '<span>' + esc(t('lp.s4.alert', { p: Math.round(u.pct), d: dates.diffDays(ref, dates.endOfMonth(ref)) })) + '</span></div>';
      return '<div class="lp-bud"><div class="lp-bud-h"><span>' + esc(catName) + '</span>' + badge + '</div><div class="progress ' + cls + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(u.pct)) + '"><i style="width:' + Math.min(100, u.pct).toFixed(1) + '%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">' + M(u.spent) + ' / ' + M(u.limit) + '</div></div>';
    }).join('');
    $('p-budget').innerHTML = win(t('nav.budgets'), bodyB + alertHtml);

    $('p-goals').innerHTML = win(t('nav.goals'), d.goals.map((gl) => {
      const p = F.goalProgress(gl, ref);
      return '<div class="lp-goal"><span>' + charts.ring(p.pct, { size: 76, stroke: 9, color: gl.color, aria: t(gl.nameKey) + ' ' + p.pct + '%' }) + '</span><div><div class="row-title">' + esc(t(gl.nameKey)) + '</div><div class="muted" style="font-size:13px">' + esc(t('lp.s5.left', { m: i18n.money(p.remaining, 'DZD') })) + ' · ' + esc(t('lp.s5.by', { date: i18n.date(gl.targetDate) })) + '</div><div class="badge badge-primary" style="margin-top:6px">' + esc(t('lp.s5.suggest', { m: i18n.money(p.suggestedMonthly, 'DZD') })) + '</div></div></div>';
    }).join(''));

    $('p-habits').innerHTML = win(t('ov.spendingByCategory'), '<div class="lp-two"><div>' + charts.donut({ slices, fmt: (v) => i18n.money(v, 'DZD'), aria: t('ov.spendingByCategory') }) + '</div><ul class="lp-legend">' + slices.slice(0, 6).map((s) => '<li><i style="background:' + s.color + '"></i><span>' + esc(s.label) + '</span></li>').join('') + '</ul></div>');

    const diff = prev.expense - cur.expense;
    $('p-chat').innerHTML = win(t('nav.assistant'), '<div class="lp-msg me">' + esc(t('lp.s7.q')) + '</div><div class="lp-msg bot"><span class="badge badge-primary">' + esc(t('lp.s7.badge')) + '</span><br>'
      + (diff >= 0 ? esc(t('lp.s7.a', { cur: i18n.money(cur.expense, 'DZD'), prev: i18n.money(prev.expense, 'DZD'), diff: i18n.money(diff, 'DZD'), pct: prev.expense ? Math.round((diff / prev.expense) * 100) : 0 })) : '') + '</div>');

    const sem = F.periodTotals(d, { start: monthRange(ref, -2).start, end: ref });
    const semBudget = 120000 * 100, usedPct = Math.min(100, Math.round((sem.expense / semBudget) * 100)), elapsed = Math.min(100, Math.round((dates.diffDays(monthRange(ref, -2).start, ref) / dates.diffDays(monthRange(ref, -2).start, dates.addMonths(monthRange(ref, -2).start, 4, 1))) * 100));
    $('p-student').innerHTML = win(t('lp.s8.semester'), '<div class="lp-kpis"><div class="kpi"><div class="k-label">' + esc(t('lp.s8.allowance')) + '</div><div class="k-value">' + M(40000 * 100) + '</div></div><div class="kpi"><div class="k-label">' + esc(t('lp.s8.upcoming')) + '</div><div class="k-value">' + M(8000 * 100) + '</div><div class="k-sub muted">' + esc(t('lp.s8.fee')) + '</div></div></div>'
      + '<div class="lp-bud"><div class="lp-bud-h"><span>' + esc(t('lp.s8.left', { m: i18n.money(cur.net > 0 ? cur.net : 0, 'DZD') })) + '</span></div><div class="progress ok" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + usedPct + '"><i style="width:' + usedPct + '%"></i></div><div class="muted" style="font-size:12.5px;margin-top:6px">' + esc(t('lp.s8.pace', { b: usedPct, t: elapsed })) + '</div></div>');
  }

  /* ---------- controls ---------- */
  const settings = () => store.get().settings;
  function renderControls() {
    const s = settings();
    $('brand-logo').innerHTML = SMM.logo(32); $('foot-logo').innerHTML = SMM.logo(24);
    $('menu-btn').innerHTML = SMM.icon($('mobile-menu').hidden ? 'menu' : 'x');
    $('mode-toggle').innerHTML = SMM.icon(doc.documentElement.getAttribute('data-mode') === 'dark' ? 'sun' : 'moon');
    $('lang-select').value = s.language;
    $('theme-grid').innerHTML = theme.THEMES.map((k) => {
      const mode = theme.FIXED[k] || doc.documentElement.getAttribute('data-mode') || 'dark';
      return '<button type="button" class="theme-card" data-theme-id="' + k + '" aria-pressed="' + (s.theme === k) + '"><div class="theme-prev" data-theme="' + k + '" data-mode="' + mode + '"><div class="tp-side"></div><div class="tp-main"><div class="tp-bar"></div><div class="tp-card"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:85%"></i></div></div></div><div class="theme-meta"><span>' + esc(THEME_NAME[k]) + '</span>' + (s.theme === k ? SMM.icon('check', 'icon-sm') : '') + '</div></button>';
    }).join('');
    $('lang-seg').innerHTML = ['en', 'fr', 'ar'].map((l) => '<button type="button" data-lang="' + l + '" aria-pressed="' + (s.language === l) + '"' + (l === 'ar' ? ' lang="ar"' : '') + '>' + esc(i18n.NAMES[l]) + '</button>').join('');
  }
  function renderAll() {
    theme.applyAll(settings());
    i18n.apply(doc);
    doc.title = 'Smart Money Manager';
    renderPreviews(); renderControls();
  }
  function change(patch) { store.setSettings(patch); renderAll(); }

  function setupEvents() {
    $('lang-select').addEventListener('change', (e) => change({ language: e.target.value }));
    $('lang-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) change({ language: b.dataset.lang }); });
    $('theme-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-theme-id]'); if (b) change({ theme: b.dataset.themeId }); });
    $('mode-toggle').addEventListener('click', () => {
      const s = settings(), dark = doc.documentElement.getAttribute('data-mode') === 'dark';
      if (s.theme === 'midnight') change({ theme: 'light' }); else if (s.theme === 'light') change({ theme: 'midnight' }); else change({ mode: dark ? 'light' : 'dark' });
    });
    const menu = $('mobile-menu'), btn = $('menu-btn');
    const setMenu = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.innerHTML = SMM.icon(open ? 'x' : 'menu'); btn.setAttribute('aria-label', t(open ? 'lp.nav.closeMenu' : 'lp.nav.menu')); };
    btn.addEventListener('click', () => setMenu(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); btn.focus(); } });
    g.addEventListener('resize', () => { if (g.innerWidth > 860 && !menu.hidden) setMenu(false); });
  }

  function setupObservers() {
    const rev = doc.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in g) || reduced()) { rev.forEach((el) => el.classList.add('in')); }
    else {
      doc.documentElement.classList.add('js');
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      rev.forEach((el) => io.observe(el));
    }
    if (!('IntersectionObserver' in g)) return;
    const map = { features: 'features', transactions: 'features', budgeting: 'features', goals: 'features', habits: 'features', students: 'students', assistant: 'assistant', personalize: 'personalize' };
    const links = [...doc.querySelectorAll('#nav-links [data-nav]')];
    const nav = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const key = map[e.target.id]; links.forEach((a) => (a.dataset.nav === key ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }), { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach((id) => { const el = $(id); if (el) nav.observe(el); });
    const hero = $('hero');
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.removeAttribute('aria-current')); }), { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }

  function init() { renderAll(); setupEvents(); setupObservers(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window);
