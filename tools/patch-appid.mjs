// Patches android/app/build.gradle applicationId.
// Called from build-admin.bat / build-student.bat as:
//   node tools/patch-appid.mjs <applicationId>
// Uses a real script file (not inline `node -e`) so cmd.exe quote/^ escaping
// can never corrupt the regex (the old inline patch silently failed, leaving
// the admin APK with the student applicationId).
import { readFileSync, writeFileSync } from 'node:fs';

const appId = process.argv[2];
if (!appId) {
  console.error('Usage: node tools/patch-appid.mjs <applicationId>');
  process.exit(1);
}

const file = 'android/app/build.gradle';
let text = readFileSync(file, 'utf8');
const re = /applicationId "[^"]+"/;
if (!re.test(text)) {
  console.error(`ERROR: applicationId not found in ${file} — nothing patched`);
  process.exit(1);
}
text = text.replace(re, `applicationId "${appId}"`);
writeFileSync(file, text, 'utf8');
console.log(`  patched: build.gradle applicationId=${appId}`);
