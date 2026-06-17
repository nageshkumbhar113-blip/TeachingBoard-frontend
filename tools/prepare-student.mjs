import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');
const outDir    = path.join(rootDir, 'dist-student');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Student app needs: student-app/, core/, css/, icons/, js/
const assets = ['student-app', 'core', 'css', 'icons', 'js'];
for (const asset of assets) {
  const src = path.join(rootDir, asset);
  if (existsSync(src)) cpSync(src, path.join(outDir, asset), { recursive: true });
}

// Root index.html → JS redirect (meta-refresh crashes Capacitor Android WebView)
writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>TeachingBoard Student</title>
<script>window.location.replace('student-app/index.html');</script>
</head><body></body></html>`);

// Copy sw.js, env.js and manifest
for (const f of ['sw.js', 'env.js']) {
  const src = path.join(rootDir, f);
  if (existsSync(src)) cpSync(src, path.join(outDir, f));
}

// Student manifest
cpSync(
  path.join(rootDir, 'student-app', 'manifest.json'),
  path.join(outDir, 'manifest.json')
);

console.log('✅ dist-student/ ready');
