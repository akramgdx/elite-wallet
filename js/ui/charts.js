/* Dependency-free SVG charts. Colors come from CSS variables (theme aware), RTL mirrors time axes + y-axis side. Each chart has <title> tooltips and an aria-label. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rtl = () => SMM.i18n && SMM.i18n.isRTL();
  const fmtAxis = (v) => SMM.i18n.moneyShort(v);

  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function scale(min, max, n) {
    min = Math.min(0, min); max = Math.max(0, max);
    if (min === max) max = min + 100;
    const step = niceStep((max - min) / (n || 4));
    return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
  }
  const pickColor = (c, i) => c || 'var(--chart-' + ((i % 6) + 1) + ')';
  const slot = (i) => (i === 0 ? 'var(--chart-1)' : i === 1 ? 'var(--c2)' : 'var(--c' + Math.min(6, i + 1) + ')');

  const charts = {
    slot,
    /** grouped bars. o: {labels, series:[{name, values, color}], fmt, aria, height} */
    bar(o) {
      const W = 640, H = o.height || 230, L = 48, R = 12, T = 12, B = 28;
      const flip = rtl();
      let labels = o.labels.slice(), series = o.series.map((s) => Object.assign({}, s, { values: s.values.slice() }));
      if (flip) { labels.reverse(); series.forEach((s) => s.values.reverse()); }
      const all = [].concat(...series.map((s) => s.values));
      const sc = scale(Math.min(...all, 0), Math.max(...all, 0), 4);
      const pw = W - L - R, ph = H - T - B;
      const y = (v) => T + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph;
      const x0 = flip ? R : L; // plot area start
      const gw = pw / labels.length, bw = Math.min(26, (gw * 0.7) / series.length);
      let out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">';
      for (let v = sc.lo; v <= sc.hi + 0.1; v += sc.step) {
        out += '<line class="grid" x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
        out += '<text x="' + (flip ? W - 4 : L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="' + (flip ? 'end' : 'end') + '"' + (flip ? ' dx="0"' : '') + '>' + esc(fmtAxis(v)) + '</text>';
      }
      labels.forEach((lb, i) => {
        const cx = x0 + gw * i + gw / 2;
        series.forEach((s, j) => {
          const v = s.values[i]; const bx = cx - (bw * series.length) / 2 + bw * j;
          const top = y(Math.max(v, 0)), h = Math.max(1, Math.abs(y(v) - y(0)));
          out += '<rect x="' + bx + '" y="' + (v >= 0 ? top : y(0)) + '" width="' + (bw - 2) + '" height="' + h + '" rx="3" style="fill:' + pickColor(s.color, j) + '"><title>' + esc(lb + ' · ' + s.name + ': ' + (o.fmt ? o.fmt(v) : v)) + '</title></rect>';
        });
        out += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>';
      });
      out += '</svg>';
      if (series.length > 1) out += '<div class="legend">' + o.series.map((s, j) => '<span><i class="swatch" style="background:' + pickColor(s.color, j) + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
      return out;
    },

    /** line / area. o: {labels, series:[{name, values, color, dashed}], fmt, aria, area, height} */
    line(o) {
      const W = 640, H = o.height || 220, L = 48, R = 14, T = 14, B = 28;
      const flip = rtl();
      let labels = o.labels.slice(), series = o.series.map((s) => Object.assign({}, s, { values: s.values.slice() }));
      if (flip) { labels.reverse(); series.forEach((s) => s.values.reverse()); }
      const all = [].concat(...series.map((s) => s.values));
      const sc = scale(Math.min(...all), Math.max(...all), 4);
      const x0 = flip ? R : L, pw = W - L - R, ph = H - T - B, n = labels.length;
      const x = (i) => x0 + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
      const y = (v) => T + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph;
      let out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">';
      for (let v = sc.lo; v <= sc.hi + 0.1; v += sc.step) {
        out += '<line class="grid" x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (flip ? W - 4 : L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmtAxis(v)) + '</text>';
      }
      const every = Math.ceil(n / 6);
      labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) out += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
      series.forEach((s, j) => {
        const col = pickColor(s.color, j);
        const pts = s.values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1));
        if (o.area && j === 0 && n > 1) out += '<polygon points="' + x(0) + ',' + y(Math.max(sc.lo, 0)) + ' ' + pts.join(' ') + ' ' + x(n - 1) + ',' + y(Math.max(sc.lo, 0)) + '" style="fill:' + col + ';opacity:.14"/>';
        out += '<polyline points="' + pts.join(' ') + '" fill="none" style="stroke:' + col + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"' + (s.dashed ? ' stroke-dasharray="6 5"' : '') + '/>';
        if (n <= 31) s.values.forEach((v, i) => { out += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="' + (n <= 14 ? 3.4 : 2.4) + '" style="fill:' + col + '"><title>' + esc(labels[i] + ' · ' + s.name + ': ' + (o.fmt ? o.fmt(v) : v)) + '</title></circle>'; });
        else out += '<circle cx="' + x(n - 1) + '" cy="' + y(s.values[n - 1]) + '" r="3.4" style="fill:' + col + '"><title>' + esc(labels[n - 1] + ' · ' + s.name + ': ' + (o.fmt ? o.fmt(s.values[n - 1]) : s.values[n - 1])) + '</title></circle>';
      });
      out += '</svg>';
      if (series.length > 1) out += '<div class="legend">' + o.series.map((s, j) => '<span><i class="swatch" style="background:' + pickColor(s.color, j) + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
      return out;
    },

    /** donut with legend list. o: {slices:[{label,value,color}], center:{label,value}, fmt, aria, max} */
    donut(o) {
      let sl = o.slices.filter((s) => s.value > 0).slice();
      const max = o.max || 6;
      if (sl.length > max) { const rest = sl.slice(max - 1).reduce((a, s) => a + s.value, 0); sl = sl.slice(0, max - 1).concat([{ label: SMM.i18n.t('common.others'), value: rest, color: '#94a3b8' }]); }
      const total = sl.reduce((a, s) => a + s.value, 0);
      if (!total) return '';
      const R = 62, C = 2 * Math.PI * R; let off = 0;
      let out = '<div class="donut-wrap"><svg viewBox="0 0 160 160" width="168" height="168" role="img" aria-label="' + esc(o.aria || '') + '"><g transform="rotate(-90 80 80)"><circle cx="80" cy="80" r="' + R + '" fill="none" style="stroke:var(--surface-2)" stroke-width="22"/>';
      sl.forEach((s, i) => {
        const len = (s.value / total) * C;
        out += '<circle cx="80" cy="80" r="' + R + '" fill="none" stroke-width="22" stroke-dasharray="' + Math.max(0, len - 1.5).toFixed(2) + ' ' + (C - Math.max(0, len - 1.5)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" style="stroke:' + (s.color || slot(i)) + '"><title>' + esc(s.label + ': ' + (o.fmt ? o.fmt(s.value) : s.value) + ' (' + Math.round((s.value / total) * 100) + '%)') + '</title></circle>';
        off += len;
      });
      out += '</g>';
      if (o.center) out += '<text x="80" y="76" text-anchor="middle" style="font-size:10.5px">' + esc(o.center.label) + '</text><text x="80" y="95" text-anchor="middle" style="font-size:13px;font-weight:800;fill:var(--text)">' + esc(o.center.value) + '</text>';
      out += '</svg><ul class="donut-legend">' + sl.map((s, i) => '<li><i class="swatch" style="background:' + (s.color || slot(i)) + '"></i><span>' + esc(s.label) + '</span><span class="v"><span class="ltr">' + esc(o.fmt ? o.fmt(s.value) : s.value) + '</span> <span class="muted" style="font-weight:600">· ' + Math.round((s.value / total) * 100) + '%</span></span></li>').join('') + '</ul></div>';
      return out;
    },

    spark(values, color) {
      if (values.length < 2) return '';
      const W = 90, H = 28, mn = Math.min(...values), mx = Math.max(...values), r = mx - mn || 1;
      const pts = values.map((v, i) => ((flipX(i, values.length, W))).toFixed(1) + ',' + (H - 3 - ((v - mn) / r) * (H - 6)).toFixed(1)).join(' ');
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" style="stroke:' + (color || 'var(--chart-1)') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    },

    /** circular progress ring */
    ring(pct, o) {
      o = o || {}; const S = o.size || 132, sw = o.stroke || 12, R = (S - sw) / 2, C = 2 * Math.PI * R, p = Math.min(100, Math.max(0, pct));
      return '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" role="img" aria-label="' + esc(o.aria || Math.round(p) + '%') + '"><g transform="rotate(-90 ' + S / 2 + ' ' + S / 2 + ')"><circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + R + '" fill="none" style="stroke:var(--surface-2)" stroke-width="' + sw + '"/><circle class="ring-arc" cx="' + S / 2 + '" cy="' + S / 2 + '" r="' + R + '" fill="none" stroke-linecap="round" stroke-width="' + sw + '" stroke-dasharray="' + ((p / 100) * C).toFixed(2) + ' ' + C.toFixed(2) + '" style="stroke:' + (o.color || 'var(--primary)') + '"/></g><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" style="font-size:' + Math.round(S / 5) + 'px;font-weight:800;fill:var(--text)">' + Math.round(p) + '%</text></svg>';
    },
  };
  function flipX(i, n, W) { const x = (W - 6) * (i / (n - 1)) + 3; return rtl() ? W - x : x; }
  SMM.charts = charts;
})(typeof globalThis !== 'undefined' ? globalThis : window);
