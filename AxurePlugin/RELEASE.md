# Flowa Axure Plugin release packaging

This folder contains the Electron-based Axure sync plugin.

## Build official installers

Run on macOS:

```bash
cd AxurePlugin
./build_release.sh
```

The script generates:

- `dist/releases/Flowa-Axure-Plugin-1.0.0-win-x64-setup.exe`
- `dist/releases/Flowa-Axure-Plugin-1.0.0-win-x64-portable.zip`
- `dist/releases/Flowa-Axure-Plugin-1.0.0-mac-x64.dmg`
- `dist/releases/Flowa-Axure-Plugin-1.0.0-mac-arm64.dmg`
- `dist/releases/Flowa-Axure-Plugin-1.0.0-mac-x64.zip`
- `dist/releases/Flowa-Axure-Plugin-1.0.0-mac-arm64.zip`
- `dist/releases/SHA256SUMS.txt`

## Publishing note

The macOS DMG files are larger than GitHub's normal 100MB Git file limit, so release binaries should be uploaded as GitHub Release assets instead of being committed to the repository.

Recommended release tag:

```text
flowa-axure-plugin-v1.0.0
```

The product is not notarized with an Apple Developer ID in local builds. macOS users may need to allow it in System Settings → Privacy & Security on first launch.
