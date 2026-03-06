# ClashFox Privileged Helper (custom implementation)

这个仓库提供了一个自定义的 macOS Privileged Helper，用于让桌面应用安全地执行需要 root 权限的网络操作（代理、DNS、TUN 前置能力）。

## 对 `clashfox-helper` 的代码分析（简述）

从仓库结构和入口实现可以看出，它的核心是：

1. `helper` 常驻运行于系统级权限（root）。
2. 对外暴露本地 API（用于 GUI 进程发起控制请求）。
3. 核心能力通过调用系统命令实现（例如 `networksetup`），从而切换代理或网络相关设置。
4. 服务部署依赖 launchd（系统服务模型）。

本仓库沿用这一设计思想，并加入了生产向加固：

1. 仅监听本地 Unix Socket（`/var/run/com.clashfox.helper.sock`）。
2. 所有 API 必须携带 `X-Helper-Token`。
3. 调用方约束：读取 Unix Socket peer 的 `uid/pid/path`，仅允许策略文件中的调用方。
4. 命令白名单：仅允许 `networksetup` / `sysctl` / `pfctl` 的受限子命令与参数。
5. 参数收紧：代理地址仅允许 loopback（`127.0.0.1`/`::1`/`localhost`），DNS 数量限制 1..3。
6. 失败回滚：修改代理/DNS 前先读当前值，执行失败自动恢复。
7. 幂等语义：目标状态已满足时返回 `ok=true, code=NOOP`，不重复执行系统命令。
8. 异常自愈：周期性比对并恢复 `state.json` 的目标状态。
9. 基线恢复：首次变更前保存 `baseline.json`，支持一键恢复。
10. 并发互斥：同一 network service 串行执行，避免竞态覆盖。
11. 防刷限速：按调用方做窗口限流（过载返回 `RATE_LIMITED`）。
12. 失败熔断：连续失败触发临时封禁（返回 `CIRCUIT_OPEN`）。
13. 漂移告警：自愈前记录 `expected/current` 差异到审计日志。
14. 安装原子升级：失败自动回滚到旧二进制与旧 plist。
15. 卸载安全：卸载前自动尝试恢复 baseline，避免残留代理/DNS。
16. 审计日志：记录调用方身份、动作、结果、状态快照。

## 功能

- `POST /v1/proxy/enable`: 开启系统 HTTP/HTTPS/SOCKS 代理
- `POST /v1/proxy/disable`: 关闭系统 HTTP/HTTPS/SOCKS 代理
- `GET /v1/proxy/status`: 查询系统代理状态（HTTP/HTTPS/SOCKS/AutoDiscovery/PAC）
- `POST /v1/core/start`: 启动 `mihomo` 内核
- `POST /v1/core/stop`: 停止 `mihomo` 内核
- `POST /v1/core/restart`: 重启 `mihomo` 内核
- `GET /v1/core/status`: 查询 `mihomo` 运行状态
- `GET /version`: 获取 helper 版本信息（version/commit/buildTime/launchedAt）
- `GET /health`: 健康检查

## 构建

```bash
bash scripts/build-helper.sh ./build/com.clashfox.helper
```

版本来源：仓库根目录 [VERSION](/Users/workstation/os-code/ClashFox-Helper/VERSION)。

## 安装为系统服务（需要管理员权限）

```bash
sudo bash scripts/install-helper.sh ./build/com.clashfox.helper
```

安装后：

- 二进制: `/Library/PrivilegedHelperTools/com.clashfox.helper`
- 启动项: `/Library/LaunchDaemons/com.clashfox.helper.plist`
- Socket: `/var/run/com.clashfox.helper.sock`
- Token: `/Library/Application Support/ClashFox/helper/token`
- 调用策略: `/Library/Application Support/ClashFox/helper/policy.json`
- 期望状态: `/Library/Application Support/ClashFox/helper/state.json`
- 基线状态: `/Library/Application Support/ClashFox/helper/baseline.json`
- 版本信息: `/Library/Application Support/ClashFox/helper/version.json`
- 版本历史: `/Library/Application Support/ClashFox/helper/version-history.log`
- 旧版本备份: `/Library/Application Support/ClashFox/helper/releases/`
- mihomo pidfile: `/Library/Application Support/ClashFox/helper/mihomo.pid`
- mihomo lockfile: `/Library/Application Support/ClashFox/helper/mihomo.lock`
- mihomo log: `/Users/<name>/Library/Application Support/ClashFox/logs/clashfox.log`
- mihomo 受控二进制: `/Users/<name>/Library/Application Support/ClashFox/core/mihomo`
- mihomo 配置文件: `/Users/<name>/Library/Application Support/ClashFox/config/config.yaml`
- 运行日志: `/var/log/clashfox-helper.log`
- 审计日志: `/var/log/clashfox-helper-audit.log`

说明：helper 会优先按当前登录用户（`/dev/console`）解析 core 路径到：
- `/Users/<name>/Library/Application Support/ClashFox/core/mihomo`
- `/Users/<name>/Library/Application Support/ClashFox/config/config.yaml`
- `/Users/<name>/Library/Application Support/ClashFox/logs/clashfox.log`
涉及 mihomo 的安装和更新由 GUI 自己管理，helper 仅负责启停重启与状态查询。

## 卸载

```bash
sudo bash scripts/uninstall-helper.sh
```

说明：卸载脚本会停止服务并把旧二进制/plist 备份到 `.../uninstall-backup/<timestamp>/` 目录。

## 调用示例

```bash
TOKEN="$(cat '/Library/Application Support/ClashFox/helper/token')"

curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST http://localhost/v1/proxy/enable \
  -d '{"service":"Wi-Fi","host":"127.0.0.1","port":7890}'

# 可选：返回一次性状态快照，避免 GUI 再请求 /v1/proxy/status
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost/v1/proxy/enable?withStatus=1" \
  -d '{"service":"Wi-Fi","host":"127.0.0.1","port":7890}'
```

说明：`service` 字段可省略。未提供时，helper 会自动按默认路由接口解析当前主网络服务（例如 Wi-Fi/Ethernet）。  
分端口可用：`port/httpPort`（HTTP）、`httpsPort`（HTTPS）、`socksPort`（SOCKS），并兼容 `socks-port`、`mixed-port` 这类连字符字段。若仅提供 `mixed-port`，则三类代理都使用该端口。
`/v1/proxy/enable` 与 `/v1/proxy/disable` 支持 query 参数 `withStatus=1`，开启后响应会携带 `data`（即代理状态快照）。

查询版本：

```bash
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -X GET http://localhost/version
```

操作 mihomo 内核：

```bash
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST http://localhost/v1/core/start \
  -d '{"configPath":"default.yaml"}'

curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -X GET http://localhost/v1/core/status

curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -X POST http://localhost/v1/core/restart

curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -X POST http://localhost/v1/core/stop
```

说明：`/v1/core/start` 支持可选 JSON 参数 `configPath`（兼容别名 `config`），可传相对文件名（例如 `OneSmart.yaml`）或绝对路径。  
当省略该参数时，默认使用 `/Users/<name>/Library/Application Support/ClashFox/config/config.yaml`。  
为安全起见，配置路径仅允许位于 `/Users/<name>/Library/Application Support/ClashFox/config/` 目录下。

完整调用示例（精简版）：[API_DEMO.md](/Users/workstation/os-code/ClashFox-Helper/docs/API_DEMO.md)

约束说明（已内置）：

- 只允许白名单二进制路径：`/usr/local/bin/mihomo`、`/opt/homebrew/bin/mihomo`、`/Applications/ClashFox.app/Contents/Resources/mihomo`
- core 启动参数：`-d /Users/<name>/Library/Application Support/ClashFox/core -f <selected-config-path>`（`-f` 由 `/v1/core/start` 动态决定）
- `pidfile + lockfile` 防止重复实例
- `pidfile` 为结构化记录（pid+binary+startedAt），并校验 PID 对应二进制路径，降低 PID 复用误操作风险
- 退出码写入审计日志（`act=core_exit`）
- 鉴权 token 使用常量时间比较，降低时序侧信道风险
- 默认策略仅放行 ClashFox 客户端路径（不再默认放行 `/usr/bin/curl`）
- token 与 unix socket 默认采用 root + ACL（按 `allowedUIDs` 下发最小权限）
- 启动前仅清理已有 Unix Socket；若路径存在但不是 socket 文件则拒绝启动（防误删/路径投毒）
- 请求调用方需可解析 peer pid（`SO_PEERPID`），不可解析则拒绝

## 生产建议

1. 若要对接 Apple 官方授权安装链路，建议使用 `SMJobBless` + 签名校验（Team ID / Requirement）。
2. 若 GUI 和 helper 分离，建议改为 NSXPC 并在 helper 侧加 `audit token` 校验调用方签名。
3. 按实际 App 安装位置维护 `policy.json` 中的 `allowedClientPathPrefixes`，避免误拦截。
4. 版本兼容测试建议包含 macOS 12/13/14/15（尤其 `networksetup` 输出和 `pfctl` 状态解析差异）。

## 许可证

本项目采用 **GNU GPL v3.0**（`GPL-3.0-only`）开源许可，详见仓库根目录 [LICENSE](/Users/workstation/os-code/ClashFox-Helper/LICENSE)。

## 常用操作

开启系统代理（`service` 可省略，自动解析主网络服务）：

```bash
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST http://localhost/v1/proxy/enable \
  -d '{"host":"127.0.0.1","port":7890}'
```

关闭系统代理：

```bash
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST http://localhost/v1/proxy/disable \
  -d '{}'
```

查询系统代理状态（`service` 可选）：

```bash
curl --unix-socket /var/run/com.clashfox.helper.sock \
  -H "X-Helper-Token: ${TOKEN}" \
  -X GET "http://localhost/v1/proxy/status?service=Wi-Fi"
```
