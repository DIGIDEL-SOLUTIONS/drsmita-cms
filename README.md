# Dr. Smita Sharma Foundation — Framer-exact site, CMS-editable

The extracted Framer site (identical animations — this **is** Framer's published runtime) plus a
**content overlay build**: all wording lives in `content/site.json`, and `build.mjs` applies it onto
the Framer output. You edit one JSON file (or use the admin UI), run one command, and the site
re-renders with Framer's own animations intact.

## How it works (the important part)

Framer's published output has **two copies of every text**:

1. the server-rendered HTML (first paint, SEO), and
2. the per-page JS chunk that React re-renders from after hydration.

Editing only the HTML gets **silently reverted** when React hydrates. This build patches **both layers**,
which is why edits stick. The build also syntax-checks every patched chunk (`node --check`) and refuses
to ship a broken one.

```
site/          pristine extraction (never edit)
content/site.json   ← ALL website content lives here (edit this)
build.mjs      applies content onto both layers → dist/
admin/         Decap CMS UI (edit content in a browser)
dist/          output — deploy this
```

## Edit & rebuild

```bash
npm run dev          # build + serve on http://localhost:4174
```

Change anything in `content/site.json`, rebuild, refresh. The build reports every patch
(`patches applied: 60/60`) and flags any that no longer match (happens when the baseline
is re-extracted from a new Framer publish — update the patterns in `build.mjs`).

## Admin UI (CMS)

```bash
npm run local-admin   # terminal 1 — Decap local server (no login, local only)
npm run dev           # terminal 2
# open http://localhost:4174/admin/
```

For the hosted version at `/admin/` (edits commit straight to GitHub → Vercel redeploys),
enable the GitHub backend in `admin/config.yml` and set up a Decap OAuth app
(https://github.com/i-do-dev/decap-github-oauth-app on Vercel works well).

## What's editable vs. what's not (honest scope)

**Editable through `content/site.json`** (verified on the live build): hero (badge, headline with
gold accent, paragraph, button, counter), all section headings, about paragraph + stats, impact
counters/labels/features, donation texts, volunteer texts, testimonials heading, FAQ (6 Q&As),
blog heading, CTA, global site name/title/email/location, footer contact strings, nav brand,
logo, and the category chip labels (the template's misspelled "Helth" is now "Care").

**Still from Framer**: the four cause detail pages and blog posts pull their data from Framer's
CMS **at runtime** — edit those in the Framer project and publish, then re-run the extractor
(`node ../out/extract_site.mjs` with `EXTRACT_OUT` pointed here) and rebuild. Template images
are swapped the same way (they're plain URLs in both layers).

## Deploy

`dist/` is static — Vercel/Netlify/any host, zero config. Build command `npm run build`,
output `dist`.
