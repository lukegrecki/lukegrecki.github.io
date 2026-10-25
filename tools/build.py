#!/usr/bin/env python3
"""Regenerate the parts of the site that depend on the lists of poems and music releases.

    python3 tools/build.py            # music pages, feed, sitemap, share tags, and any missing share images
    python3 tools/build.py --images   # also redraw every share image
    python3 tools/build.py --css      # only update the site.css version on every page

Reads music/releases.json (newest first) and poems/poems.json (order = order on the Poems page) and writes:
  music/index.html          the releases on the Music page (between the <!-- releases --> markers)
  music/<slug>/index.html   a page per release, with Newer/Older links
  assets/og/music-<slug>.png  share image per release: night, the moon in the cover's phase
  poems/feed.xml          Atom feed with the full text of each poem
  sitemap.xml               every page on the site
  assets/og/<slug>.png      1200x630 share image per poem, plus assets/og-image.png for other pages
                            (needs: pip install playwright
                            && playwright install chromium)
  og:image tags             in each poem's index.html
  ?v=<hash> on site.css     every page's stylesheet link becomes /assets/css/site.css?v=<hash>, where
                            <hash> is the first 8 hex digits of the stylesheet's SHA-256. It changes
                            only when site.css changes, so browsers re-download it after an edit.

The poem pages, the Poems list and the Previous/Next links are still edited by hand.
"""
import datetime
import hashlib
import functools
import html
import http.server
import json
import os
import re
import sys
import threading
import urllib.parse
from xml.sax.saxutils import escape

SITE = 'https://lukegrecki.com'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['/', '/work/', '/music/', '/poems/', '/about/']
# The night image uses a full moon; this instant is one.
FULL_MOON = datetime.datetime(2026, 10, 26, 4, 0, tzinfo=datetime.timezone.utc)


def path(*parts):
    return os.path.join(ROOT, *parts)


def load_poems():
    with open(path('poems', 'poems.json'), encoding='utf-8') as f:
        return json.load(f)


def poem_html(slug):
    with open(path('poems', slug, 'index.html'), encoding='utf-8') as f:
        return f.read()


def poem_body(page):
    """The poem's text as simple HTML for feed readers: stanzas as <p>, part numerals in bold."""
    m = re.search(r'<div class="poem__body">([\s\S]*?)\n    </div>\n\n    <div class="endmark"', page)
    if not m:
        raise SystemExit('could not find the poem text')
    body = m.group(1)
    body = re.sub(r'<p class="poem__num[^"]*"[^>]*>(.*?)</p>', r'<p><strong>\1</strong></p>', body)
    body = re.sub(r'<p class="stanza">', '<p>', body)
    body = re.sub(r'</?(div|section)[^>]*>', '', body)
    return '\n'.join(line.strip() for line in body.splitlines() if line.strip())


def write(rel, text):
    with open(path(rel), 'w', encoding='utf-8') as f:
        f.write(text)
    print('wrote', rel)


def build_feed(poems):
    updated = max(p['published'] for p in poems) + 'T00:00:00Z'
    entries = []
    for p in reversed(poems):  # newest first
        url = f"{SITE}/poems/{p['slug']}/"
        entries.append(f"""  <entry>
    <title>{escape(p['title'])}</title>
    <link href="{url}"/>
    <id>{url}</id>
    <published>{p['published']}T00:00:00Z</published>
    <updated>{p['published']}T00:00:00Z</updated>
    <content type="html">{escape(poem_body(poem_html(p['slug'])))}</content>
  </entry>""")
    feed = f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Luke Grecki: Poems</title>
  <subtitle>Poems by Luke Grecki</subtitle>
  <link href="{SITE}/poems/"/>
  <link rel="self" href="{SITE}/poems/feed.xml"/>
  <id>{SITE}/poems/</id>
  <updated>{updated}</updated>
  <author><name>Luke Grecki</name><uri>{SITE}/</uri></author>
{chr(10).join(entries)}
</feed>
"""
    write('poems/feed.xml', feed)


def build_sitemap(poems, releases):
    urls = PAGES + [f"/music/{r['slug']}/" for r in releases] + [f"/poems/{p['slug']}/" for p in poems]
    body = '\n'.join(f'  <url><loc>{SITE}{u}</loc></url>' for u in urls)
    write('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n'
                         f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n')


# ---------- music: the Music page listing and one page per release, from music/releases.json ----------

PHASE_WORDS = {'full': 'moon', 'crescent': 'crescent moon', 'half': 'half moon', 'gibbous': 'gibbous moon', 'waning': 'waning crescent moon'}
# days into the lunar month for each cover (matches PHASE_AGE in assets/js/music.js)
MOON_ALT = {'full': 'a full moon', 'crescent': 'a crescent moon', 'half': 'a half moon', 'gibbous': 'a gibbous moon', 'waning': 'a waning crescent moon'}
PHASE_AGE = {'full': None, 'crescent': 5.5, 'half': 7.4, 'gibbous': 11, 'waning': 24}
LUNAR_HALF = 14.782316  # days from new moon to FULL_MOON
ICON_PLAY = ('<svg class="icon-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">'
             '<path d="M4 2h2v12H4zM6 3h2v10H6zM8 5h2v6H8zM10 7h2v2h-2z" fill="currentColor"/></svg>')
ICON_PAUSE = ('<svg class="icon-pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">'
              '<path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>')
BACK_ARROW = ('<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">'
              '<path d="M2 5h2v2H2zM4 3h2v2H4zM4 7h2v2H4zM6 1h2v2H6zM6 9h2v2H6zM4 5h8v2H4z" fill="currentColor"/></svg>')
MUSIC_START = '<!-- releases: generated by tools/build.py from music/releases.json -->'
MUSIC_END = '<!-- /releases -->'


def load_releases():
    with open(path('music', 'releases.json'), encoding='utf-8') as f:
        return json.load(f)


def e(text):
    return html.escape(str(text), quote=True)


def mmss(seconds):
    return f'{seconds // 60}:{seconds % 60:02d}'


def joined(names):
    return names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]


def release_links(r, indent):
    if not r['links']:
        return ''
    items = '\n'.join(
        f'{indent}  <li><a class="textlink" href="{e(l["url"])}" data-goatcounter-click="{e(l["click"])}" '
        f'data-goatcounter-title="{e(l["name"])}: {e(r["title"])}" target="_blank" rel="noopener">{e(l["name"])}</a></li>'
        for l in r['links'])
    return f'\n{indent}<ul class="release__links">\n{items}\n{indent}</ul>'


def tracklist(r, up):
    """The playable tracklist. `up` is the relative path from the page to the site root."""
    rows = []
    for i, t in enumerate(r['tracks'], 1):
        title = e(t['title'])
        tid = f' id="{e(t["poem"])}"' if t.get('poem') else ''
        if t.get('poem'):
            name = (f'<span class="track__name">{title}</span> <a class="track__poem pixel" href="{up}poems/{e(t["poem"])}/" '
                    f'data-goatcounter-click="read-the-poem/{e(t["poem"])}" data-goatcounter-title="Music: read the poem {title}">Read the poem</a>')
        else:
            name = title
        rows.append(f"""    <li class="track"{tid} data-duration="{t['duration']}">
      <button class="track__btn" type="button" aria-label="Play {title}">
        {ICON_PLAY}
        {ICON_PAUSE}
      </button>
      <span class="track__n pixel">{i:02d}</span>
      <span class="track__title">{name}</span>
      <span class="track__bar" role="slider" tabindex="0" aria-label="Seek in {title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="track__fill"></span></span>
      <span class="track__time pixel">{mmss(t['duration'])}</span>
      <audio preload="none" src="{up}assets/audio/{e(t['file'])}"></audio>
    </li>""")
    artist = ', '.join(r['artists'])
    return (f'  <ol class="tracklist" data-player data-album="{e(r["title"])}" data-artist="{e(artist)}" aria-label="{e(r["title"])} tracklist">\n'
            + '\n'.join(rows) + '\n  </ol>')


def cover(r):
    return (f'<div class="cover" data-cover="{r["cover"]}" role="img" '
            f'aria-label="{e(r["title"])} cover: a pixel {PHASE_WORDS[r["cover"]]} over water"></div>')


def artists_line(r, indent):
    # a solo release by Luke needs no artist line
    return '' if r['artists'] == ['Luke Grecki'] else f'\n{indent}<p class="release__artists">{e(", ".join(r["artists"]))}</p>'


def music_listing(releases):
    parts = []
    for k, r in enumerate(releases):
        kicker = ('Latest' if k == 0 else 'Earlier') + f' release · {r["year"]}'
        n = len(r['tracks'])
        meta = r['type'] if n == 1 else f'{r["type"]} · {n} tracks'
        cls = 'release' if k == 0 else 'release release--earlier'
        ind = '      '
        parts.append(f"""  <section class="{cls}" aria-labelledby="release-{r['slug']}">
    {cover(r)}
    <div class="release__info">
      <p class="release__kicker pixel">{kicker}</p>
      <h2 id="release-{r['slug']}" class="release__title"><a class="rowlink" href="{r['slug']}/"><span class="rowtitle">{e(r['title'])}</span></a></h2>{artists_line(r, ind)}
      <p class="release__meta">{e(meta)}</p>{release_links(r, ind)}
    </div>
  </section>

{tracklist(r, '../')}""")
    return '\n\n'.join(parts)


def release_page(releases, k, head_from):
    r = releases[k]
    n = len(r['tracks'])
    minutes = round(sum(t['duration'] for t in r['tracks']) / 60)
    meta = f'{n} track{"s" if n != 1 else ""} · {minutes} minute{"s" if minutes != 1 else ""}'
    who = joined(r['artists'])
    kind = 'an EP' if r['type'] == 'EP' else 'a single'
    desc = f'{r["title"]}, {kind} by {who} ({r["year"]}).'
    # the head is the Music page's, one level deeper, with this release's title, description and share image
    head = head_from.replace('href="../', 'href="../../').replace('src="../', 'src="../../')
    head = re.sub(r'<title>.*?</title>', f'<title>{e(r["title"])} · Luke Grecki</title>', head)
    head = re.sub(r'<meta name="description" content="[^"]*">',
                  f'<meta name="description" content="{e(desc)}">\n<meta property="og:title" content="{e(r["title"])}">\n'
                  f'<meta property="og:description" content="{e(r["type"])} · {r["year"]} · {e(who)}">\n'
                  f'<meta property="og:type" content="music.album">', head)
    head = re.sub(r'<meta property="og:image" content="[^"]*">',
                  f'<meta property="og:image" content="{SITE}/assets/og/music-{r["slug"]}.png">', head)
    head = re.sub(r'<meta property="og:image:alt" content="[^"]*">',
                  f'<meta property="og:image:alt" content="{e(r["title"])}, {kind} by {e(who)}, over a pixel sea under {MOON_ALT[r["cover"]]}">', head)
    head = head.replace('<html lang="en" data-time="day">', '<html lang="en" data-time="night">')
    nav = []
    if k > 0:
        nav.append(('Newer', releases[k - 1], ''))
    if k + 1 < len(releases):
        nav.append(('Older', releases[k + 1], ' poem-nav__link--next'))
    nav_html = '\n'.join(
        f"""      <a class="rowlink poem-nav__link{cls}" href="../{o['slug']}/">
        <span class="poem-nav__label pixel">{label}</span>
        <span class="rowtitle">{e(o['title'])}</span>
      </a>""" for label, o, cls in nav)
    ind = '      '
    return f"""{head}<body>
<a class="skip" href="#content">Skip to content</a>
<header>
  <div class="wrap site-header__bar">
    <a class="rowlink site-name" href="../../"><span class="rowtitle">Luke <span class="name-pixel">Grecki</span></span></a>
    <nav aria-label="Main">
      <ul class="site-nav pixel">
        <li><a class="navlink" href="../../work/">Work</a></li>
        <li><a class="navlink" href="../" aria-current="page">Music</a></li>
        <li><a class="navlink" href="../../poems/">Poems</a></li>
        <li><a class="navlink" href="../../about/">About</a></li>
      </ul>
    </nav>
  </div>
  <div class="horizon" aria-hidden="true"></div>
</header>

<!-- generated by tools/build.py from music/releases.json; edit that file, not this one -->
<main id="content" class="wrap page page--poem">
  <a class="rowlink back pixel" href="../">
    {BACK_ARROW}
    <span class="rowtitle">Music</span>
  </a>

  <section class="release release--page" aria-labelledby="release-title">
    {cover(r)}
    <div class="release__info">
      <p class="release__kicker pixel">{e(r['type'])} · {r['year']}</p>
      <h1 id="release-title" class="release__title">{e(r['title'])}</h1>{artists_line(r, ind)}
      <p class="release__meta">{meta}</p>{release_links(r, ind)}
    </div>
  </section>

{tracklist(r, '../../')}

  <nav class="poem-nav" aria-label="More releases">
    <div class="dots" aria-hidden="true"></div>
    <div class="poem-nav__row">
{nav_html}
    </div>
  </nav>
</main>

<footer class="wrap site-footer"><p class="pixel">© 2026 Luke Grecki</p></footer>
</body>
</html>
"""


def build_music(releases):
    with open(path('music', 'index.html'), encoding='utf-8') as f:
        page = f.read()
    start, end = page.index(MUSIC_START) + len(MUSIC_START), page.index(MUSIC_END)
    new = page[:start] + '\n' + music_listing(releases) + '\n  ' + page[end:]
    if new != page:
        write('music/index.html', new)
    head = new[:new.index('<body>')]
    for k, r in enumerate(releases):
        os.makedirs(path('music', r['slug']), exist_ok=True)
        rel = os.path.join('music', r['slug'], 'index.html')
        text = release_page(releases, k, head)
        old = open(path(rel), encoding='utf-8').read() if os.path.exists(path(rel)) else None
        if text != old:
            write(rel, text)


TIME_WORDS = {'dawn': 'at dawn', 'day': 'at midday', 'dusk': 'at dusk', 'night': 'under a full moon'}


def set_share_tags(p):
    rel = os.path.join('poems', p['slug'], 'index.html')
    page = poem_html(p['slug'])
    image = f"{SITE}/assets/og/{p['slug']}.png"
    alt = f"“{p['title']}”, a poem by Luke Grecki, over a pixel sea {TIME_WORDS.get(p.get('time'), '')}".strip()
    new = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{image}">', page)
    new = re.sub(r'<meta property="og:image:alt" content="[^"]*">',
                 f'<meta property="og:image:alt" content="{html.escape(alt)}">', new)
    if new != page:
        write(rel, new)


def build_images(poems, releases, redraw):
    todo = [p for p in poems if redraw or not os.path.exists(path('assets', 'og', p['slug'] + '.png'))]
    music = [r for r in releases if redraw or not os.path.exists(path('assets', 'og', f"music-{r['slug']}.png"))]
    home = redraw or not os.path.exists(path('assets', 'og-image.png'))
    if not todo and not music and not home:
        print('share images up to date')
        return
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit('Drawing share images needs Playwright: pip install playwright && playwright install chromium')
    os.makedirs(path('assets', 'og'), exist_ok=True)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_address[1]}'
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for p in todo:
            page = browser.new_page(viewport={'width': 1200, 'height': 630})
            page.clock.set_fixed_time(FULL_MOON)
            query = urllib.parse.urlencode({'time': p.get('time', 'night'), 'season': 'autumn', 'title': p['title'],
                                            'label': f"Poem · {p['year']}"})
            page.goto(f'{base}/tools/og-template.html?{query}', wait_until='networkidle')
            page.wait_for_selector('html[data-ready]')
            page.evaluate('document.fonts.ready')
            page.screenshot(path=path('assets', 'og', p['slug'] + '.png'))
            print('drew', f"assets/og/{p['slug']}.png")
            page.close()
        for r in music:
            # night, with the moon in the same phase as the release's cover
            age = PHASE_AGE[r['cover']]
            when = FULL_MOON if age is None else FULL_MOON - datetime.timedelta(days=LUNAR_HALF - age)
            page = browser.new_page(viewport={'width': 1200, 'height': 630})
            page.clock.set_fixed_time(when)
            query = urllib.parse.urlencode({'time': 'night', 'season': 'autumn', 'title': r['title'],
                                            'label': f"{r['type']} · {r['year']}"})
            page.goto(f'{base}/tools/og-template.html?{query}', wait_until='networkidle')
            page.wait_for_selector('html[data-ready]')
            page.evaluate('document.fonts.ready')
            page.screenshot(path=path('assets', 'og', f"music-{r['slug']}.png"))
            print('drew', f"assets/og/music-{r['slug']}.png")
            page.close()
        if home:
            # the site-wide share image: the scene at dusk, centred, no text (matches the icons)
            page = browser.new_page(viewport={'width': 1200, 'height': 630})
            page.clock.set_fixed_time(FULL_MOON)
            page.goto(f'{base}/tools/og-template.html?home=1&time=dusk&season=autumn', wait_until='networkidle')
            page.wait_for_selector('html[data-ready]')
            page.screenshot(path=path('assets', 'og-image.png'))
            print('drew assets/og-image.png')
            page.close()
        browser.close()
    server.shutdown()


CSS_LINK = re.compile(r'href="[^"]*assets/css/site\.css(?:\?v=[0-9a-f]*)?"')


def stamp_css():
    """Point every page's stylesheet link at /assets/css/site.css?v=<hash of its contents>."""
    with open(path('assets', 'css', 'site.css'), 'rb') as f:
        digest = hashlib.sha256(f.read()).hexdigest()[:8]
    href = f'href="/assets/css/site.css?v={digest}"'
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for name in files:
            if not name.endswith('.html'):
                continue
            full = os.path.join(folder, name)
            with open(full, encoding='utf-8') as f:
                page = f.read()
            new = CSS_LINK.sub(href, page)
            if new != page:
                write(os.path.relpath(full, ROOT), new)
    print('site.css version', digest)


if __name__ == '__main__':
    stamp_css()
    if '--css' in sys.argv:
        sys.exit()
    poems = load_poems()
    releases = load_releases()
    build_music(releases)
    build_images(poems, releases, redraw='--images' in sys.argv)
    for p in poems:
        set_share_tags(p)
    build_feed(poems)
    build_sitemap(poems, releases)
