import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');
const outDir    = path.join(rootDir, 'dist-admin');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Admin app needs: admin-app/, core/, css/, js/ (testBuilder etc.), icons/
const assets = ['admin-app', 'core', 'css', 'js', 'icons'];
for (const asset of assets) {
  const src = path.join(rootDir, asset);
  if (existsSync(src)) cpSync(src, path.join(outDir, asset), { recursive: true });
}

// Root index.html → redirect to admin-app
writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta http-equiv="refresh" content="0;url=admin-app/admin.html"/>
<title>TeachingBoard Admin</title>
</head><body></body></html>`);

for (const f of ['sw.js']) {
  const src = path.join(rootDir, f);
  if (existsSync(src)) cpSync(src, path.join(outDir, f));
}

cpSync(
  path.join(rootDir, 'admin-app', 'manifest.json'),
  path.join(outDir, 'manifest.json')
);

console.log('✅ dist-admin/ ready');
