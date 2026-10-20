/* Internationalisation: dictionaries (js/i18n/*.js) + number/date/currency formatting + DOM application. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  SMM.dict = SMM.dict || { en: {}, fr: {}, ar: {} };
  const { money, dates } = SMM;
  let lang = 'en';
  let prefs = { numberLocale: 'auto', dateFormat: 'auto', currency: 'DZD' };

  const LOCALES = { en: 'en-US', fr: 'fr-FR', ar: 'ar-DZ-u-nu-latn' }; // Latin digits keep amounts readable & consistent
  const NAMES = { en: 'English', fr: 'Français', ar: 'العربية' };

  const i18n = {
    NAMES,
    get lang() { return lang; },
    isRTL: () => lang === 'ar',
    dir: () => (lang === 'ar' ? 'rtl' : 'ltr'),
    locale() { const n = prefs.numberLocale; return n && n !== 'auto' ? (n === 'ar-DZ' ? 'ar-DZ-u-nu-latn' : n) : LOCALES[lang]; },
    uiLocale: () => LOCALES[lang],
    configure(p) { prefs = Object.assign(prefs, p); },
    setLang(l) {
      if (!LOCALES[l]) l = 'en'; lang = l;
      if (typeof document !== 'undefined') { document.documentElement.lang = l; document.documentElement.dir = i18n.dir(); }
    },
    t(key, params) {
      let s = (SMM.dict[lang] && SMM.dict[lang][key]);
      if (s == null) s = SMM.dict.en[key];
      if (s == null) return key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
      return s;
    },
    has: (key) => SMM.dict.en[key] != null,
    money(minor, currency) { return money.format(minor, currency || prefs.currency, i18n.locale()); },
    /** compact money for chart axes */
    moneyShort(minor) {
      try { return new Intl.NumberFormat(i18n.locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(minor / 100); } catch (e) { return String(Math.round(minor / 100)); }
    },
    num(n, o) { return money.formatNumber(n, i18n.locale(), o); },
    pct(n) { return i18n.num(Math.round(n)) + '%'; },
    date(iso, style) {
      if (!iso || !dates.isValid(iso)) return '';
      const f = prefs.dateFormat;
      const [y, m, d] = iso.split('-');
      if (style !== 'long' && f === 'iso') return iso;
      if (style !== 'long' && f === 'dmy') return d + '/' + m + '/' + y;
      if (style !== 'long' && f === 'mdy') return m + '/' + d + '/' + y;
      const opts = style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : style === 'short' ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
      return new Intl.DateTimeFormat(i18n.uiLocale(), opts).format(dates.parse(iso));
    },
    monthYear(iso) { return new Intl.DateTimeFormat(i18n.uiLocale(), { month: 'long', year: 'numeric' }).format(dates.parse(iso)); },
    monthShort(iso) { return new Intl.DateTimeFormat(i18n.uiLocale(), { month: 'short' }).format(dates.parse(iso)); },
    weekdays(weekStart) {
      const base = new Date(2024, 0, 7); // a Sunday
      const out = [];
      for (let i = 0; i < 7; i++) { const dt = new Date(base); dt.setDate(base.getDate() + ((i + weekStart) % 7)); out.push(new Intl.DateTimeFormat(i18n.uiLocale(), { weekday: 'short' }).format(dt)); }
      return out;
    },
    time(ts) { return new Intl.DateTimeFormat(i18n.uiLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); },
    /** apply data-i18n / data-i18n-attr to a DOM subtree */
    apply(root) {
      root = root || document;
      root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = i18n.t(el.getAttribute('data-i18n')); });
      root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
        el.getAttribute('data-i18n-attr').split(';').forEach((pair) => { const [a, k] = pair.split(':'); if (a && k) el.setAttribute(a.trim(), i18n.t(k.trim())); });
      });
    },
  };
  SMM.i18n = i18n;
  SMM.t = i18n.t;
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
