// Makes sure android/app/build.gradle has the Google Play dependencies that the student app's own
// plugins need: Install Referrer (android-student/InstallReferrerPlugin.java) and Play services
// auth for Phone Number Hint (android-student/PhoneHintPlugin.java). build.gradle lives in the
// gitignored android/ folder, so this runs from build-student.bat on every build (safe to repeat).
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'android/app/build.gradle';
let text = readFileSync(file, 'utf8');

const deps = [
  ['com.android.installreferrer:installreferrer', 'implementation "com.android.installreferrer:installreferrer:2.2"',
    '// Google Play install referrer (teacher / friend code from the share link) - see InstallReferrerPlugin.java'],
  ['com.google.android.gms:play-services-auth', 'implementation "com.google.android.gms:play-services-auth:21.2.0"',
    '// Phone Number Hint (parent mobile without typing) - see PhoneHintPlugin.java'],
];

const anchor = /(\r?\n)(\s*)implementation project\(':capacitor-android'\)/;
let changed = false;
for (const [key, line, comment] of deps) {
  if (text.includes(key)) { console.log(`  ${key} already present`); continue; }
  if (!anchor.test(text)) {
    console.error(`ERROR: could not find the capacitor-android dependency line in ${file}`);
    process.exit(1);
  }
  text = text.replace(anchor, (_m, nl, indent) =>
    `${nl}${indent}${comment}${nl}${indent}${line}${nl}${indent}implementation project(':capacitor-android')`);
  console.log(`  ${key} added`);
  changed = true;
}
if (changed) writeFileSync(file, text, 'utf8');
