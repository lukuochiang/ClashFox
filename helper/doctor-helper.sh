#!/bin/bash
set -u

REPAIR=false
JSON_MODE=true

for arg in "$@"; do
  case "$arg" in
    --repair)
      REPAIR=true
      ;;
    --json)
      JSON_MODE=true
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.clashfox.helper"
INSTALL_BIN="/Library/PrivilegedHelperTools/com.clashfox.helper"
INSTALL_PLIST="/Library/LaunchDaemons/com.clashfox.helper.plist"
SOCKET_PATH="/var/run/clashfox-helper.sock"
HTTP_URL="http://127.0.0.1:19999/command"
LOG_PATH="/var/log/clashfox-helper.log"

SOURCE_BIN=""
SOURCE_PLIST=""
if [ -f "$SCRIPT_DIR/com.clashfox.helper" ]; then
  SOURCE_BIN="$SCRIPT_DIR/com.clashfox.helper"
elif [ -f "$SCRIPT_DIR/.build/release/com.clashfox.helper" ]; then
  SOURCE_BIN="$SCRIPT_DIR/.build/release/com.clashfox.helper"
fi
if [ -f "$SCRIPT_DIR/com.clashfox.helper.plist" ]; then
  SOURCE_PLIST="$SCRIPT_DIR/com.clashfox.helper.plist"
elif [ -f "$SCRIPT_DIR/../scripts/com.clashfox.helper.plist" ]; then
  SOURCE_PLIST="$SCRIPT_DIR/../scripts/com.clashfox.helper.plist"
fi

json_escape() {
  local s="${1-}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

emit_result() {
  local ok="$1"
  local error_code="$2"
  local details="$3"
  local repair_applied="$4"
  local repair_success="$5"
  local binary_exists="$6"
  local binary_exec="$7"
  local plist_exists="$8"
  local plist_valid="$9"
  local launchd_loaded="${10}"
  local socket_exists="${11}"
  local socket_ping_ok="${12}"
  local http_ping_ok="${13}"
  local source_available="${14}"
  local helper_version="${15}"
  local launchd_error="${16}"
  local codesign_status="${17}"
  local log_exists="${18}"
  local output
  output=$(cat <<JSON
{"ok":$ok,"error":"$(json_escape "$error_code")","details":"$(json_escape "$details")","data":{"repairApplied":$repair_applied,"repairSuccess":$repair_success,"binaryExists":$binary_exists,"binaryExecutable":$binary_exec,"plistExists":$plist_exists,"plistValid":$plist_valid,"launchdLoaded":$launchd_loaded,"socketExists":$socket_exists,"socketPingOk":$socket_ping_ok,"httpPingOk":$http_ping_ok,"sourceAvailable":$source_available,"helperVersion":"$(json_escape "$helper_version")","launchdError":"$(json_escape "$launchd_error")","codeSignStatus":"$(json_escape "$codesign_status")","logExists":$log_exists,"paths":{"installBinary":"$(json_escape "$INSTALL_BIN")","installPlist":"$(json_escape "$INSTALL_PLIST")","socket":"$(json_escape "$SOCKET_PATH")","log":"$(json_escape "$LOG_PATH")","sourceBinary":"$(json_escape "$SOURCE_BIN")","sourcePlist":"$(json_escape "$SOURCE_PLIST")"}}}
JSON
)
  printf '%s\n' "$output"
}

to_bool() {
  if [ "$1" = "true" ]; then
    printf 'true'
  else
    printf 'false'
  fi
}

run_checks() {
  CHECK_BINARY_EXISTS=false
  CHECK_BINARY_EXEC=false
  CHECK_PLIST_EXISTS=false
  CHECK_PLIST_VALID=false
  CHECK_LAUNCHD_LOADED=false
  CHECK_SOCKET_EXISTS=false
  CHECK_SOCKET_PING_OK=false
  CHECK_HTTP_PING_OK=false
  CHECK_SOURCE_AVAILABLE=false
  CHECK_LOG_EXISTS=false
  CHECK_HELPER_VERSION=""
  CHECK_LAUNCHD_ERROR=""
  CHECK_CODESIGN_STATUS="unknown"

  if [ -n "$SOURCE_BIN" ] && [ -n "$SOURCE_PLIST" ]; then
    CHECK_SOURCE_AVAILABLE=true
  fi
  if [ -f "$INSTALL_BIN" ]; then
    CHECK_BINARY_EXISTS=true
  fi
  if [ -x "$INSTALL_BIN" ]; then
    CHECK_BINARY_EXEC=true
  fi
  if [ -f "$INSTALL_PLIST" ]; then
    CHECK_PLIST_EXISTS=true
    if plutil -lint "$INSTALL_PLIST" >/dev/null 2>&1; then
      CHECK_PLIST_VALID=true
    fi
  fi
  if [ -f "$LOG_PATH" ]; then
    CHECK_LOG_EXISTS=true
  fi
  if [ -x "$INSTALL_BIN" ]; then
    CHECK_HELPER_VERSION="$("$INSTALL_BIN" --version 2>/dev/null || true)"
    if codesign -dv --verbose=2 "$INSTALL_BIN" >/tmp/clashfox-helper-codesign.out 2>/tmp/clashfox-helper-codesign.err; then
      CHECK_CODESIGN_STATUS="signed"
    else
      CHECK_CODESIGN_STATUS="unsigned_or_invalid"
    fi
  fi
  if launchctl print "system/$LABEL" >/tmp/clashfox-helper-launchd.out 2>/tmp/clashfox-helper-launchd.err; then
    CHECK_LAUNCHD_LOADED=true
  else
    CHECK_LAUNCHD_ERROR="$(cat /tmp/clashfox-helper-launchd.err 2>/dev/null || true)"
  fi
  if [ -S "$SOCKET_PATH" ]; then
    CHECK_SOCKET_EXISTS=true
    if command -v nc >/dev/null 2>&1; then
      SOCKET_RESP="$(printf '%s' '{"id":"doctor","cmd":"ping","args":[]}' | nc -U "$SOCKET_PATH" 2>/dev/null || true)"
      if echo "$SOCKET_RESP" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
        CHECK_SOCKET_PING_OK=true
      fi
    fi
  fi
  if command -v curl >/dev/null 2>&1; then
    HTTP_RESP="$(curl -sS -X POST "$HTTP_URL" -H 'Content-Type: application/json' -d '{"id":"doctor-http","cmd":"ping","args":[]}' --max-time 3 2>/dev/null || true)"
    if echo "$HTTP_RESP" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
      CHECK_HTTP_PING_OK=true
    fi
  fi
}

repair_helper() {
  if [ "$(id -u)" -ne 0 ]; then
    REPAIR_ERROR="repair_requires_root"
    return 1
  fi
  if [ -z "$SOURCE_BIN" ] || [ -z "$SOURCE_PLIST" ]; then
    REPAIR_ERROR="source_missing"
    return 1
  fi

  launchctl bootout system "$INSTALL_PLIST" >/dev/null 2>&1 || launchctl unload "$INSTALL_PLIST" >/dev/null 2>&1 || true
  rm -f "$INSTALL_PLIST" "$INSTALL_BIN" "$SOCKET_PATH"

  mkdir -p /Library/PrivilegedHelperTools || {
    REPAIR_ERROR="mkdir_failed"
    return 1
  }
  cp "$SOURCE_BIN" "$INSTALL_BIN" || {
    REPAIR_ERROR="copy_binary_failed"
    return 1
  }
  chmod 755 "$INSTALL_BIN" || {
    REPAIR_ERROR="chmod_binary_failed"
    return 1
  }
  chown root:wheel "$INSTALL_BIN" || {
    REPAIR_ERROR="chown_binary_failed"
    return 1
  }
  xattr -dr com.apple.quarantine "$INSTALL_BIN" >/dev/null 2>&1 || true

  cp "$SOURCE_PLIST" "$INSTALL_PLIST" || {
    REPAIR_ERROR="copy_plist_failed"
    return 1
  }
  chmod 644 "$INSTALL_PLIST" || {
    REPAIR_ERROR="chmod_plist_failed"
    return 1
  }
  chown root:wheel "$INSTALL_PLIST" || {
    REPAIR_ERROR="chown_plist_failed"
    return 1
  }
  plutil -lint "$INSTALL_PLIST" >/dev/null 2>&1 || {
    REPAIR_ERROR="plist_invalid"
    return 1
  }

  launchctl bootstrap system "$INSTALL_PLIST" >/tmp/clashfox-helper-bootstrap.err 2>&1 || launchctl load -w "$INSTALL_PLIST" >/tmp/clashfox-helper-load.err 2>&1 || {
    REPAIR_ERROR="launchctl_load_failed"
    return 1
  }
  launchctl enable system/"$LABEL" >/dev/null 2>&1 || true
  launchctl kickstart -k system/"$LABEL" >/dev/null 2>&1 || true
  sleep 1
  return 0
}

REPAIR_APPLIED=false
REPAIR_SUCCESS=false
REPAIR_ERROR=""

if [ "$REPAIR" = true ]; then
  REPAIR_APPLIED=true
  if repair_helper; then
    REPAIR_SUCCESS=true
  fi
fi

run_checks

OVERALL_OK=false
OVERALL_ERROR="helper_not_ready"
OVERALL_DETAILS=""
if [ "$CHECK_LAUNCHD_LOADED" = true ] && { [ "$CHECK_SOCKET_PING_OK" = true ] || [ "$CHECK_HTTP_PING_OK" = true ]; }; then
  OVERALL_OK=true
  OVERALL_ERROR=""
else
  if [ "$REPAIR_APPLIED" = true ] && [ "$REPAIR_SUCCESS" = false ]; then
    OVERALL_ERROR="${REPAIR_ERROR:-repair_failed}"
  elif [ "$CHECK_LAUNCHD_LOADED" = false ]; then
    OVERALL_ERROR="launchd_not_loaded"
    OVERALL_DETAILS="$CHECK_LAUNCHD_ERROR"
  elif [ "$CHECK_SOCKET_PING_OK" = false ] && [ "$CHECK_HTTP_PING_OK" = false ]; then
    OVERALL_ERROR="helper_unreachable"
  fi
fi

emit_result \
  "$(to_bool "$OVERALL_OK")" \
  "$OVERALL_ERROR" \
  "$OVERALL_DETAILS" \
  "$(to_bool "$REPAIR_APPLIED")" \
  "$(to_bool "$REPAIR_SUCCESS")" \
  "$(to_bool "$CHECK_BINARY_EXISTS")" \
  "$(to_bool "$CHECK_BINARY_EXEC")" \
  "$(to_bool "$CHECK_PLIST_EXISTS")" \
  "$(to_bool "$CHECK_PLIST_VALID")" \
  "$(to_bool "$CHECK_LAUNCHD_LOADED")" \
  "$(to_bool "$CHECK_SOCKET_EXISTS")" \
  "$(to_bool "$CHECK_SOCKET_PING_OK")" \
  "$(to_bool "$CHECK_HTTP_PING_OK")" \
  "$(to_bool "$CHECK_SOURCE_AVAILABLE")" \
  "$CHECK_HELPER_VERSION" \
  "$CHECK_LAUNCHD_ERROR" \
  "$CHECK_CODESIGN_STATUS" \
  "$(to_bool "$CHECK_LOG_EXISTS")"
