#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/scripts/clashfox_mihomo_toolkit.sh"

if [ "$(uname -s)" != "Darwin" ]; then
    printf '{"ok":false,"error":"unsupported_os"}\n'
    exit 2
fi

if [ ! -f "$SCRIPT_PATH" ]; then
    printf '{"ok":false,"error":"script_missing"}\n'
    exit 2
fi

export CLASHFOX_GUI_MODE=1
export CLASHFOX_SILENT=1

# shellcheck source=/dev/null
. "$SCRIPT_PATH"

CLASHFOX_DIR="/Applications/ClashFox.app"
CLASHFOX_DEFAULT_DIR="$CLASHFOX_DIR"

set_clashfox_subdirectories

ensure_runtime_dirs() {
    mkdir -p "$CLASHFOX_USER_DATA_DIR" \
      "$CLASHFOX_CORE_DIR" \
      "$CLASHFOX_BACKUP_DIR" \
      "$CLASHFOX_CONFIG_DIR" \
      "$CLASHFOX_DATA_DIR" \
      "$CLASHFOX_LOG_DIR" \
      "$CLASHFOX_PID_DIR" 2>/dev/null || true
}

ensure_runtime_dirs

get_backup_files_sorted() {
    ls -1t "$CLASHFOX_BACKUP_DIR"/mihomo.backup.* 2>/dev/null | awk 'NF'
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//"/\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

extract_ipip_ip() {
    local response="$1"
    local parsed=""
    if [ -n "$response" ] && command -v python3 >/dev/null 2>&1; then
        parsed="$(CLASHFOX_IPIP_RESPONSE="$response" python3 - <<'PY'
import json, os
raw = os.environ.get("CLASHFOX_IPIP_RESPONSE", "")
if not raw:
    raise SystemExit
try:
    data = json.loads(raw)
except Exception:
    raise SystemExit
ip = ""
if isinstance(data, dict):
    d = data.get("data")
    if isinstance(d, dict):
        ip = d.get("ip") or ""
    if not ip:
        ip = data.get("ip") or ""
if ip:
    print(str(ip).strip())
PY
)"
    fi
    if [ -z "$parsed" ] && [ -n "$response" ]; then
        parsed="$(printf '%s' "$response" | grep -Eo '([0-9]{1,3}\.){3}(\*|[0-9]{1,3})|([0-9a-fA-F]{0,4}:){2,}[0-9a-fA-F]{0,4}' | head -n 1)"
    fi
    printf '%s' "$parsed"
}

MIHOMO_CONTROLLER=""
MIHOMO_SECRET=""
MIHOMO_PROXY_PORT=""
SYSTEM_PROXY_STATE_FILE="$CLASHFOX_PID_DIR/system_proxy_state.env"

resolve_controller_from_config() {
    local config_path="$1"
    if [ -z "$config_path" ] || [ ! -f "$config_path" ]; then
        return
    fi
    local controller secret
    controller="$(grep -E '^[[:space:]]*external-controller:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*external-controller:[[:space:]]*//')"
    controller="${controller%\"}"
    controller="${controller#\"}"
    controller="${controller%\'}"
    controller="${controller#\'}"

    secret="$(grep -E '^[[:space:]]*secret:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*secret:[[:space:]]*//')"
    secret="${secret%\"}"
    secret="${secret#\"}"
    secret="${secret%\'}"
    secret="${secret#\'}"

    if [ -n "$controller" ]; then
        if ! echo "$controller" | grep -qE '^https?://'; then
            controller="http://$controller"
        fi
        MIHOMO_CONTROLLER="$controller"
        MIHOMO_SECRET="$secret"
    fi
}

resolve_proxy_port_from_config() {
    local config_path="$1"
    if [ -z "$config_path" ] || [ ! -f "$config_path" ]; then
        return
    fi
    local port=""
    port="$(grep -E '^[[:space:]]*mixed-port:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*mixed-port:[[:space:]]*//')"
    if [ -z "$port" ]; then
        port="$(grep -E '^[[:space:]]*port:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*port:[[:space:]]*//')"
    fi
    if [ -z "$port" ]; then
        port="$(grep -E '^[[:space:]]*socks-port:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*socks-port:[[:space:]]*//')"
    fi
    port="$(echo "$port" | tr -d '[:space:]')"
    if [ -n "$port" ] && echo "$port" | grep -qE '^[0-9]+$'; then
        MIHOMO_PROXY_PORT="$port"
    fi
}

is_yes_value() {
    local value
    value="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
    [ "$value" = "yes" ] || [ "$value" = "on" ] || [ "$value" = "1" ] || [ "$value" = "true" ]
}

is_loopback_host() {
    local host
    host="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
    [ "$host" = "127.0.0.1" ] || [ "$host" = "localhost" ] || [ "$host" = "::1" ]
}

to_json_bool() {
    if [ "$1" = true ]; then
        printf 'true'
    else
        printf 'false'
    fi
}

read_network_proxy_triplet() {
    local service="$1"
    local getter="$2"
    local output enabled server port
    output="$(networksetup "$getter" "$service" 2>/dev/null)"
    enabled="$(printf '%s\n' "$output" | awk -F': ' '/^[[:space:]]*Enabled:/{print $2; exit}')"
    server="$(printf '%s\n' "$output" | awk -F': ' '/^[[:space:]]*Server:/{print $2; exit}')"
    port="$(printf '%s\n' "$output" | awk -F': ' '/^[[:space:]]*Port:/{print $2; exit}')"
    enabled="$(echo "$enabled" | tr -d '\r')"
    server="$(echo "$server" | tr -d '\r')"
    port="$(echo "$port" | tr -d '\r')"
    printf '%s|%s|%s\n' "$enabled" "$server" "$port"
}

resolve_active_network_interface() {
    local iface default_route primary_iface
    default_route="$(route get default 2>/dev/null)"
    iface="$(echo "$default_route" | awk '/interface:/{print $2; exit}')"
    primary_iface="$(scutil --nwi 2>/dev/null | awk -F': ' '/Primary interface:/{print $2; exit}')"
    if [ -n "$primary_iface" ]; then
        iface="$primary_iface"
    fi
    if [[ "$iface" == utun* ]] || [ -z "$iface" ]; then
        iface="$(scutil --nwi 2>/dev/null | awk '/Network interfaces:/{print $3; exit}')"
    fi
    if [[ "$iface" == utun* ]] || [ -z "$iface" ]; then
        for cand in $(ifconfig -l); do
            case "$cand" in
                en*|bridge*|pdp_ip*)
                    if ipconfig getifaddr "$cand" >/dev/null 2>&1; then
                        iface="$cand"
                        break
                    fi
                    ;;
            esac
        done
    fi
    if [[ "$iface" == utun* ]]; then
        iface=""
    fi
    echo "$iface"
}

resolve_network_service_for_interface() {
    local iface="$1"
    local service
    if [ -z "$iface" ] || ! command -v networksetup >/dev/null 2>&1; then
        echo ""
        return
    fi
    service="$(networksetup -listnetworkserviceorder 2>/dev/null | awk -v iface="$iface" '
        $0 ~ "\\(" iface "\\)" {print prev; exit}
        {prev=$0}
    ' | sed -E 's/^\([0-9]+\) //')"
    if [ -n "$service" ] && [[ "$service" != *"denotes"* ]]; then
        echo "$service"
        return
    fi
    service="$(networksetup -listallhardwareports 2>/dev/null | awk -v iface="$iface" '
        $1=="Hardware" && $2=="Port:" {port=$0; sub("Hardware Port: ","",port)}
        $1=="Device:" && $2==iface {print port; exit}
    ')"
    echo "$service"
}

resolve_active_network_service() {
    local iface service
    iface="$(resolve_active_network_interface)"
    service="$(resolve_network_service_for_interface "$iface")"
    if [ -z "$service" ] && command -v networksetup >/dev/null 2>&1; then
        service="$(networksetup -listallnetworkservices 2>/dev/null | sed '1d' | sed '/^\*/d' | awk 'NF{print; exit}')"
    fi
    echo "$service"
}

save_system_proxy_snapshot() {
    local service="$1"
    local web_enabled="$2"
    local web_server="$3"
    local web_port="$4"
    local secure_enabled="$5"
    local secure_server="$6"
    local secure_port="$7"
    local socks_enabled="$8"
    local socks_server="$9"
    local socks_port="${10}"
    {
        printf 'service=%q\n' "$service"
        printf 'web_enabled=%q\n' "$web_enabled"
        printf 'web_server=%q\n' "$web_server"
        printf 'web_port=%q\n' "$web_port"
        printf 'secure_enabled=%q\n' "$secure_enabled"
        printf 'secure_server=%q\n' "$secure_server"
        printf 'secure_port=%q\n' "$secure_port"
        printf 'socks_enabled=%q\n' "$socks_enabled"
        printf 'socks_server=%q\n' "$socks_server"
        printf 'socks_port=%q\n' "$socks_port"
    } > "$SYSTEM_PROXY_STATE_FILE"
}

build_system_proxy_status_json() {
    local service="$1"
    local target_port="$2"
    local web_enabled="$3"
    local web_server="$4"
    local web_port="$5"
    local secure_enabled="$6"
    local secure_server="$7"
    local secure_port="$8"
    local socks_enabled="$9"
    local socks_server="${10}"
    local socks_port="${11}"

    local web_match=false secure_match=false socks_match=false enabled=false
    local effective_host="" effective_port=""

    if is_yes_value "$web_enabled" && is_loopback_host "$web_server" && [ "$web_port" = "$target_port" ]; then
        web_match=true
        enabled=true
        effective_host="$web_server"
        effective_port="$web_port"
    fi
    if is_yes_value "$secure_enabled" && is_loopback_host "$secure_server" && [ "$secure_port" = "$target_port" ]; then
        secure_match=true
        enabled=true
        if [ -z "$effective_host" ]; then
            effective_host="$secure_server"
            effective_port="$secure_port"
        fi
    fi
    if is_yes_value "$socks_enabled" && is_loopback_host "$socks_server" && [ "$socks_port" = "$target_port" ]; then
        socks_match=true
        enabled=true
        if [ -z "$effective_host" ]; then
            effective_host="$socks_server"
            effective_port="$socks_port"
        fi
    fi
    if [ -z "$effective_host" ]; then
        effective_host="127.0.0.1"
    fi
    if [ -z "$effective_port" ]; then
        effective_port="$target_port"
    fi

    cat <<JSON
{"enabled":$(to_json_bool "$enabled"),"service":"$(json_escape "$service")","host":"$(json_escape "$effective_host")","port":"$(json_escape "$effective_port")","webMatch":$(to_json_bool "$web_match"),"secureMatch":$(to_json_bool "$secure_match"),"socksMatch":$(to_json_bool "$socks_match")}
JSON
}

set_system_proxy_on() {
    local service="$1"
    local host="$2"
    local port="$3"
    networksetup -setwebproxy "$service" "$host" "$port" off >/dev/null 2>&1 || return 1
    networksetup -setsecurewebproxy "$service" "$host" "$port" off >/dev/null 2>&1 || return 1
    networksetup -setsocksfirewallproxy "$service" "$host" "$port" >/dev/null 2>&1 || return 1
    networksetup -setwebproxystate "$service" on >/dev/null 2>&1 || return 1
    networksetup -setsecurewebproxystate "$service" on >/dev/null 2>&1 || return 1
    networksetup -setsocksfirewallproxystate "$service" on >/dev/null 2>&1 || return 1
    return 0
}

restore_system_proxy_triplet() {
    local service="$1"
    local setter="$2"
    local state_setter="$3"
    local enabled="$4"
    local server="$5"
    local port="$6"
    if is_yes_value "$enabled" && [ -n "$server" ] && [ -n "$port" ]; then
        if [ "$setter" = "-setsocksfirewallproxy" ]; then
            networksetup "$setter" "$service" "$server" "$port" >/dev/null 2>&1 || return 1
        else
            networksetup "$setter" "$service" "$server" "$port" off >/dev/null 2>&1 || return 1
        fi
        networksetup "$state_setter" "$service" on >/dev/null 2>&1 || return 1
    else
        networksetup "$state_setter" "$service" off >/dev/null 2>&1 || return 1
    fi
    return 0
}

resolve_kernel_version_from_pid() {
    local pid="$1"
    if [ -z "$pid" ]; then
        echo ""
        return
    fi
    local cmd bin candidate
    cmd="$(ps -p "$pid" -o command= 2>/dev/null | head -n 1)"
    bin="${cmd%% *}"
    if [ -n "$bin" ]; then
        if [ -x "$bin" ]; then
            "$bin" -v 2>/dev/null | head -n 1 | tr -d '\r'
            return
        fi
        if [[ "$bin" != /* ]]; then
            candidate="$CLASHFOX_CORE_DIR/${bin#./}"
            if [ -x "$candidate" ]; then
                "$candidate" -v 2>/dev/null | head -n 1 | tr -d '\r'
                return
            fi
        fi
    fi
    if [ -n "$ACTIVE_CORE" ] && [ -x "$CLASHFOX_CORE_DIR/$ACTIVE_CORE" ]; then
        "$CLASHFOX_CORE_DIR/$ACTIVE_CORE" -v 2>/dev/null | head -n 1 | tr -d '\r'
        return
    fi
    if command -v mihomo >/dev/null 2>&1; then
        mihomo -v 2>/dev/null | head -n 1 | tr -d '\r'
        return
    fi
    echo ""
}

resolve_kernel_path_from_pid() {
    local pid="$1"
    if [ -z "$pid" ]; then
        echo ""
        return
    fi
    local path=""
    if command -v lsof >/dev/null 2>&1; then
        path="$(lsof -p "$pid" -a -d txt 2>/dev/null | awk 'NR==2{print $9}')"
    fi
    if [ -z "$path" ]; then
        local cmd
        cmd="$(ps -p "$pid" -o command= 2>/dev/null | head -n 1)"
        path="${cmd%% *}"
    fi
    if [ -n "$path" ]; then
        if [ -x "$path" ]; then
            echo "$path"
            return
        fi
        if [[ "$path" != /* ]]; then
            local candidate="$CLASHFOX_CORE_DIR/${path#./}"
            if [ -x "$candidate" ]; then
                echo "$candidate"
                return
            fi
        fi
    fi
    if [ -n "$ACTIVE_CORE" ] && [ -x "$CLASHFOX_CORE_DIR/$ACTIVE_CORE" ]; then
        echo "$CLASHFOX_CORE_DIR/$ACTIVE_CORE"
        return
    fi
    echo ""
}

print_ok() {
    printf '{"ok":true,"data":%s}\n' "$1"
}

print_err() {
    local msg="$1"
    printf '{"ok":false,"error":"%s"}\n' "$(json_escape "$msg")"
}

is_running() {
    local pid_file="$CLASHFOX_PID_DIR/clashfox.pid"
    local pid=""
    if [ -f "$pid_file" ]; then
        pid="$(cat "$pid_file" 2>/dev/null)"
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            return 0
        fi
    fi
    if pgrep -x "$ACTIVE_CORE" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

force_kill() {
    sudo -n pkill -x "$ACTIVE_CORE" >/dev/null 2>&1 || true
    local pid_file="$CLASHFOX_PID_DIR/clashfox.pid"
    if [ -f "$pid_file" ]; then
        rm -f "$pid_file"
    fi
}

ensure_sudo() {
    local sudo_pass="$1"
    if [ -z "$sudo_pass" ] && [ -n "${CLASHFOX_SUDO_PASS:-}" ]; then
        sudo_pass="$CLASHFOX_SUDO_PASS"
    fi
    if sudo -n true 2>/dev/null; then
        return 0
    fi
    if [ -z "$sudo_pass" ]; then
        print_err "sudo_required"
        return 1
    fi
    if printf '%s\n' "$sudo_pass" | sudo -S -v >/dev/null 2>&1; then
        return 0
    fi
    print_err "sudo_invalid"
    return 1
}

find_mihomo_pid() {
    local selected=""
    selected="$(ps -axo pid=,rss=,comm= 2>/dev/null | awk '
        $3=="mihomo" {
            if ($2 > max) { max=$2; pid=$1 }
        }
        END { if (pid != "") print pid }
    ')"
    if [ -z "$selected" ]; then
        selected="$(ps -axo pid=,rss=,command= 2>/dev/null | awk '
            /[\/ ]mihomo([ ]|$)/ {
                if ($2 > max) { max=$2; pid=$1 }
            }
            END { if (pid != "") print pid }
        ')"
    fi
    if [ -z "$selected" ] && command -v pgrep >/dev/null 2>&1; then
        selected="$(pgrep -x mihomo 2>/dev/null | head -n 1)"
    fi
    echo "$selected"
}

pid_is_running() {
    local pid="$1"
    if [ -z "$pid" ]; then
        return 1
    fi
    if ps -p "$pid" >/dev/null 2>&1; then
        return 0
    fi
    local err
    err="$(ps -p "$pid" -o pid= 2>&1)"
    if echo "$err" | grep -qi "not permitted"; then
        return 0
    fi
    if kill -0 "$pid" >/dev/null 2>&1; then
        return 0
    fi
    if kill -0 "$pid" 2>&1 | grep -qi "not permitted"; then
        return 0
    fi
    return 1
}

get_mihomo_rss_kb() {
    local kernel_path="$1"
    ps -axo rss=,command= 2>/dev/null | awk -v path="$kernel_path" '
        {
            rss=$1
            $1=""
            cmd=$0
            if (index(cmd, "mihomo") > 0) {
                sum+=rss
            } else if (path != "" && index(cmd, path)) {
                sum+=rss
            }
        }
        END{
            if (sum > 0) {
                print sum
            } else {
                print ""
            }
        }
    '
}

get_mihomo_rss_mb() {
    local pid="$1"
    if [ -z "$pid" ]; then
        echo ""
        return
    fi
    ps -o rss= -p "$pid" 2>/dev/null | awk '{
        if ($1 > 0) {
            mb = $1 / 1024;
            if (mb >= 5) {
                printf "%.1f", mb;
            }
        }
    }'
}

parse_etime_to_sec() {
    awk '{
        s=$1;
        days=0;
        if (index(s, "-")) {
            split(s, d, "-");
            days=d[1]+0;
            s=d[2];
        }
        n=split(s, t, ":");
        h=0; m=0; sec=0;
        if (n==3) {
            h=t[1]+0; m=t[2]+0; sec=t[3]+0;
        } else if (n==2) {
            m=t[1]+0; sec=t[2]+0;
        } else if (n==1) {
            sec=t[1]+0;
        } else {
            next;
        }
        print days*86400 + h*3600 + m*60 + sec;
    }'
}

get_mihomo_uptime_sec() {
    local pid="$1"
    if [ -z "$pid" ]; then
        echo ""
        return
    fi
    local uptime
    uptime="$(ps -o etime= -p "$pid" 2>/dev/null | parse_etime_to_sec)"
    if [ -z "$uptime" ] && sudo -n true >/dev/null 2>&1; then
        uptime="$(sudo -n ps -o etime= -p "$pid" 2>/dev/null | parse_etime_to_sec)"
    fi
    if [ -z "$uptime" ]; then
        local lstart
        lstart="$(ps -o lstart= -p "$pid" 2>/dev/null)"
        if [ -z "$lstart" ] && sudo -n true >/dev/null 2>&1; then
            lstart="$(sudo -n ps -o lstart= -p "$pid" 2>/dev/null)"
        fi
        if [ -n "$lstart" ]; then
            local start_epoch
            start_epoch="$(date -j -f "%a %b %e %H:%M:%S %Y" "$lstart" +%s 2>/dev/null)"
            if [ -n "$start_epoch" ]; then
                local now_epoch
                now_epoch="$(date +%s)"
                uptime="$((now_epoch - start_epoch))"
            fi
        fi
    fi
    echo "$uptime"
}

get_mihomo_connections() {
    local api_url="http://127.0.0.1:9090/connections"
    if [ -n "$MIHOMO_CONTROLLER" ]; then
        api_url="${MIHOMO_CONTROLLER}/connections"
    fi
    local token=""
    if [ -n "$MIHOMO_SECRET" ]; then
        token="$MIHOMO_SECRET"
    elif [ -n "${CLASHFOX_MIHOMO_TOKEN:-}" ]; then
        token="$CLASHFOX_MIHOMO_TOKEN"
    fi
    local auth_args=()
    if [ -n "$token" ]; then
        auth_args=(-H "Authorization: Bearer $token")
    fi
    if ! command -v curl >/dev/null 2>&1; then
        echo ""
        return
    fi
    local response
    response="$(curl -s --max-time 1 "${auth_args[@]}" "$api_url" 2>/dev/null)"
    if [ -z "$response" ]; then
        echo ""
        return
    fi
    printf '%s' "$response" | tr -d '\n' | awk '
        BEGIN { c = 0 }
        {
            while (match($0, /"id"[[:space:]]*:/)) {
                c++
                $0 = substr($0, RSTART + RLENGTH)
            }
        }
        END { print c }
    '
}

command="${1:-}"
shift || true

global_args=()
while [ $# -gt 0 ]; do
    case "$1" in
        --config-dir)
            shift || true
            if [ -n "${1:-}" ]; then
                CLASHFOX_CONFIG_DIR="$1"
            fi
            ;;
        --core-dir)
            shift || true
            if [ -n "${1:-}" ]; then
                CLASHFOX_CORE_DIR="$1"
            fi
            ;;
        --data-dir)
            shift || true
            if [ -n "${1:-}" ]; then
                CLASHFOX_DATA_DIR="$1"
            fi
            ;;
        --)
            shift || true
            break
            ;;
        *)
            global_args+=("$1")
            ;;
    esac
    shift || true
done

if [ ${#global_args[@]} -gt 0 ]; then
    set -- "${global_args[@]}"
fi

ensure_runtime_dirs

case "$command" in
    status)
        rotate_logs
        config_path=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"
        resolve_proxy_port_from_config "$config_path"

        kernel_path="$CLASHFOX_CORE_DIR/$ACTIVE_CORE"
        pid_file="$CLASHFOX_PID_DIR/clashfox.pid"
        log_path="$CLASHFOX_LOG_DIR/clashfox.log"
        config_default="$CLASHFOX_CONFIG_DIR/default.yaml"

        kernel_exists=false
        kernel_exec=false
        if [ -f "$kernel_path" ]; then
            kernel_exists=true
        fi
        if [ -x "$kernel_path" ]; then
            kernel_exec=true
        fi

        running=false
        pid=""
        if [ -f "$pid_file" ]; then
            pid="$(cat "$pid_file" 2>/dev/null)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi
        if [ "$running" = false ]; then
            pid="$(find_mihomo_pid)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi

        if [ -n "$pid" ] && [ ! -x "$kernel_path" ]; then
            resolved_path="$(resolve_kernel_path_from_pid "$pid")"
            if [ -n "$resolved_path" ]; then
                kernel_path="$resolved_path"
                kernel_exists=true
                kernel_exec=true
            fi
        fi

        version=""
        if [ -x "$kernel_path" ]; then
            version="$($kernel_path -v 2>/dev/null | head -n 1 | tr -d '\r')"
        fi
        if [ -z "$version" ] && [ -n "$pid" ]; then
            version="$(resolve_kernel_version_from_pid "$pid")"
        fi
        if [ -n "$version" ] && [ "$kernel_exists" = false ]; then
            kernel_exists=true
        fi

        config_exists=false
        if [ -f "$config_default" ]; then
            config_exists=true
        fi

        data=$(cat <<JSON
{"kernelPath":"$(json_escape "$kernel_path")","kernelExists":$kernel_exists,"kernelExec":$kernel_exec,"version":"$(json_escape "$version")","running":$running,"pid":"$(json_escape "$pid")","configDefault":"$(json_escape "$config_default")","configExists":$config_exists,"logPath":"$(json_escape "$log_path")","coreDir":"$(json_escape "$CLASHFOX_CORE_DIR")","configDir":"$(json_escape "$CLASHFOX_CONFIG_DIR")","dataDir":"$(json_escape "$CLASHFOX_DATA_DIR")"}
JSON
)
        print_ok "$data"
        ;;
    configs)
        if [ ! -d "$CLASHFOX_CONFIG_DIR" ]; then
            print_ok "[]"
            exit 0
        fi
        shopt -s nullglob
        files=( "$CLASHFOX_CONFIG_DIR"/*.yaml "$CLASHFOX_CONFIG_DIR"/*.yml "$CLASHFOX_CONFIG_DIR"/*.json )
        shopt -u nullglob
        if [ ${#files[@]} -eq 0 ]; then
            print_ok "[]"
            exit 0
        fi
        sorted="$(printf '%s\0' "${files[@]}" | xargs -0 ls -1t 2>/dev/null)"
        if [ -z "$sorted" ]; then
            print_ok "[]"
            exit 0
        fi
        json="["
        first=true
        while IFS= read -r file; do
            if [ ! -f "$file" ]; then
                continue
            fi
            name="$(basename "$file")"
            modified="$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null)"
            if [ -z "$modified" ]; then
                modified="-"
            fi
            if [ "$first" = true ]; then
                first=false
            else
                json+=","
            fi
            json+="{\"name\":\"$(json_escape "$name")\",\"path\":\"$(json_escape "$file")\",\"modified\":\"$(json_escape "$modified")\"}"
        done <<< "$sorted"
        json+="]"
        print_ok "$json"
        ;;
    overview)
        rotate_logs
        config_path=""
        controller_override=""
        secret_override=""
        cache_ttl=2
        disable_cache=false
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift || true
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift || true
                    secret_override="${1:-}"
                    ;;
                --cache-ttl)
                    shift || true
                    if echo "${1:-}" | grep -qE '^[0-9]+$'; then
                        cache_ttl="$1"
                    fi
                    ;;
                --no-cache)
                    disable_cache=true
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"
        resolve_proxy_port_from_config "$config_path"
        if [ -n "$controller_override" ]; then
            if ! echo "$controller_override" | grep -qE '^https?://'; then
                MIHOMO_CONTROLLER="http://$controller_override"
            else
                MIHOMO_CONTROLLER="$controller_override"
            fi
        fi
        if [ -n "$secret_override" ]; then
            MIHOMO_SECRET="$secret_override"
        fi

        kernel_path="$CLASHFOX_CORE_DIR/$ACTIVE_CORE"
        pid_file="$CLASHFOX_PID_DIR/clashfox.pid"

        running=false
        pid=""
        if [ -f "$pid_file" ]; then
            pid="$(cat "$pid_file" 2>/dev/null)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi
        if [ -z "$pid" ]; then
            pid="$(find_mihomo_pid)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi

        if [ -n "$pid" ] && [ ! -x "$kernel_path" ]; then
            resolved_path="$(resolve_kernel_path_from_pid "$pid")"
            if [ -n "$resolved_path" ]; then
                kernel_path="$resolved_path"
            fi
        fi

        kernel_version=""
        if [ -x "$kernel_path" ]; then
            kernel_version="$($kernel_path -v 2>/dev/null | head -n 1 | tr -d '\r')"
        fi
        if [ -z "$kernel_version" ] && [ -n "$pid" ]; then
            kernel_version="$(resolve_kernel_version_from_pid "$pid")"
        fi

        uptime_sec=0
        if [ "$running" = true ] && [ -n "$pid" ]; then
            uptime_sec="$(get_mihomo_uptime_sec "$pid")"
        fi
        if ! echo "$uptime_sec" | grep -qE '^[0-9]+$'; then
            uptime_sec=0
        fi

        system_name="$(sw_vers -productName 2>/dev/null)"
        system_version="$(sw_vers -productVersion 2>/dev/null)"
        system_build="$(sw_vers -buildVersion 2>/dev/null)"

        default_route="$(route get default 2>/dev/null)"
        iface="$(echo "$default_route" | awk '/interface:/{print $2; exit}')"

        primary_iface="$(scutil --nwi 2>/dev/null | awk -F': ' '/Primary interface:/{print $2; exit}')"
        if [ -n "$primary_iface" ]; then
            iface="$primary_iface"
        fi
        if [[ "$iface" == utun* ]]; then
            iface=""
        fi

        if [[ "$iface" == utun* ]] || [ -z "$iface" ]; then
            fallback_iface="$(scutil --nwi 2>/dev/null | awk '/Network interfaces:/{print $3; exit}')"
            if [ -n "$fallback_iface" ]; then
                iface="$fallback_iface"
            else
                for cand in $(ifconfig -l); do
                    case "$cand" in
                        en*|bridge*|pdp_ip*)
                            if ipconfig getifaddr "$cand" >/dev/null 2>&1; then
                                iface="$cand"
                                break
                            fi
                            ;;
                    esac
                done
            fi
        fi

        rx_bytes=""
        tx_bytes=""
        if [ -n "$iface" ]; then
            read -r rx_bytes tx_bytes <<EOF
$(netstat -ibn 2>/dev/null | awk -v iface="$iface" '$1==iface {ibytes=$7; obytes=$10} END {print ibytes, obytes}')
EOF
        fi
        if ! echo "$rx_bytes" | grep -qE '^[0-9]+$'; then
            rx_bytes=""
        fi
        if ! echo "$tx_bytes" | grep -qE '^[0-9]+$'; then
            tx_bytes=""
        fi

        gateway=""
        if [ -n "$iface" ]; then
            gateway="$(ipconfig getoption "$iface" router 2>/dev/null)"
        fi
        if [ -z "$gateway" ]; then
            scoped_route="$(route -n get -ifscope "$iface" default 2>/dev/null)"
            gateway="$(echo "$scoped_route" | awk '/gateway:/{print $2; exit}')"
        fi
        if [ -z "$gateway" ]; then
            gateway="$(ipconfig getoption en0 router 2>/dev/null)"
        fi
        if [ -z "$gateway" ]; then
            gateway="$(ipconfig getoption en1 router 2>/dev/null)"
        fi
        if [ -z "$gateway" ]; then
            gateway="$(echo "$default_route" | awk '/gateway:/{print $2; exit}')"
        fi

        network_name=""
        if [ -n "$iface" ] && command -v networksetup >/dev/null 2>&1; then
            service_name="$(networksetup -listnetworkserviceorder 2>/dev/null | awk -v iface="$iface" '
                $0 ~ "\\(" iface "\\)" {print last; exit}
                {last=$0}
            ' | sed -E 's/^\\([0-9]+\\) //')"
            network_name="$service_name"
            if [ -z "$network_name" ]; then
                network_name="$(networksetup -listallhardwareports | awk -v iface="$iface" '
                    $1=="Hardware" && $2=="Port:" {port=$0; sub("Hardware Port: ","",port)}
                    $1=="Device:" && $2==iface {print port; exit}
                ')"
            fi
        fi
        if [[ "$iface" == en* ]]; then
            network_name="Wi-Fi"
        elif echo "$network_name" | grep -qiE 'hotspot|iphone|ipad'; then
            network_name="Personal Hotspot"
        elif echo "$network_name" | grep -qiE 'wi[- ]?fi|airport|wlan'; then
            network_name="Wi-Fi"
        fi
        if [ -z "$network_name" ] || [[ "$network_name" == utun* ]]; then
            network_name="Wi-Fi"
        fi

        local_ip=""
        local_ip="$(ipconfig getifaddr en0 2>/dev/null)"
        if [ -n "$local_ip" ] && ! echo "$local_ip" | grep -q '\.'; then
            local_ip=""
        fi
        if [ -z "$local_ip" ] && [ -n "$iface" ]; then
            local_ip="$(ipconfig getifaddr "$iface" 2>/dev/null)"
        fi
        if [ -n "$local_ip" ] && ! echo "$local_ip" | grep -q '\.'; then
            local_ip=""
        fi
        if [ -z "$local_ip" ] && [ -n "$iface" ]; then
            local_ip="$(ifconfig "$iface" 2>/dev/null | awk '/inet /{print $2; exit}')"
        fi
        if [ -n "$local_ip" ] && ! echo "$local_ip" | grep -q '\.'; then
            local_ip=""
        fi
        if [ -z "$local_ip" ]; then
            local_ip="$(ipconfig getifaddr en1 2>/dev/null)"
        fi
        if [ -n "$local_ip" ] && ! echo "$local_ip" | grep -q '\.'; then
            local_ip=""
        fi

        internet_ms=""
        internet_ip_v4=""
        internet_ip_v6=""
        internet_ip_direct=""
        proxy_ip=""
        dns_ms=""
        router_ms=""

        cache_file="$CLASHFOX_PID_DIR/overview_cache"
        cache_valid=false
        now_ts="$(date +%s)"
        if [ "$disable_cache" = false ] && [ -f "$cache_file" ]; then
            # shellcheck disable=SC1090
            . "$cache_file"
            if [ -n "${ts:-}" ] && [ $((now_ts - ts)) -lt "$cache_ttl" ]; then
                cache_valid=true
                internet_ip_v4="${internet_ip_v4:-}"
                internet_ip_v6="${internet_ip_v6:-}"
                internet_ms="${internet_ms:-}"
                proxy_ip="${proxy_ip:-}"
                dns_ms="${dns_ms:-}"
                router_ms="${router_ms:-}"
                if [ -n "$internet_ip_v6" ] && ! echo "$internet_ip_v6" | grep -q ':'; then
                    if [ -z "$internet_ip_v4" ] && echo "$internet_ip_v6" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'; then
                        internet_ip_v4="$internet_ip_v6"
                    fi
                    internet_ip_v6=""
                fi
                if [ -n "$internet_ip_v4" ] && ! echo "$internet_ip_v4" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'; then
                    internet_ip_v4=""
                fi
                # Avoid reusing incomplete cache where preferred IPv4 is missing.
                if [ -z "$internet_ip_v4" ]; then
                    cache_valid=false
                fi
            fi
        fi

        if [ "$cache_valid" = false ]; then
        curl_env=(
            env
            -u http_proxy
            -u https_proxy
            -u all_proxy
            -u HTTP_PROXY
            -u HTTPS_PROXY
            -u ALL_PROXY
            -u no_proxy
            -u NO_PROXY
        )
        direct_iface_curl_args=()
        if [ -n "$iface" ]; then
            case "$iface" in
                en*|bridge*|pdp_ip*)
                    direct_iface_curl_args=(--interface "$iface")
                    ;;
            esac
        fi
        direct_curl_args=()
        if [ -n "${CLASHFOX_CURL_BIND_IFACE:-}" ]; then
            direct_curl_args=(--interface "$CLASHFOX_CURL_BIND_IFACE")
        fi

        ipip_curl_args=("${direct_curl_args[@]}")
        if [ ${#ipip_curl_args[@]} -eq 0 ] && [ -n "$iface" ]; then
            case "$iface" in
                en*|bridge*|pdp_ip*)
                    ipip_curl_args=(--interface "$iface")
                    ;;
            esac
        fi
        ipip_url="https://myip.ipip.net/json?t=$(date +%s)$RANDOM"

        # Primary source: assign Internet IP directly from ipip JSON endpoint.
        internet_ip_resp="$("${curl_env[@]}" curl "${ipip_curl_args[@]}" -s --connect-timeout 3 --max-time 8 --noproxy '*' "$ipip_url" 2>/dev/null)"
        if [ -n "$internet_ip_resp" ]; then
            internet_ip_direct="$(extract_ipip_ip "$internet_ip_resp")"
        fi

        # Optional retry with the same endpoint without interface binding.
        if [ -z "$internet_ip_direct" ]; then
            internet_ip_resp="$("${curl_env[@]}" curl -s --connect-timeout 3 --max-time 8 --noproxy '*' "$ipip_url" 2>/dev/null)"
            if [ -n "$internet_ip_resp" ]; then
                internet_ip_direct="$(extract_ipip_ip "$internet_ip_resp")"
            fi
        fi
        # Final retry: use plain curl path (same behavior as manual command).
        if [ -z "$internet_ip_direct" ]; then
            internet_ip_resp="$(curl -s "$ipip_url" 2>/dev/null)"
            if [ -n "$internet_ip_resp" ]; then
                internet_ip_direct="$(extract_ipip_ip "$internet_ip_resp")"
            fi
        fi
        if [ -n "$internet_ip_direct" ]; then
            if echo "$internet_ip_direct" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'; then
                internet_ip_v4="$internet_ip_direct"
                internet_ip_v6=""
            elif echo "$internet_ip_direct" | grep -qE '^[0-9]+\\.[0-9]+\\.\\*\\.[0-9]+$'; then
                # ipip may return masked IPv4 such as 36.4.*.226
                internet_ip_v4="$internet_ip_direct"
                internet_ip_v6=""
            elif echo "$internet_ip_direct" | grep -q ':'; then
                internet_ip_v6="$internet_ip_direct"
                internet_ip_v4=""
            fi
        fi

        if [ -n "$internet_ip_v6" ] && ! echo "$internet_ip_v6" | grep -q ':'; then
            if [ -z "$internet_ip_v4" ] && echo "$internet_ip_v6" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'; then
                internet_ip_v4="$internet_ip_v6"
            fi
            internet_ip_v6=""
        fi

        if [ -n "$internet_ip_v4" ] && ! echo "$internet_ip_v4" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$|^[0-9]+\\.[0-9]+\\.\\*\\.[0-9]+$'; then
            internet_ip_v4=""
        fi
        if [ -n "$internet_ip_direct" ]; then
            internet_ip="$internet_ip_direct"
        elif [ -n "$internet_ip_v4" ]; then
            internet_ip="$internet_ip_v4"
        else
            internet_ip="-"
        fi
        proxy_ip=""
        if [ -n "$MIHOMO_PROXY_PORT" ]; then
            proxy_ip="$("${curl_env[@]}" curl --proxy "http://127.0.0.1:$MIHOMO_PROXY_PORT" --noproxy '' -s --max-time 3 https://api.ipify.org 2>/dev/null)"
            if [ -z "$proxy_ip" ]; then
                proxy_ip="$("${curl_env[@]}" curl --proxy "http://127.0.0.1:$MIHOMO_PROXY_PORT" --noproxy '' -s --max-time 3 https://ifconfig.me/ip 2>/dev/null)"
            fi
            if [ -z "$proxy_ip" ]; then
                proxy_ip="$("${curl_env[@]}" curl --proxy "http://127.0.0.1:$MIHOMO_PROXY_PORT" --noproxy '' -s --max-time 3 https://icanhazip.com 2>/dev/null | tr -d '[:space:]')"
            fi
        fi
        proxy_ip="$(printf '%s' "$proxy_ip" | tr -d '[:space:]')"
        if [ -z "$proxy_ip" ]; then
            proxy_ip="-"
        fi

        dns_ms=""
        if command -v python3 >/dev/null 2>&1; then
            dns_ms="$(python3 - <<'PY'
import socket, time
start = time.time()
try:
    socket.getaddrinfo("apple.com", 80)
    print(int((time.time() - start) * 1000))
except Exception:
    print("")
PY
)"
        fi
        # Keep Internet latency refresh in the same cycle as DNS/Router and avoid
        # coupling to public-IP probe success.
        internet_ms=""
        if command -v python3 >/dev/null 2>&1; then
            internet_ms="$(python3 - <<'PY'
import socket, time
start = time.time()
try:
    sock = socket.create_connection(("1.1.1.1", 443), timeout=1.5)
    sock.close()
    print(int((time.time() - start) * 1000))
except Exception:
    print("")
PY
)"
        fi
        if [ -z "$internet_ms" ] && command -v curl >/dev/null 2>&1; then
            internet_ms="$("${curl_env[@]}" curl "${direct_curl_args[@]}" -s -o /dev/null -w '%{time_connect}' --max-time 2 --noproxy '*' https://1.1.1.1 2>/dev/null | awk '{if ($1>0) printf "%.0f", $1*1000}')"
        fi
        if [ -z "$internet_ms" ]; then
            internet_ms="$(ping -c 1 -W 1000 1.1.1.1 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            if [ -z "$internet_ms" ]; then
                internet_ms="$(ping -c 1 -t 1 1.1.1.1 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            fi
        fi

        router_ms=""
        if [ -n "$gateway" ] && command -v python3 >/dev/null 2>&1; then
            router_ms="$(CLASHFOX_GATEWAY="$gateway" python3 - <<'PY'
import os, socket, time
gw = os.environ.get("CLASHFOX_GATEWAY", "")
if not gw:
    print("")
    raise SystemExit
start = time.time()
try:
    sock = socket.create_connection((gw, 53), timeout=1.5)
    sock.close()
    print(int((time.time() - start) * 1000))
except Exception:
    print("")
PY
)"
        fi
        if [ -z "$router_ms" ] && [ -n "$gateway" ]; then
            router_ms="$(ping -c 1 -W 1000 "$gateway" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            if [ -z "$router_ms" ]; then
                router_ms="$(ping -c 1 -t 1 "$gateway" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            fi
        fi
        if [ -z "$router_ms" ] && [ -n "$gateway" ] && command -v python3 >/dev/null 2>&1; then
            router_ms="$(CLASHFOX_GATEWAY="$gateway" python3 - <<'PY'
import os, socket, time
gw = os.environ.get("CLASHFOX_GATEWAY", "")
if not gw:
    print("")
    raise SystemExit
for port in (443, 80, 22, 53):
    start = time.time()
    try:
        sock = socket.create_connection((gw, port), timeout=1.2)
        sock.close()
        print(int((time.time() - start) * 1000))
        raise SystemExit
    except Exception:
        pass
print("")
PY
)"
        fi
        if [ -z "$router_ms" ] && [ -n "$local_ip" ] && echo "$local_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
            guessed_gateway="$(echo "$local_ip" | awk -F'.' '{print $1"."$2"."$3".1"}')"
            if [ -n "$guessed_gateway" ]; then
                router_ms="$(ping -c 1 -W 1000 "$guessed_gateway" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
                if [ -z "$router_ms" ]; then
                    router_ms="$(ping -c 1 -t 1 "$guessed_gateway" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
                fi
            fi
        fi

        if [ "$disable_cache" = false ]; then
            {
                printf 'ts=%s\n' "$now_ts"
                printf 'internet_ip_v4=%q\n' "$internet_ip_v4"
                printf 'internet_ip_v6=%q\n' "$internet_ip_v6"
                printf 'internet_ms=%q\n' "$internet_ms"
                printf 'proxy_ip=%q\n' "$proxy_ip"
                printf 'dns_ms=%q\n' "$dns_ms"
                printf 'router_ms=%q\n' "$router_ms"
            } > "$cache_file" 2>/dev/null || true
        fi
        fi

        if [ -n "$internet_ip_direct" ]; then
            internet_ip="$internet_ip_direct"
        elif [ -n "$internet_ip_v4" ]; then
            internet_ip="$internet_ip_v4"
        else
            internet_ip="-"
        fi

        proxy_ip="$(printf '%s' "$proxy_ip" | tr -d '[:space:]')"
        if [ -n "$proxy_ip" ]; then
            if [ -n "$internet_ip_v4" ] && [ "$proxy_ip" = "$internet_ip_v4" ]; then
                proxy_ip=""
            fi
            if [ -n "$internet_ip_v6" ] && [ "$proxy_ip" = "$internet_ip_v6" ]; then
                proxy_ip=""
            fi
        fi
        if [ -z "$proxy_ip" ]; then
            proxy_ip="-"
        fi

        connections=""
        memory=""
        connections="$(get_mihomo_connections)"
        if [ "$running" = false ] && [ -n "$connections" ]; then
            running=true
        fi
        memory_pid="$(find_mihomo_pid)"
        if [ "$running" = true ] && [ -n "$memory_pid" ]; then
            memory_mb="$(get_mihomo_rss_mb "$memory_pid")"
            if [ -z "$memory_mb" ]; then
                rss_kb="$(get_mihomo_rss_kb "$kernel_path")"
                if [ -n "$rss_kb" ]; then
                    memory_mb="$(awk -v rss="$rss_kb" 'BEGIN{printf "%.1f", rss/1024}')"
                fi
            fi
            if [ -n "$memory_mb" ]; then
                memory="${memory_mb} MB"
            fi
        fi

        data=$(cat <<JSON
{"running":$running,"kernelVersion":"$(json_escape "$kernel_version")","uptimeSec":$uptime_sec,"systemName":"$(json_escape "$system_name")","systemVersion":"$(json_escape "$system_version")","systemBuild":"$(json_escape "$system_build")","networkName":"$(json_escape "$network_name")","localIp":"$(json_escape "$local_ip")","proxyIp":"$(json_escape "$proxy_ip")","internetIp":"$(json_escape "$internet_ip")","internetIp4":"$(json_escape "$internet_ip_v4")","internetIp6":"$(json_escape "$internet_ip_v6")","internetMs":"$(json_escape "$internet_ms")","dnsMs":"$(json_escape "$dns_ms")","routerMs":"$(json_escape "$router_ms")","connections":"$(json_escape "$connections")","memory":"$(json_escape "$memory")","rxBytes":"$(json_escape "$rx_bytes")","txBytes":"$(json_escape "$tx_bytes")"}
JSON
)
        print_ok "$data"
        ;;
    traffic)
        config_path=""
        controller_override=""
        secret_override=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift || true
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift || true
                    secret_override="${1:-}"
                    ;;
            esac
            shift || true
        done

        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi

        if [ ! -f "$config_path" ]; then
            print_ok '{"up":"","down":""}'
            exit 0
        fi

        controller="$(grep -E '^[[:space:]]*external-controller:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*external-controller:[[:space:]]*//')"
        controller="${controller%\"}"
        controller="${controller#\"}"
        controller="${controller%\'}"
        controller="${controller#\'}"

        secret="$(grep -E '^[[:space:]]*secret:' "$config_path" | head -n 1 | sed -E 's/^[[:space:]]*secret:[[:space:]]*//')"
        secret="${secret%\"}"
        secret="${secret#\"}"
        secret="${secret%\'}"
        secret="${secret#\'}"

        if [ -n "$controller_override" ]; then
            controller="$controller_override"
        fi
        if [ -n "$secret_override" ]; then
            secret="$secret_override"
        fi

        if [ -z "$controller" ]; then
            print_ok '{"up":"","down":""}'
            exit 0
        fi

        if ! echo "$controller" | grep -qE '^https?://'; then
            controller="http://$controller"
        fi

        if [ -n "$secret" ]; then
            traffic_resp="$(curl -s --max-time 1 -H "Authorization: Bearer $secret" "$controller/traffic" 2>/dev/null)"
        else
            traffic_resp="$(curl -s --max-time 1 "$controller/traffic" 2>/dev/null)"
        fi

        up_val=""
        down_val=""
        if [ -n "$traffic_resp" ] && command -v python3 >/dev/null 2>&1; then
            parsed_traffic="$(CLASHFOX_TRAFFIC_RESP="$traffic_resp" python3 - <<'PY'
import json, os
raw = os.environ.get("CLASHFOX_TRAFFIC_RESP", "")
if not raw:
    print("|")
    raise SystemExit
try:
    data = json.loads(raw)
except Exception:
    print("|")
    raise SystemExit
def as_num(v):
    try:
        return float(v)
    except Exception:
        return None
up = as_num(data.get("up"))
down = as_num(data.get("down"))
up_s = str(int(up)) if up is not None and up >= 0 else ""
down_s = str(int(down)) if down is not None and down >= 0 else ""
print(f"{up_s}|{down_s}")
PY
)"
            up_val="${parsed_traffic%%|*}"
            down_val="${parsed_traffic#*|}"
        fi
        if [ -z "$up_val" ] || [ -z "$down_val" ]; then
            up_val="$(printf '%s' "$traffic_resp" | sed -n 's/.*"up"[[:space:]]*:[[:space:]]*\\([0-9]\\+\\).*/\\1/p')"
            down_val="$(printf '%s' "$traffic_resp" | sed -n 's/.*"down"[[:space:]]*:[[:space:]]*\\([0-9]\\+\\).*/\\1/p')"
        fi
        if [ -z "$up_val" ]; then
            up_val=""
        fi
        if [ -z "$down_val" ]; then
            down_val=""
        fi

        data=$(cat <<JSON
{"up":"$(json_escape "$up_val")","down":"$(json_escape "$down_val")"}
JSON
)
        print_ok "$data"
        ;;
    overview-lite)
        rotate_logs
        config_path=""
        controller_override=""
        secret_override=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift || true
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift || true
                    secret_override="${1:-}"
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"
        resolve_proxy_port_from_config "$config_path"
        if [ -n "$controller_override" ]; then
            if ! echo "$controller_override" | grep -qE '^https?://'; then
                MIHOMO_CONTROLLER="http://$controller_override"
            else
                MIHOMO_CONTROLLER="$controller_override"
            fi
        fi
        if [ -n "$secret_override" ]; then
            MIHOMO_SECRET="$secret_override"
        fi

        kernel_path="$CLASHFOX_CORE_DIR/$ACTIVE_CORE"
        pid_file="$CLASHFOX_PID_DIR/clashfox.pid"
        running=false
        pid=""
        if [ -f "$pid_file" ]; then
            pid="$(cat "$pid_file" 2>/dev/null)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi
        if [ -z "$pid" ]; then
            pid="$(find_mihomo_pid)"
            if pid_is_running "$pid"; then
                running=true
            else
                pid=""
            fi
        fi

        uptime_sec=0
        if [ "$running" = true ] && [ -n "$pid" ]; then
            uptime_sec="$(get_mihomo_uptime_sec "$pid")"
        fi
        if ! echo "$uptime_sec" | grep -qE '^[0-9]+$'; then
            uptime_sec=0
        fi

        connections=""
        memory=""
        pids=""
        if [ "$running" = true ]; then
            if [ -n "$pid" ]; then
                pids="$pid"
            fi
            extra_pids="$(pgrep -x "$ACTIVE_CORE" 2>/dev/null | tr '\n' ' ')"
            if [ -n "$extra_pids" ]; then
                pids="$pids $extra_pids"
            fi
            extra_path_pids="$(pgrep -f "$kernel_path" 2>/dev/null | tr '\n' ' ')"
            if [ -n "$extra_path_pids" ]; then
                pids="$pids $extra_path_pids"
            fi
            pids="$(echo "$pids" | awk '{for (i=1;i<=NF;i++) if (!seen[$i]++) printf "%s ", $i}')"
            pids="$(echo "$pids" | xargs)"
        fi

        connections="$(get_mihomo_connections)"
        if [ "$running" = false ] && [ -n "$connections" ]; then
            running=true
        fi
        memory_pid="$(find_mihomo_pid)"
        if [ -n "$pids" ] && [ -n "$memory_pid" ]; then
            memory_mb="$(get_mihomo_rss_mb "$memory_pid")"
            if [ -z "$memory_mb" ]; then
                rss_kb="$(get_mihomo_rss_kb "$kernel_path")"
                if [ -n "$rss_kb" ]; then
                    memory_mb="$(awk -v rss="$rss_kb" 'BEGIN{printf "%.1f", rss/1024}')"
                fi
            fi
            if [ -n "$memory_mb" ]; then
                memory="${memory_mb} MB"
            fi
        fi

        data=$(cat <<JSON
{"running":$running,"uptimeSec":$uptime_sec,"connections":"$(json_escape "$connections")","memory":"$(json_escape "$memory")"}
JSON
)
        print_ok "$data"
        ;;
    overview-memory)
        kernel_path="$CLASHFOX_CORE_DIR/$ACTIVE_CORE"
        running=false
        pid="$(find_mihomo_pid)"
        if pid_is_running "$pid"; then
            running=true
        else
            pid=""
        fi

        memory=""
        if [ "$running" = true ] && [ -n "$pid" ]; then
            memory_mb="$(get_mihomo_rss_mb "$pid")"
            if [ -z "$memory_mb" ]; then
                rss_kb="$(get_mihomo_rss_kb "$kernel_path")"
                if [ -n "$rss_kb" ]; then
                    memory_mb="$(awk -v rss="$rss_kb" 'BEGIN{printf "%.1f", rss/1024}')"
                fi
            fi
            if [ -n "$memory_mb" ]; then
                memory="${memory_mb} MB"
            fi
        fi

        data=$(cat <<JSON
{"memory":"$(json_escape "$memory")"}
JSON
)
        print_ok "$data"
        ;;
    panel-install)
        panel_name=""
        panel_url=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --name)
                    shift || true
                    panel_name="${1:-}"
                    ;;
                --url)
                    shift || true
                    panel_url="${1:-}"
                    ;;
            esac
            shift || true
        done

        if [ -z "$panel_name" ] || [ -z "$panel_url" ]; then
            print_err "missing_panel_info"
            exit 1
        fi
        if ! command -v curl >/dev/null 2>&1; then
            print_err "curl_missing"
            exit 1
        fi
        if ! command -v unzip >/dev/null 2>&1; then
            unzip_available=false
        else
            unzip_available=true
        fi
        if ! command -v tar >/dev/null 2>&1; then
            tar_available=false
        else
            tar_available=true
        fi

        if [ -z "$CLASHFOX_DATA_DIR" ]; then
            CLASHFOX_DATA_DIR="$CLASHFOX_USER_DATA_DIR/data"
        fi
        if ! mkdir -p "$CLASHFOX_DATA_DIR/ui" 2>/dev/null; then
            fallback_dir="$CLASHFOX_USER_DATA_DIR/data"
            if [ -n "$fallback_dir" ] && mkdir -p "$fallback_dir/ui" 2>/dev/null; then
                CLASHFOX_DATA_DIR="$fallback_dir"
            else
                rm -rf "$temp_dir"
                print_err "data_dir_unwritable"
                exit 1
            fi
        fi
        chmod u+rwx "$CLASHFOX_DATA_DIR" "$CLASHFOX_DATA_DIR/ui" 2>/dev/null || true

        panel_dir="$CLASHFOX_DATA_DIR/ui/$panel_name"
        if [ -d "$panel_dir" ] && [ -n "$(ls -A "$panel_dir" 2>/dev/null)" ]; then
            print_ok "{\"installed\":false,\"path\":\"$(json_escape "$panel_dir")\",\"skipped\":true}"
            exit 0
        fi

        temp_dir="$(mktemp -d)"
        archive_path="$temp_dir/panel.archive"
        unpack_dir="$temp_dir/unpack"
        mkdir -p "$unpack_dir"

        if ! curl -L -o "$archive_path" "$panel_url"; then
            rm -rf "$temp_dir"
            print_err "download_failed"
            exit 1
        fi

        case "$panel_url" in
            *.tgz|*.tar.gz)
                if [ "$tar_available" = false ]; then
                    rm -rf "$temp_dir"
                    print_err "tar_missing"
                    exit 1
                fi
                if ! tar -xzf "$archive_path" -C "$unpack_dir"; then
                    rm -rf "$temp_dir"
                    print_err "untar_failed"
                    exit 1
                fi
                ;;
            *)
                if [ "$unzip_available" = false ]; then
                    rm -rf "$temp_dir"
                    print_err "unzip_missing"
                    exit 1
                fi
                if ! unzip -q "$archive_path" -d "$unpack_dir"; then
                    rm -rf "$temp_dir"
                    print_err "unzip_failed"
                    exit 1
                fi
                ;;
        esac

        src_dir="$unpack_dir"
        shopt -s nullglob
        entries=( "$unpack_dir"/* )
        shopt -u nullglob
        if [ ${#entries[@]} -eq 1 ] && [ -d "${entries[0]}" ]; then
            src_dir="${entries[0]}"
        fi
        rm -rf "$panel_dir"
        mkdir -p "$panel_dir"
        if [ ! -w "$panel_dir" ]; then
            rm -rf "$temp_dir"
            print_err "data_dir_unwritable"
            exit 1
        fi
        if [ -z "$(ls -A "$src_dir" 2>/dev/null)" ]; then
            rm -rf "$temp_dir"
            print_err "empty_archive"
            exit 1
        fi
        if ! cp -R "$src_dir"/. "$panel_dir"/; then
            rm -rf "$temp_dir"
            print_err "copy_failed"
            exit 1
        fi

        rm -rf "$temp_dir"
        print_ok "{\"installed\":true,\"path\":\"$(json_escape "$panel_dir")\"}"
        ;;
    panel-activate)
        panel_name=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --name)
                    shift || true
                    panel_name="${1:-}"
                    ;;
            esac
            shift || true
        done

        if [ -z "$panel_name" ]; then
            print_err "missing_panel_info"
            exit 1
        fi

        if [ -z "$CLASHFOX_DATA_DIR" ]; then
            CLASHFOX_DATA_DIR="$CLASHFOX_USER_DATA_DIR/data"
        fi
        panel_dir="$CLASHFOX_DATA_DIR/ui/$panel_name"
        if [ ! -d "$panel_dir" ] || [ ! -f "$panel_dir/index.html" ]; then
            print_err "panel_missing"
            exit 1
        fi

        if [ -f "$panel_dir/index.html" ]; then
            tmp_file="$(mktemp)"
            if ! sed -E \
                -e "s#([\"'])/assets/#\\1assets/#g" \
                -e "s#([\"'])/_nuxt/#\\1_nuxt/#g" \
                -e "s#([\"'])/_fonts/#\\1_fonts/#g" \
                -e "s#([\"'])/registerSW\\.js#\\1registerSW.js#g" \
                -e "s#([\"'])/manifest\\.webmanifest#\\1manifest.webmanifest#g" \
                -e "s#([\"'])/favicon\\.ico#\\1favicon.ico#g" \
                -e "s#([\"'])/favicon\\.svg#\\1favicon.svg#g" \
                "$panel_dir/index.html" > "$tmp_file"; then
                rm -f "$tmp_file"
                print_err "config_update_failed"
                exit 1
            fi
            if ! mv "$tmp_file" "$panel_dir/index.html"; then
                rm -f "$tmp_file"
                print_err "config_update_failed"
                exit 1
            fi
        fi

        print_ok "{\"configured\":true,\"path\":\"$(json_escape "$panel_dir")\"}"
        ;;
    system-proxy-status)
        config_path=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_proxy_port_from_config "$config_path"
        if [ -z "$MIHOMO_PROXY_PORT" ]; then
            MIHOMO_PROXY_PORT="7890"
        fi
        service="$(resolve_active_network_service)"
        if [ -z "$service" ]; then
            print_err "network_service_not_found"
            exit 1
        fi

        IFS='|' read -r web_enabled web_server web_port <<< "$(read_network_proxy_triplet "$service" "-getwebproxy")"
        IFS='|' read -r secure_enabled secure_server secure_port <<< "$(read_network_proxy_triplet "$service" "-getsecurewebproxy")"
        IFS='|' read -r socks_enabled socks_server socks_port <<< "$(read_network_proxy_triplet "$service" "-getsocksfirewallproxy")"

        data="$(build_system_proxy_status_json "$service" "$MIHOMO_PROXY_PORT" "$web_enabled" "$web_server" "$web_port" "$secure_enabled" "$secure_server" "$secure_port" "$socks_enabled" "$socks_server" "$socks_port")"
        print_ok "$data"
        ;;
    system-proxy-enable)
        config_path=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
            esac
            shift || true
        done

        if ! ensure_sudo ""; then
            exit 1
        fi
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_proxy_port_from_config "$config_path"
        if [ -z "$MIHOMO_PROXY_PORT" ]; then
            MIHOMO_PROXY_PORT="7890"
        fi
        service="$(resolve_active_network_service)"
        if [ -z "$service" ]; then
            print_err "network_service_not_found"
            exit 1
        fi

        IFS='|' read -r web_enabled web_server web_port <<< "$(read_network_proxy_triplet "$service" "-getwebproxy")"
        IFS='|' read -r secure_enabled secure_server secure_port <<< "$(read_network_proxy_triplet "$service" "-getsecurewebproxy")"
        IFS='|' read -r socks_enabled socks_server socks_port <<< "$(read_network_proxy_triplet "$service" "-getsocksfirewallproxy")"

        takeover_active=false
        if is_yes_value "$web_enabled" && is_loopback_host "$web_server" && [ "$web_port" = "$MIHOMO_PROXY_PORT" ]; then
            takeover_active=true
        fi
        if is_yes_value "$secure_enabled" && is_loopback_host "$secure_server" && [ "$secure_port" = "$MIHOMO_PROXY_PORT" ]; then
            takeover_active=true
        fi
        if is_yes_value "$socks_enabled" && is_loopback_host "$socks_server" && [ "$socks_port" = "$MIHOMO_PROXY_PORT" ]; then
            takeover_active=true
        fi

        if [ "$takeover_active" = false ]; then
            save_system_proxy_snapshot "$service" "$web_enabled" "$web_server" "$web_port" "$secure_enabled" "$secure_server" "$secure_port" "$socks_enabled" "$socks_server" "$socks_port"
        fi

        if ! set_system_proxy_on "$service" "127.0.0.1" "$MIHOMO_PROXY_PORT"; then
            print_err "set_system_proxy_failed"
            exit 1
        fi

        data="$(build_system_proxy_status_json "$service" "$MIHOMO_PROXY_PORT" "Yes" "127.0.0.1" "$MIHOMO_PROXY_PORT" "Yes" "127.0.0.1" "$MIHOMO_PROXY_PORT" "Yes" "127.0.0.1" "$MIHOMO_PROXY_PORT")"
        print_ok "$data"
        ;;
    system-proxy-disable)
        if ! ensure_sudo ""; then
            exit 1
        fi

        active_service="$(resolve_active_network_service)"
        if [ -z "$active_service" ]; then
            print_err "network_service_not_found"
            exit 1
        fi

        restore_service="$active_service"
        web_enabled=""
        web_server=""
        web_port=""
        secure_enabled=""
        secure_server=""
        secure_port=""
        socks_enabled=""
        socks_server=""
        socks_port=""

        if [ -f "$SYSTEM_PROXY_STATE_FILE" ]; then
            # shellcheck disable=SC1090
            . "$SYSTEM_PROXY_STATE_FILE"
            if [ -n "${service:-}" ]; then
                restore_service="$service"
            fi
            web_enabled="${web_enabled:-}"
            web_server="${web_server:-}"
            web_port="${web_port:-}"
            secure_enabled="${secure_enabled:-}"
            secure_server="${secure_server:-}"
            secure_port="${secure_port:-}"
            socks_enabled="${socks_enabled:-}"
            socks_server="${socks_server:-}"
            socks_port="${socks_port:-}"
        fi

        if ! restore_system_proxy_triplet "$restore_service" "-setwebproxy" "-setwebproxystate" "$web_enabled" "$web_server" "$web_port"; then
            print_err "restore_system_proxy_failed"
            exit 1
        fi
        if ! restore_system_proxy_triplet "$restore_service" "-setsecurewebproxy" "-setsecurewebproxystate" "$secure_enabled" "$secure_server" "$secure_port"; then
            print_err "restore_system_proxy_failed"
            exit 1
        fi
        if ! restore_system_proxy_triplet "$restore_service" "-setsocksfirewallproxy" "-setsocksfirewallproxystate" "$socks_enabled" "$socks_server" "$socks_port"; then
            print_err "restore_system_proxy_failed"
            exit 1
        fi

        rm -f "$SYSTEM_PROXY_STATE_FILE"
        data=$(cat <<JSON
{"enabled":false,"service":"$(json_escape "$restore_service")"}
JSON
)
        print_ok "$data"
        ;;
    mode)
        mode=""
        config_path=""
        controller_override=""
        secret_override=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --mode)
                    shift
                    mode="$1"
                    ;;
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift
                    secret_override="${1:-}"
                    ;;
            esac
            shift || true
        done

        case "$mode" in
            global|rule|direct)
                ;;
            *)
                print_err "invalid_mode"
                exit 1
                ;;
        esac

        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"

        if [ -n "$controller_override" ]; then
            if ! echo "$controller_override" | grep -qE '^https?://'; then
                MIHOMO_CONTROLLER="http://$controller_override"
            else
                MIHOMO_CONTROLLER="$controller_override"
            fi
        fi
        if [ -n "$secret_override" ]; then
            MIHOMO_SECRET="$secret_override"
        fi

        if [ -z "$MIHOMO_CONTROLLER" ]; then
            print_err "controller_missing"
            exit 1
        fi
        if ! command -v curl >/dev/null 2>&1; then
            print_err "curl_missing"
            exit 1
        fi

        auth_args=()
        if [ -n "$MIHOMO_SECRET" ]; then
            auth_args=(-H "Authorization: Bearer $MIHOMO_SECRET")
        fi
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 -X PATCH "${auth_args[@]}" -H "Content-Type: application/json" -d "{\"mode\":\"$mode\"}" "$MIHOMO_CONTROLLER/configs" 2>/dev/null)"
        if echo "$code" | grep -qE '^(200|204)$'; then
            print_ok "{}"
        else
            print_err "request_failed"
            exit 1
        fi
        ;;
    tun-status)
        config_path=""
        controller_override=""
        secret_override=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift || true
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift || true
                    secret_override="${1:-}"
                    ;;
            esac
            shift || true
        done

        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"

        if [ -n "$controller_override" ]; then
            if ! echo "$controller_override" | grep -qE '^https?://'; then
                MIHOMO_CONTROLLER="http://$controller_override"
            else
                MIHOMO_CONTROLLER="$controller_override"
            fi
        fi
        if [ -n "$secret_override" ]; then
            MIHOMO_SECRET="$secret_override"
        fi

        if [ -z "$MIHOMO_CONTROLLER" ]; then
            print_err "controller_missing"
            exit 1
        fi
        if ! command -v curl >/dev/null 2>&1; then
            print_err "curl_missing"
            exit 1
        fi
        auth_args=()
        if [ -n "$MIHOMO_SECRET" ]; then
            auth_args=(-H "Authorization: Bearer $MIHOMO_SECRET")
        fi
        json="$(curl -s --max-time 2 "${auth_args[@]}" "$MIHOMO_CONTROLLER/configs" 2>/dev/null | tr '\n' ' ')"
        if [ -z "$json" ]; then
            print_err "request_failed"
            exit 1
        fi
        enabled="$(printf '%s' "$json" | sed -nE 's/.*\"tun\"[[:space:]]*:[[:space:]]*\\{[^}]*\"(enable|enabled)\"[[:space:]]*:[[:space:]]*([^,}\\ ]+).*/\\2/p')"
        if [ -z "$enabled" ]; then
            enabled="$(printf '%s' "$json" | sed -nE 's/.*\"tun\"[[:space:]]*:[[:space:]]*(true|false).*/\\1/p')"
        fi
        stack="$(printf '%s' "$json" | sed -nE 's/.*\"tun\"[[:space:]]*:[[:space:]]*\\{[^}]*\"stack\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p')"
        if [ -z "$enabled" ]; then
            print_err "tun_parse_failed"
            exit 1
        fi
        if [ -z "$stack" ]; then
            stack="mixed"
        fi
        print_ok "{\"enabled\":$enabled,\"stack\":\"$(json_escape "$stack")\"}"
        ;;
    tun)
        enable_value=""
        stack_value=""
        config_path=""
        controller_override=""
        secret_override=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --enable)
                    shift || true
                    enable_value="${1:-}"
                    ;;
                --stack)
                    shift || true
                    stack_value="${1:-}"
                    ;;
                --config|--config-path)
                    shift || true
                    config_path="${1:-}"
                    ;;
                --controller)
                    shift || true
                    controller_override="${1:-}"
                    ;;
                --secret)
                    shift || true
                    secret_override="${1:-}"
                    ;;
            esac
            shift || true
        done

        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        resolve_controller_from_config "$config_path"

        if [ -n "$controller_override" ]; then
            if ! echo "$controller_override" | grep -qE '^https?://'; then
                MIHOMO_CONTROLLER="http://$controller_override"
            else
                MIHOMO_CONTROLLER="$controller_override"
            fi
        fi
        if [ -n "$secret_override" ]; then
            MIHOMO_SECRET="$secret_override"
        fi

        if [ -z "$MIHOMO_CONTROLLER" ]; then
            print_err "controller_missing"
            exit 1
        fi
        if ! command -v curl >/dev/null 2>&1; then
            print_err "curl_missing"
            exit 1
        fi

        payload=""
        if [ -n "$enable_value" ]; then
            case "$enable_value" in
                true|false) ;;
                *) print_err "invalid_tun"; exit 1 ;;
            esac
            payload="{\"tun\":{\"enable\":$enable_value}}"
        fi
        if [ -n "$stack_value" ]; then
            case "$stack_value" in
                Mixed) stack_value="mixed" ;;
                gVisor) stack_value="gvisor" ;;
                System) stack_value="system" ;;
                Lwip|LWIP) stack_value="lwip" ;;
            esac
            case "$stack_value" in
                mixed|gvisor|system|lwip) ;;
                *) print_err "invalid_tun"; exit 1 ;;
            esac
            if [ -n "$payload" ]; then
                payload="{\"tun\":{\"enable\":${enable_value:-false},\"stack\":\"$stack_value\"}}"
            else
                payload="{\"tun\":{\"stack\":\"$stack_value\"}}"
            fi
        fi
        if [ -z "$payload" ]; then
            print_err "invalid_tun"
            exit 1
        fi

        auth_args=()
        if [ -n "$MIHOMO_SECRET" ]; then
            auth_args=(-H "Authorization: Bearer $MIHOMO_SECRET")
        fi
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 -X PATCH "${auth_args[@]}" -H "Content-Type: application/json" -d "$payload" "$MIHOMO_CONTROLLER/configs" 2>/dev/null)"
        if echo "$code" | grep -qE '^(200|204)$'; then
            print_ok "{}"
        else
            print_err "request_failed"
            exit 1
        fi
        ;;
    cores)
        files_sorted="$(ls -1t "$CLASHFOX_CORE_DIR"/* "$CLASHFOX_BACKUP_DIR"/mihomo.backup.* 2>/dev/null | awk 'NF')"
        if [ -z "$files_sorted" ]; then
            print_ok "[]"
            exit 0
        fi
        json="["
        first=true
        while IFS= read -r file; do
            [ -z "$file" ] && continue
            if [ ! -f "$file" ]; then
                continue
            fi
            name="$(basename "$file")"
            modified="$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null)"
            if [ -z "$modified" ]; then
                modified="-"
            fi
            size_bytes="$(stat -f "%z" "$file" 2>/dev/null)"
            if [ -z "$size_bytes" ]; then
                size_bytes="0"
            fi
            if [ "$first" = true ]; then
                first=false
            else
                json+=","
            fi
            json+="{\"name\":\"$(json_escape "$name")\",\"path\":\"$(json_escape "$file")\",\"modified\":\"$(json_escape "$modified")\",\"size\":\"$(json_escape "$size_bytes")\"}"
        done <<< "$files_sorted"
        json+="]"
        print_ok "$json"
        ;;
    backups)
        items=""
        index=1
        backup_files="$(get_backup_files_sorted)"
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            base="$(basename "$line")"
            ts=$(echo "$base" | sed -E 's/^mihomo\.backup\.mihomo-darwin-(amd64|arm64)-.+\.([0-9]{8}_[0-9]{6})$/\2/')
            version=$(echo "$base" | sed -E 's/^mihomo\.backup\.(mihomo-darwin-(amd64|arm64)-.+)\.[0-9]{8}_[0-9]{6}$/\1/')
            item=$(cat <<JSON
{"index":$index,"name":"$(json_escape "$base")","version":"$(json_escape "$version")","timestamp":"$(json_escape "$ts")","path":"$(json_escape "$line")"}
JSON
)
            if [ -z "$items" ]; then
                items="$item"
            else
                items="$items,$item"
            fi
            index=$((index + 1))
        done <<< "$backup_files"

        print_ok "[${items}]"
        ;;
    install)
        github_user=""
        version_branch=""
        sudo_pass="${CLASHFOX_SUDO_PASS:-}"
        while [ $# -gt 0 ]; do
            case "$1" in
                --github-user)
                    shift
                    github_user="$1"
                    ;;
                --version)
                    shift
                    version_branch="$1"
                    ;;
                --sudo-pass)
                    shift
                    sudo_pass="$1"
                    ;;
            esac
            shift || true
        done

        if [ -n "$github_user" ]; then
            export CLASHFOX_GITHUB_USER="$github_user"
        fi
        if [ -n "$version_branch" ]; then
            export CLASHFOX_VERSION_BRANCH="$version_branch"
        fi
        export CLASHFOX_AUTO_YES=1

        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi

        if install_core; then
            print_ok "{}"
        else
            print_err "install_failed"
            exit 1
        fi
        ;;
    start)
        config_path=""
        sudo_pass="${CLASHFOX_SUDO_PASS:-}"
        while [ $# -gt 0 ]; do
            case "$1" in
                --config)
                    shift
                    config_path="$1"
                    ;;
                --sudo-pass)
                    shift
                    sudo_pass="$1"
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        if [ ! -f "$config_path" ]; then
            fallback_config="$CLASHFOX_CONFIG_DIR/default.yaml"
            if [ -f "$fallback_config" ]; then
                config_path="$fallback_config"
            else
                print_err "config_not_found"
                exit 1
            fi
        fi
        export CLASHFOX_CONFIG_PATH="$config_path"
        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi
        export CLASHFOX_SUDO_PASS="$sudo_pass"

        if start_mihomo_kernel; then
            unset CLASHFOX_SUDO_PASS
            print_ok "{}"
        else
            unset CLASHFOX_SUDO_PASS
            print_err "start_failed"
            exit 1
        fi
        ;;
    stop)
        sudo_pass="${CLASHFOX_SUDO_PASS:-}"
        while [ $# -gt 0 ]; do
            case "$1" in
                --sudo-pass)
                    shift
                    sudo_pass="$1"
                    ;;
            esac
            shift || true
        done
        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi
        export CLASHFOX_SUDO_PASS="$sudo_pass"

        if kill_mihomo_kernel; then
            if is_running; then
                sleep 0.6
            fi
            if is_running; then
                force_kill
                sleep 0.6
            fi
        fi

        if is_running; then
            unset CLASHFOX_SUDO_PASS
            print_err "stop_failed"
            exit 1
        else
            unset CLASHFOX_SUDO_PASS
            print_ok "{}"
        fi
        ;;
    restart)
        config_path=""
        sudo_pass="${CLASHFOX_SUDO_PASS:-}"
        while [ $# -gt 0 ]; do
            case "$1" in
                --config)
                    shift
                    config_path="$1"
                    ;;
                --sudo-pass)
                    shift
                    sudo_pass="$1"
                    ;;
            esac
            shift || true
        done
        if [ -z "$config_path" ]; then
            config_path="$CLASHFOX_CONFIG_DIR/default.yaml"
        fi
        if [ ! -f "$config_path" ]; then
            fallback_config="$CLASHFOX_CONFIG_DIR/default.yaml"
            if [ -f "$fallback_config" ]; then
                config_path="$fallback_config"
            else
                print_err "config_not_found"
                exit 1
            fi
        fi
        export CLASHFOX_CONFIG_PATH="$config_path"
        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi
        export CLASHFOX_SUDO_PASS="$sudo_pass"

        if kill_mihomo_kernel; then
            if is_running; then
                force_kill
            fi
        fi
        if is_running; then
            unset CLASHFOX_SUDO_PASS
            print_err "stop_failed"
            exit 1
        fi

        if start_mihomo_kernel; then
            if is_running; then
                unset CLASHFOX_SUDO_PASS
                print_ok "{}"
            else
                unset CLASHFOX_SUDO_PASS
                print_err "start_failed"
                exit 1
            fi
        else
            unset CLASHFOX_SUDO_PASS
            print_err "restart_failed"
            exit 1
        fi
        ;;
    switch)
        index=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --index)
                    shift
                    index="$1"
                    ;;
            esac
            shift || true
        done
        if [ -z "$index" ]; then
            print_err "missing_index"
            exit 1
        fi
        if [ ! -d "$CLASHFOX_CORE_DIR" ]; then
            print_err "core_dir_missing"
            exit 1
        fi

        cd "$CLASHFOX_CORE_DIR" || {
            print_err "core_dir_enter_fail"
            exit 1
        }

        backup_files="$(get_backup_files_sorted)"
        if [ -z "$backup_files" ]; then
            print_err "no_backups"
            exit 1
        fi

        target_backup="$(echo "$backup_files" | sed -n "${index}p")"
        if [ -z "$target_backup" ]; then
            print_err "backup_not_found"
            exit 1
        fi

        tmp_core="${ACTIVE_CORE}.tmp"
        if ! cp "$target_backup" "$tmp_core" 2>/dev/null; then
            print_err "switch_copy_failed"
            exit 1
        fi
        mv -f "$tmp_core" "$ACTIVE_CORE"
        chmod +x "$ACTIVE_CORE"
        print_ok "{}"
        ;;
    logs)
        lines=200
        while [ $# -gt 0 ]; do
            case "$1" in
                --lines)
                    shift
                    lines="$1"
                    ;;
            esac
            shift || true
        done

        log_path="$CLASHFOX_LOG_DIR/clashfox.log"
        if [ ! -f "$log_path" ]; then
            print_err "log_missing"
            exit 1
        fi

        content="$(tail -n "$lines" "$log_path" 2>/dev/null)"
        content_b64="$(printf '%s' "$content" | base64 | tr -d '\n')"
        data=$(cat <<JSON
{"path":"$(json_escape "$log_path")","lines":$lines,"contentBase64":"$content_b64","encoding":"base64"}
JSON
)
        print_ok "$data"
        ;;
    clean)
        mode=""
        while [ $# -gt 0 ]; do
            case "$1" in
                --mode)
                    shift
                    mode="$1"
                    ;;
            esac
            shift || true
        done

        case "$mode" in
            all)
                rm -f "$CLASHFOX_LOG_DIR"/clashfox.log.*.log
                rm -f "$CLASHFOX_LOG_DIR"/clashfox.log.*.gz
                ;;
            7d)
                find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.log" -mtime +7 -delete
                find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.gz" -mtime +7 -delete
                ;;
            30d)
                find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.log" -mtime +30 -delete
                find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.gz" -mtime +30 -delete
                ;;
            *)
                print_err "invalid_mode"
                exit 1
                ;;
        esac

        print_ok "{}"
        ;;
    delete-backups)
        sudo_pass="${CLASHFOX_SUDO_PASS:-}"
        paths=()
        while [ $# -gt 0 ]; do
            case "$1" in
                --path)
                    shift
                    paths+=("$1")
                    ;;
                --sudo-pass)
                    shift
                    sudo_pass="$1"
                    ;;
            esac
            shift || true
        done
        if [ "${#paths[@]}" -eq 0 ]; then
            print_err "missing_paths"
            exit 1
        fi
        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi
        for p in "${paths[@]}"; do
            case "$p" in
                "$CLASHFOX_BACKUP_DIR"/mihomo.backup.*)
                    sudo rm -f "$p"
                    ;;
            esac
        done
        print_ok "{}"
        ;;
    *)
        print_err "unknown_command"
        exit 1
        ;;
esac
