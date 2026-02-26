#!/bin/bash
set -e

echo "======================================"
echo "  ClashFox Helper Uninstall Script"
echo "======================================"

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run with sudo: sudo ./uninstall-helper.sh"
  exit 1
fi

PLIST_PATH="/Library/LaunchDaemons/com.clashfox.helper.plist"
HELPER_PATH="/Library/PrivilegedHelperTools/com.clashfox.helper"
SOCKET_PATH="/var/run/clashfox-helper.sock"
LOG_PATH="/var/log/clashfox-helper.log"

launchctl unload "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"
rm -f "$HELPER_PATH"
rm -f "$SOCKET_PATH"
rm -f "$LOG_PATH"

HELPER_LOG_DIR="$HOME/Library/Application Support/ClashFox/logs"
if [ -d "$HELPER_LOG_DIR" ]; then
  rm -f "$HELPER_LOG_DIR/helper.log" "$HELPER_LOG_DIR/helper.log.old"
  echo "Helper logs cleared"
fi

KERNEL_SOCKET="/tmp/clashfox.sock"
if [ -S "$KERNEL_SOCKET" ]; then
  rm -f "$KERNEL_SOCKET"
fi

pkill -f "mihomo" || true

echo "Helper uninstalled"
