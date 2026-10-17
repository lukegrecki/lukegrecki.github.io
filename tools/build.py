#!/usr/bin/env python3
"""Regenerate the parts of the site that depend on the list of poems.

    python3 tools/build.py            # feed, sitemap, share tags, and any missing share images
    python3 tools/build.py --images   # also redraw every share image
    python3 tools/build.py --css      # only update the site.css version on every page

Reads poems/poems.json (order = order on the Poems page) and writes:
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


def build_sitemap(poems):
    urls = PAGES + [f"/poems/{p['slug']}/" for p in poems]
    body = '\n'.join(f'  <url><loc>{SITE}{u}</loc></url>' for u in urls)
    write('sitemap.xml', f'<?xml version="1.0" encoding="UTF-8"?>\n'
                         f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n')


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


def build_images(poems, redraw):
    todo = [p for p in poems if redraw or not os.path.exists(path('assets', 'og', p['slug'] + '.png'))]
    home = redraw or not os.path.exists(path('assets', 'og-image.png'))
    if not todo and not home:
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
            query = urllib.parse.urlencode({'time': p.get('time', 'night'), 'season': 'autumn', 'title': p['title']})
            page.goto(f'{base}/tools/og-template.html?{query}', wait_until='networkidle')
            page.wait_for_selector('html[data-ready]')
            page.evaluate('document.fonts.ready')
            page.screenshot(path=path('assets', 'og', p['slug'] + '.png'))
            print('drew', f"assets/og/{p['slug']}.png")
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
    build_images(poems, redraw='--images' in sys.argv)
    for p in poems:
        set_share_tags(p)
    build_feed(poems)
    build_sitemap(poems)
