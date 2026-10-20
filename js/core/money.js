/* Money + date helpers. Pure: usable in browser and Node (tests).
 * Amounts are ALWAYS integers in minor units (1/100 of the currency unit). */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});

  const CURRENCIES = ['DZD', 'EUR', 'USD', 'GBP', 'CAD'];

  const money = {
    CURRENCIES,
    /** Parse user input ("1 250,50", "1,250.50", "١٢٫٥") to integer minor units, or null if invalid. */
    parse(input) {
      if (typeof input === 'number') {
        if (!isFinite(input)) return null;
        input = String(input);
      }
      if (typeof input !== 'string') return null;
      let s = input.trim().replace(/[\s  ]/g, '');
      s = s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
      if (!s) return null;
      const hasC = s.includes(','), hasD = s.includes('.');
      if (hasC && hasD) {
        // the last separator is the decimal one
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
      } else if (hasC) {
        s = /,\d{1,2}$/.test(s) && (s.match(/,/g) || []).length === 1 ? s.replace(',', '.') : s.replace(/,/g, '');
      }
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
      const [i, f = ''] = s.split('.');
      const v = Number(i) * 100 + Number((f + '00').slice(0, 2));
      return Number.isSafeInteger(v) ? v : null;
    },
    /** minor units -> plain decimal string for inputs/CSV ("12.50"). */
    toDecimal(minor) {
      const neg = minor < 0;
      const a = Math.abs(minor);
      return (neg ? '-' : '') + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
    },
    /** minor units -> localized currency string via Intl. */
    format(minor, currency, locale) {
      try {
        return new Intl.NumberFormat(locale || 'en-US', { style: 'currency', currency: currency || 'DZD' }).format(minor / 100);
      } catch (e) {
        return money.toDecimal(minor) + ' ' + currency;
      }
    },
    formatNumber(n, locale, opts) {
      try { return new Intl.NumberFormat(locale || 'en-US', opts).format(n); } catch (e) { return String(n); }
    },
    isAmount(v) { return Number.isSafeInteger(v) && v > 0; },
  };

  /* ---------- dates: ISO "YYYY-MM-DD" strings, always local-time safe ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dates = {
    pad,
    isValid(s) {
      if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 1970 && y <= 2200;
    },
    parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    iso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); },
    today() { return dates.iso(new Date()); },
    addDays(s, n) { const d = dates.parse(s); d.setDate(d.getDate() + n); return dates.iso(d); },
    /** add n months keeping an anchor day-of-month (clamped to month length). */
    addMonths(s, n, anchorDay) {
      const d = dates.parse(s);
      const day = anchorDay || d.getDate();
      const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      t.setDate(Math.min(day, last));
      return dates.iso(t);
    },
    startOfMonth(s) { return s.slice(0, 8) + '01'; },
    endOfMonth(s) { const d = dates.parse(s); return dates.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); },
    startOfWeek(s, weekStart) {
      const d = dates.parse(s);
      const diff = (d.getDay() - (weekStart == null ? 1 : weekStart) + 7) % 7;
      d.setDate(d.getDate() - diff);
      return dates.iso(d);
    },
    diffDays(a, b) { return Math.round((dates.parse(b) - dates.parse(a)) / 86400000); },
    monthKey(s) { return s.slice(0, 7); },
    /** period range. kind: week|month|lastMonth|year|custom */
    range(kind, today, opts) {
      opts = opts || {};
      if (kind === 'week') { const s = dates.startOfWeek(today, opts.weekStart); return { start: s, end: dates.addDays(s, 6) }; }
      if (kind === 'month') return { start: dates.startOfMonth(today), end: dates.endOfMonth(today) };
      if (kind === 'lastMonth') { const p = dates.addMonths(dates.startOfMonth(today), -1, 1); return { start: p, end: dates.endOfMonth(p) }; }
      if (kind === 'year') return { start: today.slice(0, 4) + '-01-01', end: today.slice(0, 4) + '-12-31' };
      return { start: opts.start || today, end: opts.end || today };
    },
    inRange(s, r) { return s >= r.start && s <= r.end; },
  };

  SMM.money = money;
  SMM.dates = dates;
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
