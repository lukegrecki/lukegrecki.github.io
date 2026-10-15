# lukegrecki.github.io

Personal site of Luke Grecki: a moon over water on the front door, and quiet pages for work, music, writing and an about page. Plain HTML, CSS and JavaScript. There is no build step.

## How it works

- **Time of day.** Every page sets `<html data-time="dawn|day|dusk|night">` from the visitor's clock, and all colors in `assets/css/site.css` follow it.
  - Dawn is 5–8, day is 8–17, dusk is 17–20, and night is the rest.
  - The season comes from the month. At night, the home page shows the real moon phase.
- **Preview another moment** by adding query parameters, for example `/?time=night&season=winter` or `/music/?time=dawn`.
- **Motion** is slow and ambient. It switches off for visitors who have reduced motion set in their system settings.

## Files

```
index.html                     home (moon over water)
work/ music/ writing/ about/    inner pages
writing/light-of-night/        the poem
404.html
assets/css/site.css            all styles and the four time-of-day themes
assets/js/sky.js               time, season, moon phase, shared helpers
assets/js/scene.js             home scene
assets/js/horizon.js           thin horizon strip under each inner page's header
assets/js/music.js             pixel cover + tracklist player
assets/audio/                  Neon Grotto EP, 192 kbps MP3
assets/img/portrait.jpg
```

## Common edits

- **Add a poem:** copy `writing/light-of-night/` to a new folder, then add a row for it in `writing/index.html`. Each stanza is a `<p class="stanza">`, with `<br>` between lines.
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
