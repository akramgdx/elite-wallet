/* UI kit: escaping, form fields, modals, confirm dialogs, toasts, helpers. User text is ALWAYS escaped (never trusted as HTML). */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { t } = SMM.i18n;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ui = { esc };

  ui.debounce = (fn, ms) => { let h; return function () { const a = arguments, c = this; clearTimeout(h); h = setTimeout(() => fn.apply(c, a), ms); }; };
  ui.download = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  ui.readFile = (file, maxBytes) => new Promise((res, rej) => {
    if (!file) return rej(new Error('no-file'));
    if (file.size > (maxBytes || 5 * 1024 * 1024)) return rej(new Error('too-large'));
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsText(file);
  });
  ui.pickFile = (accept) => new Promise((res) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || ''; inp.style.display = 'none';
    inp.addEventListener('change', () => { res(inp.files[0] || null); inp.remove(); }); document.body.appendChild(inp); inp.click();
  });

  /* ---------------- form fields ---------------- */
  ui.field = (o) => {
    const id = 'f_' + o.name, err = '<div class="error-text hidden" id="' + id + '_err" data-err-for="' + o.name + '" role="alert"></div>';
    const common = ' id="' + id + '" name="' + o.name + '"' + (o.required ? ' required' : '') + (o.attrs ? ' ' + o.attrs : '') + ' aria-describedby="' + id + '_err' + (o.hint ? ' ' + id + '_hint' : '') + '"';
    let ctl;
    if (o.type === 'select') {
      ctl = '<select class="select"' + common + '>' + (o.options || []).map((x) => '<option value="' + esc(x.value) + '"' + (String(x.value) === String(o.value) ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>';
    } else if (o.type === 'textarea') {
      ctl = '<textarea class="textarea"' + common + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + ' maxlength="' + (o.max || 1000) + '">' + esc(o.value || '') + '</textarea>';
    } else if (o.type === 'checkbox') {
      return '<div class="field' + (o.span2 ? ' span-2' : '') + '"><label class="check"><input type="checkbox"' + common + (o.value ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>' + (o.hint ? '<div class="hint" id="' + id + '_hint">' + esc(o.hint) + '</div>' : '') + err + '</div>';
    } else if (o.type === 'money') {
      ctl = '<div class="input-money"><input class="input" type="text" inputmode="decimal" autocomplete="off"' + common + ' value="' + esc(o.value == null ? '' : o.value) + '" placeholder="0.00"><span class="cur" aria-hidden="true">' + esc(o.currency || SMM.store.get().settings.currency) + '</span></div>';
    } else {
      ctl = '<input class="input" type="' + (o.type || 'text') + '"' + common + ' value="' + esc(o.value == null ? '' : o.value) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + ' maxlength="' + (o.max || 200) + '">';
    }
    return '<div class="field' + (o.span2 ? ' span-2' : '') + '"><label for="' + id + '">' + esc(o.label) + (o.required ? ' <span aria-hidden="true" style="color:var(--danger)">*</span>' : '') + '</label>' + ctl + (o.hint ? '<div class="hint" id="' + id + '_hint">' + esc(o.hint) + '</div>' : '') + err + '</div>';
  };
  /** multi-select as a list of checkboxes: name="cats" value=id */
  ui.checkList = (name, items, selected) => '<div class="checklist" role="group">' + items.map((i) => '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(i.value) + '"' + (selected.includes(i.value) ? ' checked' : '') + '><span class="swatch" style="background:' + esc(i.color || 'var(--muted)') + '"></span><span>' + esc(i.label) + '</span></label>').join('') + '</div>';
  ui.formData = (form) => {
    const out = {};
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
      if (el.type === 'checkbox') {
        if (el.value && el.value !== 'on') { (out[el.name] = out[el.name] || []); if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked;
      } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else out[el.name] = el.value;
    });
    return out;
  };
  ui.showErrors = (root, errors) => {
    root.querySelectorAll('[data-err-for]').forEach((e) => { e.classList.add('hidden'); e.textContent = ''; });
    root.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    let first = null;
    Object.keys(errors || {}).forEach((k) => {
      const box = root.querySelector('[data-err-for="' + k + '"]');
      const msg = t(errors[k]);
      if (box) { box.innerHTML = SMM.icon('alert', 'icon-sm') + '<span></span>'; box.lastChild.textContent = msg; box.classList.remove('hidden'); }
      const el = root.querySelector('[name="' + k + '"]');
      if (el) { el.setAttribute('aria-invalid', 'true'); first = first || el; } else if (!box) ui.toast(msg, 'error');
    });
    if (first) first.focus();
  };

  /* ---------------- modal ---------------- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let modalCount = 0;
  ui.modal = (o) => {
    const prev = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    const uid = 'm' + (++modalCount);
    back.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + uid + '_t"><div class="modal-head"><h2 id="' + uid + '_t">' + esc(o.title) + '</h2><button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="' + esc(t('common.close')) + '">' + SMM.icon('x') + '</button></div><div class="modal-body">' + (o.body || '') + '</div>' + (o.footer ? '<div class="modal-foot">' + o.footer + '</div>' : '') + '</div>';
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    const box = back.firstChild;
    let closed = false;
    const api = {
      el: box,
      close(result) {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey, true);
        back.remove(); if (!document.querySelector('.modal-backdrop')) document.body.style.overflow = '';
        if (prev && prev.focus && document.contains(prev)) prev.focus();
        if (o.onClose) o.onClose(result);
      },
    };
    function onKey(e) {
      if (back !== [...document.querySelectorAll('.modal-backdrop')].pop()) return; // only the top-most modal reacts
      if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
      else if (e.key === 'Tab') {
        const f = [...box.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
        if (!f.length) return; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
    box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    const firstInput = box.querySelector('.modal-body input:not([type=hidden]),.modal-body select,.modal-body textarea') || box.querySelector('[data-close]');
    setTimeout(() => firstInput && firstInput.focus(), 30);
    if (o.onMount) o.onMount(box, api);
    return api;
  };

  /** form dialog. onSubmit(data, form, api) -> errors object | falsy (close). May be async. */
  ui.formModal = (o) => {
    const formId = 'form_' + Math.random().toString(36).slice(2, 8);
    const api = ui.modal({
      title: o.title, wide: o.wide,
      body: '<form id="' + formId + '" novalidate>' + o.body + '</form>',
      footer: (o.extraFooter || '') + '<button type="button" class="btn btn-secondary" data-close>' + esc(o.cancelLabel || t('common.cancel')) + '</button><button type="submit" form="' + formId + '" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '">' + esc(o.submitLabel || t('common.save')) + '</button>',
      onMount(box, a) {
        const form = box.querySelector('form');
        if (o.onMount) o.onMount(box, a, form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const res = await o.onSubmit(ui.formData(form), form, a);
          if (res && typeof res === 'object' && Object.keys(res).length) ui.showErrors(form, res); else a.close(true);
        });
      },
      onClose: o.onClose,
    });
    return api;
  };

  /** Promise<boolean>. o.typeToConfirm requires typing a word before enabling. */
  ui.confirm = (o) => new Promise((resolve) => {
    let answered = false;
    const body = '<p>' + esc(o.message || '') + '</p>' + (o.detail ? '<p class="muted" style="margin-top:8px;font-size:13.5px">' + esc(o.detail) + '</p>' : '') + (o.typeToConfirm ? '<div class="field" style="margin-top:14px"><label for="cf_type">' + esc(t('common.typeToConfirm', { word: o.typeToConfirm })) + '</label><input class="input" id="cf_type" autocomplete="off"></div>' : '');
    const api = ui.modal({
      title: o.title || t('common.confirm'), body,
      footer: '<button type="button" class="btn btn-secondary" data-close>' + esc(o.cancelLabel || t('common.cancel')) + '</button><button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok' + (o.typeToConfirm ? ' disabled' : '') + '>' + esc(o.okLabel || t('common.confirm')) + '</button>',
      onMount(box, a) {
        const ok = box.querySelector('[data-ok]');
        ok.addEventListener('click', () => { answered = true; a.close(); resolve(true); });
        if (o.typeToConfirm) box.querySelector('#cf_type').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== o.typeToConfirm; });
      },
      onClose() { if (!answered) resolve(false); },
    });
    return api;
  });

  /* ---------------- toast ---------------- */
  ui.toast = (msg, kind) => {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast ' + (kind || 'info');
    el.innerHTML = SMM.icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info') + '<span></span>';
    el.lastChild.textContent = msg; box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, kind === 'error' ? 6000 : 3600);
  };

  /* ---------------- view helpers (names, formatting of domain objects) ---------------- */
  const view = {
    catName(c) { return !c ? t('common.uncategorized') : c.name || t('cat.' + c.key); },
    catById(d, id) { return d.categories.find((c) => c.id === id); },
    accName(d, id) { const a = d.accounts.find((x) => x.id === id); return a ? a.name : '—'; },
    money(minor, d) { return SMM.i18n.money(minor); },
    /** colored category icon chip */
    catChip(c) { return '<span class="dot-icon" style="background:' + esc(c ? c.color : '#94a3b8') + '">' + SMM.icon(c ? c.icon : 'tag') + '</span>'; },
    /** insight / notification text; params named m_* are money (minor), `cat` is a category id, `budget` a budget id */
    text(key, params, d) {
      const p = Object.assign({}, params || {});
      Object.keys(p).forEach((k) => {
        if (k.startsWith('m_')) p[k] = SMM.i18n.money(p[k]);
        else if (k === 'cat') p.cat = view.catName(view.catById(d, p.cat));
        else if (k === 'budget') { const b = d.budgets.find((x) => x.id === p.budget); p.budget = b ? (b.name || (b.categoryIds.length === 1 ? view.catName(view.catById(d, b.categoryIds[0])) : t('budgets.overall'))) : ''; }
        else if (typeof p[k] === 'number') p[k] = SMM.i18n.num(p[k]);
      });
      return t(key, p);
    },
    stateBadge(state) {
      const m = { ok: ['badge-ok', 'check', 'budgets.stateOk'], warn: ['badge-warn', 'alert', 'budgets.stateWarn'], over: ['badge-over', 'alert', 'budgets.stateOver'] }[state];
      return '<span class="badge ' + m[0] + '">' + SMM.icon(m[1], 'icon-sm') + t(m[2]) + '</span>';
    },
    progress(pct, state, striped) { return '<div class="progress ' + (state || '') + (striped && state === 'over' ? ' striped' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, Math.round(pct)) + '"><i style="width:' + Math.min(100, Math.max(0, pct)).toFixed(1) + '%"></i></div>'; },
    empty(icon, title, text, actionsHtml) { return '<div class="empty"><div class="e-icon">' + SMM.icon(icon, 'icon-lg') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (actionsHtml ? '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">' + actionsHtml + '</div>' : '') + '</div>'; },
    signed(minor, type) { const neg = type === 'expense'; return '<span class="amt ' + (type === 'transfer' ? 'neu' : neg ? 'neg' : 'pos') + '"><span class="ltr">' + (type === 'transfer' ? '' : neg ? '−' : '+') + SMM.i18n.money(minor) + '</span></span>'; },
  };
  SMM.ui = ui; SMM.view = view;
})(typeof globalThis !== 'undefined' ? globalThis : window);
