// Makes sure android/app/build.gradle has the Google Play Install Referrer dependency that
// android-student/InstallReferrerPlugin.java needs. build.gradle lives in the gitignored android/
// folder, so this runs from build-student.bat on every build (safe to run repeatedly).
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'android/app/build.gradle';
let text = readFileSync(file, 'utf8');
if (text.includes('com.android.installreferrer:installreferrer')) {
  console.log('  Install Referrer dependency already present');
  process.exit(0);
}
const anchor = /(\r?\n)(\s*)implementation project\(':capacitor-android'\)/;
if (!anchor.test(text)) {
  console.error(`ERROR: could not find the capacitor-android dependency line in ${file}`);
  process.exit(1);
}
text = text.replace(anchor, (_m, nl, indent) =>
  `${nl}${indent}// Google Play install referrer (teacher / friend code from the share link) - see InstallReferrerPlugin.java` +
  `${nl}${indent}implementation "com.android.installreferrer:installreferrer:2.2"` +
  `${nl}${indent}implementation project(':capacitor-android')`);
writeFileSync(file, text, 'utf8');
console.log('  Install Referrer dependency added');
