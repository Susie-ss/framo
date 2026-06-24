#!/bin/bash
# build_mac.sh — macOS 原生构建 (需在 macOS 上运行)
set -e

echo ""
echo "[Axure Sync Plugin - Build macOS Release]"
echo ""

cd "$(dirname "$0")"

# 1. Clean manifest cache
if [ -f "manifest.json" ]; then
    echo "[1/4] Cleaning manifest cache..."
    rm -f manifest.json
fi

# 2. Dependencies
if [ ! -d "node_modules" ]; then
    echo "[2/4] Installing dependencies..."
    npm install
else
    echo "[2/4] Dependencies OK"
fi

# 3. Clean old build
echo "[Clean] Removing old macOS build..."
rm -rf dist/mac

# 4. Build — electron-builder auto-detects darwin platform
echo "[3/4] Building macOS DMG + ZIP (may take 3-5 mins)..."
export NODE_OPTIONS=""
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npx electron-builder --mac --x64 --arm64 --config.directories.output="dist/mac"

echo ""
echo "[4/4] Build complete!"
echo ""
echo "=============================================="
echo " Output: dist/mac/"
echo "=============================================="
ls -lh dist/mac/*.dmg dist/mac/*.zip 2>/dev/null || echo " (check dist/mac/ for files)"
echo ""
