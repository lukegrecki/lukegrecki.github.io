/* Home scene — a sun or moon over water, its reflection breaking into
   horizontal strokes. Everything sits on one 4px pixel grid and moves in 4px
   steps. Rebuilt whenever the period or season changes. */
(function () {
  'use strict';
  var S = window.Sky;
  var root = document.querySelector('[data-scene]');
  if (!S || !root) return;

  var el = S.el, q = S.q4, G = 4;
  var sky = root.querySelector('.scene__sky');
  var water = root.querySelector('.scene__water');
  // Find a layer, or create it (so older markup, like the share-image template, still works).
  function layer(parent, cls, before) {
    var node = parent.querySelector('.' + cls.split(' ').join('.'));
    if (!node) { node = el(cls); parent.insertBefore(node, before || null); }
    return node;
  }
  var skyBands = sky.querySelector('.bands');
  var orbBox = sky.querySelector('.scene__orb');
  var cloudBox = layer(sky, 'scene__clouds', orbBox);
  var oldHills = sky.querySelector('.scene__hills:not(.scene__hills--far):not(.scene__hills--near)');
  if (oldHills) oldHills.remove();
  var farBox = layer(sky, 'scene__hills scene__hills--far');
  var nearBox = layer(sky, 'scene__hills scene__hills--near');
  var waterBands = water.querySelector('.bands');
  var reflBox = water.querySelector('.scene__refl');
  var partBox = layer(root, 'scene__particles', water.nextSibling);
  partBox.setAttribute('aria-hidden', 'true');
  var readout = root.querySelector('.scene__readout');

  // Clouds per season (fewer at night).
  var CLOUDS = { spring: 3, summer: 2, autumn: 3, winter: 4 };
  // Moon craters as [x, y, w, h] on the 192px disc.
  var CRATERS = [[52, 56, 20, 12], [112, 40, 12, 8], [100, 108, 28, 16], [60, 132, 12, 8], [136, 80, 8, 8]];

  function px(n) { return n + 'px'; }
  function row(x, y, w, c, extra) {
    return el('', 'left:' + px(x) + ';top:' + px(y) + ';width:' + px(w) + ';height:4px;background:' + c + (extra || ''));
  }

  function build() {
    var time = S.time, season = S.season, P = S.palette(), shore = S.shoreline();
    var age = S.moonAge();
    var isMoon = time === 'night';
    var r = S.rng(time.length * 97 + season.length * 13 + 7);
    var W = root.clientWidth || 1280, H = root.clientHeight || 800;

    // ---------- sky and water: flat bands with 8px dithered seams ----------
    S.fill(skyBands, S.banded(S.ramp(P.sky, 8), 8));
    S.fill(waterBands, S.banded(S.ramp(P.water, 6).map(function (c, i) { return S.mix(c, P.sh, i * 0.07); }), 8));

    // ---------- the orb: halo, disc, and either a warm rim (sun) or phase and craters (moon) ----------
    var R = 96, D = 2 * R;
    var ph = 2 * Math.PI * age / S.SYN;
    var f = (1 - Math.cos(ph)) / 2;
    var nodes = [];
    var haloC = isMoon ? S.mix(P.orb, P.hi, 0.6) : P.hi;
    [[R + 16, 0.08], [R + 8, 0.16]].forEach(function (h) {
      var RR = h[0], o = h[1] * (isMoon ? 0.35 * f : 1);
      for (var y = -RR + G / 2; y < RR; y += G) {
        var hq = q(Math.sqrt(Math.max(0, RR * RR - y * y)));
        if (hq > 0) nodes.push(row(R - hq, R + y - G / 2, 2 * hq, haloC, ';opacity:' + o.toFixed(2)));
      }
    });
    var dark = S.mix(S.mix(P.sky[0], P.orb, 0.14), P.sh, 0.25);
    var edgeC = S.mix(P.orb, P.sunEdge, 0.55);
    var craterC = S.mix(P.orb, P.sh, 0.22);
    var lit = {}, cxSum = 0, cxN = 0;
    S.discRows(R, G).forEach(function (d) {
      if (!isMoon) {
        var y = d.y + G / 2 - R;
        var rim = y > 0 ? q(8 + 16 * (y / R)) : 0;
        nodes.push(row(d.x, d.y, d.w - rim, P.orb));
        if (rim) nodes.push(row(d.x + d.w - rim, d.y, rim, edgeC));
        return;
      }
      nodes.push(row(d.x, d.y, d.w, dark));
      var a, b;
      if (ph <= Math.PI) { a = d.h * Math.cos(ph); b = d.h; } else { a = -d.h; b = -d.h * Math.cos(ph); }
      var qa = Math.max(-d.hq, q(a)), qb = Math.min(d.hq, q(b));
      // Seen from the southern hemisphere the moon is upside down: lit side on the other limb.
      if (S.south) { var t0 = qa; qa = -qb; qb = -t0; }
      if (qb - qa > 0) {
        nodes.push(row(R + qa, d.y, qb - qa, P.orb));
        lit[d.y] = [R + qa, R + qb];
        cxSum += (qa + qb) / 2; cxN++;
      }
    });
    if (isMoon && !root.hasAttribute('data-no-craters')) {
      // craters, only where the moon is lit (and turned over in the south); share images leave them off
      CRATERS.forEach(function (c) {
        var x0 = S.south ? D - c[0] - c[2] : c[0], y0 = S.south ? D - c[1] - c[3] : c[1];
        for (var yy = y0; yy < y0 + c[3]; yy += G) {
          var L = lit[yy];
          if (!L) continue;
          var a = Math.max(x0, L[0]), b = Math.min(x0 + c[2], L[1]);
          if (b > a) nodes.push(row(a, yy, b - a, craterC));
        }
      });
    }
    orbBox.style.bottom = px(P.orbBottom);
    S.fill(orbBox, nodes);

    var cx = isMoon && cxN ? cxSum / cxN : 0;
    var intensity = isMoon ? 0.3 + 0.7 * f : (time === 'day' ? 0.85 : 1);

    // ---------- reflection: 4px strokes that step side to side ----------
    var refl = [], yy = 8, N = 22;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var span = D * (0.55 + 0.75 * t) * (isMoon ? 0.55 + 0.45 * f : 1);
      var x = q(-span / 2 + (r() - 0.5) * 10);
      while (x < span / 2 - G) {
        var len = q(8 + r() * span * 0.38);
        if (x + len > span / 2) len = q(span / 2 - x);
        if (len >= G) {
          var o = Math.max(0.14, (1 - t * 0.45) * (0.55 + r() * 0.45) * intensity);
          var c = i < 3 && x <= 0 && x + len >= 0 ? P.hi : S.mix(P.refl, P.sky[2], t * 0.4);
          refl.push(el('pxdrift', 'left:calc(50% + ' + px(q(cx + x)) + ');top:' + px(yy) + ';width:' + px(len) + ';height:4px;background:' + c +
            ';opacity:' + o.toFixed(2) + ';animation-duration:' + (5 + r() * 5).toFixed(1) + 's;animation-delay:' + (-r() * 8).toFixed(1) + 's'));
        }
        x += len + q(4 + r() * 16);
      }
      yy += q(8 + i * 0.8);
    }
    // scattered glints away from the column
    for (var k = 0; k < 30; k++) {
      var sy = q(r() * 300 + 8);
      var spread = D * (0.9 + sy / 300 * 1.6);
      var sx = q((r() - 0.5) * spread * 2);
      if (Math.abs(sx - cx) < D * 0.35) continue;
      refl.push(el('pxtwinkle', 'left:calc(50% + ' + px(sx) + ');top:' + px(sy) + ';width:' + px(q(4 + r() * 12)) + ';height:4px;background:' +
        S.mix(P.water[1], P.refl, (0.35 + r() * 0.35) * intensity) + ';animation-duration:' + (2.5 + r() * 4).toFixed(1) + 's;animation-delay:' + (-r() * 6).toFixed(1) + 's'));
    }
    S.fill(reflBox, refl);

    // ---------- two shorelines: a far, hazy one and a near one with a lit top edge ----------
    var s = season.length;
    var farC = S.mix(S.mix(S.mix(shore, P.sky[3], 0.5), P.sky[1], 0.3), P.sky[0], P.shade * 0.45);
    var nearBody = S.mix(S.mix(shore, P.sh, 0.3), P.sky[0], P.shade * 0.55);
    var nearRim = S.mix(S.mix(shore, P.hi, 0.35), P.sky[0], P.shade * 0.4);
    var far = [], near = [];
    for (var j = 0; j < 640; j++) {
      var vf = 12 + 16 * (Math.sin(j * 0.031 + s) + 1) / 2 + 8 * (Math.sin(j * 0.083 + s * 1.7) + 1) / 2;
      far.push(el('', 'height:' + px(q(vf)) + ';background:' + farC));
      var vn = 4 + 10 * (Math.sin(j * 0.047 + s * 2.3) + 1) / 2 + 6 * (Math.sin(j * 0.13 + s) + 1) / 2 + 3 * (Math.sin(j * 0.41) + 1) / 2;
      near.push(el('', 'height:' + px(Math.max(8, q(vn))) + ';background:linear-gradient(' + nearRim + ' 0 4px,' + nearBody + ' 4px)'));
    }
    S.fill(farBox, far);
    S.fill(nearBox, near);

    // ---------- clouds: wisps of long 4px streaks, lit on top, hue-shifted underneath ----------
    var cBody = S.mix(P.sky[2], P.hi, 0.45), cTop = S.mix(cBody, P.hi, 0.6), cUnder = S.mix(cBody, P.sh, 0.3);
    var nClouds = isMoon ? Math.min(2, CLOUDS[season]) : CLOUDS[season];
    var clouds = [];
    for (var n = 0; n < nClouds; n++) {
      var rows = 3 + Math.floor(r() * 3), Wc = 40 + Math.floor(r() * 40);
      var slant = (r() < 0.5 ? 1 : -1) * (2 + Math.floor(r() * 4));
      var cells = [], width = 0;
      for (var ri = 0; ri < rows; ri++) {
        var tt = (ri - (rows - 1) / 2) / (rows / 2);
        var ln = Math.round(Wc * (1 - 0.6 * Math.abs(tt)) * (0.7 + r() * 0.3));
        var st = Math.round((Wc - ln) / 2 - slant * (ri - (rows - 1) / 2)) + 12;
        var col = ri === 0 ? cTop : ri === rows - 1 ? cUnder : cBody;
        var cxx = st;
        while (cxx < st + ln) {
          var seg = Math.min(st + ln - cxx, 4 + Math.floor(r() * 14));
          for (var cj = cxx; cj < cxx + seg; cj++) cells.push([cj, ri * 2, col]);
          cxx += seg + (r() < 0.45 ? 1 + Math.floor(r() * 2) : 0);
        }
        width = Math.max(width, cxx);
      }
      // 2400px per loop, about 4px a second; start each cloud somewhere across this screen
      var dur = 520 + r() * 220, lead = width * G + 8;
      var startX = (0.08 + (n + r() * 0.8) / nClouds * 0.84) * W;
      clouds.push(el('pxcloud', 'left:' + px(-lead) + ';top:' + px(q(32 + (n / nClouds) * 150 + r() * 40)) + ';opacity:' + (P.cloudO * 0.85).toFixed(2) +
        ';box-shadow:' + S.sprite(cells) + ';animation-duration:' + dur.toFixed(0) + 's;animation-delay:' + (-dur * (startX + lead) / 2400).toFixed(0) + 's'));
    }
    S.fill(cloudBox, clouds);

    // ---------- seasonal particles: a few at a time ----------
    var dim = function (c) { return S.mix(c, P.sky[0], P.shade * 0.45); };
    var parts = [];
    function particle(outer, inner, x, y, dur, delay, idur, cells) {
      var wrap = el(outer, 'left:' + x.toFixed(1) + '%;top:' + px(y) + ';animation-duration:' + dur.toFixed(1) + 's;animation-delay:' + delay.toFixed(1) + 's');
      wrap.appendChild(el(inner, 'box-shadow:' + S.sprite(cells) + ';animation-duration:' + idur.toFixed(1) + 's;animation-delay:' + (-r() * 4).toFixed(1) + 's'));
      parts.push(wrap);
    }
    function fall(count, dMin, dMax, swMin, swMax, shape) {
      for (var p = 0; p < count; p++) {
        var dd = dMin + r() * (dMax - dMin);
        particle('pxfall', 'pxsway', 2 + r() * 96, 0, dd, -r() * dd, swMin + r() * (swMax - swMin), shape(p));
      }
    }
    if (season === 'spring') {
      var soft = function (c) { return S.mix(c, P.sky[0], P.shade * 0.2); };
      var pink = soft('#f4bccd'), light = soft('#fde6ec'), pshade = soft(S.mix('#f4bccd', P.sh, 0.3));
      fall(12, 36, 56, 3, 6, function (p) { return p % 2 ? [[0, 0, light], [1, 0, pink], [1, 1, pshade]] : [[1, 0, light], [0, 1, pink], [1, 1, pink], [2, 2, pshade]]; });
    } else if (season === 'autumn') {
      var LEAF = ['#d9792e', '#b8462f', '#e3a33b'];
      fall(10, 30, 48, 2.5, 5, function (p) {
        var lc = dim(LEAF[p % 3]), ls = dim(S.mix(LEAF[p % 3], P.sh, 0.4));
        return p % 2 ? [[1, 0, lc], [2, 0, lc], [0, 1, lc], [1, 1, lc], [2, 1, ls], [0, 2, ls]] : [[0, 0, lc], [1, 0, lc], [1, 1, lc], [2, 1, ls], [2, 2, ls]];
      });
    } else if (season === 'winter') {
      var snow = S.mix('#f6f8ff', P.sh, P.shade * 0.3), farSnow = S.mix(snow, P.sky[1], 0.35);
      fall(26, 48, 84, 4, 8, function (p) { return p % 3 === 0 ? [[0, 0, snow], [1, 0, snow], [0, 1, snow], [1, 1, snow]] : [[0, 0, p % 2 ? snow : farSnow]]; });
    } else if (time === 'dusk' || time === 'night') {
      // summer evenings: fireflies over the shoreline and water
      for (var ff = 0; ff < 14; ff++) {
        particle('pxwander', 'pxblink', 4 + r() * 92, q(H * 0.5 + r() * H * 0.38), 6 + r() * 5, -r() * 8, 2.5 + r() * 2,
          [[1, 1, '#f3f59a'], [0, 1, '#f3f59a55'], [2, 1, '#f3f59a55'], [1, 0, '#f3f59a55'], [1, 2, '#f3f59a55']]);
      }
    } else {
      // summer days: a little pollen drifting upward
      for (var pl = 0; pl < 9; pl++) {
        var pd = 56 + r() * 34;
        particle('pxrise', 'pxsway', 4 + r() * 92, 0, pd, -r() * pd, 4 + r() * 4, [[0, 0, '#fff6c8cc']]);
      }
    }
    S.fill(partBox, parts);
  }

  function updateReadout() {
    readout.textContent = S.clock() + ' · ' + S.time + ' · ' + S.season + (S.time === 'night' ? ' · ' + S.phaseName(S.moonAge()) : '');
  }

  build();
  updateReadout();
  document.addEventListener('skychange', build);
  document.addEventListener('skytick', updateReadout);
})();
