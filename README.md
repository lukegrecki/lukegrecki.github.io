# lukegrecki.github.io

Personal site of Luke Grecki: a moon over water on the front door, and quiet pages for work, music, poems and an about page. Plain HTML, CSS and JavaScript, with no build step to view it. One small script, `tools/build.py`, regenerates the poetry feed, the sitemap and the poems' share images.

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
- **Sharing:** each poem has its own share image (`assets/og/<poem>.png`) showing its title over the scene at a fixed time of day. Other pages use `assets/og-image.png`, the scene at dusk with no text, matching the site icons. `python3 tools/build.py --images` redraws all of them.
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
poems/<poem>/                  one folder per poem
writing/                       redirects to poems/ (the old address); free for a future blog
404.html
assets/css/site.css            all styles and the four time-of-day themes
assets/js/tz.js                time zone -> approximate coordinates (from the tz database)
assets/js/sky.js               sun position, time, season, moon phase, shared helpers
assets/js/scene.js             home scene
assets/js/horizon.js           thin horizon strip under each inner page's header
assets/js/music.js             pixel cover + tracklist player
assets/js/analytics.js         GoatCounter setup + custom events
assets/fonts/                  Spectral + Silkscreen (woff2) and their licenses
assets/og/                     share image for each poem
poems/poems.json               list of poems: order, title, year, date, image time of day
poems/feed.xml                 Atom feed (generated)
sitemap.xml, robots.txt        for search engines (sitemap generated)
tools/build.py                 regenerates feed, sitemap, share images and share tags
tools/og-template.html         the page the share images are drawn from
assets/audio/                  Neon Grotto EP, 192 kbps MP3
assets/img/portrait.jpg
```

## Common edits

- **Add a poem:**
  1. Copy one of the folders in `poems/` (for example `poems/you-are-no-one/`) to a new folder and replace the title and stanzas. Each stanza is a `<p class="stanza">`, with `<br>` between lines.
  2. Add a numbered row for it in `poems/index.html`.
  3. Update the Previous/Next links at the bottom of its neighbors (`<nav class="poem-nav">`).
  4. Add it to `poems/poems.json`, choosing a time of day for its image (`dawn`, `day`, `dusk` or `night`).
  5. Run `python3 tools/build.py`. This draws its share image and updates the feed and sitemap. Drawing the image needs Playwright once: `pip install playwright && playwright install chromium`.
- **Add a track or release:** copy a `<li class="track">` block in `music/index.html`. Then put the MP3 in `assets/audio/` and set `data-duration` to its length in seconds.
- **Replace the pixel cover with real art:** swap `<div class="cover" data-cover …>` for an `<img class="cover" src="../assets/img/neon-grotto.jpg" alt="Neon Grotto cover">`.

## Publishing (GitHub Pages)

1. Push to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, with `main` and `/ (root)`.
3. **Custom domain:** enter it under Settings → Pages, which adds a `CNAME` file. Then at your registrar:
   - For an apex domain, add four `A` records for `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153.
   - For a `www` subdomain, add a `CNAME` record pointing to `lukegrecki.github.io`.
4. Once the certificate is issued, turn on **Enforce HTTPS**.

Preview locally with `python3 -m http.server` in this folder, then open http://localhost:8000.
