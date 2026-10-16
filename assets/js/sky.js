/* Sky — time of day, season and moon phase, shared by every page.
   Loaded in <head> (not deferred) so the right colors paint first.
   Sets <html data-time> (the CSS reads it) and fires:
     'skychange' when the period or season changes,
     'skytick'   every 30 seconds.

   Where the visitor is: their browser's time zone (e.g. America/New_York) is looked up in
   tz.js for rough coordinates. No location permission is asked for.
   - Time of day follows the real sun there: dawn and dusk are when it is within 9° of the
     horizon (morning or evening), day above that, night below.
   - Seasons flip south of the equator, and the moon's lit side is mirrored there.
   - If the time zone is unknown (e.g. plain UTC), it falls back to fixed hours: dawn 5–8,
     day 8–17, dusk 17–20, night otherwise, with northern seasons.

   Preview: ?time=dawn|day|dusk|night  ?season=spring|summer|autumn|winter
            ?tz=Australia/Sydney (see the site as a visitor in that time zone would, right now) */
(function () {
  'use strict';

  var SYN = 29.530588;                       // days in a lunar cycle
  var REF = Date.UTC(2000, 0, 6, 18, 14);    // a known new moon
  var PERIODS = ['dawn', 'day', 'dusk', 'night'];
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  var EDGE = 9;                              // degrees of sun altitude that count as dawn/dusk
  var RAD = Math.PI / 180;

  var params = new URLSearchParams(window.location.search);
  var forcedTime = PERIODS.indexOf(params.get('time')) >= 0 ? params.get('time') : null;
  var forcedSeason = SEASONS.indexOf(params.get('season')) >= 0 ? params.get('season') : null;

  // ---------- where: time zone -> rough coordinates ----------
  function systemZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }
  var zone = systemZone();
  var fmt = null;
  function makeFormat(tz) {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, hour: 'numeric', minute: 'numeric', month: 'numeric', hourCycle: 'h23' });
  }
  if (params.get('tz')) {
    try { fmt = makeFormat(params.get('tz')); zone = params.get('tz'); } catch (e) { fmt = null; }
  }
  if (!fmt) { try { fmt = makeFormat(zone); } catch (e) { fmt = null; } }

  function lookup(name) {
    var T = window.TZ_COORDS;
    if (!T || !name) return null;
    var i = name.indexOf('/');
    var group = i < 0 ? T[''] : T[name.slice(0, i)];
    var c = group && group[i < 0 ? name : name.slice(i + 1)];
    return c ? { lat: c[0], lon: c[1] } : null;
  }
  var place = lookup(zone);
  var south = !!place && place.lat < 0;

  // Hour, minute and month in the visitor's (or previewed) time zone.
  function localParts(d) {
    if (fmt && fmt.formatToParts) {
      var o = {};
      fmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      return { hour: Number(o.hour) % 24, minute: Number(o.minute), month: Number(o.month) - 1 };
    }
    return { hour: d.getHours(), minute: d.getMinutes(), month: d.getMonth() };
  }

  // ---------- when: the sun's altitude ----------
  // Low-precision solar position (accurate to a fraction of a degree), from the
  // Astronomical Almanac's approximation. Returns altitude in degrees and whether
  // it is before local solar noon.
  function sunAt(d, lat, lon) {
    var n = d.getTime() / 86400000 - 10957.5;            // days since J2000.0
    var g = (357.529 + 0.98560028 * n) * RAD;             // mean anomaly
    var q = 280.459 + 0.98564736 * n;                     // mean longitude
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    var e = (23.439 - 0.00000036 * n) * RAD;              // obliquity
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD;
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = 280.46061837 + 360.98564736629 * n;        // sidereal time, degrees
    var H = ((gmst + lon - ra) % 360 + 540) % 360 - 180;  // hour angle; negative = morning
    var alt = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(H * RAD)) / RAD;
    return { alt: alt, morning: H < 0 };
  }

  function periodOf(d) {
    if (place) {
      var s = sunAt(d, place.lat, place.lon);
      return s.alt >= EDGE ? 'day' : s.alt < -EDGE ? 'night' : (s.morning ? 'dawn' : 'dusk');
    }
    var p = localParts(d), h = p.hour + p.minute / 60;
    return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  }
  function seasonOf(d) {
    var m = localParts(d).month;
    if (south) m = (m + 6) % 12;
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }
  function clock(d) {
    var p = localParts(d || new Date());
    return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0');
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
    south: south,                // southern hemisphere: the moon's lit side is mirrored
    zone: zone,
    place: place,                // { lat, lon } or null
    clock: clock,                // 'HH:MM' in the visitor's time zone
    sun: function (d) { return place ? sunAt(d || new Date(), place.lat, place.lon) : null; },
    palette: function () { return PAL[state.time]; },
    shoreline: function () { return SEA[state.season]; },
    moonAge: function () { return moonAge(new Date()); },
    phaseName: phaseName,
    SYN: SYN,
    mix: mix, ramp: ramp, rng: rng, el: el, fill: fill, banded: banded, discRows: discRows
  };
})();
