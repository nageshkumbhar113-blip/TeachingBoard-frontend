import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');
const outDir    = path.join(rootDir, 'dist-student');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Student app needs: student-app/, core/, css/, icons/
const assets = ['student-app', 'core', 'css', 'icons'];
for (const asset of assets) {
  const src = path.join(rootDir, asset);
  if (existsSync(src)) cpSync(src, path.join(outDir, asset), { recursive: true });
}

// Root index.html → redirect to student-app
writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta http-equiv="refresh" content="0;url=student-app/"/>
<title>TeachingBoard Student</title>
</head><body></body></html>`);

// Copy sw.js and manifest
for (const f of ['sw.js']) {
  const src = path.join(rootDir, f);
  if (existsSync(src)) cpSync(src, path.join(outDir, f));
}

// Student manifest
cpSync(
  path.join(rootDir, 'student-app', 'manifest.json'),
  path.join(outDir, 'manifest.json')
);

console.log('✅ dist-student/ ready');
