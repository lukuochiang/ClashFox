#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_PNG="$ROOT_DIR/assets/logo.png"
OUT_ICNS="$ROOT_DIR/assets/logo.icns"
TMP_DIR="$(mktemp -d)"
ICONSET="$TMP_DIR/logo.iconset"

if [ ! -f "$SRC_PNG" ]; then
  echo "Missing source logo: $SRC_PNG" >&2
  exit 1
fi

mkdir -p "$ICONSET"

sips -z 16 16     "$SRC_PNG" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32     "$SRC_PNG" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$SRC_PNG" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64     "$SRC_PNG" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$SRC_PNG" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256   "$SRC_PNG" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SRC_PNG" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512   "$SRC_PNG" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SRC_PNG" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SRC_PNG" --out "$ICONSET/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET" -o "$OUT_ICNS"

rm -rf "$TMP_DIR"

echo "Generated: $OUT_ICNS"
