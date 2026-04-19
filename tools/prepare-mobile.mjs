import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-mobile');

const assets = [
  'admin-app',
  'student-app',
  'core',
  'css',
  'icons',
  'admin.html',
  'index.html',
  'manifest.json',
  'sw.js'
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const asset of assets) {
  const source = path.join(rootDir, asset);
  const target = path.join(outDir, asset);
  if (!existsSync(source)) continue;
  cpSync(source, target, { recursive: true });
}

console.log(`Prepared mobile web assets in ${outDir}`);
