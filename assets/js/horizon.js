/* Horizon strip — the home scene compressed into a thin band under the
   header of every inner page. */
(function () {
  'use strict';
  var S = window.Sky;
  var strip = document.querySelector('.horizon');
  if (!S || !strip) return;
  var el = S.el;

  var parts = {
    sky: el('horizon__sky'), orb: el('horizon__orb'), hills: el('horizon__hills'),
    water: el('horizon__water'), refl: el('horizon__refl breathe')
  };
  S.fill(strip, [parts.sky, parts.orb, parts.hills, parts.water, parts.refl]);

  var ROWS = [[-10, 7], [4, 9], [-16, 8], [-2, 14], [10, 6], [-22, 10], [-6, 18], [14, 8]];

  function build() {
    var P = S.palette();
    S.fill(parts.sky, S.banded(S.ramp(P.sky, 4), 2));
    S.fill(parts.water, S.banded(S.ramp(P.water, 3), 2));
    S.fill(parts.orb, S.discRows(9, 3).map(function (r) {
      return el('', 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:3px;background:' + P.orb);
    }));
    var hills = [];
    for (var i = 0; i < 160; i++) {
      var v = 1 + 3 * (Math.sin(i * 0.09) + 1) / 2 + 2 * (Math.sin(i * 0.31 + 1.7) + 1) / 2;
      hills.push(el('', 'flex:1 1 0;height:' + Math.round(v / 2) * 2 + 'px;background:' + P.hill));
    }
    S.fill(parts.hills, hills);
    S.fill(parts.refl, ROWS.map(function (r, i) {
      return el('drift', 'left:calc(50% + ' + r[0] + 'px);top:' + (2 + Math.floor(i / 2) * 4 + (i % 2)) + 'px;width:' + r[1] +
        'px;height:2px;background:' + P.refl + ';opacity:' + (0.95 - i * 0.08).toFixed(2) +
        ';animation-duration:' + (4 + i * 0.7).toFixed(1) + 's;animation-delay:' + (-i * 1.3).toFixed(1) + 's');
    }));
  }

  build();
  document.addEventListener('skychange', build);
})();
