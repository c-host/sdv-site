# Backup and recovery

## What to back up

| Layer | Where it lives | Backup method |
|-------|----------------|---------------|
| **Live content** (text, images, projects, home order) | Sanity `production` dataset | **Sanity dataset export** (primary) |
| **Site code** (HTML, CSS, JS, Studio schema) | GitHub | `git` / GitHub |
| **Legacy seed files** (optional) | `content/` in repo | Git only — see below |

The live site and Studio read from **Sanity**, not from `content/`. After handoff, client edits exist only in Sanity.

## Primary backup: Sanity export

Use this for real recovery (restores what the client has published, including images).

## Automated backups (recommended)

This repo includes a GitHub Actions workflow that creates backups automatically and stores them as **workflow artifacts** (no commits, no repo noise).

- **Nightly**: dataset export (documents only)
- **Weekly**: dataset export **with assets**
- **Manual**: GitHub → Actions → **Backup Sanity dataset** → Run workflow (toggle assets if needed)

### Setup

In the GitHub repo, add a secret:

- `SANITY_AUTH_TOKEN`: a Sanity token with read access to the `production` dataset (Viewer is sufficient). Create it in `sanity.io/manage` → project → **API** → **Tokens**.

Backups can then be downloaded from the workflow run’s **Artifacts** section.

From `studio-sdv-site/` with a token that can read the dataset:

```bash
mkdir -p backups
npx sanity dataset export production backups/sanity-production-$(date +%Y%m%d).tar.gz --assets
```

Or use the npm script:

```bash
npm run export:dataset
```

**When to run:** before handoff, before schema changes, and periodically (e.g. quarterly) or on request.

**Restore** (destructive — replaces the target dataset):

```bash
npx sanity dataset import backups/sanity-production-YYYYMMDD.tar.gz production --replace
```

Requires `SANITY_AUTH_TOKEN` with write access. Test on a copy dataset first if unsure.

Store exports **outside the public repo** (local disk, private cloud, or a private GitHub repo). The `backups/` folder here is gitignored.

## Do not use `import:content` for recovery

`npm run import:content` reads stale markdown/JSON from `content/` and **replaces** documents in Sanity. That will **wipe client edits** made in Studio after the original seed.

Use `import:content` only to:

- Bootstrap a **new empty** dataset during initial setup, or
- Intentionally reset a **dev** dataset from legacy files

For production recovery, always use **dataset export/import**.

## Optional: `content/` as historical archive

You may keep `content/` (or rename to `content-recovery/`) as a snapshot of the **original** import source:

- `info.md`, `projects/*.md`, `home.json`
- Optional `images/` tree if you still have files used during first import

Treat it as **museum copy**, not a live backup. It will not match Sanity after the client edits anything.

If you archive images there, document that they are **import source only** — the live site serves images from `cdn.sanity.io`.

## Material catalog default

`studio-sdv-site/data/materials.json` is **not** live content. It seeds default material types for new `siteMaterials` documents and Studio picker fallbacks. The live catalog is edited in Studio under **Materials**.

## Handoff checklist

- [ ] Sanity dataset export with `--assets` stored safely
- [ ] GitHub repo pushed and ownership transferred
- [ ] Client knows Studio URL; developer has documented export commands
- [ ] (Optional) legacy `content/` archive retained or dropped — not required for the live site
