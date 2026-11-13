// dist-team/ for the NKs Team app (CRM only): team-app/, icons/, env.js
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'dist-team');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const asset of ['team-app', 'icons']) {
  const src = path.join(rootDir, asset);
  if (existsSync(src)) cpSync(src, path.join(outDir, asset), { recursive: true });
}
cpSync(path.join(rootDir, 'env.js'), path.join(outDir, 'env.js'));
// the root opens the app (a JS redirect — meta-refresh crashes the Android WebView)
writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>NKs Team</title>
<script>window.location.replace('team-app/index.html');</script>
</head><body></body></html>`);
console.log('✅ dist-team/ ready');
