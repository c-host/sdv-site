# Sanity Studio — sdv-site

Content editor for the Stacey de Voe artist site. Built with [Sanity v6](https://www.sanity.io/docs).

## Requirements

- Node.js **22.12 or newer**
- npm

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Local Studio at `http://localhost:3333` |
| `npm run build` | Production build to `dist/` |
| `npm run deploy` | Deploy hosted Studio to `*.sanity.studio` |
| `npm run export:dataset` | Export `production` dataset + assets to `backups/` (see `docs/recovery.md`) |
| `npm run build:visual-editing` | Rebuild `../site/js/sanity-visual-editing.bundle.js` for Presentation preview |

## Studio structure

Sidebar sections (see `structure.ts`):

- **Home page** — which projects appear on the home nav and in what order
- **Info page** — bio text for the home INFO panel
- **Typography** — site-wide font roles (base UI, prose, headings)
- **Materials** — catalog of material types and icons
- **Font files** — uploaded font assets for custom typography
- **Projects** — one document per artwork/project

Plugins enabled: **Structure**, **Presentation** (live preview). Vision, releases, and scheduled drafts are disabled.

## Configuration

| File | Role |
|------|------|
| `sanity.config.ts` | Project ID, dataset, plugins, Presentation routes |
| `sanity.cli.ts` | CLI project ID for deploy/build |

### CORS vs Presentation (two different settings)

| Setting | Where | What it does |
|---------|--------|----------------|
| **CORS origins** | [sanity.io/manage](https://sanity.io/manage) → API | Lets the **browser** on your site call the Sanity API |
| **Presentation preview URL** | `sanity.config.ts` defaults (or optional env) | Tells Studio **which site URL** to load in the Presentation iframe |

You configure CORS in Sanity. You do **not** need a `.env` file for that.

**No `.env` required for local dev.** `sanity.config.ts` defaults Presentation to `http://127.0.0.1:3000`.

Optional overrides (only when needed):

| Variable | When |
|----------|------|
| `SANITY_STUDIO_PREVIEW_ORIGIN` | Optional override for Presentation preview URL (e.g. a custom domain). Defaults: production site when deployed, `http://127.0.0.1:3000` when running `npm run dev`. |
| `SANITY_AUTH_TOKEN` | CLI export/import or GitHub Actions backups — **shell or GitHub secret**, never `SANITY_STUDIO_*` |

**Automated backups:** GitHub → Settings → Secrets → `SANITY_AUTH_TOKEN` (Viewer role). See `docs/recovery.md`.

## Local development

**Terminal 1 — static site** (serve `site/` from the repo root):

```bash
python -m http.server 3000 --directory site
```

**Terminal 2 — Studio:**

```bash
cd sanity-studio
npm run dev
```

Open `http://localhost:3333` for Structure editing, or **Presentation** for live preview against `http://127.0.0.1:3000`.

**One-time Sanity CORS** ([sanity.io/manage](https://sanity.io/manage) → API → CORS origins):

- `http://localhost:3000`
- `http://127.0.0.1:3000`

**CLI with a token** (export/backup — not needed for normal editing):

```bash
# PowerShell
$env:SANITY_AUTH_TOKEN="your-token"
npm run export:dataset
```

A **Viewer** token is sufficient for export/backup.

Presentation previews **published** content against the static site. No `.env` is required for that.

**Draft preview** (unpublished changes before Publish) is not supported on a pure static host (`python -m http.server`). Sanity’s official flow uses server-side [`previewMode` endpoints](https://www.sanity.io/docs/visual-editing/configuring-the-presentation-tool) and `@sanity/preview-url-secret`: the Presentation tool calls `/api/draft-mode/enable`, your server validates a one-time secret, sets an HttpOnly cookie, and fetches drafts with a **server-only** read token (`SANITY_API_READ_TOKEN` — never in the browser). See [Implementing draft mode](https://www.sanity.io/docs/visual-editing/implementing-draft-mode).

For this repo: edit in Presentation or Structure, **Publish**, then the preview reflects changes. Click-to-edit overlays work on published content in the iframe.

If Presentation fails to connect, run `npm run build:visual-editing` and commit `site/js/sanity-visual-editing.bundle.js`.

## Schema overview

| Type | Document ID | Purpose |
|------|-------------|---------|
| `homePage` | `homePageConfig` | Ordered home nav entries |
| `info` | `infoPage` | Bio / INFO panel |
| `siteTypography` | `siteTypography` | Font role assignments |
| `siteMaterials` | `siteMaterials` | Material type catalog |
| `fontUpload` | (many) | Font file uploads |
| `project` | `project-{slug}` | Project content, timeline, publication tab |

Project delete uses a custom action that removes the project from the home page config before deleting the document.

## Deploy hosted Studio

```bash
npm run deploy
```

Choose a hostname under `*.sanity.studio` (e.g. `sdv-site.sanity.studio`). Share this URL with the client for day-to-day editing.

After the client owns their Sanity project, update `projectId` and `dataset` in `sanity.config.ts` and `sanity.cli.ts`, then deploy again.

## Developer notes

- Schema types live in `schemaTypes/`.
- Custom inputs: `components/MaterialIconInput.tsx`, `MaterialKeyInput.tsx`, etc.
- `data/materials.json` — default material catalog for schema; live catalog is edited in Sanity **Materials**.
- `docs/recovery.md` — backup and restore (Sanity dataset export/import).
- Do not commit `node_modules/`, `dist/`, `backups/`, or `.env`.
