# Stacey de Voe — artist site

Static portfolio site for artist Stacey de Voe. Content is managed in [Sanity Studio](https://www.sanity.io/) and loaded by the browser at runtime.

## What’s in the repo

| Part | Role |
|------|------|
| **Static site** (`site/`) | The deployed website — home page, project pages, and immersive viewers. Cloudflare Pages serves this folder. |
| **Sanity Studio** (`sanity-studio/`) | Where editors manage projects, bio, typography, and materials |

Images and fonts are stored on Sanity’s CDN, not in Git.

## How it works

1. An editor publishes changes in Sanity Studio.
2. A visitor opens the site; JavaScript fetches the published content and renders it.
3. If Sanity is temporarily unreachable, the site shows a minimal offline fallback.

Adding, removing, or renaming a project needs **no developer action** — Cloudflare Pages serves a shared template for every project/immersive URL, and the page loads its content from Sanity by slug.

## Documentation

| Document | Audience |
|----------|----------|
| [DEVELOPER.md](DEVELOPER.md) | Local setup, hosting/routing, backups, Cloudflare Pages, CORS, deployment |
| [sanity-studio/README.md](sanity-studio/README.md) | Studio commands, schema, Presentation preview |

## Quick start (developers)

**Site** — home page only:

```bash
python -m http.server 3000 --directory site
```

**Project + immersive pages locally** — from the repo root (mirrors `site/_worker.js`, Node 18+):

```bash
npm run dev:site
```

**Studio** — requires Node.js 22.12+:

```bash
cd sanity-studio
npm install
npm run dev
```

Open `http://localhost:3333` for Studio, `http://localhost:3000` for the site.

See [DEVELOPER.md](DEVELOPER.md) for CORS, backups, Cloudflare Pages, and the full workflow.
