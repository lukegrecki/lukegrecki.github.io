/* Analytics — GoatCounter (https://lukegrecki.goatcounter.com). No cookies.
   Loaded in <head>, before GoatCounter's count.js.

   Page views are recorded by path only, so preview links like /?time=night
   count as "/" instead of splitting the stats.

   Events (they show up in GoatCounter alongside pages):
     outbound/…        clicks on Spotify, Apple Music, GitHub, LinkedIn, email
                       (data-goatcounter-click attributes in the HTML)
     play/<track>      first play of an EP track on a page visit (music.js)
     finished/<track>  a track played through to the end (music.js)
     read-to-end/<poem> a reader reached the end mark of a poem
     next-poem/<poem>  a reader followed the Next link from that poem

   Your own visits: open https://lukegrecki.com/#skip-analytics once in each
   browser you use to stop counting yourself; open it again to resume.
   Visits from localhost (local previews) are never counted. */
(function () {
  'use strict';

  window.goatcounter = window.goatcounter || {};
  window.goatcounter.path = location.pathname || '/';

  // Owner opt-out toggle (GoatCounter skips browsers with skipgc = 't').
  if (location.hash === '#skip-analytics') {
    try {
      var off = localStorage.getItem('skipgc') === 't';
      if (off) localStorage.removeItem('skipgc'); else localStorage.setItem('skipgc', 't');
      history.replaceState(null, '', location.pathname + location.search);
      window.addEventListener('DOMContentLoaded', function () {
        var note = document.createElement('p');
        note.className = 'pixel analytics-note';
        note.setAttribute('role', 'status');
        note.textContent = off ? 'Analytics on for this browser' : 'Analytics off for this browser';
        document.body.appendChild(note);
        setTimeout(function () { note.remove(); }, 4000);
      });
    } catch (e) { /* storage blocked: nothing to toggle */ }
  }

  // Events fired before count.js arrives wait in a queue.
  var queue = [];
  function ready() { return window.goatcounter && typeof window.goatcounter.count === 'function'; }
  function send(name, title) {
    var ev = { path: name, title: title || name, event: true };
    if (ready()) window.goatcounter.count(ev); else queue.push(ev);
  }
  function flush() {
    if (!ready()) return false;
    while (queue.length) window.goatcounter.count(queue.shift());
    return true;
  }
  window.addEventListener('load', function () {
    if (flush()) return;
    var tries = 0, t = setInterval(function () { if (flush() || ++tries > 20) clearInterval(t); }, 500);
  });

  window.Analytics = { event: send };

  // Poems: did the reader reach the end mark?
  window.addEventListener('DOMContentLoaded', function () {
    var end = document.querySelector('.poem .endmark');
    if (!end || !('IntersectionObserver' in window)) return;
    var slug = location.pathname.replace(/\/+$/, '').split('/').pop();
    var title = (document.querySelector('.poem__head h1') || {}).textContent || slug;
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        send('read-to-end/' + slug, 'Read to the end: ' + title);
        io.disconnect();
      }
    });
    io.observe(end);
  });
})();
