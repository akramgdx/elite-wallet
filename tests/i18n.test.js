// Verifies that every translation key used in the source exists in EN/FR/AR and that placeholders match.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

globalThis.SMM = { dict: { en: {}, fr: {}, ar: {} } };
for (const f of fs.readdirSync(path.join(root, 'js/i18n')).sort()) require(path.join(root, 'js/i18n', f));
const dict = globalThis.SMM.dict;

function walk(dir, out) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) { if (f.name !== 'node_modules') walk(p, out); } else out.push(p); } return out; }
const files = walk(root, []).filter((f) => /\.(js|html)$/.test(f) && !f.includes('/tests/') && !f.includes('/i18n/'));
const used = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bt\(\s*'([\w.\-]+)'/g)) used.add(m[1]);
  for (const m of s.matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)) m[1].split(';').forEach((p) => used.add((p.includes(':') ? p.split(':')[1] : p).trim()));
  for (const m of s.matchAll(/(?:key|text|title):\s*'((?:as|ins|sins|n|rev\.rec|nav|stu|set)\.[\w.\-]+)'/g)) used.add(m[1]);
}
// dynamic families built with concatenation in the source
const families = {
  'tx.type.': ['income', 'expense', 'transfer', 'refund'], 'acc.type.': ['cash', 'bank', 'savings', 'student', 'other'], 'budgets.period.': ['weekly', 'monthly', 'semester', 'custom'], 'rec.freq.': ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
  'cal.type.': ['bill', 'income', 'review', 'student', 'other'], 'tx.sort.': ['date-desc', 'date-asc', 'amount-desc', 'amount-asc'], 'tx.importReason.': ['empty', 'headers', 'too-many-rows', 'type', 'date', 'amount', 'account', 'transfer-target', 'category', 'duplicate'],
  'set.mode.': ['light', 'dark', 'system'], 'set.accent.': ['default', 'teal', 'blue', 'violet', 'rose', 'amber', 'green'], 'chal.kind.': ['weekly', 'monthly', 'nospend'], 'rep.tab.': ['overview', 'budgets', 'accounts', 'recurring', 'health', 'review', 'whatif', 'journal'],
  'rep.period.': ['week', 'month', 'lastMonth', 'year', 'custom'], 'health.f.': ['savingsRate', 'budgetAdherence', 'expenseStability', 'emergencyFund', 'preparedness'],
  'cat.': ['food', 'transport', 'housing', 'education', 'books', 'health', 'entertainment', 'shopping', 'subscriptions', 'bills', 'fitness', 'gifts', 'other', 'salary', 'allowance', 'scholarship', 'freelance', 'parttime', 'giftsIn', 'otherIncome'],
  'nav.': ['overview', 'transactions', 'accounts', 'income', 'budgets', 'categories', 'recurring', 'goals', 'calendar', 'reports', 'student', 'assistant', 'settings'], 'cal.legend.': ['bill', 'income', 'student', 'review'],
};
for (const [p, list] of Object.entries(families)) list.forEach((k) => { used.add(p + k); if (p === 'health.f.') used.add(p + k + '.how'); });
const errKeys = fs.readFileSync(path.join(root, 'js/core/actions.js'), 'utf8').match(/'err\.[\w]+'/g) || [];
errKeys.forEach((k) => used.add(k.slice(1, -1)));
['js/core/finance.js', 'js/core/assistant.js'].forEach((f) => { const s = fs.readFileSync(path.join(root, f), 'utf8'); (s.match(/'(?:ins|sins|n|rev\.rec|as\.a)\.[\w.]+'/g) || []).forEach((k) => used.add(k.slice(1, -1))); });
['n.dueToday', 'n.dueSoon', 'n.overdue', 'n.budgetOver', 'n.budgetWarn', 'n.goalDone', 'n.event'].forEach((k) => used.add(k));

test('English dictionary has every used key', () => {
  const missing = [...used].filter((k) => !k.endsWith('.') && dict.en[k] == null).sort();
  assert.deepEqual(missing, []);
});
for (const lang of ['fr', 'ar']) {
  test(lang + ' dictionary is complete and placeholders match English', () => {
    const missing = Object.keys(dict.en).filter((k) => dict[lang][k] == null);
    assert.deepEqual(missing, [], 'missing in ' + lang);
    const extra = Object.keys(dict[lang]).filter((k) => dict.en[k] == null);
    assert.deepEqual(extra, [], 'unknown keys in ' + lang);
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    const bad = Object.keys(dict.en).filter((k) => dict[lang][k] != null && ph(dict.en[k]) !== ph(dict[lang][k]));
    assert.deepEqual(bad, [], 'placeholder mismatch in ' + lang);
  });
}
test('landing page keys (lp.*) exist in all languages', () => {
  const lp = Object.keys(dict.en).filter((k) => k.startsWith('lp.'));
  assert.ok(lp.length > 50, 'landing dictionary should exist');
});
