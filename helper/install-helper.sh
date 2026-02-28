#!/bin/bash
set -euo pipefail

CURRENT_STEP="init"

fail() {
  local code="$1"
  local message="$2"
  echo "helper_install_failed:${code}:${message}" >&2
  exit 1
}

on_err() {
  local exit_code=$?
  echo "helper_install_failed:step_error:${CURRENT_STEP}:exit=${exit_code}" >&2
  exit "$exit_code"
}
trap on_err ERR

echo "======================================"
echo "  ClashFox Helper Install Script"
echo "======================================"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  fail "sudo_required" "Please run with sudo: sudo ./install-helper.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER_BINARY=""

if [ -f "$SCRIPT_DIR/com.clashfox.helper" ]; then
  HELPER_BINARY="$SCRIPT_DIR/com.clashfox.helper"
elif [ -f "$SCRIPT_DIR/.build/release/com.clashfox.helper" ]; then
  HELPER_BINARY="$SCRIPT_DIR/.build/release/com.clashfox.helper"
elif [ -f "$SCRIPT_DIR/../ClashFoxHelper/com.clashfox.helper" ]; then
  HELPER_BINARY="$SCRIPT_DIR/../ClashFoxHelper/com.clashfox.helper"
fi

if [ -f "$SCRIPT_DIR/com.clashfox.helper.plist" ]; then
  PLIST_SOURCE="$SCRIPT_DIR/com.clashfox.helper.plist"
else
  PLIST_SOURCE="$SCRIPT_DIR/../scripts/com.clashfox.helper.plist"
fi

INSTALL_PATH="/Library/PrivilegedHelperTools/com.clashfox.helper"
PLIST_INSTALL="/Library/LaunchDaemons/com.clashfox.helper.plist"

echo "Script directory: $SCRIPT_DIR"
echo "Helper source: $HELPER_BINARY"
echo ""

if [ ! -f "$HELPER_BINARY" ]; then
  CURRENT_STEP="build_helper"
  echo "[Info] Helper binary not found, trying local build..."
  if [ -x "$SCRIPT_DIR/build-helper.sh" ]; then
    bash "$SCRIPT_DIR/build-helper.sh"
  else
    chmod +x "$SCRIPT_DIR/build-helper.sh" 2>/dev/null || true
    bash "$SCRIPT_DIR/build-helper.sh"
  fi
  if [ -f "$SCRIPT_DIR/.build/release/com.clashfox.helper" ]; then
    HELPER_BINARY="$SCRIPT_DIR/.build/release/com.clashfox.helper"
  fi
fi

if [ ! -f "$PLIST_SOURCE" ]; then
  fail "plist_missing" "Plist not found: $PLIST_SOURCE"
fi

if [ ! -f "$HELPER_BINARY" ]; then
  fail "helper_missing" "Helper not found: $SCRIPT_DIR/com.clashfox.helper or $SCRIPT_DIR/.build/release/com.clashfox.helper"
fi

CURRENT_STEP="stop_existing_service"
if [ -f "$PLIST_INSTALL" ]; then
  launchctl bootout system "$PLIST_INSTALL" 2>/dev/null || launchctl unload "$PLIST_INSTALL" 2>/dev/null || true
  rm -f "$PLIST_INSTALL"
  rm -f "$INSTALL_PATH"
  rm -f /var/run/clashfox-helper.sock
fi

HELPER_LOG_DIR="/Users/Shared/clashfox/logs"
if [ -d "$HELPER_LOG_DIR" ]; then
  rm -f "$HELPER_LOG_DIR/helper.log" "$HELPER_LOG_DIR/helper.log.old"
  echo "Old helper logs cleared"
fi

CURRENT_STEP="install_binary"
mkdir -p /Library/PrivilegedHelperTools/
cp "$HELPER_BINARY" "$INSTALL_PATH"
chmod 755 "$INSTALL_PATH"
chown root:wheel "$INSTALL_PATH"
xattr -dr com.apple.quarantine "$INSTALL_PATH" 2>/dev/null || true

CURRENT_STEP="install_plist"
cp "$PLIST_SOURCE" "$PLIST_INSTALL"
chmod 644 "$PLIST_INSTALL"
chown root:wheel "$PLIST_INSTALL"
plutil -lint "$PLIST_INSTALL" >/dev/null 2>&1 || fail "plist_invalid" "$PLIST_INSTALL"

CURRENT_STEP="launchd_bootstrap"
if ! launchctl bootstrap system "$PLIST_INSTALL" 2>/tmp/clashfox-helper-bootstrap.err; then
  if ! launchctl load -w "$PLIST_INSTALL" 2>/tmp/clashfox-helper-load.err; then
    BOOTSTRAP_ERR="$(cat /tmp/clashfox-helper-bootstrap.err 2>/dev/null || true)"
    LOAD_ERR="$(cat /tmp/clashfox-helper-load.err 2>/dev/null || true)"
    fail "launchctl_load_failed" "${BOOTSTRAP_ERR:-}${LOAD_ERR:+; }${LOAD_ERR:-}"
  fi
fi
launchctl enable system/com.clashfox.helper 2>/dev/null || true
launchctl kickstart -k system/com.clashfox.helper 2>/dev/null || true
sleep 1

CURRENT_STEP="verify_service"
if launchctl print system/com.clashfox.helper >/tmp/clashfox-helper-print.out 2>/tmp/clashfox-helper-print.err; then
  echo "Helper installed and running"
else
  PRINT_ERR="$(cat /tmp/clashfox-helper-print.err 2>/dev/null || true)"
  fail "launchd_not_running" "${PRINT_ERR:-launchctl print failed}"
fi
