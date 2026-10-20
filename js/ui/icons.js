/* Consistent inline SVG icon set (24x24, stroke). Original simple paths. */
(function (g) {
  'use strict';
  const SMM = (g.SMM = g.SMM || {});
  const P = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
    wallet: 'M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-1zM16 14h2',
    target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z',
    tag: 'M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9zM8 8h.01',
    repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    calendar: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M8 2v4M16 2v4',
    chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
    cap: 'M22 9L12 4 2 9l10 5 10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6',
    message: 'M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    filter: 'M3 5h18l-7 8v6l-4 2v-8z', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', 'chevron-right': 'M9 6l6 6-6 6', 'chevron-left': 'M15 6l-6 6 6 6', 'chevron-down': 'M6 9l6 6 6-6',
    menu: 'M4 6h16M4 12h16M4 18h16', bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    download: 'M12 3v12M7 10l5 5 5-5M5 21h14', upload: 'M12 21V9M7 14l5-5 5 5M5 3h14', mic: 'M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3',
    volume: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14', stop: 'M6 6h12v12H6z', sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z', globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
    'arrow-up': 'M12 19V5M5 12l7-7 7 7', 'arrow-down': 'M12 5v14M19 12l-7 7-7-7', 'arrow-right': 'M5 12h14M12 5l7 7-7 7', 'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-4M12 8h.01',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 118 0v4',
    bus: 'M5 17h14V6a3 3 0 00-3-3H8a3 3 0 00-3 3zM5 12h14M8 21v-4M16 21v-4M8 15h.01M16 15h.01', utensils: 'M4 3v7a3 3 0 003 3v8M7 3v7M10 3v7a3 3 0 01-3 3M18 21V3c-3 2-4 6-4 9h4',
    book: 'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5V21h16', heart: 'M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M16 9h4M4 15h4M16 15h4', bag: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
    receipt: 'M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3zM9 8h6M9 12h6M9 16h3', dumbbell: 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
    gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
    briefcase: 'M3 8h18v12H3zM8 8V5a2 2 0 012-2h4a2 2 0 012 2v3M3 13h18', laptop: 'M4 5h16v11H4zM2 20h20', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', play: 'M6 4l14 8-14 8z',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', palette: 'M12 22a10 10 0 110-20c5.5 0 10 3.6 10 8 0 3-2.5 4-5 4h-2a2 2 0 00-1.5 3.3c.7.8.5 2.7-1.5 4.7zM7.5 11h.01M12 7.5h.01M16.5 11h.01',
    trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', coins: 'M12 8a6 3 0 100-6 6 3 0 000 6zM6 5v4c0 1.7 2.7 3 6 3s6-1.3 6-3V5M6 11v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4M6 17v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3', piggy: 'M19 9a7 7 0 00-13.4 2H3v4h2.6A7 7 0 009 18v3h4v-2h2v2h4v-3.5c1.2-1 2-2.5 2-4.5 0-1.5-.5-2.8-1.3-3.8L22 7zM15 11h.01',
    home2: 'M3 11l9-8 9 8v9a1 1 0 01-1 1H4a1 1 0 01-1-1z', external: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    rotate: 'M3 12a9 9 0 109-9 9 9 0 00-6.7 3M3 4v5h5', undo: 'M3 7v6h6M3 13a9 9 0 109-9 9 9 0 00-7 3.3', file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6', pause: 'M6 4h4v16H6zM14 4h4v16h-4z', skip: 'M5 4l10 8-10 8zM19 5v14', star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  };
  const icon = (name, cls) => '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + (P[name] || P.tag) + '"/></svg>';
  SMM.icon = icon;
  SMM.iconNames = Object.keys(P);

  /** Brand mark: rising bars inside a rounded square. Original wordmark pairing. */
  SMM.logo = (size) => '<svg class="logo-mark" width="' + (size || 30) + '" height="' + (size || 30) + '" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--primary)"/><rect x="7" y="17" width="4.5" height="8" rx="1.6" style="fill:var(--on-primary)" opacity=".55"/><rect x="13.75" y="12" width="4.5" height="13" rx="1.6" style="fill:var(--on-primary)" opacity=".8"/><rect x="20.5" y="6.5" width="4.5" height="18.5" rx="1.6" style="fill:var(--on-primary)"/></svg>';
})(typeof globalThis !== 'undefined' ? globalThis : window);
