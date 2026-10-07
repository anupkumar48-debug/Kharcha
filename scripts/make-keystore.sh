#!/usr/bin/env bash
# Creates the signing key for Kharcha.apk (run ONCE, on your own computer; needs Java 17+).
# Every APK must be signed with this same key, or family members cannot update without uninstalling.
# Keep kharcha-upload.jks + passwords safe (password manager + a backup). Never commit it to git.
set -e
read -rsp "Choose a keystore password (min 6 chars): " PASS; echo
keytool -genkeypair -v -keystore kharcha-upload.jks -alias kharcha -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Kharcha, OU=Mobile, O=Kharcha, L=India, C=IN"
echo
echo "Created kharcha-upload.jks"
echo "Add these GitHub repo secrets (Settings > Secrets and variables > Actions):"
echo "  KEYSTORE_B64      = output of: base64 -w0 kharcha-upload.jks   (macOS: base64 -i kharcha-upload.jks)"
echo "  KEYSTORE_PASSWORD = the password you typed"
echo "  KEY_ALIAS         = kharcha"
echo "  KEY_PASSWORD      = the password you typed"
echo
echo "Done. Never lose this file: without it you cannot ship updates to the installed apps."
