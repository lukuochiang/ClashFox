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

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//"/\\"}"
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
    sudo pkill -x "$ACTIVE_CORE" >/dev/null 2>&1 || true
    local pid_file="$CLASHFOX_PID_DIR/clashfox.pid"
    if [ -f "$pid_file" ]; then
        rm -f "$pid_file"
    fi
}

ensure_sudo() {
    local sudo_pass="$1"
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
    local token="${CLASHFOX_MIHOMO_TOKEN:-clashfox}"
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

case "$command" in
    status)
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

        version=""
        if [ -x "$kernel_path" ]; then
            version="$($kernel_path -v 2>/dev/null | head -n 1 | tr -d '\r')"
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

        kernel_version=""
        if [ -x "$kernel_path" ]; then
            kernel_version="$($kernel_path -v 2>/dev/null | head -n 1 | tr -d '\r')"
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
        internet_ip_resp="$(curl -4 -s --max-time 2 -w '\n%{time_total}' https://api.ipify.org 2>/dev/null)"
        if [ -n "$internet_ip_resp" ]; then
            internet_ip="$(printf '%s\n' "$internet_ip_resp" | head -n 1 | tr -d '[:space:]')"
            internet_time="$(printf '%s\n' "$internet_ip_resp" | tail -n 1)"
            internet_ms="$(printf '%s' "$internet_time" | awk '{if ($1>0) printf "%.0f", $1*1000}')"
        fi
        if [ -z "$internet_ip" ]; then
            internet_ip_resp="$(curl -4 -s --max-time 2 -w '\n%{time_total}' https://ifconfig.me/ip 2>/dev/null)"
            if [ -n "$internet_ip_resp" ]; then
                internet_ip="$(printf '%s\n' "$internet_ip_resp" | head -n 1 | tr -d '[:space:]')"
                if [ -z "$internet_ms" ]; then
                    internet_time="$(printf '%s\n' "$internet_ip_resp" | tail -n 1)"
                    internet_ms="$(printf '%s' "$internet_time" | awk '{if ($1>0) printf "%.0f", $1*1000}')"
                fi
            fi
        fi
        if [ -z "$internet_ip" ]; then
            internet_ip_resp="$(curl -4 -s --max-time 2 -w '\n%{time_total}' https://icanhazip.com 2>/dev/null)"
            if [ -n "$internet_ip_resp" ]; then
                internet_ip="$(printf '%s\n' "$internet_ip_resp" | head -n 1 | tr -d '[:space:]')"
                if [ -z "$internet_ms" ]; then
                    internet_time="$(printf '%s\n' "$internet_ip_resp" | tail -n 1)"
                    internet_ms="$(printf '%s' "$internet_time" | awk '{if ($1>0) printf "%.0f", $1*1000}')"
                fi
            fi
        fi
        if [ -z "$internet_ip" ]; then
            internet_ip="-"
        fi
        if [ -z "$internet_ms" ] && [ -n "$internet_ip" ] && [ "$internet_ip" != "-" ]; then
            internet_ms="$(ping -c 1 -W 1000 "$internet_ip" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            if [ -z "$internet_ms" ]; then
                internet_ms="$(ping -c 1 -t 1 "$internet_ip" 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            fi
        fi

        proxy_ip="$(curl -x http://127.0.0.1:7890 -s --max-time 3 https://api.ipify.org 2>/dev/null)"
        if [ -z "$proxy_ip" ]; then
            proxy_ip="$(curl -x http://127.0.0.1:7890 -s --max-time 3 https://ifconfig.me/ip 2>/dev/null)"
        fi
        if [ -z "$proxy_ip" ]; then
            proxy_ip="$(curl -x http://127.0.0.1:7890 -s --max-time 3 https://icanhazip.com 2>/dev/null | tr -d '[:space:]')"
        fi
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
        if [ -z "$internet_ms" ]; then
            internet_ms="$(ping -c 1 -W 1000 1.1.1.1 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            if [ -z "$internet_ms" ]; then
                internet_ms="$(ping -c 1 -t 1 1.1.1.1 2>/dev/null | sed -n 's/.*time=\\([0-9.]*\\).*/\\1/p' | head -n 1)"
            fi
        fi
        if [ -z "$internet_ms" ] && command -v curl >/dev/null 2>&1; then
            internet_ms="$(curl -s -o /dev/null -w '%{time_connect}' --max-time 2 https://1.1.1.1 2>/dev/null | awk '{if ($1>0) printf "%.0f", $1*1000}')"
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
{"running":$running,"kernelVersion":"$(json_escape "$kernel_version")","uptimeSec":$uptime_sec,"systemName":"$(json_escape "$system_name")","systemVersion":"$(json_escape "$system_version")","systemBuild":"$(json_escape "$system_build")","networkName":"$(json_escape "$network_name")","localIp":"$(json_escape "$local_ip")","proxyIp":"$(json_escape "$proxy_ip")","internetIp":"$(json_escape "$internet_ip")","internetMs":"$(json_escape "$internet_ms")","dnsMs":"$(json_escape "$dns_ms")","routerMs":"$(json_escape "$router_ms")","connections":"$(json_escape "$connections")","memory":"$(json_escape "$memory")"}
JSON
)
        print_ok "$data"
        ;;
    overview-lite)
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
    backups)
        items=""
        index=1
        backup_files="$(ls -1t "$CLASHFOX_CORE_DIR"/mihomo.backup.* 2>/dev/null)"
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
        sudo_pass=""
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
        sudo_pass=""
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
        if [ -n "$config_path" ]; then
            export CLASHFOX_CONFIG_PATH="$config_path"
        fi
        if ! ensure_sudo "$sudo_pass"; then
            exit 1
        fi

        if start_mihomo_kernel; then
            print_ok "{}"
        else
            print_err "start_failed"
            exit 1
        fi
        ;;
    stop)
        sudo_pass=""
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
            print_err "stop_failed"
            exit 1
        else
            print_ok "{}"
        fi
        ;;
    restart)
        sudo_pass=""
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

        if kill_mihomo_kernel; then
            if is_running; then
                force_kill
            fi
        fi
        if is_running; then
            print_err "stop_failed"
            exit 1
        fi

        if stop_mihomo_kernel; then
            if is_running; then
                force_kill
            fi
        fi
        if is_running; then
            print_err "stop_failed"
            exit 1
        fi

        if start_mihomo_kernel; then
            if is_running; then
                print_ok "{}"
            else
                print_err "start_failed"
                exit 1
            fi
        else
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

        backup_files="$(ls -1t mihomo.backup.* 2>/dev/null)"
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
                rm -f "$CLASHFOX_LOG_DIR"/clashfox.log.*.gz
                ;;
            7d)
                find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.gz" -mtime +7 -delete
                ;;
            30d)
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
        sudo_pass=""
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
                "$CLASHFOX_CORE_DIR"/mihomo.backup.*)
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
