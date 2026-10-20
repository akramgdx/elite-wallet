/* Storage layer. The ONLY module that touches localStorage. Business logic lives elsewhere, so a backend
 * can replace `adapter` (same read/write contract) without touching the UI or the finance engine.
 * NOTE: localStorage is plain, unencrypted, per-browser storage. It is not cloud sync and not a secure database. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const KEY = 'smm.v1.data', BACKUP_KEY = 'smm.v1.backup', CORRUPT_KEY = 'smm.v1.corrupt';

  const memory = {};
  const adapter = {
    persistent: true,
    read(k) { try { return g.localStorage.getItem(k); } catch (e) { adapter.persistent = false; return memory[k] == null ? null : memory[k]; } },
    write(k, v) { try { g.localStorage.setItem(k, v); } catch (e) { adapter.persistent = false; memory[k] = v; } },
    remove(k) { try { g.localStorage.removeItem(k); } catch (e) { delete memory[k]; } },
  };

  let state = null;
  const listeners = new Set();
  let loadReport = { status: 'new', errors: [] };

  const uid = (p) => (p || 'id') + '_' + (g.crypto && g.crypto.randomUUID ? g.crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  function load() {
    const raw = adapter.read(KEY);
    if (!raw) { state = SMM.defaults.defaultState(); loadReport = { status: 'new', errors: [] }; return state; }
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    const res = SMM.defaults.validateData(parsed);
    if (!res.ok) {
      // never silently overwrite: keep the unreadable payload under a separate key
      adapter.write(CORRUPT_KEY + '.' + Date.now(), raw);
      state = SMM.defaults.defaultState();
      loadReport = { status: 'corrupt', errors: res.errors };
      return state;
    }
    state = res.data;
    loadReport = { status: res.errors.length ? 'repaired' : 'ok', errors: res.errors };
    return state;
  }
  function save() { adapter.write(KEY, JSON.stringify(state)); }
  function emit(reason) { listeners.forEach((fn) => { try { fn(state, reason); } catch (e) { console.error(e); } }); }

  const store = {
    uid,
    adapter,
    get: () => (state || load()),
    report: () => loadReport,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** mutate through a function; persists and notifies. */
    update(fn, reason) { store.get(); const r = fn(state); save(); emit(reason || 'update'); return r; },
    /* generic record helpers */
    add(coll, item) { return store.update((s) => { item.id = item.id || uid(coll.slice(0, 3)); s[coll].push(item); return item; }, coll); },
    patch(coll, id, changes) { return store.update((s) => { const it = s[coll].find((x) => x.id === id); if (it) Object.assign(it, changes); return it; }, coll); },
    remove(coll, id) { return store.update((s) => { const i = s[coll].findIndex((x) => x.id === id); if (i >= 0) s[coll].splice(i, 1); return i >= 0; }, coll); },
    setSettings(changes) { return store.update((s) => { Object.assign(s.settings, changes); }, 'settings'); },
    exportJSON() { return JSON.stringify(Object.assign({ exportedAt: new Date().toISOString(), app: 'smart-money-manager' }, store.get()), null, 2); },
    /** validate a backup string WITHOUT applying it */
    inspectImport(text) {
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['json'] }; }
      const res = SMM.defaults.validateData(parsed);
      if (!res.ok) return res;
      const d = res.data;
      return { ok: true, errors: res.errors, data: d, counts: { accounts: d.accounts.length, transactions: d.transactions.length, budgets: d.budgets.length, recurring: d.recurring.length, goals: d.goals.length, categories: d.categories.length } };
    },
    /** replace everything; the previous data is kept under a backup key first */
    replaceAll(newData) {
      adapter.write(BACKUP_KEY, JSON.stringify(store.get()));
      state = newData; save(); emit('replace');
    },
    hasBackup: () => !!adapter.read(BACKUP_KEY),
    restoreBackup() {
      const raw = adapter.read(BACKUP_KEY); if (!raw) return false;
      const res = SMM.defaults.validateData(JSON.parse(raw)); if (!res.ok) return false;
      adapter.write(BACKUP_KEY, JSON.stringify(store.get())); // swap, so the restore itself is undoable
      state = res.data; save(); emit('replace'); return true;
    },
    reset() { adapter.write(BACKUP_KEY, JSON.stringify(store.get())); state = SMM.defaults.defaultState(); save(); emit('replace'); },
    _reload: load,
  };

  SMM.store = store;
  if (typeof module !== 'undefined' && module.exports) module.exports = SMM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
