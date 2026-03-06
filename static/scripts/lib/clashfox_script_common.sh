#!/bin/bash

# Shared shell helpers for ClashFox scripts.
# Keep these functions dependency-light and side-effect free.

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

print_ok() {
    printf '{"ok":true,"data":%s}\n' "$1"
}

print_err() {
    local msg="$1"
    printf '{"ok":false,"error":"%s"}\n' "$(json_escape "$msg")"
}

print_err_with_details() {
    local msg="$1"
    local details="$2"
    printf '{"ok":false,"error":"%s","details":"%s"}\n' "$(json_escape "$msg")" "$(json_escape "$details")"
}
