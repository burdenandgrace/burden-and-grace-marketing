# Burden and Grace — Marketing Site

The static marketing site for [burdenandgrace.com](https://burdenandgrace.com).

## Stack

Plain HTML, CSS, and a couple of small JS files. No build step. Edit a file, push to `main`, Cloudflare Pages auto-deploys.

## Files

- `index.html` — home
- `about.html`, `pricing.html`, `tracks.html` — marketing pages
- `privacy.html`, `terms.html` — legal
- `site.css` — shared styles
- `waitlist.js` — pre-launch waitlist modal (writes to Supabase)
- `site.js` — small shared JS (mobile nav toggle)
- `favicon.svg`, `og-image.png` — assets
- `robots.txt`, `sitemap.xml` — SEO

## Deploy

Pushes to `main` deploy automatically via Cloudflare Pages. Custom domain: `burdenandgrace.com`.

## Related

- Native + web app: separate Expo repo
- Admin dashboard: `admin/` (deployed to `admin.burdenandgrace.com` on Vercel)
