/* Default data model, enumerations and validation/sanitising of whole data sets (used on load + import). */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { dates, money } = SMM;

  const SCHEMA_VERSION = 1;
  const LANGS = ['en', 'ar', 'fr'];
  const THEMES = ['midnight', 'light', 'emerald', 'ocean', 'violet', 'rose', 'graphite', 'sand'];
  const MODES = ['light', 'dark', 'system'];
  const ACCENTS = ['default', 'teal', 'blue', 'violet', 'rose', 'amber', 'green'];
  const TX_TYPES = ['income', 'expense', 'transfer', 'refund'];
  const ACCOUNT_TYPES = ['cash', 'bank', 'savings', 'student', 'other'];
  const FREQS = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
  const BUDGET_PERIODS = ['weekly', 'monthly', 'semester', 'custom'];
  const EVENT_TYPES = ['bill', 'income', 'review', 'student', 'other'];
  const COLORS = ['#0f9d8a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#a16207', '#64748b'];

  const expenseCats = [
    ['food', '#f59e0b', 'utensils', 1, 1], ['transport', '#3b82f6', 'bus', 1, 1], ['housing', '#8b5cf6', 'home', 1, 1],
    ['education', '#0f9d8a', 'cap', 1, 1], ['books', '#a16207', 'book', 1, 1], ['health', '#ef4444', 'heart', 1, 0],
    ['entertainment', '#ec4899', 'film', 0, 0], ['shopping', '#06b6d4', 'bag', 0, 0], ['subscriptions', '#64748b', 'repeat', 0, 0],
    ['bills', '#22c55e', 'receipt', 1, 0], ['fitness', '#f97316', 'dumbbell', 0, 0], ['gifts', '#d946ef', 'gift', 0, 0], ['other', '#94a3b8', 'tag', 0, 0],
  ].map(([k, color, icon, essential, student]) => ({ id: 'cat_' + k, kind: 'expense', key: k, color, icon, essential: !!essential, student: !!student, archived: false }));
  const incomeCats = [
    ['salary', '#0f9d8a', 'briefcase', 0], ['allowance', '#3b82f6', 'wallet', 1], ['scholarship', '#8b5cf6', 'cap', 1],
    ['freelance', '#f59e0b', 'laptop', 0], ['parttime', '#22c55e', 'clock', 1], ['giftsIn', '#ec4899', 'gift', 0], ['otherIncome', '#94a3b8', 'tag', 0],
  ].map(([k, color, icon, student]) => ({ id: 'cat_' + k, kind: 'income', key: k, color, icon, essential: false, student: !!student, archived: false }));

  function defaultSettings() {
    return {
      language: 'en', theme: 'midnight', mode: 'system', accent: 'default', currency: 'DZD',
      dateFormat: 'auto', numberLocale: 'auto', alertWarn: 80, alertOver: 100,
      notifyBrowser: false, assistantConsent: false, assistantEndpoint: '',
      student: { semesterStart: '', semesterEnd: '', semesterBudget: 0, allowance: 0, allowanceFreq: 'monthly', emergencyTarget: 0 },
    };
  }
  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION, settings: defaultSettings(),
      accounts: [], categories: expenseCats.concat(incomeCats).map((c) => Object.assign({}, c)),
      transactions: [], budgets: [], recurring: [], goals: [], challenges: [], events: [], journal: [], chats: [], readNotifications: [],
    };
  }

  /* ----- sanitising helpers ----- */
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max || 200) : '');
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const int = (v, d) => (Number.isSafeInteger(v) ? v : d);
  const isoOr = (v, d) => (dates.isValid(v) ? v : d);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const id = (v) => (typeof v === 'string' && v && v.length <= 80 ? v : null);

  function sanitizeSettings(s, errors) {
    const d = defaultSettings();
    s = s && typeof s === 'object' ? s : {};
    const st = s.student && typeof s.student === 'object' ? s.student : {};
    const out = {
      language: oneOf(s.language, LANGS, d.language), theme: oneOf(s.theme, THEMES, d.theme), mode: oneOf(s.mode, MODES, d.mode),
      accent: oneOf(s.accent, ACCENTS, d.accent), currency: oneOf(s.currency, money.CURRENCIES, d.currency),
      dateFormat: oneOf(s.dateFormat, ['auto', 'iso', 'dmy', 'mdy'], 'auto'), numberLocale: oneOf(s.numberLocale, ['auto', 'en-US', 'fr-FR', 'ar-DZ'], 'auto'),
      alertWarn: Math.min(99, Math.max(1, int(s.alertWarn, 80))), alertOver: 100,
      notifyBrowser: s.notifyBrowser === true, assistantConsent: s.assistantConsent === true,
      assistantEndpoint: /^https?:\/\//.test(s.assistantEndpoint || '') ? str(s.assistantEndpoint, 300) : '',
      student: {
        semesterStart: isoOr(st.semesterStart, ''), semesterEnd: isoOr(st.semesterEnd, ''),
        semesterBudget: Math.max(0, int(st.semesterBudget, 0)), allowance: Math.max(0, int(st.allowance, 0)),
        allowanceFreq: oneOf(st.allowanceFreq, ['weekly', 'monthly'], 'monthly'), emergencyTarget: Math.max(0, int(st.emergencyTarget, 0)), demo: st.demo === true,
      },
    };
    if (s.language && out.language !== s.language) errors.push('settings.language');
    return out;
  }

  /**
   * Validate + sanitise an entire data set. Returns {ok, errors, data}. Never throws.
   * Structural problems (not an object, referential integrity) are errors; recoverable field problems are dropped/defaulted.
   */
  function validateData(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['not-an-object'], data: null };
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) return { ok: false, errors: ['newer-schema'], data: null };
    const data = defaultState();
    data.categories = [];
    data.settings = sanitizeSettings(raw.settings, errors);
    const seen = new Set();
    const uniq = (x) => { if (!x || seen.has(x)) return false; seen.add(x); return true; };

    arr(raw.categories).forEach((c, i) => {
      if (!c || !uniq('c:' + id(c.id))) return errors.push('category#' + i);
      data.categories.push({ id: c.id, kind: oneOf(c.kind, ['expense', 'income'], 'expense'), key: str(c.key, 40), name: str(c.name, 60), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : COLORS[0], icon: str(c.icon, 20) || 'tag', essential: !!c.essential, student: !!c.student, archived: !!c.archived });
    });
    if (!data.categories.length) data.categories = defaultState().categories;
    const catIds = new Set(data.categories.map((c) => c.id));

    arr(raw.accounts).forEach((a, i) => {
      if (!a || !uniq('a:' + id(a.id))) return errors.push('account#' + i);
      data.accounts.push({ id: a.id, name: str(a.name, 60) || 'Account', type: oneOf(a.type, ACCOUNT_TYPES, 'other'), openingBalance: int(a.openingBalance, 0), currency: oneOf(a.currency, money.CURRENCIES, data.settings.currency), description: str(a.description, 200), color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : COLORS[0], archived: !!a.archived, demo: !!a.demo });
    });
    const accIds = new Set(data.accounts.map((a) => a.id));

    arr(raw.transactions).forEach((t, i) => {
      const bad = (why) => errors.push('transaction#' + i + ':' + why);
      if (!t || !uniq('t:' + id(t.id))) return bad('id');
      if (!TX_TYPES.includes(t.type)) return bad('type');
      if (!money.isAmount(t.amount)) return bad('amount');
      if (!dates.isValid(t.date)) return bad('date');
      if (!accIds.has(t.accountId)) return bad('account');
      if (t.type === 'transfer' && (!accIds.has(t.toAccountId) || t.toAccountId === t.accountId)) return bad('transfer-target');
      if (t.type !== 'transfer' && !catIds.has(t.categoryId)) return bad('category');
      data.transactions.push({ id: t.id, type: t.type, amount: t.amount, date: t.date, accountId: t.accountId, toAccountId: t.type === 'transfer' ? t.toAccountId : '', categoryId: t.type === 'transfer' ? '' : t.categoryId, description: str(t.description, 200), notes: str(t.notes, 1000), merchant: str(t.merchant, 100), tags: arr(t.tags).map((x) => str(x, 30)).filter(Boolean).slice(0, 10), recurringId: str(t.recurringId, 80), demo: !!t.demo });
    });

    arr(raw.budgets).forEach((b, i) => {
      if (!b || !uniq('b:' + id(b.id)) || !money.isAmount(b.limit)) return errors.push('budget#' + i);
      data.budgets.push({ id: b.id, name: str(b.name, 60), period: oneOf(b.period, BUDGET_PERIODS, 'monthly'), categoryIds: arr(b.categoryIds).filter((c) => catIds.has(c)), limit: b.limit, start: isoOr(b.start, ''), end: isoOr(b.end, ''), rollover: !!b.rollover, demo: !!b.demo });
    });

    arr(raw.recurring).forEach((r, i) => {
      if (!r || !uniq('r:' + id(r.id)) || !money.isAmount(r.amount) || !dates.isValid(r.nextDue) || !dates.isValid(r.startDate) || !accIds.has(r.accountId) || !catIds.has(r.categoryId)) return errors.push('recurring#' + i);
      data.recurring.push({ id: r.id, name: str(r.name, 80), type: oneOf(r.type, ['income', 'expense'], 'expense'), amount: r.amount, categoryId: r.categoryId, accountId: r.accountId, frequency: oneOf(r.frequency, FREQS, 'monthly'), interval: Math.min(365, Math.max(1, int(r.interval, 1))), startDate: r.startDate, nextDue: r.nextDue, endDate: isoOr(r.endDate, ''), active: r.active !== false, remindDays: Math.min(30, Math.max(0, int(r.remindDays, 3))), demo: !!r.demo });
    });

    arr(raw.goals).forEach((gl, i) => {
      if (!gl || !uniq('g:' + id(gl.id)) || !money.isAmount(gl.target)) return errors.push('goal#' + i);
      data.goals.push({ id: gl.id, name: str(gl.name, 80), target: gl.target, targetDate: isoOr(gl.targetDate, ''), description: str(gl.description, 300), color: /^#[0-9a-f]{6}$/i.test(gl.color) ? gl.color : COLORS[0], emergency: !!gl.emergency, demo: !!gl.demo,
        contributions: arr(gl.contributions).filter((c) => c && dates.isValid(c.date) && Number.isSafeInteger(c.amount) && c.amount !== 0).map((c) => ({ id: str(c.id, 80) || 'c' + Math.random().toString(36).slice(2), date: c.date, amount: c.amount, note: str(c.note, 100) })) });
    });

    arr(raw.challenges).forEach((c, i) => {
      if (!c || !uniq('ch:' + id(c.id))) return errors.push('challenge#' + i);
      data.challenges.push({ id: c.id, kind: oneOf(c.kind, ['weekly', 'monthly', 'nospend'], 'weekly'), name: str(c.name, 80), amount: Math.max(0, int(c.amount, 0)), count: Math.min(366, Math.max(1, int(c.count, 4))), start: isoOr(c.start, dates.today()), checkins: arr(c.checkins).filter((d) => dates.isValid(d)) });
    });

    arr(raw.events).forEach((e, i) => {
      if (!e || !uniq('e:' + id(e.id)) || !dates.isValid(e.date)) return errors.push('event#' + i);
      data.events.push({ id: e.id, title: str(e.title, 80), date: e.date, type: oneOf(e.type, EVENT_TYPES, 'other'), amount: Math.max(0, int(e.amount, 0)), demo: !!e.demo });
    });
    arr(raw.journal).forEach((j) => { if (j && id(j.id) && dates.isValid(j.date)) data.journal.push({ id: j.id, date: j.date, text: str(j.text, 2000) }); });
    arr(raw.chats).slice(0, 50).forEach((c) => {
      if (!c || !id(c.id)) return;
      data.chats.push({ id: c.id, title: str(c.title, 60), messages: arr(c.messages).slice(-200).filter((m) => m && (m.role === 'user' || m.role === 'assistant')).map((m) => ({ role: m.role, text: str(m.text, 4000), ts: int(m.ts, 0), mode: str(m.mode, 10) })) });
    });
    data.readNotifications = arr(raw.readNotifications).filter((x) => typeof x === 'string').slice(-500);
    return { ok: true, errors, data };
  }

  SMM.defaults = { SCHEMA_VERSION, LANGS, THEMES, MODES, ACCENTS, TX_TYPES, ACCOUNT_TYPES, FREQS, BUDGET_PERIODS, EVENT_TYPES, COLORS, defaultState, defaultSettings, validateData };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
