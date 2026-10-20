/* Runs synchronously in <head> BEFORE first paint (prevents a flash of the wrong theme/direction). Read-only: never writes storage. */
(function () {
  'use strict';
  var s = {};
  try { var raw = localStorage.getItem('smm.v1.data'); if (raw) s = (JSON.parse(raw) || {}).settings || {}; } catch (e) { s = {}; }
  var themes = ['midnight', 'light', 'emerald', 'ocean', 'violet', 'rose', 'graphite', 'sand'];
  var theme = themes.indexOf(s.theme) >= 0 ? s.theme : 'midnight';
  var mode = theme === 'midnight' ? 'dark' : theme === 'light' ? 'light' : (s.mode === 'light' || s.mode === 'dark') ? s.mode : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var lang = ['en', 'fr', 'ar'].indexOf(s.language) >= 0 ? s.language : 'en';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme); root.setAttribute('data-mode', mode); root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
})();
