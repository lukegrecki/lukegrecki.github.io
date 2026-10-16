/* Home scene — a sun or moon over water, its reflection breaking into
   horizontal strokes. Rebuilt whenever the period or season changes. */
(function () {
  'use strict';
  var S = window.Sky;
  var root = document.querySelector('[data-scene]');
  if (!S || !root) return;

  var skyBands = root.querySelector('.scene__sky .bands');
  var orbBox = root.querySelector('.scene__orb');
  var hillsBox = root.querySelector('.scene__hills');
  var waterBands = root.querySelector('.scene__water .bands');
  var reflBox = root.querySelector('.scene__refl');
  var readout = root.querySelector('.scene__readout');
  var el = S.el;

  function build() {
    var time = S.time, season = S.season, P = S.palette();
    var age = S.moonAge();
    var isMoon = time === 'night';

    S.fill(skyBands, S.banded(S.ramp(P.sky, 8), 4));
    S.fill(waterBands, S.banded(S.ramp(P.water, 6), 4));

    // The orb: a pixel disc; at night, lit only as far as tonight's phase.
    var R = 96, PX = 6, D = 2 * R;
    var ph = 2 * Math.PI * age / S.SYN;
    var f = (1 - Math.cos(ph)) / 2;
    var q = function (v) { return Math.round(v / PX) * PX; };
    var dark = S.mix(P.sky[0], P.orb, 0.14);
    var orbNodes = [], cxSum = 0, cxN = 0;
    S.discRows(R, PX).forEach(function (r) {
      if (!isMoon) {
        orbNodes.push(el('', 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:6px;background:' + P.orb));
        return;
      }
      orbNodes.push(el('', 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:6px;background:' + dark));
      var a, b;
      if (ph <= Math.PI) { a = r.h * Math.cos(ph); b = r.h; } else { a = -r.h; b = -r.h * Math.cos(ph); }
      var qa = Math.max(-r.hq, q(a)), qb = Math.min(r.hq, q(b));
      // Seen from the southern hemisphere the moon is upside down: lit side on the other limb.
      if (S.south) { var t0 = qa; qa = -qb; qb = -t0; }
      if (qb - qa > 0) {
        orbNodes.push(el('', 'left:' + (R + qa) + 'px;top:' + r.y + 'px;width:' + (qb - qa) + 'px;height:6px;background:' + P.orb));
        cxSum += (qa + qb) / 2; cxN++;
      }
    });
    orbBox.style.bottom = P.orbBottom + 'px';
    S.fill(orbBox, orbNodes);

    var cx = isMoon && cxN ? cxSum / cxN : 0;
    var intensity = isMoon ? 0.3 + 0.7 * f : (time === 'day' ? 0.85 : 1);

    // Reflection strokes.
    var r = S.rng(time.length * 97 + season.length * 13 + 7);
    var refl = [], yy = 8, N = 22;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var span = D * (0.55 + 0.75 * t) * (isMoon ? 0.55 + 0.45 * f : 1);
      var x = -span / 2 + (r() - 0.5) * 10;
      while (x < span / 2 - 4) {
        var len = 8 + r() * span * 0.38;
        if (x + len > span / 2) len = span / 2 - x;
        if (len >= 4) {
          var o = Math.max(0.12, (1 - t * 0.45) * (0.55 + r() * 0.45) * intensity);
          refl.push(el('drift', 'left:calc(50% + ' + Math.round(cx + x) + 'px);top:' + Math.round(yy) + 'px;width:' + Math.round(len) +
            'px;height:3px;background:' + P.refl + ';opacity:' + o.toFixed(2) +
            ';animation-duration:' + (5 + r() * 5).toFixed(1) + 's;animation-delay:' + (-r() * 8).toFixed(1) + 's'));
        }
        x += len + 3 + r() * 16;
      }
      yy += 7 + i * 0.75;
    }
    // Scattered glints away from the column.
    for (var k = 0; k < 30; k++) {
      var sy = Math.round(r() * 300 + 6);
      var spread = D * (0.9 + sy / 300 * 1.6);
      var sx = Math.round((r() - 0.5) * spread * 2);
      if (Math.abs(sx - cx) < D * 0.35) continue;
      refl.push(el('twinkle', 'left:calc(50% + ' + sx + 'px);top:' + sy + 'px;width:' + Math.round(4 + r() * 18) +
        'px;height:2px;background:' + P.refl + ';opacity:' + ((0.2 + r() * 0.35) * intensity).toFixed(2) +
        ';animation-duration:' + (2.5 + r() * 4).toFixed(1) + 's;animation-delay:' + (-r() * 6).toFixed(1) + 's'));
    }
    S.fill(reflBox, refl);

    // Distant shoreline, tinted by season.
    var hillC = S.mix(S.mix(S.shoreline(), P.sky[3], 0.35), P.sky[0], P.shade * 0.6);
    var s = season.length, hills = [];
    for (var j = 0; j < 96; j++) {
      var v = 6 + 10 * (Math.sin(j * 0.11 + s) + 1) / 2 + 7 * (Math.sin(j * 0.29 + s * 2.3) + 1) / 2 + 3 * (Math.sin(j * 0.83 + s) + 1) / 2;
      hills.push(el('', 'flex:1 1 0;height:' + Math.round(v / 3) * 3 + 'px;background:' + hillC));
    }
    S.fill(hillsBox, hills);
  }

  function updateReadout() {
    readout.textContent = S.clock() + ' · ' + S.time + ' · ' + S.season + (S.time === 'night' ? ' · ' + S.phaseName(S.moonAge()) : '');
  }

  build();
  updateReadout();
  document.addEventListener('skychange', build);
  document.addEventListener('skytick', updateReadout);
})();
