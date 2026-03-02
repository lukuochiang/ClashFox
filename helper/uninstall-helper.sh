#!/usr/bin/env bash
set -euo pipefail

LABEL="com.clashfox.helper"
BIN_DST="/Library/PrivilegedHelperTools/${LABEL}"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"
SOCKET="/var/run/${LABEL}.sock"
TOKEN="/Library/Application Support/ClashFox/helper/token"
BACKUP_DIR="/Library/Application Support/ClashFox/helper/uninstall-backup-$(date +%Y%m%d-%H%M%S)"
VERSION_META="/Library/Application Support/ClashFox/helper/version.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0"
  exit 1
fi

# Best effort: restore baseline before uninstall to avoid network residue.
if [[ -S "${SOCKET}" && -f "${TOKEN}" && -x /usr/bin/curl ]]; then
  H_TOKEN="$(cat "${TOKEN}" 2>/dev/null || true)"
  if [[ -n "${H_TOKEN}" ]]; then
    /usr/bin/curl --max-time 5 --silent --show-error \
      --unix-socket "${SOCKET}" \
      -H "X-Helper-Token: ${H_TOKEN}" \
      -H "Content-Type: application/json" \
      -X POST http://localhost/v1/state/restore >/dev/null || true
  fi
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
if [[ -f "${SOCKET}" ]]; then
  rm -f "${SOCKET}"
fi

echo "uninstalled: ${LABEL}"
echo "backup saved at: ${BACKUP_DIR}"
if [[ -f "${VERSION_META}" ]]; then
  echo "last installed version meta:"
  cat "${VERSION_META}"
fi
