# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A minimal Jekyll personal site deployed to GitHub Pages at lukegrecki.github.io. Single page, no blog, no plugins beyond Jekyll itself.

## Commands

```bash
bundle exec jekyll serve          # local dev server at http://localhost:4000
bundle exec jekyll build          # build to _site/
```

## Architecture

- `index.md` — the only page; uses `layout: default`
- `_layouts/default.html` — sole layout; minimal HTML shell
- `assets/css/style.css` — hand-written CSS; no preprocessor
- `_config.yml` — only sets `title` and `description`

## Styling

Solarized dark color scheme via CSS custom properties in `style.css`. Monospace font stack throughout. No external CSS frameworks or JS.
