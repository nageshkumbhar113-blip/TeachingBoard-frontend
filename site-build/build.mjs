// Vercel build step (vercel.json → buildCommand): reads the published exams from the backend
// and writes the static pages next to the app:
//   /index.html (the master landing page, tabs by level) · /exams/index.html · /exams/<slug>/index.html
//   /sitemap.xml · /robots.txt
// If the backend cannot be reached (Render asleep / down) after a few minutes the build FAILS on
// purpose — Vercel then keeps the previous deployment live, so the site never goes empty.
// Local try-out: SITE_DATA=path/to/exams.json node site-build/build.mjs  (writes into ./site-out unless OUT_DIR=.)
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { examPage, hubPage, landingPage, sitemap, robots } from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT_DIR ? join(ROOT, process.env.OUT_DIR) : (process.env.VERCEL ? ROOT : join(ROOT, 'site-out'));
const API = (process.env.SITE_API || 'https://teachingboard-backend.onrender.com/api').replace(/\/$/, '');

async function load() {
  if (process.env.SITE_DATA) return JSON.parse(await readFile(process.env.SITE_DATA, 'utf8'));
  let last = '';
  for (let i = 1; i <= 8; i++) {   // Render's free plan can take ~1 minute to wake up
    try {
      const r = await fetch(`${API}/site/exams`, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'nkseduorbit-site-build' } });
      if (r.ok) { const j = await r.json(); if (j && j.success && Array.isArray(j.exams)) return j; last = 'bad body'; }
      else last = `HTTP ${r.status}`;
    } catch (e) { last = e.message; }
    console.log(`[site] backend try ${i}/8 failed (${last}) — waiting`);
    await new Promise(res => setTimeout(res, 15000));
  }
  throw new Error(`backend not reachable: ${last}`);
}

const slugOk = s => /^[a-z0-9][a-z0-9-]{1,38}$/.test(String(s || ''));

async function main() {
  const data = await load();
  const exams = (data.exams || []).filter(e => slugOk(e.slug) && e.name);
  console.log(`[site] ${exams.length} published exams → ${OUT}`);
  await mkdir(OUT, { recursive: true });
  if (OUT === ROOT) await rm(join(OUT, 'exams'), { recursive: true, force: true });
  for (const e of exams) {
    await mkdir(join(OUT, 'exams', e.slug), { recursive: true });
    await writeFile(join(OUT, 'exams', e.slug, 'index.html'), examPage(e));
  }
  await mkdir(join(OUT, 'exams'), { recursive: true });
  await writeFile(join(OUT, 'exams', 'index.html'), hubPage(exams));
  // the master page replaces the old "/ → /student-app/" redirect only when there is something to show
  if (exams.length) await writeFile(join(OUT, 'index.html'), landingPage(exams));
  await writeFile(join(OUT, 'sitemap.xml'), sitemap(exams));
  await writeFile(join(OUT, 'robots.txt'), robots());
  console.log('[site] done');
}

main().catch(err => {
  console.error('[site] build failed:', err.message);
  // SITE_SOFT=1 (Vercel env) deploys the app anyway, without fresh exam pages — only for an urgent app fix while the backend is down
  process.exit(process.env.SITE_SOFT === '1' ? 0 : 1);
});
