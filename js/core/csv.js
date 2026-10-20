/* CSV export / defensive import for transactions. Pure (no DOM). */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { money, dates } = SMM;

  const HEADERS = ['id', 'date', 'type', 'amount', 'category', 'account', 'to_account', 'description', 'merchant', 'notes', 'tags'];
  const MAX_ROWS = 5000;

  /** neutralise spreadsheet formula injection in free-text cells */
  const safeText = (v) => { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
  const unsafeText = (v) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);
  const cell = (v) => { v = String(v == null ? '' : v); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

  function toCSV(rows, headers) {
    return '﻿' + [headers.map(cell).join(',')].concat(rows.map((r) => r.map(cell).join(','))).join('\r\n') + '\r\n';
  }

  function parse(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some((x) => x !== '')) rows.push(row);
    return rows;
  }

  const catLabel = (c) => (c ? c.name || c.key || c.id : '');

  function exportTransactions(d, txs) {
    const rows = txs.map((t) => {
      const cat = d.categories.find((c) => c.id === t.categoryId);
      const a = d.accounts.find((x) => x.id === t.accountId), b = d.accounts.find((x) => x.id === t.toAccountId);
      return [t.id, t.date, t.type, money.toDecimal(t.amount), safeText(catLabel(cat)), safeText(a ? a.name : ''), safeText(b ? b.name : ''), safeText(t.description), safeText(t.merchant), safeText(t.notes), safeText((t.tags || []).join('|'))];
    });
    return toCSV(rows, HEADERS);
  }

  const lc = (s) => String(s || '').trim().toLowerCase();
  function normDate(s) {
    s = String(s || '').trim();
    if (dates.isValid(s)) return s;
    const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) { const iso = m[3] + '-' + dates.pad(+m[2]) + '-' + dates.pad(+m[1]); return dates.isValid(iso) ? iso : null; }
    return null;
  }

  /** Parse + validate. Returns {rows (valid transactions, not yet saved), errors:[{line, reason}], total}. Never mutates d. */
  function importTransactions(text, d, newId) {
    const table = parse(text);
    const errors = [], rows = [];
    if (!table.length) return { rows, errors: [{ line: 0, reason: 'empty' }], total: 0 };
    const head = table[0].map(lc);
    const idx = (n) => head.indexOf(n);
    const need = ['date', 'type', 'amount'];
    if (need.some((n) => idx(n) < 0)) return { rows, errors: [{ line: 1, reason: 'headers' }], total: 0 };
    const body = table.slice(1, MAX_ROWS + 1);
    if (table.length - 1 > MAX_ROWS) errors.push({ line: MAX_ROWS + 2, reason: 'too-many-rows' });
    const existing = new Set(d.transactions.map((t) => t.id));
    const seen = new Set();
    body.forEach((r, i) => {
      const line = i + 2;
      const get = (n) => (idx(n) >= 0 ? unsafeText((r[idx(n)] || '').trim()) : '');
      const type = lc(get('type'));
      if (!SMM.defaults.TX_TYPES.includes(type)) return errors.push({ line, reason: 'type' });
      const date = normDate(get('date'));
      if (!date) return errors.push({ line, reason: 'date' });
      const amount = money.parse(get('amount'));
      if (!money.isAmount(amount)) return errors.push({ line, reason: 'amount' });
      const acc = d.accounts.find((a) => lc(a.name) === lc(get('account')) || a.id === get('account'));
      if (!acc) return errors.push({ line, reason: 'account' });
      const t = { id: '', type, amount, date, accountId: acc.id, toAccountId: '', categoryId: '', description: get('description').slice(0, 200), notes: get('notes').slice(0, 1000), merchant: get('merchant').slice(0, 100), tags: get('tags').split('|').map((x) => x.trim().slice(0, 30)).filter(Boolean).slice(0, 10), recurringId: '' };
      if (type === 'transfer') {
        const to = d.accounts.find((a) => lc(a.name) === lc(get('to_account')) || a.id === get('to_account'));
        if (!to || to.id === acc.id || to.currency !== acc.currency) return errors.push({ line, reason: 'transfer-target' });
        t.toAccountId = to.id;
      } else {
        const kind = type === 'income' ? 'income' : 'expense';
        const key = lc(get('category'));
        const cat = d.categories.find((c) => c.kind === kind && (lc(c.name) === key || lc(c.key) === key || c.id === get('category')));
        if (!cat) return errors.push({ line, reason: 'category' });
        t.categoryId = cat.id;
      }
      const rid = get('id');
      if (rid && (existing.has(rid) || seen.has(rid))) return errors.push({ line, reason: 'duplicate' });
      t.id = rid && /^[\w-]{1,80}$/.test(rid) ? rid : newId();
      seen.add(t.id);
      rows.push(t);
    });
    return { rows, errors, total: body.length };
  }

  SMM.csv = { HEADERS, toCSV, parse, exportTransactions, importTransactions };
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
