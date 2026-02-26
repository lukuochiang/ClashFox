#!/bin/bash
set -euo pipefail

echo "======================================"
echo "  ClashFox Helper Check Script"
echo "======================================"

HELPER_BIN="/Library/PrivilegedHelperTools/com.clashfox.helper"
HELPER_LABEL="com.clashfox.helper"
SOCKET_PATH="/var/run/clashfox-helper.sock"
HTTP_URL="http://127.0.0.1:19999/command"
LOG_PATH="/var/log/clashfox-helper.log"

section() {
  echo ""
  echo "== $1 =="
}

run_json_cmd() {
  local payload="$1"
  local mode="${2:-socket}"
  if [ "$mode" = "http" ]; then
    curl -sS -X POST "$HTTP_URL" \
      -H 'Content-Type: application/json' \
      -d "$payload"
  else
    printf '%s' "$payload" | nc -U "$SOCKET_PATH"
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
if [ -S "$SOCKET_PATH" ]; then
  ls -l "$SOCKET_PATH"
else
  echo "socket missing: $SOCKET_PATH"
fi

section "Ping (Socket)"
if [ -S "$SOCKET_PATH" ]; then
  run_json_cmd '{"id":"1","cmd":"ping","args":[]}' socket || echo "socket ping failed"
else
  echo "skip: socket not found"
fi

section "Ping (HTTP)"
run_json_cmd '{"id":"2","cmd":"ping","args":[]}' http || echo "http ping failed"

section "Status"
if [ -S "$SOCKET_PATH" ]; then
  run_json_cmd '{"id":"3","cmd":"status","args":[]}' socket || echo "status failed"
else
  run_json_cmd '{"id":"3","cmd":"status","args":[]}' http || echo "status failed"
fi

section "System Proxy Status"
if [ -S "$SOCKET_PATH" ]; then
  run_json_cmd '{"id":"4","cmd":"system-proxy-status","args":[]}' socket || echo "system-proxy-status failed"
else
  run_json_cmd '{"id":"4","cmd":"system-proxy-status","args":[]}' http || echo "system-proxy-status failed"
fi

section "Recent Logs"
if [ -f "$LOG_PATH" ]; then
  sudo tail -n 80 "$LOG_PATH"
else
  echo "log not found: $LOG_PATH"
fi

