#!/bin/bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Check Script"
echo "======================================"

HELPER_BIN="/Library/PrivilegedHelperTools/com.clashfox.helper"
HELPER_LABEL="com.clashfox.helper"
V2_SOCKET_PATH="/var/run/com.clashfox.helper.sock"
V2_TOKEN_PATH="/Library/Application Support/ClashFox/helper/token"
LOG_PATH="/var/log/clashfox-helper.log"

section() {
  echo ""
  echo "== $1 =="
}

run_v2_cmd() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  if [ ! -S "$V2_SOCKET_PATH" ]; then
    echo "skip: v2 socket not found"
    return
  fi
  if [ ! -f "$V2_TOKEN_PATH" ]; then
    echo "skip: v2 token not found"
    return
  fi
  local token
  token="$(cat "$V2_TOKEN_PATH" 2>/dev/null || true)"
  if [ -z "$token" ]; then
    echo "skip: v2 token empty"
    return
  fi
  if [ "$method" = "GET" ]; then
    curl -sS --unix-socket "$V2_SOCKET_PATH" -H "X-Helper-Token: $token" -X GET "http://localhost$path"
  else
    curl -sS --unix-socket "$V2_SOCKET_PATH" -H "X-Helper-Token: $token" -H 'Content-Type: application/json' -X POST "http://localhost$path" -d "$payload"
  fi
}

section "Helper Version"
if [ -x "$HELPER_BIN" ]; then
  "$HELPER_BIN" --version || true
else
  echo "binary missing: $HELPER_BIN"
fi

section "Launchd Status"
if sudo launchctl print "system/$HELPER_LABEL" >/tmp/clashfox_helper_launchd.txt 2>/tmp/clashfox_helper_launchd.err; then
  sed -n '1,80p' /tmp/clashfox_helper_launchd.txt
else
  echo "launchctl print failed:"
  sed -n '1,40p' /tmp/clashfox_helper_launchd.err || true
fi

section "Process"
pgrep -fl "$HELPER_LABEL" || echo "no process matched $HELPER_LABEL"

section "Socket"
if [ -S "$V2_SOCKET_PATH" ]; then
  ls -l "$V2_SOCKET_PATH"
else
  echo "v2 socket missing: $V2_SOCKET_PATH"
fi

section "Ping (V2)"
run_v2_cmd "GET" "/health" || echo "v2 ping failed"

section "Core Status (V2)"
run_v2_cmd "GET" "/v1/core/status" || echo "v2 core status failed"

section "Recent Logs"
if [ -f "$LOG_PATH" ]; then
  sudo tail -n 80 "$LOG_PATH"
else
  echo "log not found: $LOG_PATH"
fi
