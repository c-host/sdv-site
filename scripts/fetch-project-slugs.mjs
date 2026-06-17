import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOME_JSON_PATH = path.join(ROOT, 'content', 'home.json');

const SANITY_PROJECT_ID = 'mei3zxrq';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2025-02-19';

const SLUGS_GROQ =
  '*[_type == "project" && defined(slug)]{"slug": coalesce(slug.current, slug)}.slug | order(@ asc)';

export async function fetchProjectSlugsFromSanity() {
  const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SLUGS_GROQ }),
  });
  if (!res.ok) {
    throw new Error(`Sanity query failed (${res.status})`);
  }
  const json = await res.json();
  const slugs = Array.isArray(json.result)
    ? json.result.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  return slugs;
}

export async function fetchProjectSlugsFromHomeJson() {
  try {
    const home = JSON.parse(await fs.readFile(HOME_JSON_PATH, 'utf8'));
    const projects = Array.isArray(home.projects) ? home.projects : [];
    return projects
      .map((p) => (p && p.slug ? String(p.slug).trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {{ sanityOnly?: boolean }} [opts]
 *   sanityOnly — for CI/automation: require Sanity API; never fall back to home.json.
 */
export async function resolveProjectSlugs(opts = {}) {
  const sanityOnly = Boolean(opts.sanityOnly || process.env.SDV_SYNC_SANITY_ONLY === '1');

  try {
    const slugs = await fetchProjectSlugsFromSanity();
    if (slugs.length) return slugs;
    if (sanityOnly) {
      throw new Error('Sanity returned no project slugs');
    }
  } catch (err) {
    if (sanityOnly) throw err;
    console.warn('Sanity slug fetch failed:', err.message || err);
  }

  const fallback = await fetchProjectSlugsFromHomeJson();
  if (fallback.length) {
    console.warn('Using slugs from content/home.json');
    return fallback;
  }
  throw new Error('No project slugs found (Sanity unreachable and home.json empty)');
}
