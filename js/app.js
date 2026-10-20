/* Application shell: hash router, sidebar/topbar, event delegation, notifications. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, store, finance: F, dates, theme, dialogs: dlg } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);

  const NAV = [
    { group: 'nav.g.main', items: [['overview', 'home'], ['transactions', 'swap'], ['accounts', 'wallet'], ['income', 'arrow-down']] },
    { group: 'nav.g.plan', items: [['budgets', 'target'], ['categories', 'tag'], ['recurring', 'repeat'], ['goals', 'flag'], ['calendar', 'calendar']] },
    { group: 'nav.g.insight', items: [['reports', 'chart'], ['student', 'cap'], ['assistant', 'spark']] },
  ];
  const ROUTES = NAV.reduce((a, g2) => a.concat(g2.items.map((i) => i[0])), []).concat(['settings']);
  let current = 'overview', rafId = 0, shellBuilt = false;
  const shownBrowser = new Set();

  const app = {
    route() { const h = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0]; return ROUTES.includes(h) ? h : 'overview'; },
    go(r) { location.hash = '#/' + r; },
    shell() {
      const s = store.get().settings;
      const nav = NAV.map((grp) => '<div class="nav-group"><h6>' + ui.esc(t(grp.group)) + '</h6>' + grp.items.map(([k, ic]) => '<a class="nav-link" href="#/' + k + '" data-route="' + k + '">' + SMM.icon(ic) + '<span>' + ui.esc(t('nav.' + k)) + '</span></a>').join('') + '</div>').join('');
      document.getElementById('app').innerHTML =
        '<a class="skip-link" href="#main">' + ui.esc(t('common.skip')) + '</a>'
        + '<aside class="sidebar" id="sidebar" aria-label="' + ui.esc(t('nav.main')) + '"><a class="brand" href="index.html" aria-label="' + ui.esc(t('nav.backHome')) + '">' + SMM.logo(32) + '<span><b>Smart Money<br>Manager</b></span></a><nav>' + nav + '</nav>'
        + '<div class="sidebar-foot"><a class="nav-link" href="#/settings" data-route="settings">' + SMM.icon('settings') + '<span>' + ui.esc(t('nav.settings')) + '</span></a><a class="btn btn-secondary btn-sm" href="index.html">' + SMM.icon('arrow-left', 'icon-sm flip') + ui.esc(t('nav.backHome')) + '</a><p class="sidebar-note">' + ui.esc(t('nav.localNote')) + '</p></div></aside>'
        + '<div class="scrim" data-shell="closeNav"></div>'
        + '<div class="main-wrap"><header class="topbar"><button class="btn btn-ghost btn-icon menu-btn" data-shell="openNav" aria-label="' + ui.esc(t('nav.menu')) + '" aria-controls="sidebar">' + SMM.icon('menu') + '</button><div class="crumbs"><a href="index.html">' + ui.esc(t('nav.home')) + '</a><span aria-hidden="true">/</span><b id="crumb"></b></div>'
        + '<div class="top-actions"><label class="sr-only" for="langSel">' + ui.esc(t('set.language')) + '</label><select class="select hide-sm" id="langSel" data-shell="lang">' + [['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']].map((l) => '<option value="' + l[0] + '"' + (s.language === l[0] ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>'
        + '<button class="btn btn-ghost btn-icon" data-shell="themeToggle" aria-label="' + ui.esc(t('set.toggleMode')) + '" id="themeBtn"></button>'
        + '<span class="icon-btn-wrap"><button class="btn btn-ghost btn-icon" data-shell="notifications" aria-label="' + ui.esc(t('notif.title')) + '">' + SMM.icon('bell') + '</button><span class="dot-badge hidden" id="notifBadge" aria-hidden="true"></span></span>'
        + '<button class="btn btn-primary btn-sm hide-sm" data-shell="addTx">' + SMM.icon('plus', 'icon-sm') + ui.esc(t('tx.add')) + '</button></div></header><main id="main" tabindex="-1"></main></div>';
      shellBuilt = true; app.updateThemeBtn();
    },
    updateThemeBtn() { const b = document.getElementById('themeBtn'); if (!b) return; const mode = document.documentElement.getAttribute('data-mode'); b.innerHTML = SMM.icon(mode === 'dark' ? 'sun' : 'moon'); b.disabled = !!theme.FIXED[store.get().settings.theme]; b.title = b.disabled ? t('set.modeFixed') : t('set.toggleMode'); },
    badge() {
      const d = store.get(); const list = F.notifications(d, dates.today()); const unread = list.filter((n) => !d.readNotifications.includes(n.key));
      const b = document.getElementById('notifBadge'); if (b) { b.classList.toggle('hidden', !unread.length); b.textContent = unread.length > 9 ? '9+' : SMM.i18n.num(unread.length); }
      if (d.settings.notifyBrowser && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        unread.forEach((n) => { if (shownBrowser.has(n.key)) return; shownBrowser.add(n.key); try { new Notification('Smart Money Manager', { body: view_text(n, d) }); } catch (e) { /* some browsers only allow via service worker */ } });
      }
    },
    render() {
      if (!shellBuilt) app.shell();
      current = app.route(); const page = SMM.pages[current]; const main = document.getElementById('main');
      document.querySelectorAll('[data-route]').forEach((a) => { if (a.dataset.route === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.getElementById('crumb').textContent = t(page.title); document.title = t(page.title) + ' · Smart Money Manager';
      const y = g.scrollY; const active = document.activeElement; const keep = active && active.id && main.contains(active) ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null;
      main.innerHTML = page.render();
      if (page.mount) page.mount(main);
      if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* not a text input */ } } }
      g.scrollTo(0, y); app.badge(); app.updateThemeBtn();
    },
    fullRender() { shellBuilt = false; app.render(); },
    schedule() { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => app.render()); },
    notificationsDialog() {
      const d = store.get(); const list = F.notifications(d, dates.today()); const keys = list.map((n) => n.key);
      ui.modal({
        title: t('notif.title'),
        body: list.length ? '<ul class="rows">' + list.map((n) => { const unread = !d.readNotifications.includes(n.key); return '<li><span class="dot-icon" style="background:var(--' + (n.level === 'warn' ? 'warning' : n.level === 'good' ? 'success' : 'info') + ')">' + SMM.icon(n.level === 'warn' ? 'alert' : n.level === 'good' ? 'check' : 'bell', 'icon-sm') + '</span><div class="row-main" style="white-space:normal"><div style="font-weight:' + (unread ? 800 : 600) + '">' + ui.esc(view_text(n, d)) + '</div></div>' + (unread ? '<span class="badge badge-primary">' + ui.esc(t('notif.new')) + '</span>' : '') + '</li>'; }).join('') + '</ul><p class="hint" style="margin-top:12px">' + ui.esc(t('notif.limits')) + '</p>' : '<p class="muted">' + ui.esc(t('notif.none')) + '</p><p class="hint" style="margin-top:12px">' + ui.esc(t('notif.limits')) + '</p>',
        footer: list.length ? '<button class="btn btn-secondary" data-close>' + ui.esc(t('common.close')) + '</button><button class="btn btn-primary" data-readall>' + ui.esc(t('notif.markRead')) + '</button>' : '',
        onMount(box, api) { const b = box.querySelector('[data-readall]'); if (b) b.addEventListener('click', () => { SMM.actions.markNotificationsRead(keys); api.close(); }); },
      });
    },
  };
  const view_text = (n, d) => SMM.view.text(n.text, n.params, d);

  function init() {
    const rep = store.report();
    theme.applyAll();
    app.shell();
    app.render();
    store.subscribe((s, reason) => { if (reason === 'settings') return app.schedule(); app.schedule(); });
    g.addEventListener('hashchange', () => { document.getElementById('app').classList.remove('nav-open'); app.render(); g.scrollTo(0, 0); const m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); });

    const root = document.getElementById('app');
    root.addEventListener('click', (e) => {
      const sh = e.target.closest('[data-shell]');
      if (sh) {
        const k = sh.dataset.shell;
        if (k === 'openNav') { root.classList.add('nav-open'); } else if (k === 'closeNav') root.classList.remove('nav-open');
        else if (k === 'addTx') dlg.transaction();
        else if (k === 'notifications') app.notificationsDialog();
        else if (k === 'themeToggle') { const s = store.get().settings; const mode = document.documentElement.getAttribute('data-mode') === 'dark' ? 'light' : 'dark'; store.setSettings({ mode }); theme.applyAll(); app.render(); }
        return;
      }
      if (e.target.closest('.nav-link')) root.classList.remove('nav-open');
      const a = e.target.closest('[data-action]');
      if (!a || a.tagName === 'INPUT' && a.type === 'checkbox') return;
      if (a.disabled) return;
      const fn = SMM.pages[current].actions && SMM.pages[current].actions[a.dataset.action];
      if (fn) fn(a, e, document.getElementById('main'));
    });
    root.addEventListener('change', (e) => {
      const sh = e.target.closest('[data-shell="lang"]');
      if (sh) { store.setSettings({ language: sh.value }); theme.applyAll(); app.fullRender(); return; }
      const a = e.target.closest('input[data-action][type="checkbox"]'); // checkbox actions fire on change
      if (a) { const fn = SMM.pages[current].actions[a.dataset.action]; if (fn) fn(a, e, document.getElementById('main')); return; }
      const f = e.target.closest('[data-filter], [data-range], [data-setting]');
      if (f && !(f.type === 'search' || f.type === 'text')) filterEvent(f);
    });
    const typed = ui.debounce((f) => filterEvent(f), 180);
    root.addEventListener('input', (e) => { const f = e.target.closest('[data-filter]'); if (f && (f.type === 'search' || f.type === 'text')) typed(f); });
    root.addEventListener('keydown', (e) => { const row = e.target.closest('tr[data-action], li[data-action]'); if (row && (e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); row.click(); } });
    function filterEvent(f) { const p = SMM.pages[current]; if (p.onFilter) p.onFilter(document.getElementById('main'), f); }

    if (rep.status === 'corrupt') ui.modal({ title: t('boot.corruptTitle'), body: '<p>' + ui.esc(t('boot.corruptText')) + '</p>' });
    else if (rep.status === 'repaired') ui.toast(t('boot.repaired', { n: SMM.i18n.num(rep.errors.length) }), 'warn');
    if (!store.adapter.persistent) ui.toast(t('set.storageMemory'), 'warn');
  }
  SMM.app = app;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof globalThis !== 'undefined' ? globalThis : window);
