/* Settings: appearance, language, regional, alerts, notifications, privacy, data (backup/restore/reset), assistant config. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, store, theme, defaults: D, money, actions: A } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  const sel = (name, value, opts) => '<select class="select" data-setting="' + name + '" id="s_' + name + '">' + opts.map((o) => '<option value="' + ui.esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + ui.esc(o[1]) + '</option>').join('') + '</select>';
  const row = (name, label, ctl, hint) => '<div class="field"><label for="s_' + name + '">' + ui.esc(label) + '</label>' + ctl + (hint ? '<div class="hint">' + ui.esc(hint) + '</div>' : '') + '</div>';
  const THEME_NAME = { midnight: 'Midnight Dark', light: 'Pure Light', emerald: 'Emerald Finance', ocean: 'Ocean Blue', violet: 'Violet Modern', rose: 'Rose Elegant', graphite: 'Graphite', sand: 'Warm Sand' };

  SMM.pages.settings = {
    title: 'nav.settings',
    render() {
      const d = store.get(); const s = d.settings; const fixed = theme.FIXED[s.theme];
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.settings')) + '</h1><p>' + ui.esc(t('set.subtitle')) + '</p></div></div><div class="stack">';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('palette', 'icon-sm') + ' ' + ui.esc(t('set.appearance')) + '</div>'
        + '<div class="theme-grid" role="group" aria-label="' + ui.esc(t('set.theme')) + '">' + theme.THEMES.map((k) => {
          const mode = theme.FIXED[k] || (theme.resolveMode(s)); const sw = { midnight: 'dark', light: 'light' };
          return '<button type="button" class="theme-card" data-action="theme" data-theme-id="' + k + '" aria-pressed="' + (s.theme === k) + '"><div class="theme-prev" data-theme="' + k + '" data-mode="' + mode + '" style="background:var(--bg)"><div class="tp-side"></div><div class="tp-main"><div class="tp-bar"></div><div class="tp-card"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:85%"></i></div></div></div><div class="theme-meta"><span>' + ui.esc(THEME_NAME[k]) + '</span>' + (s.theme === k ? SMM.icon('check', 'icon-sm') : '') + '</div></button>';
        }).join('') + '</div>'
        + '<div class="field"><span class="label">' + ui.esc(t('set.mode')) + '</span><div class="seg" role="group">' + ['light', 'dark', 'system'].map((k) => '<button data-action="mode" data-mode="' + k + '" aria-pressed="' + (s.mode === k) + '"' + (fixed ? ' disabled' : '') + '>' + SMM.icon(k === 'light' ? 'sun' : k === 'dark' ? 'moon' : 'settings', 'icon-sm') + ' ' + ui.esc(t('set.mode.' + k)) + '</button>').join('') + '</div>' + (fixed ? '<div class="hint">' + ui.esc(t('set.modeFixed')) + '</div>' : '') + '</div>'
        + '<div class="field"><span class="label">' + ui.esc(t('set.accent')) + '</span><div class="accent-row" role="group">' + '<button type="button" class="accent" data-action="accent" data-accent="default" aria-pressed="' + (s.accent === 'default') + '" style="background:var(--surface-2);color:var(--text)" aria-label="' + ui.esc(t('set.accent.default')) + '" title="' + ui.esc(t('set.accent.default')) + '">' + SMM.icon('rotate', 'icon-sm') + '</button>' + Object.keys(theme.ACCENTS).map((k) => '<button type="button" class="accent" data-action="accent" data-accent="' + k + '" aria-pressed="' + (s.accent === k) + '" style="background:' + theme.ACCENTS[k][theme.resolveMode(s)] + '" aria-label="' + ui.esc(t('set.accent.' + k)) + '" title="' + ui.esc(t('set.accent.' + k)) + '">' + (s.accent === k ? SMM.icon('check', 'icon-sm') : '') + '</button>').join('') + '</div><div class="hint">' + ui.esc(t('set.accentHint')) + '</div></div></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('globe', 'icon-sm') + ' ' + ui.esc(t('set.regional')) + '</div><div class="form-grid">'
        + row('language', t('set.language'), sel('language', s.language, [['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']]), t('set.languageHint'))
        + row('currency', t('set.currency'), sel('currency', s.currency, money.CURRENCIES.map((c) => [c, c + ' — ' + currencyName(c)])), t('set.currencyHint'))
        + row('dateFormat', t('set.dateFormat'), sel('dateFormat', s.dateFormat, [['auto', t('set.auto')], ['iso', '2026-10-31'], ['dmy', '31/10/2026'], ['mdy', '10/31/2026']]))
        + row('numberLocale', t('set.numberFormat'), sel('numberLocale', s.numberLocale, [['auto', t('set.auto')], ['en-US', '1,234.56'], ['fr-FR', '1 234,56'], ['ar-DZ', '1.234,56']])) + '</div>'
        + '<div class="hint">' + ui.esc(t('set.sample')) + ': <b class="ltr">' + ui.esc(SMM.i18n.money(123456)) + '</b> · ' + ui.esc(SMM.i18n.date('2026-10-31')) + '</div></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('bell', 'icon-sm') + ' ' + ui.esc(t('set.alerts')) + '</div><div class="form-grid">'
        + row('alertWarn', t('set.warnThreshold'), '<input class="input" id="s_alertWarn" type="number" min="1" max="99" data-setting="alertWarn" value="' + s.alertWarn + '">', t('set.warnHint'))
        + '</div><label class="check"><input type="checkbox" data-setting="notifyBrowser"' + (s.notifyBrowser ? ' checked' : '') + '><span>' + ui.esc(t('set.browserNotify')) + '</span></label><div class="hint">' + ui.esc(t('set.notifyLimits')) + ' <b>' + ui.esc(t('set.notifyPerm', { p: typeof Notification === 'undefined' ? t('set.notSupported') : Notification.permission })) + '</b></div></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('spark', 'icon-sm') + ' ' + ui.esc(t('set.assistant')) + '</div><p class="muted">' + ui.esc(t('set.assistantText')) + '</p>'
        + row('assistantEndpoint', t('set.endpoint'), '<input class="input ltr" style="display:block;width:100%" dir="ltr" id="s_assistantEndpoint" type="url" data-setting="assistantEndpoint" value="' + ui.esc(s.assistantEndpoint) + '" placeholder="https://your-server.example/api/assistant">', t('set.endpointHint'))
        + '<label class="check"><input type="checkbox" data-setting="assistantConsent"' + (s.assistantConsent ? ' checked' : '') + '><span>' + ui.esc(t('set.consent')) + '</span></label><div class="hint">' + ui.esc(t('set.consentHint')) + '</div></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('shield', 'icon-sm') + ' ' + ui.esc(t('set.privacy')) + '</div><div class="callout warn">' + SMM.icon('alert') + '<div>' + ui.esc(t('set.storageNote')) + '</div></div><p class="hint">' + ui.esc(store.adapter.persistent ? t('set.storageOk') : t('set.storageMemory')) + '</p></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('archive', 'icon-sm') + ' ' + ui.esc(t('set.data')) + '</div><p class="muted">' + ui.esc(t('set.dataText')) + '</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" data-action="exportJson">' + SMM.icon('download') + ui.esc(t('set.exportJson')) + '</button><button class="btn btn-secondary" data-action="importJson">' + SMM.icon('upload') + ui.esc(t('set.importJson')) + '</button><button class="btn btn-secondary" data-action="restoreBackup"' + (store.hasBackup() ? '' : ' disabled') + '>' + SMM.icon('undo') + ui.esc(t('set.restoreBackup')) + '</button></div><div class="hint">' + ui.esc(t('set.backupHint')) + '</div>'
        + '<hr style="border:0;border-top:1px solid var(--border);width:100%">' + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + (A.hasDemo() ? '<button class="btn btn-secondary" data-action="removeDemo">' + SMM.icon('trash') + ui.esc(t('demo.remove')) + '</button>' : '<button class="btn btn-secondary" data-action="loadDemo">' + SMM.icon('play') + ui.esc(t('demo.load')) + '</button>') + '<button class="btn btn-danger" data-action="reset">' + SMM.icon('trash') + ui.esc(t('set.reset')) + '</button></div></div>';

      h += '<div class="card setting-block"><div class="card-title">' + SMM.icon('info', 'icon-sm') + ' ' + ui.esc(t('set.about')) + '</div><p class="muted">' + ui.esc(t('set.aboutText')) + '</p></div></div>';
      return h;
    },
    onFilter(root, el) { // generic setting inputs
      const k = el.dataset.setting; if (!k) return;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'alertWarn') { v = Math.min(99, Math.max(1, parseInt(v, 10) || 80)); }
      if (k === 'assistantEndpoint') { v = String(v).trim(); if (v && !/^https?:\/\//i.test(v)) { ui.toast(t('set.endpointInvalid'), 'error'); el.value = store.get().settings.assistantEndpoint; return; } }
      if (k === 'notifyBrowser' && v) {
        if (typeof Notification === 'undefined') { el.checked = false; return ui.toast(t('set.notSupported'), 'warn'); }
        Notification.requestPermission().then((p) => { if (p !== 'granted') { store.setSettings({ notifyBrowser: false }); ui.toast(t('set.notifyDenied'), 'warn'); } SMM.app.render(); });
      }
      store.setSettings({ [k]: v });
      if (['language', 'currency', 'dateFormat', 'numberLocale'].includes(k)) { theme.applyAll(); SMM.app.fullRender(); }
      else SMM.app.render();
    },
    actions: {
      theme(el) { store.setSettings({ theme: el.dataset.themeId }); theme.applyAll(); SMM.app.render(); },
      mode(el) { store.setSettings({ mode: el.dataset.mode }); theme.applyAll(); SMM.app.render(); },
      accent(el) { store.setSettings({ accent: el.dataset.accent }); theme.applyAll(); SMM.app.render(); },
      exportJson() { ui.download('smart-money-backup-' + SMM.dates.today() + '.json', store.exportJSON(), 'application/json'); ui.toast(t('set.exported'), 'success'); },
      async importJson() {
        const file = await ui.pickFile('.json,application/json'); if (!file) return;
        let text; try { text = await ui.readFile(file, 20 * 1024 * 1024); } catch (e) { return ui.toast(t(e.message === 'too-large' ? 'tx.fileTooLarge' : 'tx.fileReadError'), 'error'); }
        const r = store.inspectImport(text);
        if (!r.ok) return ui.toast(t(r.errors[0] === 'newer-schema' ? 'set.importNewer' : 'set.importInvalid'), 'error');
        const cur = store.get();
        const ok = await ui.confirm({ title: t('set.importTitle'), danger: true, okLabel: t('set.importReplace'), message: t('set.importWarn', { a: SMM.i18n.num(r.counts.transactions), b: SMM.i18n.num(r.counts.accounts), c: SMM.i18n.num(cur.transactions.length), d: SMM.i18n.num(cur.accounts.length) }), detail: t('set.importDetail') + (r.errors.length ? ' ' + t('set.importSkipped', { n: SMM.i18n.num(r.errors.length) }) : '') });
        if (!ok) return;
        store.replaceAll(r.data); theme.applyAll(); SMM.app.fullRender(); ui.toast(t('set.imported'), 'success');
      },
      async restoreBackup() { if (await ui.confirm({ title: t('set.restoreBackup'), message: t('set.restoreConfirm'), okLabel: t('set.restoreBackup') })) { if (store.restoreBackup()) { theme.applyAll(); SMM.app.fullRender(); ui.toast(t('set.restored'), 'success'); } } },
      loadDemo() { const r = A.loadDemo(SMM.dates.today()); ui.toast(r.ok ? t('demo.loaded') : t(r.errors._), r.ok ? 'success' : 'error'); },
      async removeDemo() { if (await ui.confirm({ title: t('demo.remove'), message: t('demo.removeConfirm'), danger: true, okLabel: t('demo.remove') })) { A.removeDemo(); ui.toast(t('demo.removed'), 'success'); } },
      async reset() {
        if (await ui.confirm({ title: t('set.reset'), message: t('set.resetConfirm'), detail: t('set.resetDetail'), danger: true, okLabel: t('set.reset'), typeToConfirm: t('set.resetWord') })) { store.reset(); theme.applyAll(); SMM.app.fullRender(); ui.toast(t('set.resetDone'), 'success'); }
      },
    },
  };
  function currencyName(c) { try { return new Intl.DisplayNames([SMM.i18n.uiLocale()], { type: 'currency' }).of(c); } catch (e) { return c; } }
})(typeof globalThis !== 'undefined' ? globalThis : window);
