#!/bin/bash
# build_release.sh — build official Flowa Axure Plugin release packages.
#
# Outputs:
#   dist/releases/Flowa-Axure-Plugin-1.0.0-win-x64-setup.exe
#   dist/releases/Flowa-Axure-Plugin-1.0.0-win-x64-portable.zip
#   dist/releases/Flowa-Axure-Plugin-1.0.0-mac-x64.dmg
#   dist/releases/Flowa-Axure-Plugin-1.0.0-mac-arm64.dmg
#   dist/releases/Flowa-Axure-Plugin-1.0.0-mac-x64.zip
#   dist/releases/Flowa-Axure-Plugin-1.0.0-mac-arm64.zip

set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="Flowa Axure Plugin"
VERSION="$(node -p "require('./package.json').version")"
RELEASE_DIR="dist/releases"

export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"

echo ""
echo "[Flowa Axure Plugin - Build Official Release]"
echo ""

if [ ! -d "node_modules" ]; then
  echo "[1/5] Installing dependencies..."
  npm install
else
  echo "[1/5] Dependencies OK"
fi

echo "[2/5] Cleaning old release artifacts..."
rm -rf dist/mac dist/win "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

echo "[3/5] Building macOS .app bundles..."
npx electron-builder --mac --x64 --arm64 --dir --config.directories.output=dist/mac

echo "[4/5] Packaging macOS DMG + ZIP..."
hdiutil create -volname "$APP_NAME" -srcfolder "dist/mac/mac/$APP_NAME.app" -ov -format UDZO "$RELEASE_DIR/Flowa-Axure-Plugin-$VERSION-mac-x64.dmg"
hdiutil create -volname "$APP_NAME" -srcfolder "dist/mac/mac-arm64/$APP_NAME.app" -ov -format UDZO "$RELEASE_DIR/Flowa-Axure-Plugin-$VERSION-mac-arm64.dmg"
ditto -c -k --sequesterRsrc --keepParent "dist/mac/mac/$APP_NAME.app" "$RELEASE_DIR/Flowa-Axure-Plugin-$VERSION-mac-x64.zip"
ditto -c -k --sequesterRsrc --keepParent "dist/mac/mac-arm64/$APP_NAME.app" "$RELEASE_DIR/Flowa-Axure-Plugin-$VERSION-mac-arm64.zip"

echo "[5/5] Building Windows NSIS installer..."
npx electron-builder --win nsis --x64 --config.directories.output=dist/win
cp "dist/win/$APP_NAME Setup $VERSION.exe" "$RELEASE_DIR/Flowa-Axure-Plugin-$VERSION-win-x64-setup.exe"
(cd dist/win && zip -qr "../releases/Flowa-Axure-Plugin-$VERSION-win-x64-portable.zip" win-unpacked)

echo ""
echo "[Checksums]"
(cd "$RELEASE_DIR" && shasum -a 256 * | tee SHA256SUMS.txt)

echo ""
echo "[Release files]"
ls -lh "$RELEASE_DIR"
echo ""
