/* AI Money Assistant page: local demonstration mode, optional external endpoint (needs setup + consent), voice in/out when the browser supports it. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const { ui, view, store, dates, assistant } = SMM;
  const t = (k, p) => SMM.i18n.t(k, p);
  let activeChat = null, busy = false, rec = null, listening = false;
  const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
  const canSpeak = typeof g.speechSynthesis !== 'undefined' && typeof g.SpeechSynthesisUtterance !== 'undefined';
  const SPEECH_LANG = { en: 'en-US', fr: 'fr-FR', ar: 'ar-SA' };
  const SUGGEST = ['as.q.spent', 'as.q.topCat', 'as.q.compare', 'as.q.upcoming', 'as.q.afford', 'as.q.goal'];

  function chat() {
    const d = store.get();
    let c = d.chats.find((x) => x.id === activeChat) || d.chats[d.chats.length - 1];
    if (c) activeChat = c.id; return c;
  }
  function compose(a, d) {
    const p = Object.assign({}, a.params || {});
    let s = view.text(a.key, p, d);
    if (a.extra) s += '\n' + view.text(a.extra, p, d);
    if (a.lines) s += '\n' + a.lines.map((l) => '• ' + SMM.i18n.date(l.date, 'short') + ' — ' + l.name + ' — ' + SMM.i18n.money(l.amount) + (l.type === 'income' ? ' (+)' : '')).join('\n');
    return s;
  }
  const modeOf = (s) => (s.assistantEndpoint ? 'external' : 'demo');

  async function ask(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    const d = store.get(); const s = d.settings;
    if (s.assistantEndpoint && !s.assistantConsent) { ui.toast(t('as.consentNeeded'), 'warn'); return; }
    let c = chat();
    if (!c) { c = { id: store.uid('chat'), title: text.slice(0, 40), messages: [] }; store.add('chats', c); activeChat = c.id; }
    store.update((st) => { const cc = st.chats.find((x) => x.id === c.id); if (!cc.messages.length) cc.title = text.slice(0, 40); cc.messages.push({ role: 'user', text, ts: Date.now(), mode: '' }); }, 'chats');
    busy = true; SMM.app.render(); scrollLog();
    let reply, mode = modeOf(s);
    if (mode === 'external') {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(s.assistantEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assistant.buildRequest(store.get(), text, dates.today())), signal: ctrl.signal, credentials: 'omit' });
        clearTimeout(to);
        if (!res.ok) throw new Error('http ' + res.status);
        const j = await res.json(); reply = String(j.answer || j.reply || '').slice(0, 4000);
        if (!reply) throw new Error('empty');
      } catch (e) { reply = t('as.externalError'); mode = 'error'; }
    } else {
      await new Promise((r) => setTimeout(r, 350)); // brief loading state; the engine itself is synchronous
      reply = compose(assistant.answer(store.get(), text, dates.today()), store.get());
    }
    store.update((st) => { st.chats.find((x) => x.id === c.id).messages.push({ role: 'assistant', text: reply, ts: Date.now(), mode }); }, 'chats');
    busy = false; SMM.app.render(); scrollLog();
  }
  const scrollLog = () => { const l = document.getElementById('chatLog'); if (l) l.scrollTop = l.scrollHeight; };
  function stopSpeaking() { if (canSpeak) g.speechSynthesis.cancel(); }
  function speak(text) { if (!canSpeak) return ui.toast(t('as.noTts'), 'warn'); stopSpeaking(); const u = new g.SpeechSynthesisUtterance(text); u.lang = SPEECH_LANG[SMM.i18n.lang]; g.speechSynthesis.speak(u); }

  SMM.pages.assistant = {
    title: 'nav.assistant',
    render() {
      const d = store.get(); const s = d.settings; const c = chat(); const mode = modeOf(s);
      let h = '<div class="page-head"><div><h1>' + ui.esc(t('nav.assistant')) + '</h1><p>' + ui.esc(t('as.subtitle')) + '</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="newChat">' + SMM.icon('plus') + ui.esc(t('as.newChat')) + '</button></div></div>';
      h += '<div class="callout ' + (mode === 'demo' ? 'warn' : '') + '" style="margin-bottom:16px">' + SMM.icon(mode === 'demo' ? 'alert' : 'shield') + '<div>' + (mode === 'demo' ? '<b>' + ui.esc(t('as.demoBadge')) + '</b> — ' + ui.esc(t('as.demoText')) : '<b>' + ui.esc(t('as.externalOn')) + '</b> — ' + ui.esc(t('as.externalText')) + (s.assistantConsent ? '' : ' <b>' + ui.esc(t('as.consentNeeded')) + '</b>')) + ' <a href="#/settings">' + ui.esc(t('as.configure')) + '</a></div></div>';
      h += '<div class="grid-2-1"><div class="card chat"><div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-label="' + ui.esc(t('nav.assistant')) + '">';
      if (!c || !c.messages.length) h += '<div class="empty" style="margin:auto;border:0">' + '<div class="e-icon">' + SMM.icon('spark', 'icon-lg') + '</div><h3>' + ui.esc(t('as.emptyTitle')) + '</h3><p>' + ui.esc(t('as.emptyText')) + '</p></div>';
      else h += c.messages.map((mm, i) => '<div class="msg ' + mm.role + '">' + ui.esc(mm.text) + '<span class="meta">' + ui.esc(mm.role === 'assistant' ? t('as.assistant') + (mm.mode === 'demo' ? ' · ' + t('as.demoShort') : '') : t('as.you')) + ' · ' + ui.esc(mm.ts ? SMM.i18n.time(mm.ts) : '') + '</span>' + (mm.role === 'assistant' && canSpeak ? '<button class="btn btn-ghost btn-sm" style="margin-top:6px" data-action="speak" data-i="' + i + '">' + SMM.icon('volume', 'icon-sm') + ui.esc(t('as.listen')) + '</button>' : '') + '</div>').join('');
      if (busy) h += '<div class="msg assistant" aria-live="polite"><span class="spinner" style="display:inline-block;vertical-align:middle"></span> ' + ui.esc(t('as.thinking')) + '</div>';
      h += '</div><form class="composer" id="chatForm" novalidate><div style="flex:1;display:flex;flex-direction:column;gap:4px"><label class="sr-only" for="chatInput">' + ui.esc(t('as.inputLabel')) + '</label><textarea class="textarea" id="chatInput" rows="1" maxlength="1000" placeholder="' + ui.esc(t('as.placeholder')) + '"></textarea>' + (listening ? '<span class="hint" aria-live="polite">' + ui.esc(t('as.listening')) + '</span>' : '<span class="hint">' + ui.esc(SR ? t('as.voiceHint') : t('as.noStt')) + '</span>') + '</div>'
        + '<button type="button" class="btn btn-secondary btn-icon' + (listening ? ' mic-on' : '') + '" data-action="mic" aria-pressed="' + listening + '" aria-label="' + ui.esc(t('as.mic')) + '"' + (SR ? '' : ' disabled title="' + ui.esc(t('as.noStt')) + '"') + '>' + SMM.icon('mic') + '</button>'
        + (canSpeak ? '<button type="button" class="btn btn-secondary btn-icon" data-action="stopSpeak" aria-label="' + ui.esc(t('as.stopSpeaking')) + '">' + SMM.icon('stop') + '</button>' : '')
        + '<button type="submit" class="btn btn-primary btn-icon" aria-label="' + ui.esc(t('as.send')) + '"' + (busy ? ' disabled' : '') + '>' + SMM.icon('send', 'flip') + '</button></form></div>';
      h += '<div class="stack"><div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('as.suggested')) + '</div></div><div class="stack" style="gap:8px">' + SUGGEST.map((k) => '<button class="btn btn-secondary" style="justify-content:flex-start;white-space:normal;text-align:start;height:auto;padding:10px 14px;line-height:1.35" data-action="suggest" data-q="' + ui.esc(t(k)) + '">' + ui.esc(t(k)) + '</button>').join('') + '</div></div>'
        + '<div class="card"><div class="card-head"><div class="card-title">' + ui.esc(t('as.history')) + '</div></div>' + (d.chats.length ? '<ul class="rows">' + d.chats.slice().reverse().map((x) => '<li><button class="btn btn-ghost btn-sm" style="flex:1;justify-content:flex-start;overflow:hidden;text-overflow:ellipsis" data-action="openChat" data-id="' + x.id + '"' + (c && c.id === x.id ? ' aria-current="true"' : '') + '>' + ui.esc(x.title || t('as.untitled')) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-action="delChat" data-id="' + x.id + '" aria-label="' + ui.esc(t('common.delete')) + '">' + SMM.icon('trash', 'icon-sm') + '</button></li>').join('') + '</ul>' : '<p class="muted">' + ui.esc(t('as.noHistory')) + '</p>') + '</div>'
        + '<div class="callout">' + SMM.icon('lock') + '<div>' + ui.esc(t('as.privacy')) + '</div></div></div></div>';
      return h;
    },
    mount(root) {
      const f = root.querySelector('#chatForm'); const inp = root.querySelector('#chatInput');
      f.addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value; inp.value = ''; ask(v); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
      if (pendingText) { inp.value = pendingText; pendingText = ''; }
      scrollLog();
    },
    actions: {
      suggest: (el) => ask(el.dataset.q),
      newChat() { activeChat = null; const d = store.get(); const last = d.chats[d.chats.length - 1]; if (last && !last.messages.length) activeChat = last.id; else { const c = { id: store.uid('chat'), title: '', messages: [] }; store.add('chats', c); activeChat = c.id; } SMM.app.render(); },
      openChat(el) { activeChat = el.dataset.id; SMM.app.render(); },
      async delChat(el) { if (await ui.confirm({ title: t('common.confirmDelete'), message: t('as.deleteConfirm'), danger: true, okLabel: t('common.delete') })) { store.remove('chats', el.dataset.id); if (activeChat === el.dataset.id) activeChat = null; } },
      speak(el) { const c = chat(); const mm = c && c.messages[Number(el.dataset.i)]; if (mm) speak(mm.text); }, stopSpeak: stopSpeaking,
      mic() {
        if (!SR) return ui.toast(t('as.noStt'), 'warn');
        if (listening && rec) { rec.stop(); return; }
        // explicit user action + disclosure: browser speech recognition may send audio to the browser vendor's service
        ui.confirm({ title: t('as.micTitle'), message: t('as.micDisclosure'), okLabel: t('as.micStart') }).then((ok) => {
          if (!ok) return;
          rec = new SR(); rec.lang = SPEECH_LANG[SMM.i18n.lang]; rec.interimResults = true; rec.continuous = false;
          const inp = document.getElementById('chatInput');
          rec.onresult = (e) => { let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript; if (inp) inp.value = txt; };
          rec.onerror = (e) => { listening = false; ui.toast(t(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'as.micDenied' : 'as.micError'), 'error'); SMM.app.render(); };
          rec.onend = () => { listening = false; const v = inp ? inp.value : ''; pendingText = v; SMM.app.render(); const i2 = document.getElementById('chatInput'); if (i2) i2.focus(); };
          try { rec.start(); listening = true; SMM.app.render(); } catch (e) { listening = false; ui.toast(t('as.micError'), 'error'); }
        });
      },
    },
  };
  let pendingText = '';
})(typeof globalThis !== 'undefined' ? globalThis : window);
