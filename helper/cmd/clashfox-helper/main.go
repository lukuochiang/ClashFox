package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	socketPath = "/var/run/clashfox-helper.sock"
	httpAddr   = "127.0.0.1:19999"
	logPath    = "/var/log/clashfox-helper.log"
)

var (
	version   = "dev"
	buildTime = "unknown"
	gitCommit = "unknown"
)

type helperRequest struct {
	ID         string   `json:"id"`
	Cmd        string   `json:"cmd"`
	Args       []string `json:"args"`
	BridgePath string   `json:"bridgePath"`
	Cwd        string   `json:"cwd"`
}

var (
	logger  *log.Logger
	logFile *os.File
	logMu   sync.Mutex
)

var defaultAllowedCommandList = []string{
	"ping",
	"status",
	"start",
	"stop",
	"restart",
	"install",
	"delete-backups",
	"system-proxy-status",
	"system-proxy-enable",
	"system-proxy-disable",
	"tun-status",
	"tun",
}

var allowedCommands = map[string]struct{}{}

func initLogger() {
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		logger = log.New(os.Stderr, "[clashfox-helper] ", log.LstdFlags)
		logger.Printf("open log file failed: %v", err)
		return
	}
	logFile = f
	logger = log.New(f, "", log.LstdFlags)
}

func logf(format string, args ...any) {
	logMu.Lock()
	defer logMu.Unlock()
	if logger != nil {
		logger.Printf(format, args...)
	}
}

func jsonFail(code string, details string) []byte {
	payload := map[string]any{
		"ok":    false,
		"error": code,
	}
	if strings.TrimSpace(details) != "" {
		payload["details"] = details
	}
	data, _ := json.Marshal(payload)
	return data
}

func jsonPingOK() []byte {
	payload := map[string]any{
		"ok": true,
		"data": map[string]any{
			"status":    "ok",
			"version":   version,
			"buildTime": buildTime,
			"gitCommit": gitCommit,
		},
	}
	data, _ := json.Marshal(payload)
	return data
}

func findJSONPayload(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		var anyPayload any
		if json.Unmarshal([]byte(trimmed), &anyPayload) == nil {
			return trimmed, true
		}
	}
	scanner := bufio.NewScanner(strings.NewReader(trimmed))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "[") {
			var anyPayload any
			if json.Unmarshal([]byte(line), &anyPayload) == nil {
				return line, true
			}
		}
	}
	return "", false
}

func defaultBridgePath() string {
	candidates := []string{
		"/Applications/ClashFox.app/Contents/Resources/scripts/gui_bridge.sh",
	}
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func buildAllowedCommandMap(list []string) map[string]struct{} {
	m := make(map[string]struct{}, len(list))
	for _, item := range list {
		cmd := strings.TrimSpace(item)
		if cmd == "" {
			continue
		}
		m[cmd] = struct{}{}
	}
	return m
}

func parseAllowedCommandList(raw []byte) ([]string, error) {
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return arr, nil
	}
	var obj struct {
		Commands []string `json:"commands"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && len(obj.Commands) > 0 {
		return obj.Commands, nil
	}
	return nil, errors.New("invalid_allowed_commands_json")
}

func resolveAllowedCommandList() []string {
	candidates := []string{
		"/Applications/ClashFox.app/Contents/Resources/helper/allowed-commands.json",
	}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		list, err := parseAllowedCommandList(data)
		if err != nil || len(list) == 0 {
			continue
		}
		logf("loaded allowed commands from %s", p)
		return list
	}
	logf("using built-in allowed command list")
	return defaultAllowedCommandList
}

func isAllowedCommand(cmd string) bool {
	_, ok := allowedCommands[cmd]
	return ok
}

func isAllowedBridgePath(p string) bool {
	clean := filepath.Clean(strings.TrimSpace(p))
	if clean == "" || filepath.Base(clean) != "gui_bridge.sh" {
		return false
	}
	return strings.HasSuffix(clean, "/scripts/gui_bridge.sh")
}

func resolveBridgePath(reqPath string) string {
	if isAllowedBridgePath(reqPath) {
		if st, err := os.Stat(reqPath); err == nil && !st.IsDir() {
			return reqPath
		}
	}
	return defaultBridgePath()
}

func readCommandOutput(bin string, args ...string) string {
	out, err := exec.Command(bin, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func detectConsoleUser() string {
	user := readCommandOutput("/usr/bin/stat", "-f%Su", "/dev/console")
	if user == "" || user == "root" || user == "loginwindow" {
		return ""
	}
	return user
}

func detectConsoleUserHome(user string) string {
	if user == "" {
		return ""
	}
	raw := readCommandOutput("/usr/bin/dscl", ".", "-read", "/Users/"+user, "NFSHomeDirectory")
	if raw != "" {
		const prefix = "NFSHomeDirectory:"
		for _, line := range strings.Split(raw, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, prefix) {
				home := strings.TrimSpace(strings.TrimPrefix(line, prefix))
				if home != "" {
					return home
				}
			}
		}
	}
	fallback := "/Users/" + user
	if st, err := os.Stat(fallback); err == nil && st.IsDir() {
		return fallback
	}
	return ""
}

func withUserScopedEnv(base []string) []string {
	env := make(map[string]string, len(base))
	for _, kv := range base {
		if kv == "" {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		key := parts[0]
		val := ""
		if len(parts) == 2 {
			val = parts[1]
		}
		env[key] = val
	}

	user := detectConsoleUser()
	home := detectConsoleUserHome(user)
	if home != "" {
		env["HOME"] = home
		if user != "" {
			env["USER"] = user
			env["LOGNAME"] = user
			if env["SUDO_USER"] == "" {
				env["SUDO_USER"] = user
			}
		}
		if env["CLASHFOX_USER_DATA_DIR"] == "" {
			env["CLASHFOX_USER_DATA_DIR"] = filepath.Join(home, "Library", "Application Support", "ClashFox")
		}
	}

	out := make([]string, 0, len(env))
	for k, v := range env {
		out = append(out, k+"="+v)
	}
	return out
}

func runBridge(req helperRequest) []byte {
	if !isAllowedCommand(req.Cmd) {
		return jsonFail("unsupported_command", req.Cmd)
	}

	bridgePath := resolveBridgePath(req.BridgePath)
	if bridgePath == "" {
		return jsonFail("script_missing", "bridge_path_empty")
	}
	if st, err := os.Stat(bridgePath); err != nil || st.IsDir() {
		return jsonFail("script_missing", bridgePath)
	}

	args := []string{bridgePath, req.Cmd}
	args = append(args, req.Args...)
	cmd := exec.Command("/bin/bash", args...)
	if cwd := strings.TrimSpace(req.Cwd); cwd != "" {
		if st, err := os.Stat(cwd); err == nil && st.IsDir() {
			cmd.Dir = cwd
		}
	}
	baseEnv := append(os.Environ(), "CLASHFOX_GUI_MODE=1", "CLASHFOX_SILENT=1")
	cmd.Env = withUserScopedEnv(baseEnv)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	stdoutText := stdout.String()
	stderrText := stderr.String()

	if parsed, ok := findJSONPayload(stdoutText); ok {
		return []byte(parsed)
	}
	if parsed, ok := findJSONPayload(stderrText); ok {
		return []byte(parsed)
	}
	if parsed, ok := findJSONPayload(stdoutText + "\n" + stderrText); ok {
		return []byte(parsed)
	}

	details := strings.TrimSpace(stdoutText)
	if details == "" {
		details = strings.TrimSpace(stderrText)
	}
	if details == "" && err != nil {
		details = err.Error()
	}
	if details == "" {
		details = "bridge_output_empty"
	}
	if err != nil {
		return jsonFail("command_failed", details)
	}
	return jsonFail("parse_error", details)
}

func process(raw []byte) []byte {
	var req helperRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return jsonFail("bad_request", err.Error())
	}
	if strings.TrimSpace(req.Cmd) == "" {
		return jsonFail("bad_request", "missing_cmd")
	}
	if req.Cmd == "ping" {
		return jsonPingOK()
	}
	return runBridge(req)
}

func handleUnixConn(conn net.Conn) {
	defer conn.Close()
	data, err := io.ReadAll(io.LimitReader(conn, 1024*1024))
	if err != nil {
		_, _ = conn.Write(jsonFail("read_failed", err.Error()))
		return
	}
	resp := process(data)
	_, _ = conn.Write(resp)
}

func startUnixServer() error {
	_ = os.Remove(socketPath)
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		return err
	}
	if err := os.Chmod(socketPath, 0o666); err != nil {
		logf("chmod socket failed: %v", err)
	}
	logf("unix socket listening at %s", socketPath)
	for {
		conn, err := listener.Accept()
		if err != nil {
			logf("accept unix failed: %v", err)
			time.Sleep(100 * time.Millisecond)
			continue
		}
		go handleUnixConn(conn)
	}
}

func startHTTPServer() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/command", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		data, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write(jsonFail("read_failed", err.Error()))
			return
		}
		resp := process(data)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(resp)
	})

	server := &http.Server{
		Addr:              httpAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	logf("http listening at %s", httpAddr)
	return server.ListenAndServe()
}

func ensureSocketDir() error {
	return os.MkdirAll(filepath.Dir(socketPath), 0o755)
}

func main() {
	if len(os.Args) > 1 {
		arg := strings.TrimSpace(os.Args[1])
		if arg == "--version" || arg == "-v" || arg == "version" {
			_, _ = os.Stdout.WriteString(version + " (" + gitCommit + ") " + buildTime + "\n")
			return
		}
	}

	initLogger()
	defer func() {
		if logFile != nil {
			_ = logFile.Close()
		}
	}()
	allowedCommands = buildAllowedCommandMap(resolveAllowedCommandList())
	logf("allowed commands loaded: %d", len(allowedCommands))
	if user := detectConsoleUser(); user != "" {
		logf("console user: %s", user)
		if home := detectConsoleUserHome(user); home != "" {
			logf("console home: %s", home)
		}
	}

	if err := ensureSocketDir(); err != nil {
		logf("mkdir socket dir failed: %v", err)
		panic(err)
	}

	errCh := make(chan error, 2)
	go func() {
		if err := startUnixServer(); err != nil {
			errCh <- err
		}
	}()
	go func() {
		if err := startHTTPServer(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	if err := <-errCh; err != nil {
		logf("helper exiting: %v", err)
		panic(err)
	}
}
