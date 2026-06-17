# Stacey de Voe — artist site

Static portfolio site for artist Stacey de Voe. Content is managed in [Sanity Studio](https://www.sanity.io/) and loaded by the browser at runtime.

## What’s in the repo

| Part | Role |
|------|------|
| **Static site** (`index.html`, `css/`, `js/`) | Home page, project pages, and immersive viewers |
| **Page shells** (`project/`, `immersive/`) | Thin HTML files so each project URL works on static hosting |
| **Sanity Studio** (`studio-sdv-site/`) | Where editors manage projects, bio, typography, and materials |

Images and fonts are stored on Sanity’s CDN, not in Git.

## How it works

1. An editor publishes changes in Sanity Studio.
2. A visitor opens the site; JavaScript fetches the published content and renders it.
3. If Sanity is temporarily unreachable, the site shows a minimal offline fallback.

Adding, removing, or renaming a project also requires syncing HTML page shells — that is a developer task, not something editors do in Studio.

## Documentation

| Document | Audience |
|----------|----------|
| [DEVELOPER.md](DEVELOPER.md) | Local setup, page sync, backups, GitHub Pages, CORS, deployment |
| [studio-sdv-site/README.md](studio-sdv-site/README.md) | Studio commands, schema, Presentation preview |

## Quick start (developers)

**Site** — from the repo root:

```bash
python -m http.server 3000
```

**Studio** — requires Node.js 22.12+:

```bash
cd studio-sdv-site
npm install
npm run dev
```

Open `http://localhost:3333` for Studio, `http://localhost:3000` for the site.

See [DEVELOPER.md](DEVELOPER.md) for CORS, backups, GitHub Pages, and the full workflow.
