import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProjectSlugs } from './fetch-project-slugs.mjs';
import { parseArgvFlags, pruneStaleSlugDirs, writeSlugPages } from './sync-page-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'immersive');
const TEMPLATE_PATH = path.join(BASE_DIR, 'template.html');

async function main() {
  const { slugFilter, prune, sanityOnly } = parseArgvFlags(process.argv.slice(2));

  let template;
  try {
    template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  } catch {
    console.error('Missing template: immersive/template.html');
    process.exit(1);
  }

  const slugs = await resolveProjectSlugs({ sanityOnly });
  const targets = slugFilter ? slugs.filter((s) => s === slugFilter) : slugs;

  if (slugFilter && !targets.length) {
    console.error('Slug not found: ' + slugFilter);
    process.exit(1);
  }

  if (prune && !slugFilter) {
    await pruneStaleSlugDirs(BASE_DIR, slugs);
  }

  await writeSlugPages({ baseDir: BASE_DIR, template, slugs: targets, label: 'immersive' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
