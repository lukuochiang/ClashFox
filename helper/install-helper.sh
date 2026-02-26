#!/bin/bash
set -e

echo "======================================"
echo "  ClashFox Helper Install Script"
echo "======================================"

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run with sudo: sudo ./install-helper.sh"
  exit 1
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
  echo "Error: Plist not found: $PLIST_SOURCE"
  exit 1
fi

if [ ! -f "$HELPER_BINARY" ]; then
  echo "Error: Helper not found: $SCRIPT_DIR/com.clashfox.helper or $SCRIPT_DIR/.build/release/com.clashfox.helper"
  exit 1
fi

if [ -f "$PLIST_INSTALL" ]; then
  launchctl unload "$PLIST_INSTALL" 2>/dev/null || true
  rm -f "$PLIST_INSTALL"
  rm -f "$INSTALL_PATH"
  rm -f /var/run/clashfox-helper.sock
fi

HELPER_LOG_DIR="/Users/Shared/clashfox/logs"
if [ -d "$HELPER_LOG_DIR" ]; then
  rm -f "$HELPER_LOG_DIR/helper.log" "$HELPER_LOG_DIR/helper.log.old"
  echo "Old helper logs cleared"
fi

mkdir -p /Library/PrivilegedHelperTools/
cp "$HELPER_BINARY" "$INSTALL_PATH"
chmod 755 "$INSTALL_PATH"
chown root:wheel "$INSTALL_PATH"

cp "$PLIST_SOURCE" "$PLIST_INSTALL"
chmod 644 "$PLIST_INSTALL"
chown root:wheel "$PLIST_INSTALL"

launchctl load -w "$PLIST_INSTALL"
sleep 1

if launchctl list | grep -q com.clashfox.helper; then
  echo "Helper installed and running"
else
  echo "Helper installed but not running, check logs"
fi
