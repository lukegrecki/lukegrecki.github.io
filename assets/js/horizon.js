/* Horizon strip — the home scene compressed into a 52px band under the header
   of every inner page, on the same 4px pixel grid. */
(function () {
  'use strict';
  var S = window.Sky;
  var strip = document.querySelector('.horizon');
  if (!S || !strip) return;
  var el = S.el, q = S.q4;

  var parts = {
    sky: el('horizon__sky'), clouds: el('horizon__clouds'), orb: el('horizon__orb'),
    far: el('horizon__hills'), near: el('horizon__hills'),
    water: el('horizon__water'), refl: el('horizon__refl')
  };
  S.fill(strip, [parts.sky, parts.clouds, parts.orb, parts.far, parts.near, parts.water, parts.refl]);

  function rows(list) { return list.map(function (bg) { return el('', 'background:' + bg); }); }
  function bar(x, y, w, c, o) {
    return el('', 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:4px;background:' + c + (o < 1 ? ';opacity:' + o : ''));
  }

  function build() {
    var P = S.palette(), hill = S.shoreline(), Sk = P.sky;
    var Wt = P.water.map(function (c, i) { return S.mix(c, P.sh, i * 0.07); });
    var isMoon = S.time === 'night';

    // 8 sky rows and 5 water rows, each 4px; one checkerboard row where the sky glows into the horizon
    S.fill(parts.sky, rows([Sk[0], Sk[0], Sk[1], Sk[1], Sk[2], Sk[2], S.dither(Sk[2], Sk[3]), Sk[3]]));
    S.fill(parts.water, rows([Wt[0], Wt[1], Wt[1], Wt[2], Wt[2]]));

    // orb: 24px across, a faint stepped halo, a warmer rim low on the right (sun) or two craters (moon)
    var orb = [];
    var haloC = isMoon ? S.mix(P.orb, P.hi, 0.6) : P.hi;
    [[12, 8], [4, 24], [0, 32], [0, 32], [0, 32], [0, 32], [4, 24], [12, 8]].forEach(function (h, i) {
      orb.push(bar(h[0], i * 4, h[1], haloC, isMoon ? 0.06 : 0.14));
    });
    [[12, 8], [8, 16], [4, 24], [4, 24], [4, 24], [4, 24], [8, 16]].forEach(function (d, i) {
      var y = 4 + i * 4, rim = !isMoon && i >= 4 ? 4 : 0;
      orb.push(bar(d[0], y, d[1] - rim, P.orb, 1));
      if (rim) orb.push(bar(d[0] + d[1] - rim, y, rim, S.mix(P.orb, P.sunEdge, 0.55), 1));
    });
    if (isMoon) {
      var crater = S.mix(P.orb, P.sh, 0.22);
      orb.push(bar(12, 12, 4, crater, 1), bar(20, 20, 4, crater, 1));
    }
    S.fill(parts.orb, orb);

    // two shorelines: hazy far hills, and near hills with a lit top edge
    var farC = S.mix(S.mix(S.mix(hill, Sk[3], 0.5), Sk[1], 0.3), Sk[0], P.shade * 0.45);
    var nearBody = S.mix(S.mix(hill, P.sh, 0.3), Sk[0], P.shade * 0.55);
    var nearRim = S.mix(S.mix(hill, P.hi, 0.3), Sk[0], P.shade * 0.62);
    var far = [], near = [];
    for (var i = 0; i < 640; i++) {
      far.push(el('', 'height:' + q(3 + 4 * (Math.sin(i * 0.09 + 1.3) + 1) / 2 + 2 * (Math.sin(i * 0.31) + 1) / 2) + 'px;background:' + farC));
      var hn = q(2 + 3 * (Math.sin(i * 0.12 + 4.1) + 1) / 2 + 2 * (Math.sin(i * 0.37 + 0.6) + 1) / 2);
      near.push(el('', 'height:' + hn + 'px;background:' + (hn > 4 ? 'linear-gradient(' + nearRim + ' 0 4px,' + nearBody + ' 4px)' : nearRim)));
    }
    S.fill(parts.far, far);
    S.fill(parts.near, near);

    // reflection: three rows of 4px strokes, one row apart, stepping side to side
    var refl = [];
    [[0, [[-12, 24]], 0.95], [8, [[-20, 12], [-4, 20]], 0.7], [16, [[-24, 8], [-12, 16], [8, 12]], 0.45]].forEach(function (rw, ri) {
      rw[1].forEach(function (sg, k) {
        refl.push(el('pxdrift', 'left:calc(50% + ' + sg[0] + 'px);top:' + rw[0] + 'px;width:' + sg[1] + 'px;height:4px;background:' +
          (ri === 0 ? P.hi : S.mix(P.refl, Sk[2], ri * 0.15)) + ';opacity:' + rw[2] +
          ';animation-duration:' + (5 + ri * 1.5 + k).toFixed(1) + 's;animation-delay:' + (-(ri * 2 + k * 1.3)).toFixed(1) + 's'));
      });
    });
    S.fill(parts.refl, refl);

    // two small wisps drifting across the sky
    var cBody = S.mix(Sk[2], P.hi, 0.45), cTop = S.mix(cBody, P.hi, 0.6);
    var width = strip.clientWidth || 1280;
    S.fill(parts.clouds, [[0.18, 4, 22, 14, 3], [0.72, 8, 16, 10, -2]].map(function (c, k) {
      var cells = [], j;
      for (j = 0; j < c[2]; j++) if (j % 9 !== 8) cells.push([j, 0, cTop]);
      for (j = 0; j < c[3]; j++) if (j % 7 !== 6) cells.push([j + c[4] + 2, 2, cBody]);
      var dur = 600 + k * 120, lead = (c[2] + 6) * 4;
      return el('pxcloud', 'left:' + (-lead) + 'px;top:' + c[1] + 'px;opacity:' + (P.cloudO * 0.83).toFixed(2) + ';box-shadow:' + S.sprite(cells) +
        ';animation-duration:' + dur + 's;animation-delay:' + (-dur * (c[0] * width + lead) / 2400).toFixed(0) + 's');
    }));
  }

  build();
  document.addEventListener('skychange', build);
})();
