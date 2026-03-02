#!/usr/bin/env bash
set -euo pipefail

LABEL="com.clashfox.helper"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_BIN_SRC="${SCRIPT_DIR}/com.clashfox.helper"
BIN_SRC="${1:-${DEFAULT_BIN_SRC}}"
VERSION_IN="${2:-}"
BIN_DST="/Library/PrivilegedHelperTools/${LABEL}"
PLIST_SRC="${SCRIPT_DIR}/${LABEL}.plist"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"
TOKEN_DIR="/Library/Application Support/ClashFox/helper"
RELEASE_DIR="${TOKEN_DIR}/releases"
VERSION_META="${TOKEN_DIR}/version.json"
HISTORY_LOG="${TOKEN_DIR}/version-history.log"

SUCCESS=0
BIN_BAK=""
PLIST_BAK=""

rollback() {
  if [[ "${SUCCESS}" -eq 1 ]]; then
    return
  fi

  echo "install failed, rolling back..."

  if [[ -n "${BIN_BAK}" && -f "${BIN_BAK}" ]]; then
    cp -f "${BIN_BAK}" "${BIN_DST}"
    chown root:wheel "${BIN_DST}"
    chmod 755 "${BIN_DST}"
  else
    rm -f "${BIN_DST}"
  fi

  if [[ -n "${PLIST_BAK}" && -f "${PLIST_BAK}" ]]; then
    cp -f "${PLIST_BAK}" "${PLIST_DST}"
    chown root:wheel "${PLIST_DST}"
    chmod 644 "${PLIST_DST}"
  else
    rm -f "${PLIST_DST}"
  fi

  if [[ -f "${PLIST_DST}" ]]; then
    launchctl bootstrap system "${PLIST_DST}" || true
    launchctl enable "system/${LABEL}" || true
    launchctl kickstart -k "system/${LABEL}" || true
  fi
}
trap rollback EXIT

show_diag() {
  echo "diag: plist lint"
  plutil -lint "${PLIST_DST}" || true
  echo "diag: file info"
  ls -lO@ "${BIN_DST}" "${PLIST_DST}" 2>/dev/null || true
  echo "diag: xattr"
  xattr -l "${BIN_DST}" 2>/dev/null || true
  echo "diag: launchd recent logs"
  log show --last 3m --style compact --predicate "(process == \"launchd\") AND (eventMessage CONTAINS \"${LABEL}\")" 2>/dev/null | tail -n 80 || true
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0 [binary-path]"
  exit 1
fi

if [[ ! -f "${BIN_SRC}" ]]; then
  echo "binary not found: ${BIN_SRC}"
  exit 1
fi
if [[ ! -f "${PLIST_SRC}" ]]; then
  echo "plist not found: ${PLIST_SRC}"
  exit 1
fi

if [[ -n "${VERSION_IN}" ]]; then
  VERSION="${VERSION_IN}"
elif [[ -f "${SCRIPT_DIR}/VERSION" ]]; then
  VERSION="$(tr -d '[:space:]' < "${SCRIPT_DIR}/VERSION")"
elif [[ -f "./VERSION" ]]; then
  VERSION="$(tr -d '[:space:]' < "./VERSION")"
else
  VERSION_FROM_BIN="$("${BIN_SRC}" --version 2>/dev/null || true)"
  VERSION="$(printf '%s' "${VERSION_FROM_BIN}" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' | head -n 1)"
  if [[ -z "${VERSION}" ]]; then
    VERSION="unknown"
  fi
fi

mkdir -p "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons" "${TOKEN_DIR}" "${RELEASE_DIR}"
chmod 755 "${TOKEN_DIR}"

if [[ -f "${BIN_DST}" ]]; then
  BIN_BAK="$(mktemp /tmp/${LABEL}.bin.bak.XXXXXX)"
  cp -f "${BIN_DST}" "${BIN_BAK}"
  TS="$(date +%Y%m%d-%H%M%S)"
  cp -f "${BIN_DST}" "${RELEASE_DIR}/${TS}-prev-${LABEL}" || true
fi
if [[ -f "${PLIST_DST}" ]]; then
  PLIST_BAK="$(mktemp /tmp/${LABEL}.plist.bak.XXXXXX)"
  cp -f "${PLIST_DST}" "${PLIST_BAK}"
fi

BIN_TMP="${BIN_DST}.new.$$"
PLIST_TMP="${PLIST_DST}.new.$$"
cp -f "${BIN_SRC}" "${BIN_TMP}"
cp -f "${PLIST_SRC}" "${PLIST_TMP}"
chown root:wheel "${BIN_TMP}" "${PLIST_TMP}"
chmod 755 "${BIN_TMP}"
chmod 644 "${PLIST_TMP}"
# Remove quarantine/xattrs that can cause launchd bootstrap to fail on downloaded artifacts.
xattr -rc "${BIN_TMP}" "${PLIST_TMP}" 2>/dev/null || true

if launchctl print "system/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "system/${LABEL}" || true
fi

mv -f "${BIN_TMP}" "${BIN_DST}"
mv -f "${PLIST_TMP}" "${PLIST_DST}"

if [[ -f "/var/run/${LABEL}.sock" ]]; then
  rm -f "/var/run/${LABEL}.sock"
fi

if ! launchctl bootstrap system "${PLIST_DST}"; then
  echo "bootstrap failed for ${LABEL}"
  show_diag
  exit 1
fi
launchctl enable "system/${LABEL}"
launchctl kickstart -k "system/${LABEL}"
# Keep token readable for the GUI process if helper created it as root-only.
if [[ -f "${TOKEN_DIR}/token" ]]; then
  chmod 644 "${TOKEN_DIR}/token" || true
fi

BIN_SHA="$(shasum -a 256 "${BIN_DST}" | awk '{print $1}')"
INSTALLED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "${VERSION_META}" <<EOF
{
  "label": "${LABEL}",
  "version": "${VERSION}",
  "installedAt": "${INSTALLED_AT}",
  "binaryPath": "${BIN_DST}",
  "binarySha256": "${BIN_SHA}"
}
EOF
chmod 600 "${VERSION_META}"
echo "${INSTALLED_AT} version=${VERSION} sha256=${BIN_SHA}" >> "${HISTORY_LOG}"

# Keep only the newest 10 binary backups.
ls -1t "${RELEASE_DIR}" 2>/dev/null | sed -n '11,$p' | while IFS= read -r old; do
  rm -f "${RELEASE_DIR}/${old}"
done

SUCCESS=1
echo "installed and started: ${LABEL} version=${VERSION}"
