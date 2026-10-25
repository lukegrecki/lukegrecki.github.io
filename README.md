# lukegrecki.github.io

Personal site of Luke Grecki: a sun or moon over water on the front door, and quiet pages for work, music, poems and an about page. Plain HTML, CSS and JavaScript: there's nothing to compile, and the folder works as is. One small script, `tools/build.py`, keeps the generated parts up to date (see [Build tool](#build-tool)).

## How it works

- **Time of day.** Every page sets `<html data-time="dawn|day|dusk|night">`, and all colors in `assets/css/site.css` follow it.
  - The visitor's time zone (for example `America/New_York`) is looked up in `assets/js/tz.js` for rough coordinates. No location permission is asked for.
  - The site works out where the sun is for them right now. Dawn and dusk are while it's within 9° of the horizon, day is above that, and night is below. So dusk arrives at 4:30 in a New York December and after 7:30 in June, and Svalbard gets midnight sun.
  - If the time zone isn't recognized (for example plain `UTC`), it falls back to fixed hours: dawn 5–8, day 8–17, dusk 17–20, night the rest.
- **Seasons** come from the month in the visitor's time zone, flipped south of the equator. At night the home page shows the real moon phase, with the lit side mirrored for the southern hemisphere.
- **Preview another moment** by adding query parameters:
  - `/?time=night&season=winter` or `/music/?time=dawn` forces a period or season.
  - `/?tz=Australia/Sydney` shows the site as a visitor in that time zone sees it right now.
- **Pixel art.** The home scene and the strip under each inner page's header are drawn on one 4px grid, and everything moves in 4px steps. Shadows lean toward a cooler hue for each time of day rather than just getting darker, and there are two shorelines: a hazy far one and a near one with a lit top edge.
- **Clouds and seasons.** Two to four wispy clouds drift across the sky (fewer at night). A few seasonal particles drift through the home scene: petals in spring, pollen on summer days, fireflies on summer evenings, leaves in autumn and snow in winter.
- **Motion** is slow and ambient. For visitors who have reduced motion set in their system settings, the water stops moving and clouds and particles freeze where they are.
- **Fonts** (Spectral and Silkscreen) are served from `assets/fonts/`, so visitors' browsers don't contact Google. Both are under the SIL Open Font License; the license files sit beside them.
- **The EP player** works with lock screens, headphones and media keys: play/pause, next/previous track, and seeking.
- **Sharing:** each poem has its own share image (`assets/og/<poem>.png`) showing its title over the scene at a fixed time of day, and each release one at night with the moon in its cover's phase. Other pages use `assets/og-image.png`, the scene at dusk with no text, matching the site icons. `python3 tools/build.py --images` redraws all of them.
- **For search engines and feed readers:** `sitemap.xml` and `robots.txt`, plus an Atom feed of the poems at `poems/feed.xml` (linked from the Poems page).

## Analytics

The site uses [GoatCounter](https://lukegrecki.goatcounter.com), which sets no cookies. `assets/js/analytics.js` sets it up.

- **Page views** are recorded by path only, so `/?time=night` counts as `/`. Visits from `localhost` (local previews) are never counted.
- **Events:**
  - `outbound/…`: clicks to Spotify, Apple Music, GitHub, LinkedIn and email. These come from `data-goatcounter-click` attributes on the links.
  - `play/<track>`: the first play of each EP track during a visit.
  - `finished/<track>`: a track played to the end.
  - `read-to-end/<poem>`: a reader reached the poem's end mark.
  - `next-poem/<poem>`: a reader clicked Next from that poem.
- **Skip your own visits:** open `https://lukegrecki.com/#skip-analytics` once in each browser you use. Open it again to resume counting.

## Files

```
index.html                     home (moon over water)
work/ music/ poems/ about/      inner pages
music/releases.json            list of releases: tracks, artists, links, cover (newest first)
music/<release>/               one page per release (generated)
poems/<poem>/                  one folder per poem
writing/                       redirects to poems/ (the old address); free for a future blog
404.html
assets/css/site.css            all styles and the four time-of-day themes
assets/js/tz.js                time zone -> approximate coordinates (from the tz database)
assets/js/sky.js               sun position, time, season, moon phase, shared helpers
assets/js/scene.js             home scene
assets/js/horizon.js           thin horizon strip under each inner page's header
assets/js/music.js             pixel covers + tracklist players
assets/js/analytics.js         GoatCounter setup + custom events
assets/fonts/                  Spectral + Silkscreen (woff2) and their licenses
assets/og/                     share image for each poem and release
assets/og-image.png            share image for every other page
poems/poems.json               list of poems: order, title, year, date, image time of day
poems/feed.xml                 Atom feed (generated)
sitemap.xml, robots.txt        for search engines (sitemap generated)
tools/build.py                 updates the generated parts (see Build tool below)
tools/og-template.html         the page the share images are drawn from
assets/audio/                  the EPs, 192 kbps MP3 (Neon Grotto at the top level, later additions each in their own folder)
assets/img/portrait.jpg
```

## Build tool

`tools/build.py` updates everything that's generated from other files. Run it from the repo folder after adding a poem or release or changing the styles, then commit what it changed. Running it again when nothing has changed does nothing.

```
python3 tools/build.py            # the usual run: everything below except redrawing existing images
python3 tools/build.py --css      # only the stylesheet version (after editing site.css)
python3 tools/build.py --images   # also redraw every share image (after changing the scene's look)
```

What it writes:

- **Stylesheet version:** every page's stylesheet link becomes `/assets/css/site.css?v=<hash>`, a short hash of `site.css`, so browsers fetch new styles as soon as they change.
- **Poem feed:** `poems/feed.xml`, with the full text of each poem in `poems/poems.json`.
- **Music pages:** the releases on the Music page and a page for each release, from `music/releases.json`.
- **Sitemap:** `sitemap.xml`, listing every page, release and poem.
- **Share images:** `assets/og/<poem>.png` for each poem, `assets/og/music-<release>.png` for each release, plus `assets/og-image.png` for the other pages. It only draws missing ones unless you pass `--images`.
- **Share tags:** the `og:image` lines in each poem's page, pointing at its image.

**Requirements:** Python 3, nothing else, unless it has to draw share images. For that, install Playwright once:

```
pip install playwright && playwright install chromium
```

**Preview before pushing:** run `python3 -m http.server` in the repo folder and open http://localhost:8000. Add `?time=night`, `?season=winter` or `?tz=Asia/Tokyo` to see other moments (see [How it works](#how-it-works)).

## Common edits

- **Add a poem:**
  1. Copy one of the folders in `poems/` (for example `poems/you-are-no-one/`) to a new folder and replace the title and stanzas. Each stanza is a `<p class="stanza">`, with `<br>` between lines.
  2. Add a numbered row for it in `poems/index.html`.
  3. Update the Previous/Next links at the bottom of its neighbors (`<nav class="poem-nav">`).
  4. Add it to `poems/poems.json`, choosing a time of day for its image (`dawn`, `day`, `dusk` or `night`).
  5. Run `python3 tools/build.py`. This draws its share image and updates the feed and sitemap (see [Build tool](#build-tool)).
- **Edit the styles:** after changing `assets/css/site.css`, run `python3 tools/build.py --css`. It sets every page's stylesheet link to `/assets/css/site.css?v=<hash>`, a short hash of the file's contents, so visitors' browsers fetch the new styles straight away but keep using their cached copy until it changes again. (A full `python3 tools/build.py` does this too.)
- **Add a track or release:** edit `music/releases.json` (newest release first), then run `python3 tools/build.py`. It rewrites the releases on the Music page (between the `<!-- releases -->` markers in `music/index.html`; the heading and intro above them are edited by hand) and writes a page for each release at `music/<slug>/`, with Newer/Older links and a share image showing the moon in the cover's phase. Don't edit those pages directly; the next build overwrites them. For each release:
  - `slug` (its address), `title`, `type` (`EP` or `Single`), `year` and `cover` (see Pixel covers).
  - `artists`: everyone credited, in order. A release by you alone (`["Luke Grecki"]`) shows no artist line. Lock screens show these names too.
  - `links`: Spotify, Apple Music and so on, each with a `click` name for analytics (`outbound/…`). Leave it `[]` until there are some.
  - `tracks`: `title`, `file` (relative to `assets/audio/`), `duration` in whole seconds (rounded down, as streaming services show it) and, optionally, `poem` (a poem's slug) to add a "Read the poem" link.
  
  Put the MP3s in their own folder under `assets/audio/` (as `assets/audio/a-history-of-small-feelings/` does), encoded at 192 kbps: `ffmpeg -i song.wav -b:a 192k 01-song.mp3`. Tracks never download until someone presses play, and the player handles any number of releases (only one track plays at a time; next and previous stay within a release).
- **Pixel covers:** `data-cover="full"` draws a full moon, `"crescent"` a crescent, `"half"` a half moon, `"gibbous"` a gibbous moon and `"waning"` a waning crescent (lit on the left); add more phases in `PHASE_AGE` in `assets/js/music.js`.
- **Replace a pixel cover with real art:** change `cover()` in `tools/build.py` to return an `<img class="cover" src="…" alt="… cover">` for that release.

## Publishing (GitHub Pages)

1. Push to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, with `main` and `/ (root)`.
3. **Custom domain:** enter it under Settings → Pages, which adds a `CNAME` file. Then at your registrar:
   - For an apex domain, add four `A` records for `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153.
   - For a `www` subdomain, add a `CNAME` record pointing to `lukegrecki.github.io`.
4. Once the certificate is issued, turn on **Enforce HTTPS**.

To check changes before pushing, preview locally (see [Build tool](#build-tool)).
