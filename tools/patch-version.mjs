// Patches env.js APP_VERSION + android/app/build.gradle versionCode/versionName.
// Called from build-admin.bat / build-student.bat as:
//   node tools/patch-version.mjs <version> <versionCode>
// Uses a real script file (not inline `node -e`) so cmd.exe quote/^ escaping
// can never corrupt the regex (that silently broke the old inline patch).
import { readFileSync, writeFileSync } from 'node:fs';

const [version, versionCode] = process.argv.slice(2);
if (!version || !versionCode) {
  console.error('Usage: node tools/patch-version.mjs <version> <versionCode>');
  process.exit(1);
}

function patchFile(file, edits) {
  let text = readFileSync(file, 'utf8');
  for (const { re, to, label } of edits) {
    if (!re.test(text)) {
      console.error(`ERROR: pattern not found in ${file} (${label}) — nothing patched`);
      process.exit(1);
    }
    text = text.replace(re, to);
  }
  writeFileSync(file, text, 'utf8');
}

patchFile('env.js', [
  { re: /APP_VERSION\s*=\s*'[^']+'/, to: `APP_VERSION = '${version}'`, label: 'APP_VERSION' },
]);

patchFile('android/app/build.gradle', [
  { re: /versionCode \d+/,        to: `versionCode ${versionCode}`, label: 'versionCode' },
  { re: /versionName "[^"]+"/,    to: `versionName "${version}"`,   label: 'versionName' },
]);

console.log(`  patched: env.js APP_VERSION + build.gradle versionName=${version}, versionCode=${versionCode}`);
