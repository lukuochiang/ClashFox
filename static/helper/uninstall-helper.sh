#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Uninstall Script"
echo "======================================"

LABEL="com.clashfox.helper"
BIN_DST="/Library/PrivilegedHelperTools/${LABEL}"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"
APP_BUNDLE_PATH="${CLASHFOX_APP_PATH:-/Applications/ClashFox.app}"
APP_HELPER_DIR="${CLASHFOX_HELPER_DIR:-${APP_BUNDLE_PATH}/Contents/Resources/helper}"
BACKUP_ROOT="${APP_HELPER_DIR}/uninstall-backup"
BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
VERSION_META="/Library/Application Support/ClashFox/helper/version.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0"
  exit 1
fi

if launchctl print "system/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout system "${PLIST_DST}" || true
fi

mkdir -p "${BACKUP_DIR}"
chown root:wheel "${BACKUP_ROOT}" "${BACKUP_DIR}" >/dev/null 2>&1 || true
chmod 755 "${BACKUP_ROOT}" "${BACKUP_DIR}" >/dev/null 2>&1 || true

if [[ -f "${PLIST_DST}" ]]; then
  mv "${PLIST_DST}" "${BACKUP_DIR}/${LABEL}.plist"
fi
if [[ -f "${BIN_DST}" ]]; then
  mv "${BIN_DST}" "${BACKUP_DIR}/${LABEL}"
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
