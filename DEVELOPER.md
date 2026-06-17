# Developer guide

Technical reference for maintaining the Stacey de Voe artist site. For a high-level overview, see [README.md](README.md). For Studio-specific commands and schema, see [studio-sdv-site/README.md](studio-sdv-site/README.md).

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | Home page |
| `project/{slug}/index.html` | Project page shell (content from Sanity) |
| `immersive/{slug}/index.html` | Immersive viewer shell (publication-tab images) |
| `css/`, `js/` | Styles and front-end behaviour |
| `js/content-loader.js` | Fetches Sanity content and updates the DOM |
| `js/sanity-visual-editing.bundle.js` | Built bundle for Studio Presentation preview |
| `studio-sdv-site/` | Sanity Studio (schema, editor UI, deploy) |
| `scripts/` | Page sync — creates/removes `project/` and `immersive/` folders from Sanity slugs |
| `.github/workflows/` | GitHub Actions (page sync, automated Sanity backups) |
| `package.json` | Root npm scripts for page sync (see below) |

## How content flows

1. Editor publishes in Sanity Studio.
2. Visitor opens the site; `content-loader.js` fetches published documents from Sanity.
3. If Sanity is unreachable, the site shows minimal built-in offline fallbacks (home nav only).

**New or removed projects** need an extra step: run page sync so GitHub Pages has matching folders (see below). Day-to-day text and image edits do not.

All live content lives in Sanity.

## Root `package.json`

The repo root has a small `package.json` with **no dependencies** — it exists so you can run maintenance scripts from the repo root without `cd` into `studio-sdv-site/`.

| Script | What it does |
|--------|----------------|
| `npm run sync:pages` | Reads project slugs from Sanity and syncs `project/{slug}/` and `immersive/{slug}/` HTML shells from templates. Removes folders for deleted slugs. |
| `npm run sync:pages:ci` | Same sync, Sanity-only mode (used by the GitHub Actions workflow). |

Requires Node.js and network access to Sanity. The same `sync:pages` script is also available from `studio-sdv-site/` (`npm run sync:pages` there calls the same files).

You do **not** need `npm install` at the repo root — there are no packages to install. Studio dependencies live in `studio-sdv-site/package.json`.

## Local development

### Static site

From the repo root:

```bash
python -m http.server 3000
```

Open `http://localhost:3000`.

### Sanity Studio

Requires **Node.js 22.12+**.

```bash
cd studio-sdv-site
npm install
npm run dev
```

Studio runs at `http://localhost:3333`.

### CORS

In [sanity.io/manage](https://sanity.io/manage) → your project → **API** → **CORS origins**, allow:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- Your production site URL (e.g. `https://c-host.github.io` for GitHub Pages)

Enable **Allow credentials** for each origin. Without CORS, the browser blocks API requests and the site falls back to offline content.

## Sync project page shells

When a project is **added**, **removed**, or its **URL slug** changes:

```bash
npm run sync:pages
```

(Run from the repo root, or `npm run sync:pages` from `studio-sdv-site/`.)

This writes `project/{slug}/index.html` and `immersive/{slug}/index.html` from templates and removes folders for deleted slugs.

**CI:** GitHub Actions workflow **Sync Sanity pages** (`.github/workflows/sync-sanity-pages.yml`) runs the same sync and commits changes. Trigger manually from **Actions → Sync Sanity pages → Run workflow**, or via an optional Sanity webhook (documented in the workflow file).

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

From `studio-sdv-site/` with a token that can read the dataset:

```bash
# PowerShell
$env:SANITY_AUTH_TOKEN="your-viewer-token"
npm run export:dataset
```

This writes `studio-sdv-site/backups/sanity-production-YYYY-MM-DD.tar.gz` with assets included. The `backups/` folder is gitignored.

Or directly:

```bash
mkdir -p backups
npx sanity dataset export production backups/sanity-production-$(Get-Date -Format yyyyMMdd).tar.gz --assets
```

Run before schema changes, before handoff, and periodically on request.

### Restore from a backup

**Warning:** import **replaces** the target dataset. Test on a copy dataset first if unsure.

```bash
cd studio-sdv-site
# PowerShell — use an Editor or Admin token
$env:SANITY_AUTH_TOKEN="your-write-token"
npx sanity dataset import backups/sanity-production-YYYYMMDD.tar.gz production --replace
```

After restore, redeploy hosted Studio if needed (`npm run deploy` from `studio-sdv-site/`). The static site picks up published content on the next page load — no redeploy required for content-only changes.

More detail: [studio-sdv-site/docs/recovery.md](studio-sdv-site/docs/recovery.md).

## Sanity project configuration

The default project ID and dataset are set in:

- `studio-sdv-site/sanity.config.ts`
- `studio-sdv-site/sanity.cli.ts`
- `js/content-loader.js` (overridable via `window.SDV_SANITY_CONFIG` before scripts load)
- `scripts/fetch-project-slugs.mjs`

After the creating Sanity project, update these IDs and redeploy Studio.

## Rebuild visual-editing bundle

After upgrading `@sanity/visual-editing` in `studio-sdv-site`:

```bash
cd studio-sdv-site
npm run build:visual-editing
```

Commit the updated `js/sanity-visual-editing.bundle.js`.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source:** Deploy from branch `main`, folder `/ (root)`.
3. Add the Pages URL to Sanity CORS (see above).
4. Site URL will be `https://<user>.github.io/<repo-name>/` (e.g. `https://c-host.github.io/sdv-site/`). Path resolution is automatic via `js/sdv-shared.js`.

For Studio **Presentation** preview against the live site, redeploy hosted Studio with the Pages URL:

```bash
cd studio-sdv-site
$env:SANITY_STUDIO_PREVIEW_ORIGIN="https://c-host.github.io/sdv-site"
npm run deploy
```

## Do not delete

- `project/template.html`, `immersive/template.html`
- Synced `project/{slug}/` and `immersive/{slug}/` folders (unless page sync has pruned them)

Generated folders not to commit: `studio-sdv-site/node_modules/`, `studio-sdv-site/dist/`, `studio-sdv-site/backups/`.
