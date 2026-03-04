#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Install Script"
echo "======================================"

LABEL="com.clashfox.helper"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_BIN_SRC="${SCRIPT_DIR}/com.clashfox.helper"
BIN_SRC="${1:-${DEFAULT_BIN_SRC}}"
VERSION_IN="${2:-}"
BIN_DST="/Library/PrivilegedHelperTools/${LABEL}"
PLIST_SRC="${SCRIPT_DIR}/${LABEL}.plist"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"
TOKEN_DIR="/Library/Application Support/ClashFox/helper"
VERSION_META="${TOKEN_DIR}/version.json"
HISTORY_LOG="${TOKEN_DIR}/version-history.log"
TOKEN_PATH="${TOKEN_DIR}/token"
POLICY_PATH="${TOKEN_DIR}/policy.json"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

enforce_launchd_perms() {
  # launchd requires strict ownership/mode for system daemons.
  chown root:wheel "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons"
  chmod 755 "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons"

  chown root:wheel "${BIN_DST}" "${PLIST_DST}"
  chmod 755 "${BIN_DST}"
  chmod 644 "${PLIST_DST}"
}

verify_launchd_perms() {
  local bin_perm plist_perm bin_owner plist_owner
  bin_perm="$(stat -f '%Mp%Lp' "${BIN_DST}")"
  plist_perm="$(stat -f '%Mp%Lp' "${PLIST_DST}")"
  bin_owner="$(stat -f '%Su:%Sg' "${BIN_DST}")"
  plist_owner="$(stat -f '%Su:%Sg' "${PLIST_DST}")"
  # macOS `stat -f %Mp%Lp` may output with a leading zero (e.g. 0755).
  bin_perm="${bin_perm#0}"
  plist_perm="${plist_perm#0}"

  if [[ "${bin_owner}" != "root:wheel" || "${plist_owner}" != "root:wheel" ]]; then
    echo "invalid ownership: ${BIN_DST}=${bin_owner}, ${PLIST_DST}=${plist_owner}"
    return 1
  fi
  if [[ "${bin_perm}" != "755" || "${plist_perm}" != "644" ]]; then
    echo "invalid mode: ${BIN_DST}=${bin_perm}, ${PLIST_DST}=${plist_perm}"
    return 1
  fi
}

show_diag() {
  echo "diag: plist lint"
  plutil -lint "${PLIST_DST}" || true
  echo "diag: file info"
  ls -lO@ "${BIN_DST}" "${PLIST_DST}" 2>/dev/null || true
  echo "diag: xattr"
  xattr -l "${BIN_DST}" 2>/dev/null || true
  xattr -l "${PLIST_DST}" 2>/dev/null || true
  echo "diag: launchd recent logs"
  log show --last 3m --style compact --predicate "(process == \"launchd\") AND (eventMessage CONTAINS \"${LABEL}\")" 2>/dev/null | tail -n 80 || true
}

clear_quarantine() {
  local p
  for p in "$@"; do
    [[ -e "${p}" ]] || continue
    # Best effort: remove quarantine regardless of file/dir type.
    xattr -d com.apple.quarantine "${p}" >/dev/null 2>&1 || true
    xattr -dr com.apple.quarantine "${p}" >/dev/null 2>&1 || true
  done
}

prepare_helper_state_dir() {
  local base_dir
  base_dir="$(dirname "${TOKEN_DIR}")"

  mkdir -p "${base_dir}"
  if [[ -L "${TOKEN_DIR}" ]]; then
    echo "found legacy symlink at ${TOKEN_DIR}, replacing with real directory"
    rm -f "${TOKEN_DIR}"
  fi
  if [[ -e "${TOKEN_DIR}" && ! -d "${TOKEN_DIR}" ]]; then
    echo "invalid helper state path (not a directory): ${TOKEN_DIR}"
    return 1
  fi
  mkdir -p "${TOKEN_DIR}"
  chown root:wheel "${base_dir}" "${TOKEN_DIR}"
  chmod 755 "${base_dir}"
  chmod 700 "${TOKEN_DIR}"
}

ensure_token_readable() {
  chmod 755 "${TOKEN_DIR}" >/dev/null 2>&1 || true
  local console_uid
  console_uid="$(stat -f '%u' /dev/console 2>/dev/null || true)"
  local attempt=0
  while [[ "${attempt}" -lt 25 ]]; do
    if [[ -f "${TOKEN_PATH}" ]]; then
      chmod 600 "${TOKEN_PATH}" >/dev/null 2>&1 || true
      chmod -N "${TOKEN_PATH}" >/dev/null 2>&1 || true
      if [[ -n "${console_uid}" && "${console_uid}" != "0" ]]; then
        chmod +a "user:${console_uid} allow read" "${TOKEN_PATH}" >/dev/null 2>&1 || true
      fi
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.2
  done
  return 0
}

write_helper_policy() {
  local console_uid
  console_uid="$(stat -f '%u' /dev/console 2>/dev/null || true)"
  if [[ -z "${console_uid}" || "${console_uid}" == "0" ]]; then
    console_uid="501"
  fi

  local dev_electron_prefix="${ROOT_DIR}/node_modules/electron/dist/Electron.app/"
  local dev_app_prefix="${ROOT_DIR}/"

  cat > "${POLICY_PATH}" <<EOF
{
  "allowedUIDs": [
    0,
    ${console_uid}
  ],
  "allowedClientPathPrefixes": [
    "/Applications/ClashFox.app/",
    "/usr/local/bin/clashfox",
    "${dev_electron_prefix}",
    "${dev_app_prefix}"
  ],
  "enableCallerPathConstraint": true
}
EOF
  chown root:wheel "${POLICY_PATH}" >/dev/null 2>&1 || true
  chmod 600 "${POLICY_PATH}" >/dev/null 2>&1 || true
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
clear_quarantine "${BIN_SRC}" "${PLIST_SRC}"

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

mkdir -p "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons"
prepare_helper_state_dir
chown root:wheel "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons"
chmod 755 "/Library/PrivilegedHelperTools" "/Library/LaunchDaemons"

if [[ -f "${BIN_DST}" ]]; then
  BIN_BAK="$(mktemp /tmp/${LABEL}.bin.bak.XXXXXX)"
  cp -f "${BIN_DST}" "${BIN_BAK}"
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
clear_quarantine "${BIN_TMP}" "${PLIST_TMP}"
# Remove remaining xattrs that can cause launchd bootstrap to fail on downloaded artifacts.
xattr -rc "${BIN_TMP}" "${PLIST_TMP}" 2>/dev/null || true

if launchctl print "system/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "system/${LABEL}" >/dev/null 2>&1 || true
fi

mv -f "${BIN_TMP}" "${BIN_DST}"
mv -f "${PLIST_TMP}" "${PLIST_DST}"
clear_quarantine "${BIN_DST}" "${PLIST_DST}"
enforce_launchd_perms

if ! verify_launchd_perms; then
  echo "permission check failed before bootstrap"
  show_diag
  exit 1
fi

if [[ -f "/var/run/${LABEL}.sock" ]]; then
  rm -f "/var/run/${LABEL}.sock"
fi

if ! launchctl bootstrap system "${PLIST_DST}"; then
  echo "bootstrap failed for ${LABEL}"
  show_diag
  exit 1
fi
launchctl enable "system/${LABEL}"
write_helper_policy
launchctl kickstart -k "system/${LABEL}"
ensure_token_readable

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

SUCCESS=1
echo "installed and started: ${LABEL} version=${VERSION}"
