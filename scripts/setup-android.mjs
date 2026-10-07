// Run once after `npx cap add android` (npm run android:init does both).
// - adds notification + backup-folder permissions to AndroidManifest.xml (no SMS permissions)
// - sets target SDK 36 + release signing
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = path.join(root, 'android/app');
if (!fs.existsSync(app)) {
  console.error('android/ folder not found. Run: npx cap add android');
  process.exit(1);
}

const manifestPath = path.join(app, 'src/main/AndroidManifest.xml');
let m = fs.readFileSync(manifestPath, 'utf8');
// No SMS permissions: Kharcha only parses SMS text the user pastes.
const perms = ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'];
for (const p of perms) {
  if (!m.includes(p)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}
// Daily auto-backup writes to Documents/Kharcha: old Android (9 and below) needs storage permission, Android 10 needs legacy storage.
if (!m.includes('WRITE_EXTERNAL_STORAGE')) {
  m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>');
}
if (!m.includes('requestLegacyExternalStorage')) m = m.replace('<application', '<application android:requestLegacyExternalStorage="true"');
fs.writeFileSync(manifestPath, m);
console.log('✓ notification + backup-folder permissions added to AndroidManifest.xml');

// ---- Build settings ----
// 1) Target Android 16 (API 36)
const vars = path.join(root, 'android/variables.gradle');
if (fs.existsSync(vars)) {
  let v = fs.readFileSync(vars, 'utf8');
  v = v.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36').replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36');
  fs.writeFileSync(vars, v);
  console.log('✓ compileSdk/targetSdk set to 36');
}
// 2) Release signing + version from environment (used by the Build APK workflow).
//    Signing every APK with the SAME key lets family members install updates over the old app without losing data.
const gradlePath = path.join(app, 'build.gradle');
let g = fs.readFileSync(gradlePath, 'utf8');
if (!g.includes('KHARCHA_SIGNING')) {
  g = g.replace(/versionCode\s+\d+/, 'versionCode (System.getenv("VERSION_CODE") ?: "1") as Integer')
       .replace(/versionName\s+"[^"]*"/, 'versionName System.getenv("VERSION_NAME") ?: "1.0.0"');
  g = g.replace(/android\s*\{/, `android {
    // KHARCHA_SIGNING: upload key comes from env vars (never commit the keystore)
    signingConfigs {
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }`);
  g = g.replace(/buildTypes\s*\{\s*release\s*\{/, 'buildTypes {\n        release {\n            signingConfig signingConfigs.release');
  fs.writeFileSync(gradlePath, g);
  console.log('✓ release signing + versionCode/versionName from env added');
}
console.log('\nDone. Next: npm run android:sync && npm run android:open');
