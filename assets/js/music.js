/* Music page — the pixel cover and the tracklist player. */
(function () {
  'use strict';
  var S = window.Sky;

  // ---------- pixel covers: a small moon and its reflection ----------
  // data-cover="full" (Neon Grotto), "crescent" (A History of Small Feelings) or "half" (Stakehouse).
  var PHASE_AGE = { crescent: 5.5, half: 7.4 };   // days into the lunar month
  function drawCover(cover) {
    var age = PHASE_AGE[cover.getAttribute('data-cover')];
    var crescent = age !== undefined;   // any partly lit moon
    var orb = S.el('cover__orb'), line = S.el('cover__line'), refl = S.el('cover__refl');
    var rows = [];
    S.discRows(48, 6).forEach(function (r) {
      if (!crescent) { rows.push(S.el('', 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:6px')); return; }
      // a waxing crescent: the unlit disc faintly, then the lit sliver on the right
      var lit = Math.max(-r.hq, Math.round(r.h * Math.cos(2 * Math.PI * age / S.SYN) / 6) * 6);
      rows.push(S.el('', 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:6px;opacity:.14'));
      if (r.hq - lit > 0) rows.push(S.el('', 'left:' + (48 + lit) + 'px;top:' + r.y + 'px;width:' + (r.hq - lit) + 'px;height:6px'));
    });
    S.fill(orb, rows);
    // how much of the disc is lit, and where its middle sits, shape the reflection
    var litFrac = crescent ? (1 - Math.cos(2 * Math.PI * age / S.SYN)) / 2 : 1;
    var rnd = S.rng(crescent ? 23 + Math.round(age) : 11), dashes = [], yy = 6;
    for (var i = 0; i < 12; i++) {
      // the crescent's reflection is narrower, dimmer and sits under its lit side
      var span = crescent ? (36 + 50 * litFrac) * (0.7 + i * 0.05) : 96 * (0.7 + i * 0.06), off = crescent ? Math.round(48 * (1 - litFrac) * 0.8) : 0, x = off - span / 2;
      while (x < off + span / 2 - 4) {
        var len = crescent ? 4 + rnd() * span * 0.35 : 6 + rnd() * span * 0.4;
        if (x + len > off + span / 2) len = off + span / 2 - x;
        if (len >= 4) dashes.push(S.el('', 'left:calc(50% + ' + Math.round(x) + 'px);top:' + Math.round(yy) + 'px;width:' + Math.round(len) + 'px;height:3px;opacity:' + ((crescent ? 0.7 : 0.9) - i * (crescent ? 0.045 : 0.05)).toFixed(2)));
        x += len + (crescent ? 4 + rnd() * 14 : 3 + rnd() * 12);
      }
      yy += 6 + i * 0.6;
    }
    S.fill(refl, dashes);
    S.fill(cover, [orb, line, refl]);
  }
  if (S) Array.prototype.forEach.call(document.querySelectorAll('[data-cover]'), drawCover);

  // ---------- players: one tracklist per release; only one track plays at a time ----------
  var lists = Array.prototype.slice.call(document.querySelectorAll('[data-player]'));
  if (!lists.length) return;
  var current = null;      // the <audio> playing (or last played)
  var currentRows = [];    // the tracklist it belongs to, for next/previous
  var session = 'mediaSession' in navigator ? navigator.mediaSession : null;
  // Cover shown on the lock screen and in system media controls.
  var ARTWORK = [
    { src: new URL('../assets/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' },
    { src: new URL('../assets/icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' }
  ];

  function fmt(sec) {
    if (!isFinite(sec)) return '—';
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  lists.forEach(function (list) {
  var rows = Array.prototype.slice.call(list.querySelectorAll('.track'));
  rows.forEach(function (row, i) {
    var audio = row.querySelector('audio');
    var btn = row.querySelector('.track__btn');
    var bar = row.querySelector('.track__bar');
    var fillEl = row.querySelector('.track__fill');
    var timeEl = row.querySelector('.track__time');
    var title = (row.querySelector('.track__name') || row.querySelector('.track__title')).textContent.trim();
    var total = row.getAttribute('data-duration') ? Number(row.getAttribute('data-duration')) : NaN;
    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var playedOnce = false;
    function track(name, label) { if (window.Analytics) window.Analytics.event(name + '/' + slug, label + ': ' + title); }

    function length() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total; }
    function paint() {
      var d = length(), t = audio.currentTime;
      var pct = d ? Math.min(100, t / d * 100) : 0;
      fillEl.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      bar.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
      timeEl.textContent = (row.classList.contains('is-playing') || t > 0) ? fmt(t) + ' / ' + fmt(d) : fmt(d);
    }
    function play() {
      if (current && current !== audio) current.pause();
      current = audio;
      currentRows = rows;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }
    function seekTo(fraction) {
      var d = length();
      if (!d) return;
      audio.currentTime = Math.max(0, Math.min(d, fraction * d));
      paint();
    }

    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('play', function () {
      row.classList.add('is-playing');
      btn.setAttribute('aria-label', 'Pause ' + title);
      if (!playedOnce) { playedOnce = true; track('play', 'Played'); }
      if (session && window.MediaMetadata) {
        session.metadata = new MediaMetadata({ title: title, artist: list.getAttribute('data-artist') || 'Luke Grecki', album: list.getAttribute('data-album') || '', artwork: ARTWORK });
        session.playbackState = 'playing';
      }
      paint();
    });
    audio.addEventListener('pause', function () {
      row.classList.remove('is-playing');
      btn.setAttribute('aria-label', 'Play ' + title);
      if (session && current === audio) session.playbackState = 'paused';
      paint();
    });
    audio.addEventListener('timeupdate', function () {
      if (!session || !session.setPositionState || current !== audio) return;
      var d = length();
      if (!d || !isFinite(d)) return;
      try { session.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, d) }); } catch (e) {}
    });
    audio.addEventListener('ended', function () {
      track('finished', 'Listened to the end');
      audio.currentTime = 0;
      paint();
      var next = rows[i + 1];
      if (next) next.querySelector('.track__btn').click();
    });
    audio.addEventListener('error', function () {
      btn.disabled = true;
      bar.removeAttribute('tabindex');
      row.classList.add('is-missing');
    });

    btn.addEventListener('click', function () {
      if (audio.paused) play(); else audio.pause();
    });
    bar.addEventListener('click', function (e) {
      var rect = bar.getBoundingClientRect();
      seekTo((e.clientX - rect.left) / rect.width);
      if (audio.paused) play();
    });
    bar.addEventListener('keydown', function (e) {
      var d = length();
      if (!d) return;
      var step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (step) { audio.currentTime = Math.max(0, Math.min(d, audio.currentTime + step)); paint(); e.preventDefault(); }
      else if (e.key === 'Home') { seekTo(0); e.preventDefault(); }
      else if (e.key === 'End') { seekTo(0.999); e.preventDefault(); }
    });

    paint();
  });
  });

  // ---------- lock screen, headphones and media keys ----------
  if (session) {
    var indexOfCurrent = function () {
      for (var k = 0; k < currentRows.length; k++) if (currentRows[k].querySelector('audio') === current) return k;
      return -1;
    };
    var press = function (k) { var r = (currentRows.length ? currentRows : lists[0].querySelectorAll('.track'))[k]; if (r) r.querySelector('.track__btn').click(); };
    var on = function (action, fn) { try { session.setActionHandler(action, fn); } catch (e) { /* not supported here */ } };
    on('play', function () { if (current) current.play(); else press(0); });
    on('pause', function () { if (current) current.pause(); });
    on('previoustrack', function () {
      var k = indexOfCurrent();
      if (current && (current.currentTime > 3 || k <= 0)) { current.currentTime = 0; if (current.paused) current.play(); }
      else press(k - 1);
    });
    on('nexttrack', function () { var k = indexOfCurrent(); if (k < currentRows.length - 1) press(k + 1); });
    on('seekbackward', function (d) { if (current) current.currentTime = Math.max(0, current.currentTime - ((d && d.seekOffset) || 10)); });
    on('seekforward', function (d) { if (current) current.currentTime = Math.min(current.duration || Infinity, current.currentTime + ((d && d.seekOffset) || 10)); });
    on('seekto', function (d) { if (current && d && isFinite(d.seekTime)) current.currentTime = d.seekTime; });
  }
})();
