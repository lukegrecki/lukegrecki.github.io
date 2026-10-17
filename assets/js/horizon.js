/* Horizon strip — the home scene compressed into a 52px band under the header
   of every inner page, on the same 4px pixel grid. */
(function () {
  'use strict';
  var S = window.Sky;
  var strip = document.querySelector('.horizon');
  if (!S || !strip) return;
  var el = S.el, q = S.q4;

  var parts = {
    sky: el('horizon__sky'), clouds: el('horizon__clouds'),
    far: el('horizon__hills'), near: el('horizon__hills'),
    water: el('horizon__water'), refl: el('horizon__refl')
  };
  S.fill(strip, [parts.sky, parts.clouds, parts.far, parts.near, parts.water, parts.refl]);

  function rows(list) { return list.map(function (bg) { return el('', 'background:' + bg); }); }

  function build() {
    var P = S.palette(), hill = S.shoreline(), Sk = P.sky;
    var Wt = P.water.map(function (c, i) { return S.mix(c, P.sh, i * 0.07); });

    // 8 sky rows and 5 water rows, each 4px; one checkerboard row where the sky glows into the horizon
    S.fill(parts.sky, rows([Sk[0], Sk[0], Sk[1], Sk[1], Sk[2], Sk[2], S.dither(Sk[2], Sk[3]), Sk[3]]));
    S.fill(parts.water, rows([Wt[0], Wt[1], Wt[1], Wt[2], Wt[2]]));

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

    // a few glints scattered across the water, flickering in steps
    var refl = [], gr = S.rng(41);
    for (var g = 0; g < 18; g++) {
      refl.push(el('pxtwinkle', 'left:' + (gr() * 100).toFixed(1) + '%;top:' + (4 + Math.floor(gr() * 3) * 4) + 'px;width:' + (4 + Math.floor(gr() * 3) * 4) +
        'px;height:4px;background:' + S.mix(Wt[1], P.refl, 0.45 + gr() * 0.25) +
        ';animation-duration:' + (2.5 + gr() * 4).toFixed(1) + 's;animation-delay:' + (-gr() * 6).toFixed(1) + 's'));
    }
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
