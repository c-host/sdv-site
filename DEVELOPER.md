# Developer guide

Technical reference for maintaining the Stacey de Voe artist site. For a high-level overview, see [README.md](README.md). For Studio-specific commands and schema, see [sanity-studio/README.md](sanity-studio/README.md).

## Repository layout

| Path | Purpose |
|------|---------|
| `site/` | **The deployed website.** Cloudflare Pages serves this folder (and nothing else). |
| `site/index.html` | Home page |
| `site/shell/project.html` | Project page shell, served for every `/project/<slug>/` URL (content from Sanity) |
| `site/shell/immersive.html` | Immersive viewer shell, served for every `/immersive/<slug>/` URL (publication-tab images) |
| `site/_worker.js` | Cloudflare Pages routing — serves shells for `/project/*` and `/immersive/*` before static assets |
| `site/css/`, `site/js/` | Styles and front-end behaviour |
| `site/js/content-loader.js` | Fetches Sanity content and updates the DOM |
| `site/js/sanity-visual-editing.bundle.js` | Built bundle for Studio Presentation preview |
| `sanity-studio/` | Sanity Studio (schema, editor UI, deploy) — **not** part of the deployed site |
| `.github/workflows/` | GitHub Actions (automated Sanity backups) |

## How content flows

1. Editor publishes in Sanity Studio.
2. Visitor opens the site; `content-loader.js` fetches published documents from Sanity.
3. If Sanity is unreachable, the site shows minimal built-in offline fallbacks (home nav only).

**New or removed projects need no developer action.** Cloudflare Pages serves the shared shell for any `/project/<slug>/` or `/immersive/<slug>/` URL (via `site/_worker.js`), and `content-loader.js` loads the matching project from Sanity by slug at runtime. Adding a project in Sanity makes its page live; deleting it makes the page show a "not found" message.

All live content lives in Sanity.

## Hosting and routing

The site is hosted on **Cloudflare Pages** with **no build step** — Cloudflare serves the `site/` folder directly (Build output directory = `site`, Build command = empty). Because only `site/` is published, the Studio source, scripts, and docs are never exposed on the live site. `site/_worker.js` serves the shared shells for `/project/*` and `/immersive/*` before static assets, so per-slug HTML folders are not needed.

There is no repo-root `package.json` and nothing to `npm install` at the root. Studio dependencies live in `sanity-studio/package.json`.

## Local development

### Static site (home page only)

Serve the `site/` folder from the repo root:

```bash
python -m http.server 3000 --directory site
```

Open `http://localhost:3000`. The home page works as-is.

> **Note:** `site/_worker.js` only runs on Cloudflare Pages (or Wrangler locally). With `python -m http.server`, `/project/<slug>/` and `/immersive/<slug>/` URLs **404**.

### Full local routing (project + immersive pages)

To test project and immersive pages with **live Sanity content** (required for styling/layout work), run the local dev server from the **repo root**. It mirrors `site/_worker.js` routing (no Sanity sync, no generated files):

```bash
npm run dev:site
```

Or with a custom port:

```bash
node scripts/dev-server.mjs --port 3099
```

Then open e.g. `http://127.0.0.1:3000/project/overlocked/` or `/immersive/overlocked/`.

Content is fetched from Sanity at runtime, exactly as on the live site. Requires **Node.js 18+** (no extra dependencies).

**Optional — Wrangler** (runs `_worker.js` via Cloudflare's local runtime; requires **Node.js 22+**):

```bash
npm run dev:site:wrangler
```

If Wrangler fails on Windows (workerd crash) or reports an unsupported Node version, use `npm run dev:site` instead.

**Two-terminal workflow** (site + Studio Presentation preview):

```bash
# Terminal 1 — site with full routing
npm run dev:site

# Terminal 2 — Studio (requires Node.js 22.12+)
cd sanity-studio && npm run dev
```

Add `http://127.0.0.1:3000` and `http://localhost:3000` to Sanity CORS (see below). Studio Presentation preview defaults to `http://127.0.0.1:3000` when running `npm run dev`.

Alternative: push a branch and use a **Cloudflare Pages preview deploy** URL, or test against `https://sdv-site.pages.dev` directly (requires deploying site changes first).

### Sanity Studio

Requires **Node.js 22.12+**.

```bash
cd sanity-studio
npm install
npm run dev
```

Studio runs at `http://localhost:3333`.

### CORS

In [sanity.io/manage](https://sanity.io/manage) → your project → **API** → **CORS origins**, allow:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- Your production site URL (`https://sdv-site.pages.dev`, plus any custom domain once configured)

Enable **Allow credentials** for each origin. Without CORS, the browser blocks API requests and the site falls back to offline content.

## Adding and removing projects

No developer action is required. Cloudflare Pages serves the shared shell for every `/project/<slug>/` and `/immersive/<slug>/` URL (see `site/_worker.js`), and `content-loader.js` resolves the slug against Sanity at runtime:

- **Add a project** in Sanity → its page is immediately live at `/project/<slug>/`.
- **Delete a project** in Sanity → its page shows a "not found" message.
- **Change a slug** → the new URL works immediately; the old URL shows "not found".

## Backup and recovery

Live content (text, images, projects, home order) lives only in the Sanity `production` dataset. **Sanity dataset export** is the canonical backup. Site code is backed up by Git.

### Automated backups (GitHub Actions)

Workflow: **Backup Sanity dataset** (`.github/workflows/backup-sanity-dataset.yml`)

| Schedule | What |
|----------|------|
| Nightly | Documents only |
| Weekly | Documents **and** assets (images, fonts) |
| Manual | **Actions → Backup Sanity dataset → Run workflow** (toggle assets if needed) |

**One-time setup:** GitHub repo → **Settings → Secrets → Actions** → add `SANITY_AUTH_TOKEN` (Sanity **Viewer** token from [sanity.io/manage](https://sanity.io/manage) → API → Tokens).

Download backups from the workflow run’s **Artifacts** section (retained 30 days). Store important exports elsewhere if you need longer retention.

### Manual backup (local)

From `sanity-studio/` with a token that can read the dataset:

```bash
# PowerShell
$env:SANITY_AUTH_TOKEN="your-viewer-token"
npm run export:dataset
```

This writes `sanity-studio/backups/sanity-production-YYYY-MM-DD.tar.gz` with assets included. The `backups/` folder is gitignored.

Or directly:

```bash
mkdir -p backups
npx sanity dataset export production backups/sanity-production-$(Get-Date -Format yyyyMMdd).tar.gz --assets
```

Run before schema changes, before handoff, and periodically on request.

### Restore from a backup

**Warning:** import **replaces** the target dataset. Test on a copy dataset first if unsure.

```bash
cd sanity-studio
# PowerShell — use an Editor or Admin token
$env:SANITY_AUTH_TOKEN="your-write-token"
npx sanity dataset import backups/sanity-production-YYYYMMDD.tar.gz production --replace
```

After restore, redeploy hosted Studio if needed (`npm run deploy` from `sanity-studio/`). The static site picks up published content on the next page load — no redeploy required for content-only changes.

More detail: [sanity-studio/docs/recovery.md](sanity-studio/docs/recovery.md).

## Sanity project configuration

The default project ID and dataset are set in:

- `sanity-studio/sanity.config.ts`
- `sanity-studio/sanity.cli.ts`
- `site/js/content-loader.js` (overridable via `window.SDV_SANITY_CONFIG` before scripts load)

When pointing the site at a different Sanity project, update these IDs and redeploy Studio.

## Rebuild visual-editing bundle

After upgrading `@sanity/visual-editing` in `sanity-studio`:

```bash
cd sanity-studio
npm run build:visual-editing
```

Commit the updated `site/js/sanity-visual-editing.bundle.js`.

## Deploying to Cloudflare Pages

The site is connected to Cloudflare Pages with **no build step**: it serves the `site/` folder. Pushing to the production branch on GitHub triggers an automatic deploy.

Cloudflare Pages settings (**Settings → Builds & deployments**):

- **Build command:** *(empty)*
- **Build output directory:** `site`
- `site/_worker.js` handles `/project/*` and `/immersive/*` routing.

Add the live URL to Sanity CORS (see above): `https://sdv-site.pages.dev`, plus any custom domain once configured. Path resolution at the domain root is automatic via `site/js/sdv-shared.js`.

For Studio **Presentation** preview against the live site, redeploy hosted Studio after config changes:

```bash
cd sanity-studio
npm run deploy
```

Hosted Studio previews `https://sdv-site.pages.dev` by default (`sanity.config.ts`). Local `npm run dev` previews `http://127.0.0.1:3000` automatically. Override with `SANITY_STUDIO_PREVIEW_ORIGIN` when testing a custom domain.

## Do not delete

- `site/shell/project.html`, `site/shell/immersive.html` — HTML shells served for every project/immersive URL
- `site/_worker.js` — without it, `/project/<slug>/` and `/immersive/<slug>/` URLs return 404 on Cloudflare Pages

Generated folders not to commit: `sanity-studio/node_modules/`, `sanity-studio/dist/`, `sanity-studio/backups/`.
