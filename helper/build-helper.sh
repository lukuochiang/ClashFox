#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_PATH="${SCRIPT_DIR}/com.clashfox.helper"
PLIST_PATH="${SCRIPT_DIR}/com.clashfox.helper.plist"

echo "ClashFox-Helper uses prebuilt release artifacts; local build is no longer required."

if [[ ! -f "${BIN_PATH}" ]]; then
  echo "[Error] helper binary missing: ${BIN_PATH}"
  exit 1
fi
if [[ ! -f "${PLIST_PATH}" ]]; then
  echo "[Error] helper plist missing: ${PLIST_PATH}"
  exit 1
fi

echo "[OK] helper artifacts are ready:"
echo " - ${BIN_PATH}"
echo " - ${PLIST_PATH}"
