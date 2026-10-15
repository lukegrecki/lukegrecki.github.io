/* Sky — time of day, season and moon phase, shared by every page.
   Sets <html data-time> (the CSS reads it) and fires:
     'skychange' when the period or season changes,
     'skytick'   every 30 seconds.
   Preview any moment with ?time=dawn|day|dusk|night and ?season=spring|summer|autumn|winter. */
(function () {
  'use strict';

  var SYN = 29.530588;                       // days in a lunar cycle
  var REF = Date.UTC(2000, 0, 6, 18, 14);    // a known new moon
  var PERIODS = ['dawn', 'day', 'dusk', 'night'];
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];

  var params = new URLSearchParams(window.location.search);
  var forcedTime = PERIODS.indexOf(params.get('time')) >= 0 ? params.get('time') : null;
  var forcedSeason = SEASONS.indexOf(params.get('season')) >= 0 ? params.get('season') : null;

  function periodOf(d) {
    var h = d.getHours() + d.getMinutes() / 60;
    return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  }
  function seasonOf(d) {
    var m = d.getMonth();
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }
  function moonAge(d) {
    return (((d.getTime() - REF) / 86400000) % SYN + SYN) % SYN;
  }
  function phaseName(age) {
    var names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    var edges = [1.84, 5.53, 9.22, 12.91, 16.61, 20.3, 23.99, 27.68];
    for (var i = 0; i < edges.length; i++) if (age < edges[i]) return names[i];
    return names[0];
  }

  // Scene palettes: sky and water stops, the sun/moon, its reflection.
  var PAL = {
    dawn:  { sky: ['#3a3760', '#8a5f86', '#e59a8f', '#f6c79c'], water: ['#5a4f74', '#3a3557', '#262340'], orb: '#fde8c2', refl: '#ffd9a8', hill: '#6e5a72', shade: 0.5,  orbBottom: -46 },
    day:   { sky: ['#7fb7cc', '#a9d2d6', '#d7e9d9', '#f1efd8'], water: ['#6aa3aa', '#4a8189', '#2f5f68'], orb: '#fffaf0', refl: '#fffbe9', hill: '#7d9c8a', shade: 0.12, orbBottom: 210 },
    dusk:  { sky: ['#2b2445', '#6b3c62', '#c9645f', '#efa365'], water: ['#4a3150', '#2c2038', '#18121f'], orb: '#f7b866', refl: '#f4a95e', hill: '#5a3346', shade: 0.6,  orbBottom: 52 },
    night: { sky: ['#0c1027', '#141b3c', '#1f2852', '#2e3866'], water: ['#1a2148', '#0e1230', '#070918'], orb: '#f2d88c', refl: '#e9c977', hill: '#1a2040', shade: 0.82, orbBottom: 150 }
  };
  // Distant shoreline color per season.
  var SEA = { spring: '#6c8d5a', summer: '#4d7046', autumn: '#8a5a3c', winter: '#7c8794' };

  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return '#' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0'); }).join('');
  }
  function ramp(stops, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var u = i / (n - 1) * (stops.length - 1);
      var k = Math.min(Math.floor(u), stops.length - 2);
      out.push(mix(stops[k], stops[k + 1], u - k));
    }
    return out;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function el(cls, css) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (css) d.style.cssText = css;
    return d;
  }
  function fill(container, nodes) {
    var frag = document.createDocumentFragment();
    nodes.forEach(function (n) { frag.appendChild(n); });
    container.textContent = '';
    container.appendChild(frag);
  }
  // Color bands with a checkerboard dither strip where neighbours meet.
  function banded(colors, stripPx) {
    var out = [];
    colors.forEach(function (c, i) {
      out.push(el('', 'flex:1 1 0;background:' + c));
      if (i < colors.length - 1) {
        out.push(el('', 'flex:0 0 ' + stripPx + 'px;background:repeating-conic-gradient(' + c + ' 0 25%,' + colors[i + 1] + ' 0 50%) 0 0/4px 4px'));
      }
    });
    return out;
  }
  // A stepped pixel disc as rows: [{x, y, w}], radius R, step PX.
  function discRows(R, PX) {
    var rows = [];
    for (var i = 0; i < (2 * R) / PX; i++) {
      var y = -R + (i + 0.5) * PX;
      var hq = Math.round(Math.sqrt(Math.max(0, R * R - y * y)) / PX) * PX;
      if (hq > 0) rows.push({ x: R - hq, y: i * PX, w: 2 * hq, h: Math.sqrt(Math.max(0, R * R - y * y)), hq: hq });
    }
    return rows;
  }

  var now = new Date();
  var state = { time: forcedTime || periodOf(now), season: forcedSeason || seasonOf(now) };
  document.documentElement.setAttribute('data-time', state.time);

  setInterval(function () {
    var d = new Date();
    var t = forcedTime || periodOf(d), s = forcedSeason || seasonOf(d);
    if (t !== state.time || s !== state.season) {
      state.time = t; state.season = s;
      document.documentElement.setAttribute('data-time', t);
      document.dispatchEvent(new CustomEvent('skychange'));
    }
    document.dispatchEvent(new CustomEvent('skytick'));
  }, 30000);

  window.Sky = {
    get time() { return state.time; },
    get season() { return state.season; },
    palette: function () { return PAL[state.time]; },
    shoreline: function () { return SEA[state.season]; },
    moonAge: function () { return moonAge(new Date()); },
    phaseName: phaseName,
    SYN: SYN,
    mix: mix, ramp: ramp, rng: rng, el: el, fill: fill, banded: banded, discRows: discRows
  };
})();
