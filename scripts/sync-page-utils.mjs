import fs from 'node:fs/promises';
import path from 'node:path';

export function parseSlugFilter(argv) {
  const arg = argv.find((a) => a.startsWith('--slug='));
  if (!arg) return null;
  const slug = arg.slice('--slug='.length).trim();
  return slug || null;
}

export function parseArgvFlags(argv) {
  return {
    slugFilter: parseSlugFilter(argv),
    prune: argv.includes('--prune'),
    sanityOnly: argv.includes('--sanity-only'),
  };
}

/** Remove project/immersive subfolders that no longer exist in Sanity. */
export async function pruneStaleSlugDirs(baseDir, activeSlugs) {
  let entries;
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch {
    return;
  }

  const active = new Set(activeSlugs);
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (active.has(ent.name)) continue;
    const dir = path.join(baseDir, ent.name);
    await fs.rm(dir, { recursive: true, force: true });
    console.log('removed ' + path.relative(process.cwd(), dir) + '/');
  }
}

export async function writeSlugPages({ baseDir, template, slugs, label }) {
  for (const slug of slugs) {
    const dir = path.join(baseDir, slug);
    await fs.mkdir(dir, { recursive: true });
    const out = path.join(dir, 'index.html');
    await fs.writeFile(out, template);
    console.log('wrote ' + label + '/' + slug + '/index.html');
  }
}
