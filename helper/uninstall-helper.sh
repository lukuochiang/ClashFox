#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Uninstall Script"
echo "======================================"

LABEL="com.clashfox.helper"
BIN_DST="/Library/PrivilegedHelperTools/${LABEL}"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"
BACKUP_DIR="/Library/Application Support/ClashFox/helper/uninstall-backup-$(date +%Y%m%d-%H%M%S)"
VERSION_META="/Library/Application Support/ClashFox/helper/version.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0"
  exit 1
fi

if launchctl print "system/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout system "${PLIST_DST}" || true
fi

mkdir -p "${BACKUP_DIR}"

if [[ -f "${PLIST_DST}" ]]; then
  mv "${PLIST_DST}" "${BACKUP_DIR}/"
fi
if [[ -f "${BIN_DST}" ]]; then
  mv "${BIN_DST}" "${BACKUP_DIR}/"
fi
if [[ -f "/var/run/${LABEL}.sock" ]]; then
  rm -f "/var/run/${LABEL}.sock"
fi

echo "uninstalled: ${LABEL}"
echo "backup saved at: ${BACKUP_DIR}"
if [[ -f "${VERSION_META}" ]]; then
  echo "last installed version meta:"
  cat "${VERSION_META}"
fi
