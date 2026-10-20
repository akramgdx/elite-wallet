/* Theme engine: 8 themes x (light|dark|system), curated accents, language + regional prefs applied from settings.
 * Used by both the landing page and the app so choices persist across them. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const FIXED = { midnight: 'dark', light: 'light' }; // palettes that only exist in one mode
  const ACCENTS = {
    teal: { light: '#0b7a68', dark: '#3ddbaa' }, blue: { light: '#1d63d1', dark: '#5aa2ff' }, violet: { light: '#6642dc', dark: '#a78bfa' },
    rose: { light: '#c42a60', dark: '#fb7fa5' }, amber: { light: '#a85a00', dark: '#fbbf24' }, green: { light: '#12803f', dark: '#4ade80' },
  };
  const THEME_INFO = {
    midnight: { dark: true }, light: { dark: false }, emerald: {}, ocean: {}, violet: {}, rose: {}, graphite: {}, sand: {},
  };
  let mq = null, current = null;

  function resolveMode(s) {
    if (FIXED[s.theme]) return FIXED[s.theme];
    if (s.mode === 'light' || s.mode === 'dark') return s.mode;
    return g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const theme = {
    FIXED, ACCENTS, THEMES: Object.keys(THEME_INFO), resolveMode,
    apply(s) {
      s = s || SMM.store.get().settings;
      current = s;
      const root = document.documentElement;
      const mode = resolveMode(s);
      root.setAttribute('data-theme', s.theme);
      root.setAttribute('data-mode', mode);
      if (s.accent && s.accent !== 'default' && ACCENTS[s.accent]) {
        const c = ACCENTS[s.accent][mode];
        root.style.setProperty('--primary', c); root.style.setProperty('--chart-1', c);
        root.style.setProperty('--on-primary', mode === 'dark' ? '#0a1020' : '#ffffff');
      } else { ['--primary', '--chart-1', '--on-primary'].forEach((p) => root.style.removeProperty(p)); }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#0a1020');
      if (g.matchMedia && !mq) { mq = g.matchMedia('(prefers-color-scheme: dark)'); const on = () => { if (current && current.mode === 'system' && !FIXED[current.theme]) theme.apply(current); }; mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on); }
    },
    /** apply language + number/date/currency prefs + theme from settings */
    applyAll(s) {
      s = s || SMM.store.get().settings;
      SMM.i18n.configure({ numberLocale: s.numberLocale, dateFormat: s.dateFormat, currency: s.currency });
      SMM.i18n.setLang(s.language);
      theme.apply(s);
    },
  };
  SMM.theme = theme;
})(typeof globalThis !== 'undefined' ? globalThis : window);
