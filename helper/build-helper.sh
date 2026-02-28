#!/bin/bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Build Script"
echo "======================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BIN_NAME="com.clashfox.helper"
GO_MAIN="./main.go"
BUILD_DIR="$ROOT_DIR/.build/release"
BUILD_OUTPUT="$BUILD_DIR/$BIN_NAME"
ARM_OUTPUT="$BUILD_DIR/$BIN_NAME.arm64"
AMD_OUTPUT="$BUILD_DIR/$BIN_NAME.amd64"
GO_CACHE="$ROOT_DIR/.build/go-build-cache"
GO_MOD_CACHE="$ROOT_DIR/.build/go-mod-cache"
PROJECT_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

VERSION="${VERSION:-$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo dev)}"
GIT_COMMIT="${GIT_COMMIT:-$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
LDFLAGS="-s -w -X main.version=$VERSION -X main.gitCommit=$GIT_COMMIT -X main.buildTime=$BUILD_TIME"

mkdir -p "$BUILD_DIR" "$GO_CACHE" "$GO_MOD_CACHE"

if ! command -v go >/dev/null 2>&1; then
  echo "[Error] go not found."
  exit 1
fi

if [ ! -f "$ROOT_DIR/go.mod" ]; then
  echo "[Error] go.mod not found: $ROOT_DIR/go.mod"
  exit 1
fi

echo "[Info] Building universal binary: $BIN_NAME (arm64 + amd64)"
echo "[Info] Version: $VERSION  Commit: $GIT_COMMIT  BuildTime: $BUILD_TIME"

GOCACHE="$GO_CACHE" GOMODCACHE="$GO_MOD_CACHE" GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 \
  go build -trimpath -ldflags "$LDFLAGS" -o "$ARM_OUTPUT" "$GO_MAIN"

GOCACHE="$GO_CACHE" GOMODCACHE="$GO_MOD_CACHE" GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 \
  go build -trimpath -ldflags "$LDFLAGS" -o "$AMD_OUTPUT" "$GO_MAIN"

lipo -create "$ARM_OUTPUT" "$AMD_OUTPUT" -output "$BUILD_OUTPUT"
rm -f "$ARM_OUTPUT" "$AMD_OUTPUT"
chmod +x "$BUILD_OUTPUT"

echo "[OK] Built: $BUILD_OUTPUT"
file "$BUILD_OUTPUT"
lipo -info "$BUILD_OUTPUT"
