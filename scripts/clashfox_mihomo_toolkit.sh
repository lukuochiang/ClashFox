#!/bin/bash

# -----------------------------------------------------------------------------
# ClashFox Mihomo Kernel Management CLI
# Copyright (c) 2026 Kuochiang Lu
# Licensed under the MIT License.
# -----------------------------------------------------------------------------

# Author: Kuochiang Lu
# Version: v1.2.5(12)
# Last Updated: 2026-02-10
#
# 描述：
#   ClashFox Mihomo Kernel Manager 是一个功能完整的 mihomo 内核管理工具，
#   提供下载、安装、切换、备份及运行状态控制等一站式服务，确保内核运行环境的完整性和稳定性。
#
# 功能：
#   - 安装/更新最新 mihomo 内核（支持多 GitHub 源选择）
#   - 自动检测系统架构 (arm64 / amd64)
#   - 智能内核备份机制（按时间戳管理，保留历史版本）
#   - 灵活的内核版本切换功能
#   - 实时显示内核运行状态及版本信息
#   - 完整的目录结构检查与自动创建
#   - 内核进程的启动/关闭/重启控制
#   - 配置文件与日志目录的智能管理
#   - PID 文件管理确保进程安全控制
#   - 友好的交互式菜单界面，操作直观简单
#

# 生成二进制文件
# shc -f clashfox_mihomo_toolkit.sh -o ../shc/clashfox-installer && rm -f clashfox_mihomo_toolkit.sh.x.c
SCRIPT_NAME="ClashFox Mihomo Toolkit"
# 脚本版本号
SCRIPT_VERSION="v1.2.5(12)"

# Language settings: set CLASHFOX_LANG=zh|en|auto (default: auto)
CLASHFOX_LANG="${CLASHFOX_LANG:-auto}"

detect_language() {
    case "$CLASHFOX_LANG" in
        zh|en|ja|ko|fr|de|ru)
            echo "$CLASHFOX_LANG"
            return
            ;;
    esac

    local apple_locale
    apple_locale=$(defaults read -g AppleLocale 2>/dev/null)
    if [[ "$apple_locale" == zh* || "$apple_locale" == *zh* ]]; then
        echo "zh"
        return
    elif [[ "$apple_locale" == ja* || "$apple_locale" == *ja* ]]; then
        echo "ja"
        return
    elif [[ "$apple_locale" == ko* || "$apple_locale" == *ko* ]]; then
        echo "ko"
        return
    elif [[ "$apple_locale" == fr* || "$apple_locale" == *fr* ]]; then
        echo "fr"
        return
    elif [[ "$apple_locale" == de* || "$apple_locale" == *de* ]]; then
        echo "de"
        return
    elif [[ "$apple_locale" == ru* || "$apple_locale" == *ru* ]]; then
        echo "ru"
        return
    fi

    local sys_lang="${LC_ALL:-${LANG:-}}"
    if [[ "$sys_lang" == zh* || "$sys_lang" == *zh* ]]; then
        echo "zh"
    elif [[ "$sys_lang" == ja* || "$sys_lang" == *ja* ]]; then
        echo "ja"
    elif [[ "$sys_lang" == ko* || "$sys_lang" == *ko* ]]; then
        echo "ko"
    elif [[ "$sys_lang" == fr* || "$sys_lang" == *fr* ]]; then
        echo "fr"
    elif [[ "$sys_lang" == de* || "$sys_lang" == *de* ]]; then
        echo "de"
    elif [[ "$sys_lang" == ru* || "$sys_lang" == *ru* ]]; then
        echo "ru"
    else
        echo "en"
    fi
}

tr_msg() {
    local key="$1"
    shift
    local lang
    lang="$(detect_language)"

    case "$lang" in
        zh)
            case "$key" in
                TAG_SUCCESS) printf "成功" ;;
                TAG_ERROR) printf "错误" ;;
                TAG_WARNING) printf "提示" ;;
                TAG_VERSION) printf "版本" ;;
                LABEL_FUNCTION) printf "功能" ;;
                LABEL_STATUS) printf "状态" ;;
                LABEL_HELP) printf "帮助" ;;
                LABEL_INIT) printf "初始化" ;;
                LABEL_STEP) printf "步骤" ;;
                LABEL_INFO) printf "信息" ;;
                LABEL_CLEANUP) printf "清理" ;;
                LABEL_OPTIONS) printf "选项" ;;
                LABEL_MENU) printf "主菜单" ;;

                MSG_MACOS_ONLY) printf "此脚本仅支持 macOS 系统" ;;
                MSG_WELCOME) printf "欢迎 %s 使用 %s" "$@" ;;
                MSG_PRESS_ENTER) printf "按 Enter 键继续..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "需要系统权限以执行内核管理操作" ;;
                MSG_REQUIRE_SUDO_DESC) printf "说明: 内核启动/关闭/重启/状态等操作需要 sudo 权限" ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "授权: 请输入您的 macOS 用户密码以继续" ;;
                MSG_SUDO_OK) printf "权限验证通过" ;;
                MSG_SUDO_FAIL) printf "密码验证失败，请重新尝试" ;;

                MSG_INIT_CHECK_DIRS) printf "[初始化] 检查目录结构..." ;;
                MSG_INIT_SET_PERMS) printf "[初始化] 设置目录权限..." ;;
                MSG_NEED_ADMIN) printf "需要管理员权限创建目录结构" ;;
                MSG_NO_PERMISSION) printf "权限不足，无法创建目录结构" ;;
                MSG_CORE_DIR_CREATE) printf "创建内核目录: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "内核目录存在: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "创建配置目录: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "配置目录存在: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "创建数据目录: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "数据目录存在: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "创建日志目录: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "日志目录存在: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "创建运行时目录: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "运行时目录存在: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "目录权限已设置" ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "内核目录不存在，正在创建完整目录结构..." ;;
                MSG_DIR_CREATE_FAIL) printf "目录结构创建失败" ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "无法进入内核目录" ;;

                MSG_STATUS_STOPPED) printf "已停止" ;;
                MSG_STATUS_RUNNING) printf "已运行" ;;
                MSG_STATUS_LABEL) printf "Mihomo 状态" ;;
                MSG_KERNEL_LABEL) printf "Mihomo 内核" ;;
                MSG_CONFIG_LABEL) printf "Mihomo 配置" ;;
                MSG_CONFIG_NOT_FOUND) printf "未找到 %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• 运行状态:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• 内核文件信息:" ;;
                MSG_BACKUP_SECTION) printf "• 备份信息:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ 内核文件存在" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ 内核文件不可执行" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ 内核文件不存在" ;;
                MSG_KERNEL_VERSION_INFO) printf "版本信息: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "显示名称: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "显示名称: %s (无法解析)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ 找到备份文件" ;;
                MSG_BACKUP_LATEST) printf "最新备份: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "备份版本: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "备份版本: 未知版本" ;;
                MSG_BACKUP_TIME) printf "备份时间: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  未找到任何备份" ;;

                MSG_LIST_BACKUPS_TITLE) printf "列出所有备份内核" ;;
                MSG_NO_BACKUPS) printf "无备份文件" ;;
                MSG_BACKUP_LIST_TITLE) printf "[信息] 可用备份内核列表（按时间倒序）:" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "序号 | 版本信息 | 备份时间" ;;
                MSG_BACKUP_TOTAL) printf "备份文件总数: %s 个" "$@" ;;

                MSG_SWITCH_TITLE) printf "切换内核版本" ;;
                MSG_SWITCH_PROMPT) printf "请输入要切换的备份序号 (或按 Enter 返回主菜单): " ;;
                MSG_INVALID_NUMBER) printf "请输入有效的数字" ;;
                MSG_BACKUP_NO_MATCH) printf "未找到匹配的备份序号" ;;
                MSG_SWITCH_START) printf "[步骤] 开始切换内核..." ;;
                MSG_BACKUP_SELECTED) printf "[信息] 选择的备份文件: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[信息] 当前内核版本: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[信息] 当前内核不存在" ;;
                MSG_SWITCH_CONFIRM) printf "确定要切换到该版本吗? (y/n): " ;;
                MSG_OP_CANCELLED) printf "操作已取消" ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[步骤] 已备份当前内核 -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[步骤] 内核已替换为: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[步骤] 已删除临时备份文件: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[完成] 内核切换完成" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[信息] 可用备份内核:" ;;
                MSG_INSTALL_TITLE) printf "安装/更新 Mihomo 内核" ;;
                MSG_SELECT_GITHUB_USER) printf "选择 GitHub 用户下载内核:" ;;
                MSG_SELECT_USER_PROMPT) printf "请选择用户（默认1）: " ;;
                MSG_SELECTED_GITHUB_USER) printf "[信息] 选择的 GitHub 用户: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[步骤] 获取最新版本信息..." ;;
                MSG_VERSION_INFO_FAIL) printf "无法获取版本信息或版本不存在" ;;
                MSG_VERSION_INFO) printf "[信息] 版本信息: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "不支持的架构: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[信息] 架构检测: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[步骤] 下载信息:" ;;
                MSG_DOWNLOAD_URL) printf "  下载地址: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  版本信息: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "确定要下载并安装此版本吗? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[步骤] 正在下载内核 (可能需要几分钟)..." ;;
                MSG_DOWNLOAD_RETRY) printf "下载失败，正在进行第 %s/%s 次重试..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "下载完成" ;;
                MSG_EXTRACT_START) printf "[步骤] 正在解压内核..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[步骤] 已备份新安装的内核 -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[完成] 内核安装成功" ;;
                MSG_EXTRACT_FAIL) printf "解压失败" ;;
                MSG_DOWNLOAD_FAIL) printf "下载失败，已尝试 %s 次" "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "无法解析" ;;
                MSG_NOT_INSTALLED) printf "未安装" ;;

                MSG_START_TITLE) printf "启动 Mihomo 内核" ;;
                MSG_KERNEL_RUNNING) printf "Mihomo 内核已经在运行中" ;;
                MSG_START_PRECHECK) printf "[步骤] 启动 Mihomo 内核前检查..." ;;
                MSG_KERNEL_NOT_FOUND) printf "未找到 Mihomo 内核文件" ;;
                MSG_KERNEL_NOT_EXEC) printf "Mihomo 内核文件不可执行" ;;
                MSG_ADD_EXEC) printf "[步骤] 正在添加执行权限..." ;;
                MSG_ADD_EXEC_FAIL) printf "添加执行权限失败" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "默认配置文件不存在: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[步骤] 检查配置目录中的其他配置文件..." ;;
                MSG_CONFIG_NONE) printf "配置目录中没有找到任何配置文件" ;;
                MSG_CONFIG_PUT_HINT) printf "请将配置文件放置在 %s 目录下" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[信息] 可用的配置文件:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "序号 | 配置文件路径" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "请选择要使用的配置文件序号 (0 表示取消): " ;;
                MSG_CONFIG_SELECTED) printf "选择的配置文件: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "无效的选择" ;;
                MSG_CONFIG_READ_FAIL) printf "配置文件不可读: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "请检查配置文件的权限设置" ;;
                MSG_CONFIG_EMPTY) printf "配置文件为空: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "请确保配置文件包含有效的配置内容" ;;
                MSG_CONFIG_WILL_USE) printf "将使用配置文件: %s" "$@" ;;
                MSG_START_PROCESS) printf "[步骤] 正在启动内核进程..." ;;
                MSG_START_COMMAND) printf "启动命令: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID已写入: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Mihomo 内核已启动" ;;
                MSG_PROCESS_ID) printf "进程 ID: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Mihomo 内核启动失败" ;;

                MSG_STOP_TITLE) printf "关闭 Mihomo 内核" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Mihomo 内核当前未运行" ;;
                MSG_STOPPING_KERNEL) printf "[步骤] 正在关闭 Mihomo 内核..." ;;
                MSG_PIDS_FOUND) printf "找到进程 ID: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[步骤] 正在关闭进程 %s..." "$@" ;;
                MSG_FORCE_STOPPING) printf "尝试强制关闭剩余进程..." ;;
                MSG_KERNEL_STOP_FAIL) printf "关闭 Mihomo 内核失败" ;;
                MSG_KERNEL_STOP_HINT) printf "请尝试在 Activity Monitor 手动停止内核" ;;
                MSG_KERNEL_STOPPED) printf "Mihomo 内核已关闭" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Mihomo 内核进程当前未运行" ;;
                MSG_PID_CLEANED) printf "PID文件已清理: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "重启 Mihomo 内核" ;;
                MSG_KERNEL_MENU_TITLE) printf "内核控制" ;;
                MSG_KERNEL_MENU_PROMPT) printf "请选择内核操作:" ;;
                MSG_MENU_START) printf "1) 启动内核" ;;
                MSG_MENU_STOP) printf "2) 关闭内核" ;;
                MSG_MENU_RESTART) printf "3) 重启内核" ;;
                MSG_MENU_BACK) printf "0) 返回主菜单" ;;
                MSG_MENU_CHOICE_0_3) printf "请输入选择 (0-3): " ;;
                MSG_MENU_INVALID) printf "无效的选择，请重新输入" ;;

                MSG_LOGS_TITLE) printf "查看 Mihomo 内核日志" ;;
                MSG_LOG_FILE_MISSING) printf "日志文件不存在: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "请先启动内核以生成日志文件" ;;
                MSG_LOG_FILE_PATH) printf "[信息] 日志文件路径: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[信息] 日志大小: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[信息] 日志行数: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[选项] 如何查看日志:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) 查看日志的最后 50 行" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) 实时查看日志更新 (按 Ctrl+C 退出)" ;;
                MSG_LOG_OPTION_LESS) printf "3) 使用 less 查看完整日志 (按 q 退出)" ;;
                MSG_LOG_OPTION_BACK) printf "0) 返回主菜单" ;;
                MSG_LOG_TAIL_HEADER) printf "[信息] 日志的最后 50 行内容:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[信息] 实时查看日志更新 (按 Ctrl+C 退出):" ;;
                MSG_LOG_LESS_HEADER) printf "[信息] 使用 less 查看完整日志 (按 q 退出):" ;;

                MSG_HELP_TITLE) printf "帮助信息" ;;
                MSG_HELP_ARGS) printf "命令行参数:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <路径>  自定义 ClashFox 安装目录" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  指定显示语言" ;;
                MSG_HELP_STATUS) printf "  status                 查看当前内核状态" ;;
                MSG_HELP_LIST) printf "  list                   列出所有内核备份" ;;
                MSG_HELP_SWITCH) printf "  switch                 切换内核版本" ;;
                MSG_HELP_LOGS) printf "  logs|log               查看内核日志" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            清除日志" ;;
                MSG_HELP_HELP) printf "  help|-h                显示帮助信息" ;;
                MSG_HELP_VERSION) printf "  version|-v             显示版本信息" ;;
                MSG_HELP_MENU) printf "交互式菜单:" ;;
                MSG_MENU_INSTALL) printf "1) 安装/更新 Mihomo 内核" ;;
                MSG_MENU_CONTROL) printf "2) 内核控制(启动/关闭/重启)" ;;
                MSG_MENU_STATUS) printf "3) 查看当前状态" ;;
                MSG_MENU_SWITCH) printf "4) 切换内核版本" ;;
                MSG_MENU_LIST) printf "5) 列出所有备份" ;;
                MSG_MENU_LOGS) printf "6) 查看内核日志" ;;
                MSG_MENU_CLEAN) printf "7) 清除日志" ;;
                MSG_MENU_HELP) printf "8) 显示帮助信息" ;;
                MSG_MENU_EXIT) printf "0) 退出程序" ;;
                MSG_HELP_NOTE) printf "此工具不仅负责内核版本管理，还可以控制内核的运行状态（启动/关闭/重启）" ;;

                MSG_CLEAN_TITLE) printf "清理旧日志文件" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[信息] 当前日志文件: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[信息] 日志大小: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[信息] 旧日志数量: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[信息] 旧日志总大小: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[清理选项]" ;;
                MSG_CLEAN_ALL) printf "1) 删除所有旧日志文件" ;;
                MSG_CLEAN_7D) printf "2) 保留最近7天的日志，删除更早的日志" ;;
                MSG_CLEAN_30D) printf "3) 保留最近30天的日志，删除更早的日志" ;;
                MSG_CLEAN_CANCEL) printf "0) 取消操作" ;;
                MSG_CLEAN_PROMPT) printf "请选择清理方式 (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "已删除所有旧日志文件" ;;
                MSG_CLEAN_DONE_7D) printf "已删除7天前的日志文件" ;;
                MSG_CLEAN_DONE_30D) printf "已删除30天前的日志文件" ;;
                MSG_CLEAN_CANCELLED) printf "取消清理操作" ;;
                MSG_CLEAN_INVALID) printf "无效的选择" ;;

                MSG_LOG_ROTATE_DATE) printf "日志已按日期备份: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "日志已按大小滚动: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "当前内核信息" ;;
                MSG_MAIN_MENU_TITLE) printf "主菜单" ;;
                MSG_KERNEL_STATUS_CHECK) printf "内核状态检查" ;;
                MSG_MAIN_PROMPT) printf "请选择要执行的功能:" ;;
                MSG_MAIN_LINE_1) printf "  1) 安装/更新 Mihomo 内核         2) 内核控制(启动/关闭/重启)" ;;
                MSG_MAIN_LINE_2) printf "  3) 查看当前状态                  4) 切换内核版本" ;;
                MSG_MAIN_LINE_3) printf "  5) 列出所有备份                  6) 查看内核日志" ;;
                MSG_MAIN_LINE_4) printf "  7) 清除日志                      8) 显示帮助信息" ;;
                MSG_MAIN_LINE_5) printf "  0) 退出程序" ;;

                MSG_CLEANUP_STOPPING) printf "[清理] 正在终止日志检查进程 (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[清理] 尝试强制终止日志检查进程..." ;;
                MSG_CLEANUP_FAIL) printf "[清理] 日志检查进程终止失败 (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "日志检查进程已终止" ;;
                MSG_EXIT_ABNORMAL) printf "[退出] 程序已异常终止" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory 参数需要指定目录路径" ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang 参数需要指定语言(zh|en|ja|ko|fr|de|ru|auto)" ;;
                MSG_ARG_LANG_INVALID) printf "无效语言: %s (支持: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "未知命令: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "可用命令: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "可用参数: -d/--directory <路径> - 自定义 ClashFox 安装目录; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - 指定显示语言" ;;

                MSG_SAVED_DIR_LOADED) printf "已加载保存的目录: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "未找到保存的目录，将使用默认目录: %s" "$@" ;;
                MSG_DIR_SAVED) printf "已保存目录到配置文件: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "选择 ClashFox 安装目录" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "当前默认安装目录: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "是否使用默认目录? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "请输入自定义安装目录: " ;;
                MSG_DIR_SET) printf "已设置 ClashFox 安装目录为: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "将使用默认安装目录: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "未输入有效目录，将使用默认目录: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "使用现有安装目录: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[初始化] 启动日志定期检查进程..." ;;
                MSG_LOG_CHECKER_OK) printf "日志定期检查进程已启动，PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[初始化] 检查 ClashFox 应用是否安装..." ;;
                MSG_APP_DIR_MISSING) printf "ClashFox 应用目录不存在，正在创建..." ;;
                MSG_APP_DIR_TARGET) printf "  目标目录: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "已创建 ClashFox 应用目录: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox 应用已安装: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "请输入选择 (0-8): " ;;
                MSG_EXIT_THANKS) printf "[退出] 感谢使用 ClashFox Mihomo 内核管理器" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo 配置: [未找到 %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo 配置: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        en)
            case "$key" in
                TAG_SUCCESS) printf "Success" ;;
                TAG_ERROR) printf "Error" ;;
                TAG_WARNING) printf "Tip" ;;
                TAG_VERSION) printf "Version" ;;
                LABEL_FUNCTION) printf "Function" ;;
                LABEL_STATUS) printf "Status" ;;
                LABEL_HELP) printf "Help" ;;
                LABEL_INIT) printf "Init" ;;
                LABEL_STEP) printf "Step" ;;
                LABEL_INFO) printf "Info" ;;
                LABEL_CLEANUP) printf "Cleanup" ;;
                LABEL_OPTIONS) printf "Options" ;;
                LABEL_MENU) printf "Main Menu" ;;

                MSG_MACOS_ONLY) printf "This script only supports macOS." ;;
                MSG_WELCOME) printf "Welcome %s to %s" "$@" ;;
                MSG_PRESS_ENTER) printf "Press Enter to continue..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "System privileges are required to manage the kernel." ;;
                MSG_REQUIRE_SUDO_DESC) printf "Note: start/stop/restart/status operations require sudo privileges." ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "Authorization: enter your macOS password to continue." ;;
                MSG_SUDO_OK) printf "Privilege check passed." ;;
                MSG_SUDO_FAIL) printf "Password verification failed. Please try again." ;;

                MSG_INIT_CHECK_DIRS) printf "[Init] Checking directory structure..." ;;
                MSG_INIT_SET_PERMS) printf "[Init] Setting directory permissions..." ;;
                MSG_NEED_ADMIN) printf "Administrator privileges are required to create directories." ;;
                MSG_NO_PERMISSION) printf "Insufficient permissions to create directories." ;;
                MSG_CORE_DIR_CREATE) printf "Creating core directory: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "Core directory exists: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "Creating config directory: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "Config directory exists: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "Creating data directory: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "Data directory exists: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "Creating log directory: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "Log directory exists: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "Creating runtime directory: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "Runtime directory exists: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "Directory permissions set." ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "Core directory missing. Creating full structure..." ;;
                MSG_DIR_CREATE_FAIL) printf "Failed to create directory structure." ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "Unable to enter core directory." ;;

                MSG_STATUS_STOPPED) printf "Stopped" ;;
                MSG_STATUS_RUNNING) printf "Running" ;;
                MSG_STATUS_LABEL) printf "Mihomo Status" ;;
                MSG_KERNEL_LABEL) printf "Mihomo Kernel" ;;
                MSG_CONFIG_LABEL) printf "Mihomo Config" ;;
                MSG_CONFIG_NOT_FOUND) printf "Not found %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• Status:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• Kernel file info:" ;;
                MSG_BACKUP_SECTION) printf "• Backup info:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ Kernel file exists" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ Kernel file is not executable" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ Kernel file not found" ;;
                MSG_KERNEL_VERSION_INFO) printf "Version: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "Display name: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "Display name: %s (parse failed)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ Backup found" ;;
                MSG_BACKUP_LATEST) printf "Latest backup: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "Backup version: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "Backup version: Unknown" ;;
                MSG_BACKUP_TIME) printf "Backup time: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  No backups found" ;;

                MSG_LIST_BACKUPS_TITLE) printf "List all backup kernels" ;;
                MSG_NO_BACKUPS) printf "No backup files" ;;
                MSG_BACKUP_LIST_TITLE) printf "[Info] Available backups (newest first):" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "No. | Version | Backup time" ;;
                MSG_BACKUP_TOTAL) printf "Total backups: %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "Switch kernel version" ;;
                MSG_SWITCH_PROMPT) printf "Enter backup number to switch (or press Enter to return): " ;;
                MSG_INVALID_NUMBER) printf "Please enter a valid number." ;;
                MSG_BACKUP_NO_MATCH) printf "No matching backup number found." ;;
                MSG_SWITCH_START) printf "[Step] Starting kernel switch..." ;;
                MSG_BACKUP_SELECTED) printf "[Info] Selected backup: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[Info] Current kernel version: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[Info] Current kernel not found" ;;
                MSG_SWITCH_CONFIRM) printf "Confirm switch to this version? (y/n): " ;;
                MSG_OP_CANCELLED) printf "Operation cancelled." ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[Step] Backed up current kernel -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[Step] Kernel replaced with: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[Step] Removed temp backup file: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[Done] Kernel switch complete" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[Info] Available backups:" ;;
                MSG_INSTALL_TITLE) printf "Install/Update Mihomo kernel" ;;
                MSG_SELECT_GITHUB_USER) printf "Select GitHub user for download:" ;;
                MSG_SELECT_USER_PROMPT) printf "Choose user (default 1): " ;;
                MSG_SELECTED_GITHUB_USER) printf "[Info] Selected GitHub user: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[Step] Fetching latest version info..." ;;
                MSG_VERSION_INFO_FAIL) printf "Unable to fetch version info or version does not exist." ;;
                MSG_VERSION_INFO) printf "[Info] Version: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "Unsupported architecture: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[Info] Architecture: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[Step] Download info:" ;;
                MSG_DOWNLOAD_URL) printf "  Download URL: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  Version: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "Download and install this version? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[Step] Downloading kernel (may take a few minutes)..." ;;
                MSG_DOWNLOAD_RETRY) printf "Download failed. Retrying %s/%s..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "Download complete" ;;
                MSG_EXTRACT_START) printf "[Step] Extracting kernel..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[Step] Backed up new kernel -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[Done] Kernel installation successful" ;;
                MSG_EXTRACT_FAIL) printf "Extraction failed." ;;
                MSG_DOWNLOAD_FAIL) printf "Download failed after %s attempts." "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "Parse failed" ;;
                MSG_NOT_INSTALLED) printf "Not installed" ;;

                MSG_START_TITLE) printf "Start Mihomo kernel" ;;
                MSG_KERNEL_RUNNING) printf "Mihomo kernel is already running" ;;
                MSG_START_PRECHECK) printf "[Step] Pre-check before starting kernel..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Mihomo kernel file not found" ;;
                MSG_KERNEL_NOT_EXEC) printf "Mihomo kernel file is not executable" ;;
                MSG_ADD_EXEC) printf "[Step] Adding execute permission..." ;;
                MSG_ADD_EXEC_FAIL) printf "Failed to add execute permission" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "Default config file not found: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[Step] Checking other config files..." ;;
                MSG_CONFIG_NONE) printf "No config files found in config directory." ;;
                MSG_CONFIG_PUT_HINT) printf "Place your config file in %s" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[Info] Available config files:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "No. | Config file path" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "Choose config file number (0 to cancel): " ;;
                MSG_CONFIG_SELECTED) printf "Selected config file: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "Invalid selection." ;;
                MSG_CONFIG_READ_FAIL) printf "Config file not readable: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "Check the config file permissions." ;;
                MSG_CONFIG_EMPTY) printf "Config file is empty: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "Ensure the config file has valid content." ;;
                MSG_CONFIG_WILL_USE) printf "Using config file: %s" "$@" ;;
                MSG_START_PROCESS) printf "[Step] Starting kernel process..." ;;
                MSG_START_COMMAND) printf "Start command: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID written to: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Mihomo kernel started" ;;
                MSG_PROCESS_ID) printf "Process ID: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Mihomo kernel failed to start" ;;

                MSG_STOP_TITLE) printf "Stop Mihomo kernel" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Mihomo kernel is not running" ;;
                MSG_STOPPING_KERNEL) printf "[Step] Stopping Mihomo kernel..." ;;
                MSG_PIDS_FOUND) printf "Found process IDs: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[Step] Stopping process %s..." "$@" ;;
                MSG_FORCE_STOPPING) printf "Forcing remaining processes to stop..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Failed to stop Mihomo kernel" ;;
                MSG_KERNEL_STOP_HINT) printf "Try stopping the kernel in Activity Monitor." ;;
                MSG_KERNEL_STOPPED) printf "Mihomo kernel stopped" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Mihomo kernel process is not running" ;;
                MSG_PID_CLEANED) printf "PID file removed: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Restart Mihomo kernel" ;;
                MSG_KERNEL_MENU_TITLE) printf "Kernel control" ;;
                MSG_KERNEL_MENU_PROMPT) printf "Choose kernel action:" ;;
                MSG_MENU_START) printf "1) Start kernel" ;;
                MSG_MENU_STOP) printf "2) Stop kernel" ;;
                MSG_MENU_RESTART) printf "3) Restart kernel" ;;
                MSG_MENU_BACK) printf "0) Back to main menu" ;;
                MSG_MENU_CHOICE_0_3) printf "Enter choice (0-3): " ;;
                MSG_MENU_INVALID) printf "Invalid choice. Please try again." ;;

                MSG_LOGS_TITLE) printf "View Mihomo kernel logs" ;;
                MSG_LOG_FILE_MISSING) printf "Log file not found: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "Start the kernel to generate logs first." ;;
                MSG_LOG_FILE_PATH) printf "[Info] Log file path: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[Info] Log size: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[Info] Log lines: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[Options] How to view logs:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) Show last 50 lines" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) Follow log updates (Ctrl+C to exit)" ;;
                MSG_LOG_OPTION_LESS) printf "3) View full log with less (q to exit)" ;;
                MSG_LOG_OPTION_BACK) printf "0) Back to main menu" ;;
                MSG_LOG_TAIL_HEADER) printf "[Info] Last 50 log lines:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[Info] Following log updates (Ctrl+C to exit):" ;;
                MSG_LOG_LESS_HEADER) printf "[Info] Viewing log with less (q to exit):" ;;

                MSG_HELP_TITLE) printf "Help" ;;
                MSG_HELP_ARGS) printf "Command-line arguments:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  Custom ClashFox install directory" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  Set UI language" ;;
                MSG_HELP_STATUS) printf "  status                 Show current kernel status" ;;
                MSG_HELP_LIST) printf "  list                   List all kernel backups" ;;
                MSG_HELP_SWITCH) printf "  switch                 Switch kernel version" ;;
                MSG_HELP_LOGS) printf "  logs|log               View kernel logs" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            Clean logs" ;;
                MSG_HELP_HELP) printf "  help|-h                Show help" ;;
                MSG_HELP_VERSION) printf "  version|-v             Show version" ;;
                MSG_HELP_MENU) printf "Interactive menu:" ;;
                MSG_MENU_INSTALL) printf "1) Install/Update Mihomo kernel" ;;
                MSG_MENU_CONTROL) printf "2) Kernel control (start/stop/restart)" ;;
                MSG_MENU_STATUS) printf "3) Show current status" ;;
                MSG_MENU_SWITCH) printf "4) Switch kernel version" ;;
                MSG_MENU_LIST) printf "5) List all backups" ;;
                MSG_MENU_LOGS) printf "6) View kernel logs" ;;
                MSG_MENU_CLEAN) printf "7) Clean logs" ;;
                MSG_MENU_HELP) printf "8) Show help" ;;
                MSG_MENU_EXIT) printf "0) Exit" ;;
                MSG_HELP_NOTE) printf "This tool manages kernel versions and controls kernel status (start/stop/restart)." ;;

                MSG_CLEAN_TITLE) printf "Clean old log files" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[Info] Current log file: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[Info] Log size: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[Info] Old log count: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[Info] Total old log size: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[Cleanup options]" ;;
                MSG_CLEAN_ALL) printf "1) Delete all old logs" ;;
                MSG_CLEAN_7D) printf "2) Keep last 7 days, delete older logs" ;;
                MSG_CLEAN_30D) printf "3) Keep last 30 days, delete older logs" ;;
                MSG_CLEAN_CANCEL) printf "0) Cancel" ;;
                MSG_CLEAN_PROMPT) printf "Choose cleanup option (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "Deleted all old log files" ;;
                MSG_CLEAN_DONE_7D) printf "Deleted logs older than 7 days" ;;
                MSG_CLEAN_DONE_30D) printf "Deleted logs older than 30 days" ;;
                MSG_CLEAN_CANCELLED) printf "Cleanup cancelled" ;;
                MSG_CLEAN_INVALID) printf "Invalid selection" ;;

                MSG_LOG_ROTATE_DATE) printf "Log rotated by date: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "Log rotated by size: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "Current kernel info" ;;
                MSG_MAIN_MENU_TITLE) printf "Main menu" ;;
                MSG_KERNEL_STATUS_CHECK) printf "Kernel status check" ;;
                MSG_MAIN_PROMPT) printf "Choose an option:" ;;
                MSG_MAIN_LINE_1) printf "  1) Install/Update Mihomo kernel        2) Kernel control (start/stop/restart)" ;;
                MSG_MAIN_LINE_2) printf "  3) Show current status                 4) Switch kernel version" ;;
                MSG_MAIN_LINE_3) printf "  5) List all backups                    6) View kernel logs" ;;
                MSG_MAIN_LINE_4) printf "  7) Clean logs                          8) Show help" ;;
                MSG_MAIN_LINE_5) printf "  0) Exit" ;;

                MSG_CLEANUP_STOPPING) printf "[Cleanup] Stopping log checker (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[Cleanup] Forcing log checker to stop..." ;;
                MSG_CLEANUP_FAIL) printf "[Cleanup] Failed to stop log checker (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "Log checker stopped" ;;
                MSG_EXIT_ABNORMAL) printf "[Exit] Program terminated unexpectedly" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory requires a directory path." ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang requires a language (zh|en|ja|ko|fr|de|ru|auto)." ;;
                MSG_ARG_LANG_INVALID) printf "Invalid language: %s (supported: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "Unknown command: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "Available commands: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "Available args: -d/--directory <path> - custom ClashFox install dir; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - set UI language" ;;

                MSG_SAVED_DIR_LOADED) printf "Loaded saved directory: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "No saved directory found. Using default: %s" "$@" ;;
                MSG_DIR_SAVED) printf "Saved directory to config: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "Select ClashFox install directory" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "Current default directory: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "Use default directory? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "Enter custom install directory: " ;;
                MSG_DIR_SET) printf "Set ClashFox install directory to: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "Using default install directory: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "Invalid input. Using default directory: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "Using existing install directory: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[Init] Starting log checker..." ;;
                MSG_LOG_CHECKER_OK) printf "Log checker started. PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[Init] Checking ClashFox app installation..." ;;
                MSG_APP_DIR_MISSING) printf "ClashFox app directory not found. Creating..." ;;
                MSG_APP_DIR_TARGET) printf "  Target directory: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "Created ClashFox app directory: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox app installed: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "Enter choice (0-8): " ;;
                MSG_EXIT_THANKS) printf "[Exit] Thanks for using ClashFox Mihomo Kernel Manager" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo Config: [Not found %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo Config: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        ja)
            case "$key" in
                TAG_SUCCESS) printf "成功" ;;
                TAG_ERROR) printf "エラー" ;;
                TAG_WARNING) printf "ヒント" ;;
                TAG_VERSION) printf "バージョン" ;;
                LABEL_FUNCTION) printf "機能" ;;
                LABEL_STATUS) printf "状態" ;;
                LABEL_HELP) printf "ヘルプ" ;;
                LABEL_INIT) printf "初期化" ;;
                LABEL_STEP) printf "手順" ;;
                LABEL_INFO) printf "情報" ;;
                LABEL_CLEANUP) printf "クリーンアップ" ;;
                LABEL_OPTIONS) printf "オプション" ;;
                LABEL_MENU) printf "メインメニュー" ;;

                MSG_MACOS_ONLY) printf "このスクリプトは macOS のみ対応です。" ;;
                MSG_WELCOME) printf "ようこそ %s、%s へ" "$@" ;;
                MSG_PRESS_ENTER) printf "Enterキーを押して続行..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "カーネル管理にはシステム権限が必要です。" ;;
                MSG_REQUIRE_SUDO_DESC) printf "注: 起動/停止/再起動/状態の操作には sudo 権限が必要です。" ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "認証: 続行するには macOS のパスワードを入力してください。" ;;
                MSG_SUDO_OK) printf "権限確認に成功しました。" ;;
                MSG_SUDO_FAIL) printf "パスワード認証に失敗しました。再試行してください。" ;;

                MSG_INIT_CHECK_DIRS) printf "[初期化] ディレクトリ構造を確認中..." ;;
                MSG_INIT_SET_PERMS) printf "[初期化] ディレクトリ権限を設定中..." ;;
                MSG_NEED_ADMIN) printf "ディレクトリ作成には管理者権限が必要です。" ;;
                MSG_NO_PERMISSION) printf "権限が不足しています。ディレクトリを作成できません。" ;;
                MSG_CORE_DIR_CREATE) printf "コアディレクトリを作成: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "コアディレクトリが存在します: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "設定ディレクトリを作成: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "設定ディレクトリが存在します: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "データディレクトリを作成: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "データディレクトリが存在します: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "ログディレクトリを作成: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "ログディレクトリが存在します: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "ランタイムディレクトリを作成: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "ランタイムディレクトリが存在します: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "ディレクトリ権限を設定しました。" ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "コアディレクトリが見つかりません。構造を作成中..." ;;
                MSG_DIR_CREATE_FAIL) printf "ディレクトリ構造の作成に失敗しました。" ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "コアディレクトリに入れません。" ;;

                MSG_STATUS_STOPPED) printf "停止" ;;
                MSG_STATUS_RUNNING) printf "稼働中" ;;
                MSG_STATUS_LABEL) printf "Mihomo 状態" ;;
                MSG_KERNEL_LABEL) printf "Mihomo カーネル" ;;
                MSG_CONFIG_LABEL) printf "Mihomo 設定" ;;
                MSG_CONFIG_NOT_FOUND) printf "見つかりません: %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• 状態:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• カーネルファイル情報:" ;;
                MSG_BACKUP_SECTION) printf "• バックアップ情報:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ カーネルファイルあり" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ カーネルファイルが実行不可" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ カーネルファイルなし" ;;
                MSG_KERNEL_VERSION_INFO) printf "バージョン: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "表示名: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "表示名: %s (解析失敗)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ バックアップあり" ;;
                MSG_BACKUP_LATEST) printf "最新バックアップ: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "バックアップ版: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "バックアップ版: 不明" ;;
                MSG_BACKUP_TIME) printf "バックアップ時間: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  バックアップがありません" ;;

                MSG_LIST_BACKUPS_TITLE) printf "すべてのバックアップカーネルを一覧" ;;
                MSG_NO_BACKUPS) printf "バックアップファイルなし" ;;
                MSG_BACKUP_LIST_TITLE) printf "[情報] 利用可能なバックアップ (新しい順):" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "番号 | バージョン | バックアップ時間" ;;
                MSG_BACKUP_TOTAL) printf "バックアップ総数: %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "カーネル版の切替" ;;
                MSG_SWITCH_PROMPT) printf "切り替えるバックアップ番号を入力 (Enterで戻る): " ;;
                MSG_INVALID_NUMBER) printf "有効な数字を入力してください。" ;;
                MSG_BACKUP_NO_MATCH) printf "一致するバックアップ番号がありません。" ;;
                MSG_SWITCH_START) printf "[手順] カーネル切替を開始..." ;;
                MSG_BACKUP_SELECTED) printf "[情報] 選択したバックアップ: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[情報] 現在のカーネル版: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[情報] 現在のカーネルがありません" ;;
                MSG_SWITCH_CONFIRM) printf "この版に切り替えますか? (y/n): " ;;
                MSG_OP_CANCELLED) printf "操作をキャンセルしました。" ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[手順] 現在のカーネルをバックアップ -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[手順] カーネルを置換: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[手順] 一時バックアップを削除: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[完了] カーネル切替完了" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[情報] 利用可能なバックアップ:" ;;
                MSG_INSTALL_TITLE) printf "Mihomo カーネルをインストール/更新" ;;
                MSG_SELECT_GITHUB_USER) printf "ダウンロードする GitHub ユーザーを選択:" ;;
                MSG_SELECT_USER_PROMPT) printf "ユーザーを選択 (デフォルト1): " ;;
                MSG_SELECTED_GITHUB_USER) printf "[情報] 選択した GitHub ユーザー: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[手順] 最新バージョン情報を取得中..." ;;
                MSG_VERSION_INFO_FAIL) printf "バージョン情報を取得できないか、存在しません。" ;;
                MSG_VERSION_INFO) printf "[情報] バージョン: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "未対応アーキテクチャ: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[情報] アーキテクチャ: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[手順] ダウンロード情報:" ;;
                MSG_DOWNLOAD_URL) printf "  ダウンロードURL: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  バージョン: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "このバージョンをダウンロードしてインストールしますか? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[手順] カーネルをダウンロード中 (数分かかる場合があります)..." ;;
                MSG_DOWNLOAD_RETRY) printf "ダウンロード失敗。%s/%s で再試行中..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "ダウンロード完了" ;;
                MSG_EXTRACT_START) printf "[手順] カーネルを解凍中..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[手順] 新規カーネルをバックアップ -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[完了] カーネルのインストールが成功" ;;
                MSG_EXTRACT_FAIL) printf "解凍に失敗しました。" ;;
                MSG_DOWNLOAD_FAIL) printf "ダウンロードに失敗しました (%s 回試行)。" "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "解析失敗" ;;
                MSG_NOT_INSTALLED) printf "未インストール" ;;

                MSG_START_TITLE) printf "Mihomo カーネルを起動" ;;
                MSG_KERNEL_RUNNING) printf "Mihomo カーネルは既に起動しています" ;;
                MSG_START_PRECHECK) printf "[手順] 起動前チェック..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Mihomo カーネルファイルが見つかりません" ;;
                MSG_KERNEL_NOT_EXEC) printf "Mihomo カーネルファイルが実行不可" ;;
                MSG_ADD_EXEC) printf "[手順] 実行権限を付与中..." ;;
                MSG_ADD_EXEC_FAIL) printf "実行権限の付与に失敗" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "デフォルト設定ファイルが見つかりません: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[手順] 他の設定ファイルを確認中..." ;;
                MSG_CONFIG_NONE) printf "設定ディレクトリに設定ファイルがありません。" ;;
                MSG_CONFIG_PUT_HINT) printf "%s に設定ファイルを配置してください" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[情報] 利用可能な設定ファイル:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "番号 | 設定ファイルパス" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "使用する設定ファイル番号を選択 (0でキャンセル): " ;;
                MSG_CONFIG_SELECTED) printf "選択した設定ファイル: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "無効な選択です。" ;;
                MSG_CONFIG_READ_FAIL) printf "設定ファイルを読めません: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "設定ファイルの権限を確認してください。" ;;
                MSG_CONFIG_EMPTY) printf "設定ファイルが空です: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "設定ファイルに有効な内容があるか確認してください。" ;;
                MSG_CONFIG_WILL_USE) printf "使用する設定ファイル: %s" "$@" ;;
                MSG_START_PROCESS) printf "[手順] カーネルプロセスを起動中..." ;;
                MSG_START_COMMAND) printf "起動コマンド: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PIDを保存: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Mihomo カーネルを起動しました" ;;
                MSG_PROCESS_ID) printf "プロセスID: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Mihomo カーネルの起動に失敗" ;;

                MSG_STOP_TITLE) printf "Mihomo カーネルを停止" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Mihomo カーネルは停止中です" ;;
                MSG_STOPPING_KERNEL) printf "[手順] Mihomo カーネルを停止中..." ;;
                MSG_PIDS_FOUND) printf "プロセスIDを検出: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[手順] プロセス %s を停止中..." "$@" ;;
                MSG_FORCE_STOPPING) printf "残りのプロセスを強制停止中..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Mihomo カーネルの停止に失敗" ;;
                MSG_KERNEL_STOP_HINT) printf "Activity Monitor で手動停止を試してください。" ;;
                MSG_KERNEL_STOPPED) printf "Mihomo カーネルを停止しました" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Mihomo カーネルプロセスは動作していません" ;;
                MSG_PID_CLEANED) printf "PIDファイルを削除: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Mihomo カーネルを再起動" ;;
                MSG_KERNEL_MENU_TITLE) printf "カーネル制御" ;;
                MSG_KERNEL_MENU_PROMPT) printf "カーネル操作を選択:" ;;
                MSG_MENU_START) printf "1) カーネルを起動" ;;
                MSG_MENU_STOP) printf "2) カーネルを停止" ;;
                MSG_MENU_RESTART) printf "3) カーネルを再起動" ;;
                MSG_MENU_BACK) printf "0) メインメニューへ戻る" ;;
                MSG_MENU_CHOICE_0_3) printf "選択 (0-3): " ;;
                MSG_MENU_INVALID) printf "無効な選択です。再入力してください。" ;;

                MSG_LOGS_TITLE) printf "Mihomo カーネルログを表示" ;;
                MSG_LOG_FILE_MISSING) printf "ログファイルが見つかりません: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "ログ生成のためにカーネルを先に起動してください。" ;;
                MSG_LOG_FILE_PATH) printf "[情報] ログファイルパス: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[情報] ログサイズ: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[情報] ログ行数: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[オプション] ログ表示方法:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) 最後の50行を表示" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) リアルタイム表示 (Ctrl+Cで終了)" ;;
                MSG_LOG_OPTION_LESS) printf "3) lessで全文表示 (qで終了)" ;;
                MSG_LOG_OPTION_BACK) printf "0) メインメニューへ戻る" ;;
                MSG_LOG_TAIL_HEADER) printf "[情報] ログの最後50行:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[情報] リアルタイム表示 (Ctrl+Cで終了):" ;;
                MSG_LOG_LESS_HEADER) printf "[情報] lessで全文表示 (qで終了):" ;;

                MSG_HELP_TITLE) printf "ヘルプ" ;;
                MSG_HELP_ARGS) printf "コマンドライン引数:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  ClashFox インストール先を指定" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  表示言語を指定" ;;
                MSG_HELP_STATUS) printf "  status                 現在のカーネル状態を表示" ;;
                MSG_HELP_LIST) printf "  list                   すべてのバックアップを一覧" ;;
                MSG_HELP_SWITCH) printf "  switch                 カーネル版を切替" ;;
                MSG_HELP_LOGS) printf "  logs|log               カーネルログを表示" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            ログを削除" ;;
                MSG_HELP_HELP) printf "  help|-h                ヘルプを表示" ;;
                MSG_HELP_VERSION) printf "  version|-v             バージョンを表示" ;;
                MSG_HELP_MENU) printf "対話メニュー:" ;;
                MSG_MENU_INSTALL) printf "1) Mihomo カーネルをインストール/更新" ;;
                MSG_MENU_CONTROL) printf "2) カーネル制御(起動/停止/再起動)" ;;
                MSG_MENU_STATUS) printf "3) 現在の状態を表示" ;;
                MSG_MENU_SWITCH) printf "4) カーネル版を切替" ;;
                MSG_MENU_LIST) printf "5) すべてのバックアップを一覧" ;;
                MSG_MENU_LOGS) printf "6) カーネルログを表示" ;;
                MSG_MENU_CLEAN) printf "7) ログを削除" ;;
                MSG_MENU_HELP) printf "8) ヘルプを表示" ;;
                MSG_MENU_EXIT) printf "0) 終了" ;;
                MSG_HELP_NOTE) printf "このツールはカーネル版管理と、カーネル状態(起動/停止/再起動)の制御ができます。" ;;

                MSG_CLEAN_TITLE) printf "古いログを削除" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[情報] 現在のログ: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[情報] ログサイズ: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[情報] 旧ログ数: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[情報] 旧ログ合計サイズ: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[クリーンアップオプション]" ;;
                MSG_CLEAN_ALL) printf "1) すべての旧ログを削除" ;;
                MSG_CLEAN_7D) printf "2) 直近7日を保持し古いログを削除" ;;
                MSG_CLEAN_30D) printf "3) 直近30日を保持し古いログを削除" ;;
                MSG_CLEAN_CANCEL) printf "0) キャンセル" ;;
                MSG_CLEAN_PROMPT) printf "削除方法を選択 (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "すべての旧ログを削除しました" ;;
                MSG_CLEAN_DONE_7D) printf "7日より古いログを削除しました" ;;
                MSG_CLEAN_DONE_30D) printf "30日より古いログを削除しました" ;;
                MSG_CLEAN_CANCELLED) printf "削除をキャンセルしました" ;;
                MSG_CLEAN_INVALID) printf "無効な選択です" ;;

                MSG_LOG_ROTATE_DATE) printf "日付でログをローテーション: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "サイズでログをローテーション: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "現在のカーネル情報" ;;
                MSG_MAIN_MENU_TITLE) printf "メインメニュー" ;;
                MSG_KERNEL_STATUS_CHECK) printf "カーネル状態チェック" ;;
                MSG_MAIN_PROMPT) printf "操作を選択してください:" ;;
                MSG_MAIN_LINE_1) printf "  1) Mihomo カーネルをインストール/更新       2) カーネル制御(起動/停止/再起動)" ;;
                MSG_MAIN_LINE_2) printf "  3) 現在の状態を表示                         4) カーネル版を切替" ;;
                MSG_MAIN_LINE_3) printf "  5) すべてのバックアップを一覧               6) カーネルログを表示" ;;
                MSG_MAIN_LINE_4) printf "  7) ログを削除                               8) ヘルプを表示" ;;
                MSG_MAIN_LINE_5) printf "  0) 終了" ;;

                MSG_CLEANUP_STOPPING) printf "[クリーンアップ] ログチェッカーを停止中 (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[クリーンアップ] ログチェッカーを強制停止中..." ;;
                MSG_CLEANUP_FAIL) printf "[クリーンアップ] ログチェッカー停止に失敗 (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "ログチェッカーを停止しました" ;;
                MSG_EXIT_ABNORMAL) printf "[終了] プログラムが異常終了しました" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory にはディレクトリパスが必要です。" ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang には言語(zh|en|ja|ko|fr|de|ru|auto)が必要です。" ;;
                MSG_ARG_LANG_INVALID) printf "無効な言語: %s (対応: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "不明なコマンド: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "利用可能コマンド: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "利用可能引数: -d/--directory <path> - ClashFoxのインストール先; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - 表示言語" ;;

                MSG_SAVED_DIR_LOADED) printf "保存済みディレクトリを読み込みました: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "保存済みディレクトリがありません。デフォルトを使用: %s" "$@" ;;
                MSG_DIR_SAVED) printf "設定ファイルに保存しました: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "ClashFox のインストール先を選択" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "現在のデフォルトディレクトリ: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "デフォルトディレクトリを使用しますか? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "カスタムインストール先を入力: " ;;
                MSG_DIR_SET) printf "ClashFox のインストール先を設定: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "デフォルトのインストール先を使用: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "無効な入力。デフォルトを使用: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "既存のインストール先を使用: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[初期化] ログチェッカーを起動中..." ;;
                MSG_LOG_CHECKER_OK) printf "ログチェッカーを起動しました。PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[初期化] ClashFox アプリのインストール確認..." ;;
                MSG_APP_DIR_MISSING) printf "ClashFox アプリディレクトリがありません。作成中..." ;;
                MSG_APP_DIR_TARGET) printf "  対象ディレクトリ: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "ClashFox アプリディレクトリを作成しました: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox アプリがインストール済み: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "選択 (0-8): " ;;
                MSG_EXIT_THANKS) printf "[終了] ClashFox Mihomo Kernel Manager をご利用いただきありがとうございます" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo 設定: [未検出 %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo 設定: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        ko)
            case "$key" in
                TAG_SUCCESS) printf "성공" ;;
                TAG_ERROR) printf "오류" ;;
                TAG_WARNING) printf "안내" ;;
                TAG_VERSION) printf "버전" ;;
                LABEL_FUNCTION) printf "기능" ;;
                LABEL_STATUS) printf "상태" ;;
                LABEL_HELP) printf "도움말" ;;
                LABEL_INIT) printf "초기화" ;;
                LABEL_STEP) printf "단계" ;;
                LABEL_INFO) printf "정보" ;;
                LABEL_CLEANUP) printf "정리" ;;
                LABEL_OPTIONS) printf "옵션" ;;
                LABEL_MENU) printf "메인 메뉴" ;;

                MSG_MACOS_ONLY) printf "이 스크립트는 macOS만 지원합니다." ;;
                MSG_WELCOME) printf "%s님, %s에 오신 것을 환영합니다" "$@" ;;
                MSG_PRESS_ENTER) printf "Enter 키를 눌러 계속..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "커널 관리를 위해 시스템 권한이 필요합니다." ;;
                MSG_REQUIRE_SUDO_DESC) printf "참고: 시작/중지/재시작/상태 작업에는 sudo 권한이 필요합니다." ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "인증: 계속하려면 macOS 비밀번호를 입력하세요." ;;
                MSG_SUDO_OK) printf "권한 확인 완료." ;;
                MSG_SUDO_FAIL) printf "비밀번호 확인 실패. 다시 시도하세요." ;;

                MSG_INIT_CHECK_DIRS) printf "[초기화] 디렉터리 구조 확인 중..." ;;
                MSG_INIT_SET_PERMS) printf "[초기화] 디렉터리 권한 설정 중..." ;;
                MSG_NEED_ADMIN) printf "디렉터리 생성을 위해 관리자 권한이 필요합니다." ;;
                MSG_NO_PERMISSION) printf "권한이 부족하여 디렉터리를 만들 수 없습니다." ;;
                MSG_CORE_DIR_CREATE) printf "코어 디렉터리 생성: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "코어 디렉터리가 존재합니다: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "설정 디렉터리 생성: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "설정 디렉터리가 존재합니다: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "데이터 디렉터리 생성: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "데이터 디렉터리가 존재합니다: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "로그 디렉터리 생성: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "로그 디렉터리가 존재합니다: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "런타임 디렉터리 생성: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "런타임 디렉터리가 존재합니다: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "디렉터리 권한을 설정했습니다." ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "코어 디렉터리가 없습니다. 구조를 생성 중..." ;;
                MSG_DIR_CREATE_FAIL) printf "디렉터리 구조 생성에 실패했습니다." ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "코어 디렉터리에 들어갈 수 없습니다." ;;

                MSG_STATUS_STOPPED) printf "중지됨" ;;
                MSG_STATUS_RUNNING) printf "실행 중" ;;
                MSG_STATUS_LABEL) printf "Mihomo 상태" ;;
                MSG_KERNEL_LABEL) printf "Mihomo 커널" ;;
                MSG_CONFIG_LABEL) printf "Mihomo 설정" ;;
                MSG_CONFIG_NOT_FOUND) printf "찾을 수 없음: %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• 상태:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• 커널 파일 정보:" ;;
                MSG_BACKUP_SECTION) printf "• 백업 정보:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ 커널 파일 존재" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ 커널 파일이 실행 불가" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ 커널 파일 없음" ;;
                MSG_KERNEL_VERSION_INFO) printf "버전: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "표시 이름: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "표시 이름: %s (파싱 실패)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ 백업 발견" ;;
                MSG_BACKUP_LATEST) printf "최신 백업: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "백업 버전: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "백업 버전: 알 수 없음" ;;
                MSG_BACKUP_TIME) printf "백업 시간: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  백업이 없습니다" ;;

                MSG_LIST_BACKUPS_TITLE) printf "모든 백업 커널 목록" ;;
                MSG_NO_BACKUPS) printf "백업 파일 없음" ;;
                MSG_BACKUP_LIST_TITLE) printf "[정보] 사용 가능한 백업(최신순):" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "번호 | 버전 | 백업 시간" ;;
                MSG_BACKUP_TOTAL) printf "백업 총수: %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "커널 버전 전환" ;;
                MSG_SWITCH_PROMPT) printf "전환할 백업 번호 입력 (Enter로 돌아가기): " ;;
                MSG_INVALID_NUMBER) printf "유효한 숫자를 입력하세요." ;;
                MSG_BACKUP_NO_MATCH) printf "일치하는 백업 번호가 없습니다." ;;
                MSG_SWITCH_START) printf "[단계] 커널 전환 시작..." ;;
                MSG_BACKUP_SELECTED) printf "[정보] 선택된 백업: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[정보] 현재 커널 버전: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[정보] 현재 커널이 없습니다" ;;
                MSG_SWITCH_CONFIRM) printf "이 버전으로 전환할까요? (y/n): " ;;
                MSG_OP_CANCELLED) printf "작업이 취소되었습니다." ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[단계] 현재 커널 백업 -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[단계] 커널 교체: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[단계] 임시 백업 삭제: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[완료] 커널 전환 완료" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[정보] 사용 가능한 백업:" ;;
                MSG_INSTALL_TITLE) printf "Mihomo 커널 설치/업데이트" ;;
                MSG_SELECT_GITHUB_USER) printf "다운로드할 GitHub 사용자 선택:" ;;
                MSG_SELECT_USER_PROMPT) printf "사용자 선택(기본 1): " ;;
                MSG_SELECTED_GITHUB_USER) printf "[정보] 선택된 GitHub 사용자: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[단계] 최신 버전 정보 가져오는 중..." ;;
                MSG_VERSION_INFO_FAIL) printf "버전 정보를 가져올 수 없거나 버전이 없습니다." ;;
                MSG_VERSION_INFO) printf "[정보] 버전: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "지원하지 않는 아키텍처: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[정보] 아키텍처: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[단계] 다운로드 정보:" ;;
                MSG_DOWNLOAD_URL) printf "  다운로드 URL: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  버전: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "이 버전을 다운로드 및 설치할까요? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[단계] 커널 다운로드 중(몇 분 걸릴 수 있음)..." ;;
                MSG_DOWNLOAD_RETRY) printf "다운로드 실패. %s/%s 재시도 중..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "다운로드 완료" ;;
                MSG_EXTRACT_START) printf "[단계] 커널 압축 해제 중..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[단계] 새 커널 백업 -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[완료] 커널 설치 성공" ;;
                MSG_EXTRACT_FAIL) printf "압축 해제 실패." ;;
                MSG_DOWNLOAD_FAIL) printf "다운로드 실패(%s회 시도)." "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "파싱 실패" ;;
                MSG_NOT_INSTALLED) printf "미설치" ;;

                MSG_START_TITLE) printf "Mihomo 커널 시작" ;;
                MSG_KERNEL_RUNNING) printf "Mihomo 커널이 이미 실행 중입니다" ;;
                MSG_START_PRECHECK) printf "[단계] 시작 전 점검..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Mihomo 커널 파일을 찾을 수 없습니다" ;;
                MSG_KERNEL_NOT_EXEC) printf "Mihomo 커널 파일이 실행 불가" ;;
                MSG_ADD_EXEC) printf "[단계] 실행 권한 추가 중..." ;;
                MSG_ADD_EXEC_FAIL) printf "실행 권한 추가 실패" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "기본 설정 파일을 찾을 수 없습니다: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[단계] 다른 설정 파일 확인 중..." ;;
                MSG_CONFIG_NONE) printf "설정 디렉터리에 설정 파일이 없습니다." ;;
                MSG_CONFIG_PUT_HINT) printf "%s 에 설정 파일을 넣어주세요" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[정보] 사용 가능한 설정 파일:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "번호 | 설정 파일 경로" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "사용할 설정 파일 번호 선택(0 취소): " ;;
                MSG_CONFIG_SELECTED) printf "선택된 설정 파일: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "잘못된 선택입니다." ;;
                MSG_CONFIG_READ_FAIL) printf "설정 파일을 읽을 수 없음: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "설정 파일 권한을 확인하세요." ;;
                MSG_CONFIG_EMPTY) printf "설정 파일이 비어 있습니다: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "설정 파일에 유효한 내용이 있는지 확인하세요." ;;
                MSG_CONFIG_WILL_USE) printf "사용할 설정 파일: %s" "$@" ;;
                MSG_START_PROCESS) printf "[단계] 커널 프로세스 시작 중..." ;;
                MSG_START_COMMAND) printf "시작 명령: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID 기록: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Mihomo 커널이 시작되었습니다" ;;
                MSG_PROCESS_ID) printf "프로세스 ID: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Mihomo 커널 시작 실패" ;;

                MSG_STOP_TITLE) printf "Mihomo 커널 중지" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Mihomo 커널이 실행 중이 아닙니다" ;;
                MSG_STOPPING_KERNEL) printf "[단계] Mihomo 커널 중지 중..." ;;
                MSG_PIDS_FOUND) printf "프로세스 ID 발견: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[단계] 프로세스 %s 중지 중..." ;;
                MSG_FORCE_STOPPING) printf "남은 프로세스를 강제 종료 중..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Mihomo 커널 중지 실패" ;;
                MSG_KERNEL_STOP_HINT) printf "Activity Monitor에서 수동으로 중지해 보세요." ;;
                MSG_KERNEL_STOPPED) printf "Mihomo 커널이 중지되었습니다" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Mihomo 커널 프로세스가 실행 중이 아닙니다" ;;
                MSG_PID_CLEANED) printf "PID 파일 삭제: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Mihomo 커널 재시작" ;;
                MSG_KERNEL_MENU_TITLE) printf "커널 제어" ;;
                MSG_KERNEL_MENU_PROMPT) printf "커널 작업을 선택하세요:" ;;
                MSG_MENU_START) printf "1) 커널 시작" ;;
                MSG_MENU_STOP) printf "2) 커널 중지" ;;
                MSG_MENU_RESTART) printf "3) 커널 재시작" ;;
                MSG_MENU_BACK) printf "0) 메인 메뉴로 돌아가기" ;;
                MSG_MENU_CHOICE_0_3) printf "선택 (0-3): " ;;
                MSG_MENU_INVALID) printf "잘못된 선택입니다. 다시 입력하세요." ;;

                MSG_LOGS_TITLE) printf "Mihomo 커널 로그 보기" ;;
                MSG_LOG_FILE_MISSING) printf "로그 파일을 찾을 수 없음: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "먼저 커널을 시작하여 로그를 생성하세요." ;;
                MSG_LOG_FILE_PATH) printf "[정보] 로그 파일 경로: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[정보] 로그 크기: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[정보] 로그 줄 수: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[옵션] 로그 보기 방법:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) 마지막 50줄 보기" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) 실시간 로그 보기 (Ctrl+C 종료)" ;;
                MSG_LOG_OPTION_LESS) printf "3) less로 전체 보기 (q 종료)" ;;
                MSG_LOG_OPTION_BACK) printf "0) 메인 메뉴로 돌아가기" ;;
                MSG_LOG_TAIL_HEADER) printf "[정보] 마지막 50줄:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[정보] 실시간 로그 보기 (Ctrl+C 종료):" ;;
                MSG_LOG_LESS_HEADER) printf "[정보] less로 전체 보기 (q 종료):" ;;

                MSG_HELP_TITLE) printf "도움말" ;;
                MSG_HELP_ARGS) printf "명령줄 인자:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  ClashFox 설치 경로 지정" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  UI 언어 지정" ;;
                MSG_HELP_STATUS) printf "  status                 현재 커널 상태 보기" ;;
                MSG_HELP_LIST) printf "  list                   모든 백업 목록" ;;
                MSG_HELP_SWITCH) printf "  switch                 커널 버전 전환" ;;
                MSG_HELP_LOGS) printf "  logs|log               커널 로그 보기" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            로그 정리" ;;
                MSG_HELP_HELP) printf "  help|-h                도움말 표시" ;;
                MSG_HELP_VERSION) printf "  version|-v             버전 표시" ;;
                MSG_HELP_MENU) printf "대화형 메뉴:" ;;
                MSG_MENU_INSTALL) printf "1) Mihomo 커널 설치/업데이트" ;;
                MSG_MENU_CONTROL) printf "2) 커널 제어(시작/중지/재시작)" ;;
                MSG_MENU_STATUS) printf "3) 현재 상태 보기" ;;
                MSG_MENU_SWITCH) printf "4) 커널 버전 전환" ;;
                MSG_MENU_LIST) printf "5) 모든 백업 목록" ;;
                MSG_MENU_LOGS) printf "6) 커널 로그 보기" ;;
                MSG_MENU_CLEAN) printf "7) 로그 정리" ;;
                MSG_MENU_HELP) printf "8) 도움말 표시" ;;
                MSG_MENU_EXIT) printf "0) 종료" ;;
                MSG_HELP_NOTE) printf "이 도구는 커널 버전 관리 및 상태 제어(시작/중지/재시작)를 제공합니다." ;;

                MSG_CLEAN_TITLE) printf "오래된 로그 정리" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[정보] 현재 로그: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[정보] 로그 크기: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[정보] 오래된 로그 개수: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[정보] 오래된 로그 총 크기: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[정리 옵션]" ;;
                MSG_CLEAN_ALL) printf "1) 모든 오래된 로그 삭제" ;;
                MSG_CLEAN_7D) printf "2) 최근 7일 유지, 이전 로그 삭제" ;;
                MSG_CLEAN_30D) printf "3) 최근 30일 유지, 이전 로그 삭제" ;;
                MSG_CLEAN_CANCEL) printf "0) 취소" ;;
                MSG_CLEAN_PROMPT) printf "정리 방법 선택 (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "모든 오래된 로그를 삭제했습니다" ;;
                MSG_CLEAN_DONE_7D) printf "7일 이전 로그를 삭제했습니다" ;;
                MSG_CLEAN_DONE_30D) printf "30일 이전 로그를 삭제했습니다" ;;
                MSG_CLEAN_CANCELLED) printf "정리가 취소되었습니다" ;;
                MSG_CLEAN_INVALID) printf "잘못된 선택입니다" ;;

                MSG_LOG_ROTATE_DATE) printf "날짜 기준 로그 회전: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "크기 기준 로그 회전: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "현재 커널 정보" ;;
                MSG_MAIN_MENU_TITLE) printf "메인 메뉴" ;;
                MSG_KERNEL_STATUS_CHECK) printf "커널 상태 확인" ;;
                MSG_MAIN_PROMPT) printf "원하는 기능을 선택하세요:" ;;
                MSG_MAIN_LINE_1) printf "  1) Mihomo 커널 설치/업데이트           2) 커널 제어(시작/중지/재시작)" ;;
                MSG_MAIN_LINE_2) printf "  3) 현재 상태 보기                       4) 커널 버전 전환" ;;
                MSG_MAIN_LINE_3) printf "  5) 모든 백업 목록                       6) 커널 로그 보기" ;;
                MSG_MAIN_LINE_4) printf "  7) 로그 정리                            8) 도움말 표시" ;;
                MSG_MAIN_LINE_5) printf "  0) 종료" ;;

                MSG_CLEANUP_STOPPING) printf "[정리] 로그 검사 프로세스 종료 중 (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[정리] 로그 검사 프로세스 강제 종료 중..." ;;
                MSG_CLEANUP_FAIL) printf "[정리] 로그 검사 프로세스 종료 실패 (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "로그 검사 프로세스를 종료했습니다" ;;
                MSG_EXIT_ABNORMAL) printf "[종료] 프로그램이 비정상 종료되었습니다" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory 에는 디렉터리 경로가 필요합니다." ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang 에는 언어(zh|en|ja|ko|fr|de|ru|auto)가 필요합니다." ;;
                MSG_ARG_LANG_INVALID) printf "잘못된 언어: %s (지원: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "알 수 없는 명령: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "사용 가능한 명령: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "사용 가능한 인자: -d/--directory <path> - ClashFox 설치 경로; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - UI 언어" ;;

                MSG_SAVED_DIR_LOADED) printf "저장된 디렉터리 불러옴: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "저장된 디렉터리가 없습니다. 기본값 사용: %s" "$@" ;;
                MSG_DIR_SAVED) printf "디렉터리를 설정 파일에 저장: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "ClashFox 설치 경로 선택" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "현재 기본 디렉터리: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "기본 디렉터리를 사용하시겠습니까? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "사용자 지정 설치 경로 입력: " ;;
                MSG_DIR_SET) printf "ClashFox 설치 경로 설정: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "기본 설치 경로 사용: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "잘못된 입력. 기본 경로 사용: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "기존 설치 경로 사용: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[초기화] 로그 검사 프로세스 시작..." ;;
                MSG_LOG_CHECKER_OK) printf "로그 검사 프로세스 시작됨. PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[초기화] ClashFox 앱 설치 확인..." ;;
                MSG_APP_DIR_MISSING) printf "ClashFox 앱 디렉터리가 없습니다. 생성 중..." ;;
                MSG_APP_DIR_TARGET) printf "  대상 디렉터리: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "ClashFox 앱 디렉터리 생성됨: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox 앱이 설치되어 있습니다: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "선택 (0-8): " ;;
                MSG_EXIT_THANKS) printf "[종료] ClashFox Mihomo Kernel Manager를 이용해 주셔서 감사합니다" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo 설정: [찾을 수 없음 %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo 설정: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        fr)
            case "$key" in
                TAG_SUCCESS) printf "Succès" ;;
                TAG_ERROR) printf "Erreur" ;;
                TAG_WARNING) printf "Info" ;;
                TAG_VERSION) printf "Version" ;;
                LABEL_FUNCTION) printf "Fonction" ;;
                LABEL_STATUS) printf "Statut" ;;
                LABEL_HELP) printf "Aide" ;;
                LABEL_INIT) printf "Initialisation" ;;
                LABEL_STEP) printf "Étape" ;;
                LABEL_INFO) printf "Info" ;;
                LABEL_CLEANUP) printf "Nettoyage" ;;
                LABEL_OPTIONS) printf "Options" ;;
                LABEL_MENU) printf "Menu principal" ;;

                MSG_MACOS_ONLY) printf "Ce script ne prend en charge que macOS." ;;
                MSG_WELCOME) printf "Bienvenue %s sur %s" "$@" ;;
                MSG_PRESS_ENTER) printf "Appuyez sur Entrée pour continuer..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "Des privilèges système sont requis pour gérer le noyau." ;;
                MSG_REQUIRE_SUDO_DESC) printf "Note : les opérations démarrer/arrêter/redémarrer/état nécessitent sudo." ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "Autorisation : saisissez le mot de passe macOS pour continuer." ;;
                MSG_SUDO_OK) printf "Vérification des privilèges réussie." ;;
                MSG_SUDO_FAIL) printf "Échec de la vérification du mot de passe. Veuillez réessayer." ;;

                MSG_INIT_CHECK_DIRS) printf "[Init] Vérification de la structure des répertoires..." ;;
                MSG_INIT_SET_PERMS) printf "[Init] Définition des permissions des répertoires..." ;;
                MSG_NEED_ADMIN) printf "Des privilèges administrateur sont requis pour créer les répertoires." ;;
                MSG_NO_PERMISSION) printf "Permissions insuffisantes pour créer les répertoires." ;;
                MSG_CORE_DIR_CREATE) printf "Création du répertoire core : %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "Le répertoire core existe : %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "Création du répertoire config : %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "Le répertoire config existe : %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "Création du répertoire data : %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "Le répertoire data existe : %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "Création du répertoire logs : %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "Le répertoire logs existe : %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "Création du répertoire runtime : %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "Le répertoire runtime existe : %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "Permissions des répertoires définies." ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "Répertoire core manquant. Création de la structure..." ;;
                MSG_DIR_CREATE_FAIL) printf "Échec de la création de la structure des répertoires." ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "Impossible d'entrer dans le répertoire core." ;;

                MSG_STATUS_STOPPED) printf "Arrêté" ;;
                MSG_STATUS_RUNNING) printf "En cours" ;;
                MSG_STATUS_LABEL) printf "Statut Mihomo" ;;
                MSG_KERNEL_LABEL) printf "Noyau Mihomo" ;;
                MSG_CONFIG_LABEL) printf "Config Mihomo" ;;
                MSG_CONFIG_NOT_FOUND) printf "Introuvable %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• Statut:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• Fichiers du noyau:" ;;
                MSG_BACKUP_SECTION) printf "• Sauvegardes:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ Fichier du noyau présent" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ Fichier du noyau non exécutable" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ Fichier du noyau introuvable" ;;
                MSG_KERNEL_VERSION_INFO) printf "Version : %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "Nom affiché : %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "Nom affiché : %s (échec d'analyse)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ Sauvegarde trouvée" ;;
                MSG_BACKUP_LATEST) printf "Dernière sauvegarde : %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "Version de sauvegarde : %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "Version de sauvegarde : inconnue" ;;
                MSG_BACKUP_TIME) printf "Heure de sauvegarde : %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  Aucune sauvegarde" ;;

                MSG_LIST_BACKUPS_TITLE) printf "Lister toutes les sauvegardes du noyau" ;;
                MSG_NO_BACKUPS) printf "Aucun fichier de sauvegarde" ;;
                MSG_BACKUP_LIST_TITLE) printf "[Info] Sauvegardes disponibles (les plus récentes d'abord) :" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "N° | Version | Heure de sauvegarde" ;;
                MSG_BACKUP_TOTAL) printf "Total des sauvegardes : %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "Changer de version du noyau" ;;
                MSG_SWITCH_PROMPT) printf "Entrez le numéro de sauvegarde (Entrée pour revenir) : " ;;
                MSG_INVALID_NUMBER) printf "Veuillez saisir un nombre valide." ;;
                MSG_BACKUP_NO_MATCH) printf "Aucun numéro de sauvegarde correspondant." ;;
                MSG_SWITCH_START) printf "[Étape] Démarrage du changement de noyau..." ;;
                MSG_BACKUP_SELECTED) printf "[Info] Sauvegarde sélectionnée : %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[Info] Version actuelle du noyau : %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[Info] Noyau actuel introuvable" ;;
                MSG_SWITCH_CONFIRM) printf "Confirmer le changement vers cette version ? (y/n) : " ;;
                MSG_OP_CANCELLED) printf "Opération annulée." ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[Étape] Sauvegarde du noyau actuel -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[Étape] Noyau remplacé par : %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[Étape] Sauvegarde temporaire supprimée : %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[Terminé] Changement de noyau terminé" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[Info] Sauvegardes disponibles:" ;;
                MSG_INSTALL_TITLE) printf "Installer/Mettre à jour le noyau Mihomo" ;;
                MSG_SELECT_GITHUB_USER) printf "Sélectionnez l'utilisateur GitHub pour le téléchargement :" ;;
                MSG_SELECT_USER_PROMPT) printf "Choisir l'utilisateur (par défaut 1) : " ;;
                MSG_SELECTED_GITHUB_USER) printf "[Info] Utilisateur GitHub sélectionné : %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[Étape] Récupération des infos de version..." ;;
                MSG_VERSION_INFO_FAIL) printf "Impossible de récupérer les infos de version ou version inexistante." ;;
                MSG_VERSION_INFO) printf "[Info] Version : %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "Architecture non prise en charge : %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[Info] Architecture : %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[Étape] Infos de téléchargement :" ;;
                MSG_DOWNLOAD_URL) printf "  URL de téléchargement : %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  Version : %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "Télécharger et installer cette version ? (y/n) : " ;;
                MSG_DOWNLOAD_START) printf "[Étape] Téléchargement du noyau (peut prendre quelques minutes)..." ;;
                MSG_DOWNLOAD_RETRY) printf "Échec du téléchargement. Nouvelle tentative %s/%s..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "Téléchargement terminé" ;;
                MSG_EXTRACT_START) printf "[Étape] Extraction du noyau..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[Étape] Sauvegarde du nouveau noyau -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[Terminé] Installation du noyau réussie" ;;
                MSG_EXTRACT_FAIL) printf "Échec de l'extraction." ;;
                MSG_DOWNLOAD_FAIL) printf "Échec du téléchargement après %s tentatives." "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "Échec d'analyse" ;;
                MSG_NOT_INSTALLED) printf "Non installé" ;;

                MSG_START_TITLE) printf "Démarrer le noyau Mihomo" ;;
                MSG_KERNEL_RUNNING) printf "Le noyau Mihomo est déjà en cours d'exécution" ;;
                MSG_START_PRECHECK) printf "[Étape] Pré-vérification avant démarrage..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Fichier du noyau Mihomo introuvable" ;;
                MSG_KERNEL_NOT_EXEC) printf "Fichier du noyau Mihomo non exécutable" ;;
                MSG_ADD_EXEC) printf "[Étape] Ajout du droit d'exécution..." ;;
                MSG_ADD_EXEC_FAIL) printf "Impossible d'ajouter le droit d'exécution" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "Fichier de config par défaut introuvable : %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[Étape] Recherche d'autres fichiers de config..." ;;
                MSG_CONFIG_NONE) printf "Aucun fichier de config dans le répertoire." ;;
                MSG_CONFIG_PUT_HINT) printf "Placez votre fichier de config dans %s" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[Info] Fichiers de config disponibles :" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "N° | Chemin du fichier de config" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "Choisissez le numéro du fichier de config (0 pour annuler) : " ;;
                MSG_CONFIG_SELECTED) printf "Fichier de config sélectionné : %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "Sélection invalide." ;;
                MSG_CONFIG_READ_FAIL) printf "Fichier de config illisible : %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "Vérifiez les permissions du fichier de config." ;;
                MSG_CONFIG_EMPTY) printf "Fichier de config vide : %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "Assurez-vous que le fichier de config contient des données valides." ;;
                MSG_CONFIG_WILL_USE) printf "Utilisation du fichier de config : %s" "$@" ;;
                MSG_START_PROCESS) printf "[Étape] Démarrage du processus du noyau..." ;;
                MSG_START_COMMAND) printf "Commande de démarrage : %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID écrit dans : %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Noyau Mihomo démarré" ;;
                MSG_PROCESS_ID) printf "ID de processus : %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Échec du démarrage du noyau Mihomo" ;;

                MSG_STOP_TITLE) printf "Arrêter le noyau Mihomo" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Le noyau Mihomo n'est pas en cours d'exécution" ;;
                MSG_STOPPING_KERNEL) printf "[Étape] Arrêt du noyau Mihomo..." ;;
                MSG_PIDS_FOUND) printf "ID(s) de processus trouvés : %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[Étape] Arrêt du processus %s..." "$@" ;;
                MSG_FORCE_STOPPING) printf "Arrêt forcé des processus restants..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Échec de l'arrêt du noyau Mihomo" ;;
                MSG_KERNEL_STOP_HINT) printf "Essayez d'arrêter le noyau via Activity Monitor." ;;
                MSG_KERNEL_STOPPED) printf "Noyau Mihomo arrêté" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Le processus du noyau Mihomo n'est pas en cours d'exécution" ;;
                MSG_PID_CLEANED) printf "Fichier PID supprimé : %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Redémarrer le noyau Mihomo" ;;
                MSG_KERNEL_MENU_TITLE) printf "Contrôle du noyau" ;;
                MSG_KERNEL_MENU_PROMPT) printf "Choisissez une action :" ;;
                MSG_MENU_START) printf "1) Démarrer le noyau" ;;
                MSG_MENU_STOP) printf "2) Arrêter le noyau" ;;
                MSG_MENU_RESTART) printf "3) Redémarrer le noyau" ;;
                MSG_MENU_BACK) printf "0) Retour au menu principal" ;;
                MSG_MENU_CHOICE_0_3) printf "Choix (0-3) : " ;;
                MSG_MENU_INVALID) printf "Choix invalide. Réessayez." ;;

                MSG_LOGS_TITLE) printf "Afficher les logs du noyau Mihomo" ;;
                MSG_LOG_FILE_MISSING) printf "Fichier de log introuvable : %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "Démarrez le noyau pour générer les logs." ;;
                MSG_LOG_FILE_PATH) printf "[Info] Chemin du fichier de log : %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[Info] Taille du log : %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[Info] Nombre de lignes : %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[Options] Comment afficher les logs :" ;;
                MSG_LOG_OPTION_TAIL) printf "1) Afficher les 50 dernières lignes" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) Suivre les logs en temps réel (Ctrl+C pour quitter)" ;;
                MSG_LOG_OPTION_LESS) printf "3) Voir le log complet avec less (q pour quitter)" ;;
                MSG_LOG_OPTION_BACK) printf "0) Retour au menu principal" ;;
                MSG_LOG_TAIL_HEADER) printf "[Info] Dernières 50 lignes :" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[Info] Suivi des logs (Ctrl+C pour quitter) :" ;;
                MSG_LOG_LESS_HEADER) printf "[Info] Affichage avec less (q pour quitter) :" ;;

                MSG_HELP_TITLE) printf "Aide" ;;
                MSG_HELP_ARGS) printf "Arguments de ligne de commande :" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  Répertoire d'installation ClashFox" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  Langue de l'interface" ;;
                MSG_HELP_STATUS) printf "  status                 Afficher l'état du noyau" ;;
                MSG_HELP_LIST) printf "  list                   Lister toutes les sauvegardes" ;;
                MSG_HELP_SWITCH) printf "  switch                 Changer la version du noyau" ;;
                MSG_HELP_LOGS) printf "  logs|log               Afficher les logs du noyau" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            Nettoyer les logs" ;;
                MSG_HELP_HELP) printf "  help|-h                Afficher l'aide" ;;
                MSG_HELP_VERSION) printf "  version|-v             Afficher la version" ;;
                MSG_HELP_MENU) printf "Menu interactif:" ;;
                MSG_MENU_INSTALL) printf "1) Installer/Mettre à jour le noyau Mihomo" ;;
                MSG_MENU_CONTROL) printf "2) Contrôle du noyau (démarrer/arrêter/redémarrer)" ;;
                MSG_MENU_STATUS) printf "3) Afficher l'état actuel" ;;
                MSG_MENU_SWITCH) printf "4) Changer la version du noyau" ;;
                MSG_MENU_LIST) printf "5) Lister toutes les sauvegardes" ;;
                MSG_MENU_LOGS) printf "6) Afficher les logs du noyau" ;;
                MSG_MENU_CLEAN) printf "7) Nettoyer les logs" ;;
                MSG_MENU_HELP) printf "8) Afficher l'aide" ;;
                MSG_MENU_EXIT) printf "0) Quitter" ;;
                MSG_HELP_NOTE) printf "Cet outil gère les versions du noyau et contrôle son état (démarrer/arrêter/redémarrer)." ;;

                MSG_CLEAN_TITLE) printf "Nettoyer les anciens logs" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[Info] Log actuel : %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[Info] Taille du log : %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[Info] Nombre d'anciens logs : %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[Info] Taille totale des anciens logs : %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[Options de nettoyage]" ;;
                MSG_CLEAN_ALL) printf "1) Supprimer tous les anciens logs" ;;
                MSG_CLEAN_7D) printf "2) Conserver 7 jours, supprimer le reste" ;;
                MSG_CLEAN_30D) printf "3) Conserver 30 jours, supprimer le reste" ;;
                MSG_CLEAN_CANCEL) printf "0) Annuler" ;;
                MSG_CLEAN_PROMPT) printf "Choisissez une option (0-3) : " ;;
                MSG_CLEAN_DONE_ALL) printf "Tous les anciens logs ont été supprimés" ;;
                MSG_CLEAN_DONE_7D) printf "Logs de plus de 7 jours supprimés" ;;
                MSG_CLEAN_DONE_30D) printf "Logs de plus de 30 jours supprimés" ;;
                MSG_CLEAN_CANCELLED) printf "Nettoyage annulé" ;;
                MSG_CLEAN_INVALID) printf "Sélection invalide" ;;

                MSG_LOG_ROTATE_DATE) printf "Rotation des logs par date : %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "Rotation des logs par taille : %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "Infos du noyau actuel" ;;
                MSG_MAIN_MENU_TITLE) printf "Menu principal" ;;
                MSG_KERNEL_STATUS_CHECK) printf "Vérification de l'état du noyau" ;;
                MSG_MAIN_PROMPT) printf "Choisissez une option :" ;;
                MSG_MAIN_LINE_1) printf "  1) Installer/Mettre à jour le noyau Mihomo   2) Contrôle du noyau (démarrer/arrêter/redémarrer)" ;;
                MSG_MAIN_LINE_2) printf "  3) Afficher l'état actuel                    4) Changer la version du noyau" ;;
                MSG_MAIN_LINE_3) printf "  5) Lister toutes les sauvegardes             6) Afficher les logs du noyau" ;;
                MSG_MAIN_LINE_4) printf "  7) Nettoyer les logs                         8) Afficher l'aide" ;;
                MSG_MAIN_LINE_5) printf "  0) Quitter" ;;

                MSG_CLEANUP_STOPPING) printf "[Nettoyage] Arrêt du contrôleur de logs (PID : %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[Nettoyage] Arrêt forcé du contrôleur de logs..." ;;
                MSG_CLEANUP_FAIL) printf "[Nettoyage] Échec de l'arrêt du contrôleur de logs (PID : %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "Contrôleur de logs arrêté" ;;
                MSG_EXIT_ABNORMAL) printf "[Quitter] Programme interrompu de manière inattendue" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory requiert un chemin de répertoire." ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang requiert une langue (zh|en|ja|ko|fr|de|ru|auto)." ;;
                MSG_ARG_LANG_INVALID) printf "Langue invalide : %s (supportées : zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "Commande inconnue : %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "Commandes disponibles : status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "Arguments disponibles : -d/--directory <path> - répertoire d'installation ClashFox; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - langue UI" ;;

                MSG_SAVED_DIR_LOADED) printf "Répertoire enregistré chargé : %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "Aucun répertoire enregistré. Utilisation par défaut : %s" "$@" ;;
                MSG_DIR_SAVED) printf "Répertoire enregistré dans la config : %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "Choisir le répertoire d'installation ClashFox" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "Répertoire par défaut actuel : %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "Utiliser le répertoire par défaut ? (y/n) : " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "Entrez le répertoire d'installation personnalisé : " ;;
                MSG_DIR_SET) printf "Répertoire d'installation ClashFox défini : %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "Utilisation du répertoire par défaut : %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "Entrée invalide. Utilisation du répertoire par défaut : %s" "$@" ;;
                MSG_DIR_EXISTING) printf "Utilisation du répertoire existant : %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[Init] Démarrage du contrôleur de logs..." ;;
                MSG_LOG_CHECKER_OK) printf "Contrôleur de logs démarré. PID : %s" "$@" ;;
                MSG_APP_CHECK) printf "[Init] Vérification de l'installation de ClashFox..." ;;
                MSG_APP_DIR_MISSING) printf "Répertoire ClashFox introuvable. Création..." ;;
                MSG_APP_DIR_TARGET) printf "  Répertoire cible : %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "Répertoire ClashFox créé : %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox installé : %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "Entrez un choix (0-8) : " ;;
                MSG_EXIT_THANKS) printf "[Quitter] Merci d'utiliser ClashFox Mihomo Kernel Manager" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo Config : [Introuvable %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo Config : [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        de)
            case "$key" in
                TAG_SUCCESS) printf "Erfolg" ;;
                TAG_ERROR) printf "Fehler" ;;
                TAG_WARNING) printf "Hinweis" ;;
                TAG_VERSION) printf "Version" ;;
                LABEL_FUNCTION) printf "Funktion" ;;
                LABEL_STATUS) printf "Status" ;;
                LABEL_HELP) printf "Hilfe" ;;
                LABEL_INIT) printf "Initialisierung" ;;
                LABEL_STEP) printf "Schritt" ;;
                LABEL_INFO) printf "Info" ;;
                LABEL_CLEANUP) printf "Bereinigung" ;;
                LABEL_OPTIONS) printf "Optionen" ;;
                LABEL_MENU) printf "Hauptmenü" ;;

                MSG_MACOS_ONLY) printf "Dieses Skript unterstützt nur macOS." ;;
                MSG_WELCOME) printf "Willkommen %s bei %s" "$@" ;;
                MSG_PRESS_ENTER) printf "Drücken Sie Enter zum Fortfahren..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "Systemrechte sind für die Kernelverwaltung erforderlich." ;;
                MSG_REQUIRE_SUDO_DESC) printf "Hinweis: Start/Stopp/Neustart/Status erfordern sudo-Rechte." ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "Autorisierung: Bitte macOS-Passwort eingeben." ;;
                MSG_SUDO_OK) printf "Rechteprüfung bestanden." ;;
                MSG_SUDO_FAIL) printf "Passwortprüfung fehlgeschlagen. Bitte erneut versuchen." ;;

                MSG_INIT_CHECK_DIRS) printf "[Init] Prüfe Verzeichnisstruktur..." ;;
                MSG_INIT_SET_PERMS) printf "[Init] Setze Verzeichnisberechtigungen..." ;;
                MSG_NEED_ADMIN) printf "Administratorrechte sind zum Erstellen von Verzeichnissen erforderlich." ;;
                MSG_NO_PERMISSION) printf "Unzureichende Berechtigungen zum Erstellen von Verzeichnissen." ;;
                MSG_CORE_DIR_CREATE) printf "Erstelle Core-Verzeichnis: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "Core-Verzeichnis vorhanden: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "Erstelle Config-Verzeichnis: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "Config-Verzeichnis vorhanden: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "Erstelle Data-Verzeichnis: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "Data-Verzeichnis vorhanden: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "Erstelle Log-Verzeichnis: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "Log-Verzeichnis vorhanden: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "Erstelle Runtime-Verzeichnis: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "Runtime-Verzeichnis vorhanden: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "Verzeichnisberechtigungen gesetzt." ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "Core-Verzeichnis fehlt. Struktur wird erstellt..." ;;
                MSG_DIR_CREATE_FAIL) printf "Erstellen der Verzeichnisstruktur fehlgeschlagen." ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "Core-Verzeichnis kann nicht betreten werden." ;;

                MSG_STATUS_STOPPED) printf "Gestoppt" ;;
                MSG_STATUS_RUNNING) printf "Läuft" ;;
                MSG_STATUS_LABEL) printf "Mihomo-Status" ;;
                MSG_KERNEL_LABEL) printf "Mihomo-Kernel" ;;
                MSG_CONFIG_LABEL) printf "Mihomo-Konfig" ;;
                MSG_CONFIG_NOT_FOUND) printf "Nicht gefunden: %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• Status:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• Kernel-Dateiinfo:" ;;
                MSG_BACKUP_SECTION) printf "• Backup-Info:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ Kernel-Datei vorhanden" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ Kernel-Datei nicht ausführbar" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ Kernel-Datei fehlt" ;;
                MSG_KERNEL_VERSION_INFO) printf "Version: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "Anzeigename: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "Anzeigename: %s (Parse-Fehler)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ Backup gefunden" ;;
                MSG_BACKUP_LATEST) printf "Letztes Backup: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "Backup-Version: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "Backup-Version: Unbekannt" ;;
                MSG_BACKUP_TIME) printf "Backup-Zeit: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  Keine Backups gefunden" ;;

                MSG_LIST_BACKUPS_TITLE) printf "Alle Kernel-Backups auflisten" ;;
                MSG_NO_BACKUPS) printf "Keine Backup-Dateien" ;;
                MSG_BACKUP_LIST_TITLE) printf "[Info] Verfügbare Backups (neueste zuerst):" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "Nr. | Version | Backup-Zeit" ;;
                MSG_BACKUP_TOTAL) printf "Backups gesamt: %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "Kernel-Version wechseln" ;;
                MSG_SWITCH_PROMPT) printf "Backup-Nummer eingeben (Enter für zurück): " ;;
                MSG_INVALID_NUMBER) printf "Bitte eine gültige Zahl eingeben." ;;
                MSG_BACKUP_NO_MATCH) printf "Keine passende Backup-Nummer gefunden." ;;
                MSG_SWITCH_START) printf "[Schritt] Kernel-Wechsel starten..." ;;
                MSG_BACKUP_SELECTED) printf "[Info] Gewähltes Backup: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[Info] Aktuelle Kernel-Version: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[Info] Aktueller Kernel nicht gefunden" ;;
                MSG_SWITCH_CONFIRM) printf "Wechsel zu dieser Version bestätigen? (y/n): " ;;
                MSG_OP_CANCELLED) printf "Vorgang abgebrochen." ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[Schritt] Aktuellen Kernel gesichert -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[Schritt] Kernel ersetzt durch: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[Schritt] Temporäres Backup gelöscht: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[Fertig] Kernel-Wechsel abgeschlossen" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[Info] Verfügbare Backups:" ;;
                MSG_INSTALL_TITLE) printf "Mihomo-Kernel installieren/aktualisieren" ;;
                MSG_SELECT_GITHUB_USER) printf "GitHub-Benutzer für Download wählen:" ;;
                MSG_SELECT_USER_PROMPT) printf "Benutzer wählen (Standard 1): " ;;
                MSG_SELECTED_GITHUB_USER) printf "[Info] Gewählter GitHub-Benutzer: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[Schritt] Neueste Versionsinfo abrufen..." ;;
                MSG_VERSION_INFO_FAIL) printf "Versionsinfo konnte nicht abgerufen werden oder existiert nicht." ;;
                MSG_VERSION_INFO) printf "[Info] Version: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "Nicht unterstützte Architektur: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[Info] Architektur: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[Schritt] Download-Info:" ;;
                MSG_DOWNLOAD_URL) printf "  Download-URL: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  Version: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "Diese Version herunterladen und installieren? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[Schritt] Kernel wird heruntergeladen (kann einige Minuten dauern)..." ;;
                MSG_DOWNLOAD_RETRY) printf "Download fehlgeschlagen. Wiederhole %s/%s..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "Download abgeschlossen" ;;
                MSG_EXTRACT_START) printf "[Schritt] Kernel wird entpackt..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[Schritt] Neuer Kernel gesichert -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[Fertig] Kernel-Installation erfolgreich" ;;
                MSG_EXTRACT_FAIL) printf "Entpacken fehlgeschlagen." ;;
                MSG_DOWNLOAD_FAIL) printf "Download nach %s Versuchen fehlgeschlagen." "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "Parse fehlgeschlagen" ;;
                MSG_NOT_INSTALLED) printf "Nicht installiert" ;;

                MSG_START_TITLE) printf "Mihomo-Kernel starten" ;;
                MSG_KERNEL_RUNNING) printf "Mihomo-Kernel läuft bereits" ;;
                MSG_START_PRECHECK) printf "[Schritt] Vorprüfung vor dem Start..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Mihomo-Kernel-Datei nicht gefunden" ;;
                MSG_KERNEL_NOT_EXEC) printf "Mihomo-Kernel-Datei nicht ausführbar" ;;
                MSG_ADD_EXEC) printf "[Schritt] Ausführungsrecht hinzufügen..." ;;
                MSG_ADD_EXEC_FAIL) printf "Ausführungsrecht konnte nicht gesetzt werden" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "Standard-Konfigurationsdatei nicht gefunden: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[Schritt] Andere Konfigurationsdateien prüfen..." ;;
                MSG_CONFIG_NONE) printf "Keine Konfigurationsdateien im Config-Verzeichnis gefunden." ;;
                MSG_CONFIG_PUT_HINT) printf "Konfigurationsdatei in %s ablegen" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[Info] Verfügbare Konfigurationsdateien:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "Nr. | Pfad der Konfigurationsdatei" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "Konfigurationsdatei wählen (0 zum Abbrechen): " ;;
                MSG_CONFIG_SELECTED) printf "Gewählte Konfigurationsdatei: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "Ungültige Auswahl." ;;
                MSG_CONFIG_READ_FAIL) printf "Konfigurationsdatei nicht lesbar: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "Berechtigungen der Konfigurationsdatei prüfen." ;;
                MSG_CONFIG_EMPTY) printf "Konfigurationsdatei ist leer: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "Bitte sicherstellen, dass die Konfiguration gültige Inhalte enthält." ;;
                MSG_CONFIG_WILL_USE) printf "Verwendete Konfigurationsdatei: %s" "$@" ;;
                MSG_START_PROCESS) printf "[Schritt] Kernel-Prozess starten..." ;;
                MSG_START_COMMAND) printf "Startbefehl: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID geschrieben nach: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Mihomo-Kernel gestartet" ;;
                MSG_PROCESS_ID) printf "Prozess-ID: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Mihomo-Kernel konnte nicht gestartet werden" ;;

                MSG_STOP_TITLE) printf "Mihomo-Kernel stoppen" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Mihomo-Kernel läuft nicht" ;;
                MSG_STOPPING_KERNEL) printf "[Schritt] Mihomo-Kernel wird gestoppt..." ;;
                MSG_PIDS_FOUND) printf "Prozess-IDs gefunden: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[Schritt] Prozess %s wird gestoppt..." "$@" ;;
                MSG_FORCE_STOPPING) printf "Verbleibende Prozesse werden zwangsweise beendet..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Mihomo-Kernel konnte nicht gestoppt werden" ;;
                MSG_KERNEL_STOP_HINT) printf "Versuchen Sie, den Kernel im Activity Monitor zu stoppen." ;;
                MSG_KERNEL_STOPPED) printf "Mihomo-Kernel gestoppt" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Mihomo-Kernel-Prozess läuft nicht" ;;
                MSG_PID_CLEANED) printf "PID-Datei gelöscht: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Mihomo-Kernel neu starten" ;;
                MSG_KERNEL_MENU_TITLE) printf "Kernel-Steuerung" ;;
                MSG_KERNEL_MENU_PROMPT) printf "Kernel-Aktion wählen:" ;;
                MSG_MENU_START) printf "1) Kernel starten" ;;
                MSG_MENU_STOP) printf "2) Kernel stoppen" ;;
                MSG_MENU_RESTART) printf "3) Kernel neu starten" ;;
                MSG_MENU_BACK) printf "0) Zurück zum Hauptmenü" ;;
                MSG_MENU_CHOICE_0_3) printf "Auswahl (0-3): " ;;
                MSG_MENU_INVALID) printf "Ungültige Auswahl. Bitte erneut eingeben." ;;

                MSG_LOGS_TITLE) printf "Mihomo-Kernel-Logs anzeigen" ;;
                MSG_LOG_FILE_MISSING) printf "Logdatei nicht gefunden: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "Kernel starten, um Logs zu erzeugen." ;;
                MSG_LOG_FILE_PATH) printf "[Info] Pfad der Logdatei: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[Info] Loggröße: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[Info] Logzeilen: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[Optionen] Logs anzeigen:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) Letzte 50 Zeilen anzeigen" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) Logs live verfolgen (Ctrl+C zum Beenden)" ;;
                MSG_LOG_OPTION_LESS) printf "3) Vollständige Logs mit less anzeigen (q zum Beenden)" ;;
                MSG_LOG_OPTION_BACK) printf "0) Zurück zum Hauptmenü" ;;
                MSG_LOG_TAIL_HEADER) printf "[Info] Letzte 50 Logzeilen:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[Info] Live-Loganzeige (Ctrl+C zum Beenden):" ;;
                MSG_LOG_LESS_HEADER) printf "[Info] Anzeige mit less (q zum Beenden):" ;;

                MSG_HELP_TITLE) printf "Hilfe" ;;
                MSG_HELP_ARGS) printf "Kommandozeilenargumente:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  ClashFox-Installationsverzeichnis" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  UI-Sprache" ;;
                MSG_HELP_STATUS) printf "  status                 Aktuellen Kernelstatus anzeigen" ;;
                MSG_HELP_LIST) printf "  list                   Alle Backups auflisten" ;;
                MSG_HELP_SWITCH) printf "  switch                 Kernel-Version wechseln" ;;
                MSG_HELP_LOGS) printf "  logs|log               Kernel-Logs anzeigen" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            Logs bereinigen" ;;
                MSG_HELP_HELP) printf "  help|-h                Hilfe anzeigen" ;;
                MSG_HELP_VERSION) printf "  version|-v             Version anzeigen" ;;
                MSG_HELP_MENU) printf "Interaktives Menü:" ;;
                MSG_MENU_INSTALL) printf "1) Mihomo-Kernel installieren/aktualisieren" ;;
                MSG_MENU_CONTROL) printf "2) Kernel-Steuerung (start/stop/restart)" ;;
                MSG_MENU_STATUS) printf "3) Aktuellen Status anzeigen" ;;
                MSG_MENU_SWITCH) printf "4) Kernel-Version wechseln" ;;
                MSG_MENU_LIST) printf "5) Alle Backups auflisten" ;;
                MSG_MENU_LOGS) printf "6) Kernel-Logs anzeigen" ;;
                MSG_MENU_CLEAN) printf "7) Logs bereinigen" ;;
                MSG_MENU_HELP) printf "8) Hilfe anzeigen" ;;
                MSG_MENU_EXIT) printf "0) Beenden" ;;
                MSG_HELP_NOTE) printf "Dieses Tool verwaltet Kernel-Versionen und steuert den Kernelstatus (start/stop/restart)." ;;

                MSG_CLEAN_TITLE) printf "Alte Logs bereinigen" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[Info] Aktuelle Logdatei: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[Info] Loggröße: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[Info] Anzahl alter Logs: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[Info] Gesamtgröße alter Logs: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[Bereinigungsoptionen]" ;;
                MSG_CLEAN_ALL) printf "1) Alle alten Logs löschen" ;;
                MSG_CLEAN_7D) printf "2) Letzte 7 Tage behalten, ältere löschen" ;;
                MSG_CLEAN_30D) printf "3) Letzte 30 Tage behalten, ältere löschen" ;;
                MSG_CLEAN_CANCEL) printf "0) Abbrechen" ;;
                MSG_CLEAN_PROMPT) printf "Bereinigungsoption wählen (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "Alle alten Logs gelöscht" ;;
                MSG_CLEAN_DONE_7D) printf "Logs älter als 7 Tage gelöscht" ;;
                MSG_CLEAN_DONE_30D) printf "Logs älter als 30 Tage gelöscht" ;;
                MSG_CLEAN_CANCELLED) printf "Bereinigung abgebrochen" ;;
                MSG_CLEAN_INVALID) printf "Ungültige Auswahl" ;;

                MSG_LOG_ROTATE_DATE) printf "Logrotation nach Datum: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "Logrotation nach Größe: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "Aktuelle Kernel-Info" ;;
                MSG_MAIN_MENU_TITLE) printf "Hauptmenü" ;;
                MSG_KERNEL_STATUS_CHECK) printf "Kernelstatus prüfen" ;;
                MSG_MAIN_PROMPT) printf "Option auswählen:" ;;
                MSG_MAIN_LINE_1) printf "  1) Mihomo-Kernel installieren/aktualisieren   2) Kernel-Steuerung (start/stop/restart)" ;;
                MSG_MAIN_LINE_2) printf "  3) Aktuellen Status anzeigen                  4) Kernel-Version wechseln" ;;
                MSG_MAIN_LINE_3) printf "  5) Alle Backups auflisten                     6) Kernel-Logs anzeigen" ;;
                MSG_MAIN_LINE_4) printf "  7) Logs bereinigen                            8) Hilfe anzeigen" ;;
                MSG_MAIN_LINE_5) printf "  0) Beenden" ;;

                MSG_CLEANUP_STOPPING) printf "[Bereinigung] Log-Checker wird gestoppt (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[Bereinigung] Log-Checker wird zwangsweise beendet..." ;;
                MSG_CLEANUP_FAIL) printf "[Bereinigung] Log-Checker konnte nicht gestoppt werden (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "Log-Checker gestoppt" ;;
                MSG_EXIT_ABNORMAL) printf "[Beenden] Programm unerwartet beendet" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory erfordert einen Verzeichnispfad." ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang erfordert eine Sprache (zh|en|ja|ko|fr|de|ru|auto)." ;;
                MSG_ARG_LANG_INVALID) printf "Ungültige Sprache: %s (unterstützt: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "Unbekannter Befehl: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "Verfügbare Befehle: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "Verfügbare Argumente: -d/--directory <path> - ClashFox-Installationsverzeichnis; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - UI-Sprache" ;;

                MSG_SAVED_DIR_LOADED) printf "Gespeichertes Verzeichnis geladen: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "Kein gespeichertes Verzeichnis gefunden. Verwende Standard: %s" "$@" ;;
                MSG_DIR_SAVED) printf "Verzeichnis in Konfiguration gespeichert: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "ClashFox-Installationsverzeichnis wählen" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "Aktuelles Standardverzeichnis: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "Standardverzeichnis verwenden? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "Benutzerdefiniertes Installationsverzeichnis eingeben: " ;;
                MSG_DIR_SET) printf "ClashFox-Installationsverzeichnis gesetzt: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "Standard-Installationsverzeichnis verwenden: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "Ungültige Eingabe. Verwende Standard: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "Vorhandenes Installationsverzeichnis verwenden: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[Init] Log-Checker wird gestartet..." ;;
                MSG_LOG_CHECKER_OK) printf "Log-Checker gestartet. PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[Init] Prüfe ClashFox-Installation..." ;;
                MSG_APP_DIR_MISSING) printf "ClashFox-Verzeichnis nicht gefunden. Erstelle..." ;;
                MSG_APP_DIR_TARGET) printf "  Zielverzeichnis: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "ClashFox-Verzeichnis erstellt: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox installiert: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "Auswahl (0-8): " ;;
                MSG_EXIT_THANKS) printf "[Beenden] Danke für die Nutzung von ClashFox Mihomo Kernel Manager" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Mihomo-Konfig: [Nicht gefunden %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Mihomo-Konfig: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
        ru)
            case "$key" in
                TAG_SUCCESS) printf "Успех" ;;
                TAG_ERROR) printf "Ошибка" ;;
                TAG_WARNING) printf "Подсказка" ;;
                TAG_VERSION) printf "Версия" ;;
                LABEL_FUNCTION) printf "Функция" ;;
                LABEL_STATUS) printf "Статус" ;;
                LABEL_HELP) printf "Справка" ;;
                LABEL_INIT) printf "Инициализация" ;;
                LABEL_STEP) printf "Шаг" ;;
                LABEL_INFO) printf "Инфо" ;;
                LABEL_CLEANUP) printf "Очистка" ;;
                LABEL_OPTIONS) printf "Опции" ;;
                LABEL_MENU) printf "Главное меню" ;;

                MSG_MACOS_ONLY) printf "Этот скрипт поддерживает только macOS." ;;
                MSG_WELCOME) printf "Добро пожаловать, %s, в %s" "$@" ;;
                MSG_PRESS_ENTER) printf "Нажмите Enter для продолжения..." ;;
                MSG_REQUIRE_SUDO_TITLE) printf "Для управления ядром требуются системные привилегии." ;;
                MSG_REQUIRE_SUDO_DESC) printf "Примечание: операции старт/стоп/перезапуск/статус требуют sudo." ;;
                MSG_REQUIRE_SUDO_PROMPT) printf "Авторизация: введите пароль macOS для продолжения." ;;
                MSG_SUDO_OK) printf "Проверка прав прошла успешно." ;;
                MSG_SUDO_FAIL) printf "Проверка пароля не удалась. Попробуйте снова." ;;

                MSG_INIT_CHECK_DIRS) printf "[Init] Проверка структуры каталогов..." ;;
                MSG_INIT_SET_PERMS) printf "[Init] Настройка прав каталогов..." ;;
                MSG_NEED_ADMIN) printf "Для создания каталогов требуются права администратора." ;;
                MSG_NO_PERMISSION) printf "Недостаточно прав для создания каталогов." ;;
                MSG_CORE_DIR_CREATE) printf "Создание core-каталога: %s" "$@" ;;
                MSG_CORE_DIR_EXISTS) printf "Core-каталог существует: %s" "$@" ;;
                MSG_CONFIG_DIR_CREATE) printf "Создание config-каталога: %s" "$@" ;;
                MSG_CONFIG_DIR_EXISTS) printf "Config-каталог существует: %s" "$@" ;;
                MSG_DATA_DIR_CREATE) printf "Создание data-каталога: %s" "$@" ;;
                MSG_DATA_DIR_EXISTS) printf "Data-каталог существует: %s" "$@" ;;
                MSG_LOG_DIR_CREATE) printf "Создание log-каталога: %s" "$@" ;;
                MSG_LOG_DIR_EXISTS) printf "Log-каталог существует: %s" "$@" ;;
                MSG_RUNTIME_DIR_CREATE) printf "Создание runtime-каталога: %s" "$@" ;;
                MSG_RUNTIME_DIR_EXISTS) printf "Runtime-каталог существует: %s" "$@" ;;
                MSG_DIRS_PERMS_OK) printf "Права каталогов установлены." ;;

                MSG_CORE_DIR_MISSING_CREATE) printf "Core-каталог отсутствует. Создаю структуру..." ;;
                MSG_DIR_CREATE_FAIL) printf "Не удалось создать структуру каталогов." ;;
                MSG_CORE_DIR_ENTER_FAIL) printf "Не удалось войти в core-каталог." ;;

                MSG_STATUS_STOPPED) printf "Остановлено" ;;
                MSG_STATUS_RUNNING) printf "Запущено" ;;
                MSG_STATUS_LABEL) printf "Статус Mihomo" ;;
                MSG_KERNEL_LABEL) printf "Ядро Mihomo" ;;
                MSG_CONFIG_LABEL) printf "Конфиг Mihomo" ;;
                MSG_CONFIG_NOT_FOUND) printf "Не найдено: %s" "$@" ;;
                MSG_STATUS_SECTION) printf "• Статус:" ;;
                MSG_KERNEL_FILES_SECTION) printf "• Информация о файле ядра:" ;;
                MSG_BACKUP_SECTION) printf "• Информация о резервных копиях:" ;;
                MSG_KERNEL_FILE_OK) printf "✓ Файл ядра существует" ;;
                MSG_KERNEL_FILE_NOEXEC) printf "✗ Файл ядра не исполняемый" ;;
                MSG_KERNEL_FILE_MISSING) printf "✗ Файл ядра не найден" ;;
                MSG_KERNEL_VERSION_INFO) printf "Версия: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME) printf "Отображаемое имя: %s" "$@" ;;
                MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL) printf "Отображаемое имя: %s (ошибка разбора)" "$@" ;;
                MSG_BACKUP_FOUND) printf "✓ Резервная копия найдена" ;;
                MSG_BACKUP_LATEST) printf "Последняя резервная копия: %s" "$@" ;;
                MSG_BACKUP_VERSION) printf "Версия резервной копии: %s" "$@" ;;
                MSG_BACKUP_VERSION_UNKNOWN) printf "Версия резервной копии: неизвестна" ;;
                MSG_BACKUP_TIME) printf "Время резервной копии: %s" "$@" ;;
                MSG_BACKUP_NONE) printf "⚠️  Резервные копии не найдены" ;;

                MSG_LIST_BACKUPS_TITLE) printf "Список всех резервных ядер" ;;
                MSG_NO_BACKUPS) printf "Файлы резервных копий отсутствуют" ;;
                MSG_BACKUP_LIST_TITLE) printf "[Инфо] Доступные резервные копии (новые сверху):" ;;
                MSG_BACKUP_LIST_COLUMNS) printf "№ | Версия | Время резервной копии" ;;
                MSG_BACKUP_TOTAL) printf "Всего резервных копий: %s" "$@" ;;

                MSG_SWITCH_TITLE) printf "Переключить версию ядра" ;;
                MSG_SWITCH_PROMPT) printf "Введите номер резервной копии (Enter для возврата): " ;;
                MSG_INVALID_NUMBER) printf "Введите корректное число." ;;
                MSG_BACKUP_NO_MATCH) printf "Подходящий номер резервной копии не найден." ;;
                MSG_SWITCH_START) printf "[Шаг] Начало переключения ядра..." ;;
                MSG_BACKUP_SELECTED) printf "[Инфо] Выбранная резервная копия: %s" "$@" ;;
                MSG_CURRENT_KERNEL_VERSION) printf "[Инфо] Текущая версия ядра: %s" "$@" ;;
                MSG_CURRENT_KERNEL_MISSING) printf "[Инфо] Текущее ядро не найдено" ;;
                MSG_SWITCH_CONFIRM) printf "Подтвердить переключение на эту версию? (y/n): " ;;
                MSG_OP_CANCELLED) printf "Операция отменена." ;;
                MSG_BACKUP_CURRENT_KERNEL) printf "[Шаг] Резервная копия текущего ядра -> %s" "$@" ;;
                MSG_KERNEL_REPLACED) printf "[Шаг] Ядро заменено на: %s" "$@" ;;
                MSG_TEMP_BACKUP_REMOVED) printf "[Шаг] Временная резервная копия удалена: %s" "$@" ;;
                MSG_SWITCH_DONE) printf "[Готово] Переключение ядра завершено" ;;

                MSG_LIST_BACKUPS_SIMPLE_TITLE) printf "[Инфо] Доступные резервные копии:" ;;
                MSG_INSTALL_TITLE) printf "Установить/Обновить ядро Mihomo" ;;
                MSG_SELECT_GITHUB_USER) printf "Выберите пользователя GitHub для загрузки:" ;;
                MSG_SELECT_USER_PROMPT) printf "Выберите пользователя (по умолчанию 1): " ;;
                MSG_SELECTED_GITHUB_USER) printf "[Инфо] Выбранный пользователь GitHub: %s" "$@" ;;
                MSG_GET_VERSION_INFO) printf "[Шаг] Получение информации о версии..." ;;
                MSG_VERSION_INFO_FAIL) printf "Не удалось получить информацию о версии или версия отсутствует." ;;
                MSG_VERSION_INFO) printf "[Инфо] Версия: %s" "$@" ;;
                MSG_ARCH_UNSUPPORTED) printf "Неподдерживаемая архитектура: %s" "$@" ;;
                MSG_ARCH_DETECTED) printf "[Инфо] Архитектура: %s" "$@" ;;
                MSG_DOWNLOAD_INFO) printf "[Шаг] Информация о загрузке:" ;;
                MSG_DOWNLOAD_URL) printf "  URL загрузки: %s" "$@" ;;
                MSG_VERSION_LABEL) printf "  Версия: %s" "$@" ;;
                MSG_DOWNLOAD_CONFIRM) printf "Скачать и установить эту версию? (y/n): " ;;
                MSG_DOWNLOAD_START) printf "[Шаг] Загрузка ядра (может занять несколько минут)..." ;;
                MSG_DOWNLOAD_RETRY) printf "Ошибка загрузки. Повтор %s/%s..." "$@" ;;
                MSG_DOWNLOAD_OK) printf "Загрузка завершена" ;;
                MSG_EXTRACT_START) printf "[Шаг] Распаковка ядра..." ;;
                MSG_BACKUP_NEW_KERNEL) printf "[Шаг] Резервная копия нового ядра -> %s" "$@" ;;
                MSG_INSTALL_DONE) printf "[Готово] Установка ядра выполнена" ;;
                MSG_EXTRACT_FAIL) printf "Распаковка не удалась." ;;
                MSG_DOWNLOAD_FAIL) printf "Загрузка не удалась после %s попыток." "$@" ;;

                MSG_VERSION_PARSE_FAIL) printf "Ошибка разбора" ;;
                MSG_NOT_INSTALLED) printf "Не установлено" ;;

                MSG_START_TITLE) printf "Запустить ядро Mihomo" ;;
                MSG_KERNEL_RUNNING) printf "Ядро Mihomo уже запущено" ;;
                MSG_START_PRECHECK) printf "[Шаг] Проверка перед запуском..." ;;
                MSG_KERNEL_NOT_FOUND) printf "Файл ядра Mihomo не найден" ;;
                MSG_KERNEL_NOT_EXEC) printf "Файл ядра Mihomo не исполняемый" ;;
                MSG_ADD_EXEC) printf "[Шаг] Добавление права на выполнение..." ;;
                MSG_ADD_EXEC_FAIL) printf "Не удалось добавить право на выполнение" ;;
                MSG_CONFIG_DEFAULT_MISSING) printf "Файл конфигурации по умолчанию не найден: %s" "$@" ;;
                MSG_CONFIG_SCAN) printf "[Шаг] Поиск других файлов конфигурации..." ;;
                MSG_CONFIG_NONE) printf "В каталоге конфигурации нет файлов." ;;
                MSG_CONFIG_PUT_HINT) printf "Поместите файл конфигурации в %s" "$@" ;;
                MSG_CONFIG_AVAILABLE) printf "[Инфо] Доступные файлы конфигурации:" ;;
                MSG_CONFIG_LIST_COLUMNS) printf "№ | Путь к файлу конфигурации" ;;
                MSG_CONFIG_SELECT_PROMPT) printf "Выберите номер файла конфигурации (0 для отмены): " ;;
                MSG_CONFIG_SELECTED) printf "Выбранный файл конфигурации: %s" "$@" ;;
                MSG_CONFIG_INVALID) printf "Неверный выбор." ;;
                MSG_CONFIG_READ_FAIL) printf "Файл конфигурации недоступен для чтения: %s" "$@" ;;
                MSG_CONFIG_PERM_HINT) printf "Проверьте права файла конфигурации." ;;
                MSG_CONFIG_EMPTY) printf "Файл конфигурации пуст: %s" "$@" ;;
                MSG_CONFIG_EMPTY_HINT) printf "Убедитесь, что файл конфигурации содержит корректные данные." ;;
                MSG_CONFIG_WILL_USE) printf "Используемый файл конфигурации: %s" "$@" ;;
                MSG_START_PROCESS) printf "[Шаг] Запуск процесса ядра..." ;;
                MSG_START_COMMAND) printf "Команда запуска: %s" "$@" ;;
                MSG_PID_WRITTEN) printf "PID записан в: %s" "$@" ;;
                MSG_KERNEL_STARTED) printf "Ядро Mihomo запущено" ;;
                MSG_PROCESS_ID) printf "ID процесса: %s" "$@" ;;
                MSG_KERNEL_START_FAIL) printf "Не удалось запустить ядро Mihomo" ;;

                MSG_STOP_TITLE) printf "Остановить ядро Mihomo" ;;
                MSG_KERNEL_NOT_RUNNING) printf "Ядро Mihomo не запущено" ;;
                MSG_STOPPING_KERNEL) printf "[Шаг] Остановка ядра Mihomo..." ;;
                MSG_PIDS_FOUND) printf "Найдены ID процессов: %s" "$@" ;;
                MSG_STOPPING_PROCESS) printf "[Шаг] Остановка процесса %s..." "$@" ;;
                MSG_FORCE_STOPPING) printf "Принудительная остановка оставшихся процессов..." ;;
                MSG_KERNEL_STOP_FAIL) printf "Не удалось остановить ядро Mihomo" ;;
                MSG_KERNEL_STOP_HINT) printf "Попробуйте остановить ядро через Activity Monitor." ;;
                MSG_KERNEL_STOPPED) printf "Ядро Mihomo остановлено" ;;
                MSG_PROCESS_NOT_RUNNING) printf "Процесс ядра Mihomo не запущен" ;;
                MSG_PID_CLEANED) printf "PID-файл удалён: %s" "$@" ;;

                MSG_RESTART_TITLE) printf "Перезапустить ядро Mihomo" ;;
                MSG_KERNEL_MENU_TITLE) printf "Управление ядром" ;;
                MSG_KERNEL_MENU_PROMPT) printf "Выберите действие ядра:" ;;
                MSG_MENU_START) printf "1) Запустить ядро" ;;
                MSG_MENU_STOP) printf "2) Остановить ядро" ;;
                MSG_MENU_RESTART) printf "3) Перезапустить ядро" ;;
                MSG_MENU_BACK) printf "0) Назад в главное меню" ;;
                MSG_MENU_CHOICE_0_3) printf "Выбор (0-3): " ;;
                MSG_MENU_INVALID) printf "Неверный выбор. Повторите." ;;

                MSG_LOGS_TITLE) printf "Просмотр логов ядра Mihomo" ;;
                MSG_LOG_FILE_MISSING) printf "Файл логов не найден: %s" "$@" ;;
                MSG_LOG_FILE_HINT) printf "Сначала запустите ядро, чтобы создать логи." ;;
                MSG_LOG_FILE_PATH) printf "[Инфо] Путь к файлу логов: %s" "$@" ;;
                MSG_LOG_FILE_SIZE) printf "[Инфо] Размер логов: %s" "$@" ;;
                MSG_LOG_FILE_LINES) printf "[Инфо] Строк логов: %s" "$@" ;;
                MSG_LOG_VIEW_OPTIONS) printf "[Опции] Как просматривать логи:" ;;
                MSG_LOG_OPTION_TAIL) printf "1) Показать последние 50 строк" ;;
                MSG_LOG_OPTION_FOLLOW) printf "2) Следить за логами (Ctrl+C для выхода)" ;;
                MSG_LOG_OPTION_LESS) printf "3) Просмотр полного лога через less (q для выхода)" ;;
                MSG_LOG_OPTION_BACK) printf "0) Назад в главное меню" ;;
                MSG_LOG_TAIL_HEADER) printf "[Инфо] Последние 50 строк:" ;;
                MSG_LOG_FOLLOW_HEADER) printf "[Инфо] Просмотр логов в реальном времени (Ctrl+C для выхода):" ;;
                MSG_LOG_LESS_HEADER) printf "[Инфо] Просмотр через less (q для выхода):" ;;

                MSG_HELP_TITLE) printf "Справка" ;;
                MSG_HELP_ARGS) printf "Аргументы командной строки:" ;;
                MSG_HELP_DIR_ARG) printf "  -d|--directory <path>  Каталог установки ClashFox" ;;
                MSG_HELP_LANG_ARG) printf "  -l|--lang <zh|en|ja|ko|fr|de|ru|auto>  Язык интерфейса" ;;
                MSG_HELP_STATUS) printf "  status                 Показать текущий статус ядра" ;;
                MSG_HELP_LIST) printf "  list                   Список всех резервных копий" ;;
                MSG_HELP_SWITCH) printf "  switch                 Переключить версию ядра" ;;
                MSG_HELP_LOGS) printf "  logs|log               Просмотр логов ядра" ;;
                MSG_HELP_CLEAN) printf "  clean|clear            Очистить логи" ;;
                MSG_HELP_HELP) printf "  help|-h                Показать справку" ;;
                MSG_HELP_VERSION) printf "  version|-v             Показать версию" ;;
                MSG_HELP_MENU) printf "Интерактивное меню:" ;;
                MSG_MENU_INSTALL) printf "1) Установить/Обновить ядро Mihomo" ;;
                MSG_MENU_CONTROL) printf "2) Управление ядром (старт/стоп/перезапуск)" ;;
                MSG_MENU_STATUS) printf "3) Показать текущий статус" ;;
                MSG_MENU_SWITCH) printf "4) Переключить версию ядра" ;;
                MSG_MENU_LIST) printf "5) Список всех резервных копий" ;;
                MSG_MENU_LOGS) printf "6) Просмотр логов ядра" ;;
                MSG_MENU_CLEAN) printf "7) Очистить логи" ;;
                MSG_MENU_HELP) printf "8) Показать справку" ;;
                MSG_MENU_EXIT) printf "0) Выход" ;;
                MSG_HELP_NOTE) printf "Этот инструмент управляет версиями ядра и его состоянием (старт/стоп/перезапуск)." ;;

                MSG_CLEAN_TITLE) printf "Очистка старых логов" ;;
                MSG_CLEAN_CURRENT_LOG) printf "[Инфо] Текущий лог: %s" "$@" ;;
                MSG_CLEAN_LOG_SIZE) printf "[Инфо] Размер лога: %s" "$@" ;;
                MSG_CLEAN_OLD_COUNT) printf "[Инфо] Кол-во старых логов: %s" "$@" ;;
                MSG_CLEAN_OLD_SIZE) printf "[Инфо] Общий размер старых логов: %s" "$@" ;;
                MSG_CLEAN_OPTIONS) printf "[Опции очистки]" ;;
                MSG_CLEAN_ALL) printf "1) Удалить все старые логи" ;;
                MSG_CLEAN_7D) printf "2) Оставить 7 дней, удалить более старые" ;;
                MSG_CLEAN_30D) printf "3) Оставить 30 дней, удалить более старые" ;;
                MSG_CLEAN_CANCEL) printf "0) Отмена" ;;
                MSG_CLEAN_PROMPT) printf "Выберите способ (0-3): " ;;
                MSG_CLEAN_DONE_ALL) printf "Все старые логи удалены" ;;
                MSG_CLEAN_DONE_7D) printf "Логи старше 7 дней удалены" ;;
                MSG_CLEAN_DONE_30D) printf "Логи старше 30 дней удалены" ;;
                MSG_CLEAN_CANCELLED) printf "Очистка отменена" ;;
                MSG_CLEAN_INVALID) printf "Неверный выбор" ;;

                MSG_LOG_ROTATE_DATE) printf "Ротация логов по дате: %s" "$@" ;;
                MSG_LOG_ROTATE_SIZE) printf "Ротация логов по размеру: %s" "$@" ;;

                MSG_MAIN_STATUS_TITLE) printf "Текущая информация о ядре" ;;
                MSG_MAIN_MENU_TITLE) printf "Главное меню" ;;
                MSG_KERNEL_STATUS_CHECK) printf "Проверка статуса ядра" ;;
                MSG_MAIN_PROMPT) printf "Выберите действие:" ;;
                MSG_MAIN_LINE_1) printf "  1) Установить/Обновить ядро Mihomo         2) Управление ядром (старт/стоп/перезапуск)" ;;
                MSG_MAIN_LINE_2) printf "  3) Показать текущий статус                 4) Переключить версию ядра" ;;
                MSG_MAIN_LINE_3) printf "  5) Список всех резервных копий             6) Просмотр логов ядра" ;;
                MSG_MAIN_LINE_4) printf "  7) Очистить логи                           8) Показать справку" ;;
                MSG_MAIN_LINE_5) printf "  0) Выход" ;;

                MSG_CLEANUP_STOPPING) printf "[Очистка] Остановка лог-чекера (PID: %s)..." "$@" ;;
                MSG_CLEANUP_FORCE) printf "[Очистка] Принудительная остановка лог-чекера..." ;;
                MSG_CLEANUP_FAIL) printf "[Очистка] Не удалось остановить лог-чекер (PID: %s)" "$@" ;;
                MSG_CLEANUP_OK) printf "Лог-чекер остановлен" ;;
                MSG_EXIT_ABNORMAL) printf "[Выход] Программа завершилась неожиданно" ;;

                MSG_ARG_DIR_REQUIRED) printf "-d/--directory требует путь к каталогу." ;;
                MSG_ARG_LANG_REQUIRED) printf "-l/--lang требует язык (zh|en|ja|ko|fr|de|ru|auto)." ;;
                MSG_ARG_LANG_INVALID) printf "Недопустимый язык: %s (поддерживаются: zh|en|ja|ko|fr|de|ru|auto)" "$@" ;;
                MSG_UNKNOWN_COMMAND) printf "Неизвестная команда: %s" "$@" ;;
                MSG_AVAILABLE_COMMANDS) printf "Доступные команды: status, list, switch, logs, clean, help, version" ;;
                MSG_AVAILABLE_ARGS) printf "Доступные параметры: -d/--directory <path> - каталог установки ClashFox; -l/--lang <zh|en|ja|ko|fr|de|ru|auto> - язык UI" ;;

                MSG_SAVED_DIR_LOADED) printf "Сохранённый каталог загружен: %s" "$@" ;;
                MSG_SAVED_DIR_NOT_FOUND) printf "Сохранённый каталог не найден. Используется по умолчанию: %s" "$@" ;;
                MSG_DIR_SAVED) printf "Каталог сохранён в конфиг: %s" "$@" ;;

                MSG_DIR_SELECT_TITLE) printf "Выберите каталог установки ClashFox" ;;
                MSG_DEFAULT_DIR_CURRENT) printf "Текущий каталог по умолчанию: %s" "$@" ;;
                MSG_USE_DEFAULT_DIR) printf "Использовать каталог по умолчанию? (y/n): " ;;
                MSG_CUSTOM_DIR_PROMPT) printf "Введите пользовательский каталог установки: " ;;
                MSG_DIR_SET) printf "Каталог установки ClashFox установлен: %s" "$@" ;;
                MSG_DIR_USE_DEFAULT) printf "Используется каталог по умолчанию: %s" "$@" ;;
                MSG_DIR_INVALID_FALLBACK) printf "Неверный ввод. Используется каталог по умолчанию: %s" "$@" ;;
                MSG_DIR_EXISTING) printf "Используется существующий каталог установки: %s" "$@" ;;

                MSG_LOG_CHECKER_START) printf "[Init] Запуск лог-чекера..." ;;
                MSG_LOG_CHECKER_OK) printf "Лог-чекер запущен. PID: %s" "$@" ;;
                MSG_APP_CHECK) printf "[Init] Проверка установки ClashFox..." ;;
                MSG_APP_DIR_MISSING) printf "Каталог ClashFox не найден. Создание..." ;;
                MSG_APP_DIR_TARGET) printf "  Целевой каталог: %s" "$@" ;;
                MSG_APP_DIR_CREATED) printf "Каталог ClashFox создан: %s" "$@" ;;
                MSG_APP_DIR_EXISTS) printf "ClashFox установлен: %s" "$@" ;;

                MSG_MAIN_CHOICE) printf "Выбор (0-8): " ;;
                MSG_EXIT_THANKS) printf "[Выход] Спасибо за использование ClashFox Mihomo Kernel Manager" ;;

                MSG_MIHOMO_CONFIG_NOT_FOUND) printf "Конфиг Mihomo: [Не найден %s]" "$@" ;;
                MSG_MIHOMO_CONFIG_FOUND) printf "Конфиг Mihomo: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_RUNNING) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_STATUS_STOPPED) printf "%s: [%s]" "$@" ;;
                MSG_MIHOMO_KERNEL_LINE) printf "%s: [%s]" "$@" ;;

                *) printf "%s" "$key" ;;
            esac
            ;;
    esac
}

# ClashFox 默认目录 - 默认值，可通过命令行参数或交互方式修改
CLASHFOX_DEFAULT_DIR="/Applications/ClashFox"
CLASHFOX_DIR="$CLASHFOX_DEFAULT_DIR"
resolve_clashfox_user_data_dir() {
    if [ -n "${CLASHFOX_USER_DATA_DIR:-}" ]; then
        printf '%s\n' "$CLASHFOX_USER_DATA_DIR"
        return
    fi

    if [ -n "${HOME:-}" ]; then
        printf '%s\n' "$HOME/Library/Application Support/ClashFox"
        return
    fi

    local console_user=""
    console_user="$(stat -f%Su /dev/console 2>/dev/null || true)"
    if [ -n "$console_user" ] && [ "$console_user" != "root" ] && [ "$console_user" != "loginwindow" ]; then
        printf '%s\n' "/Users/$console_user/Library/Application Support/ClashFox"
        return
    fi

    printf '%s\n' "/Library/Application Support/ClashFox"
}

CLASHFOX_USER_DATA_DIR="$(resolve_clashfox_user_data_dir)"

# ClashFox 子目录定义
set_clashfox_subdirectories() {
    # ClashFox 内核目录
    CLASHFOX_CORE_DIR="$CLASHFOX_USER_DATA_DIR/core"
    # ClashFox 内核备份目录
    CLASHFOX_BACKUP_DIR="$CLASHFOX_CORE_DIR/cfox-backup"
    # ClashFox 默认配置文件路径
    CLASHFOX_CONFIG_DIR="$CLASHFOX_USER_DATA_DIR/config"
    # ClashFox 数据目录
    CLASHFOX_DATA_DIR="$CLASHFOX_USER_DATA_DIR/data"
    # ClashFox 日志目录
    CLASHFOX_LOG_DIR="$CLASHFOX_USER_DATA_DIR/logs"
    # ClashFox PID 文件路径
    CLASHFOX_PID_DIR="$CLASHFOX_USER_DATA_DIR/runtime"
}

# 初始化子目录
set_clashfox_subdirectories
# 当前激活的内核名称
ACTIVE_CORE="mihomo"

# 可选 GitHub 用户
GITHUB_USERS=("vernesong" "MetaCubeX")
# 默认分支
DEFAULT_BRANCH="Prerelease-Alpha"

# 终端颜色定义 - 和谐专业版
RED='\033[0;31m'          # 红色 - 错误信息（保持标准红色，确保警示性）
GREEN='\033[0;32m'        # 绿色 - 成功信息（保持标准绿色，确保清晰识别）
YELLOW='\033[0;33m'       # 黄色 - 提示和警告（使用标准黄色，避免过于刺眼）
BLUE='\033[1;34m'         # 亮蓝色 - 主色调，用于标题和重要信息（突出但不刺眼）
CYAN='\033[0;36m'         # 青色 - 状态信息和功能说明（保持专业感）
PURPLE='\033[0;35m'       # 紫色 - 强调信息（降低亮度，避免与其他颜色冲突）
GRAY='\033[0;37m'         # 灰色 - 辅助信息（新增，用于次要文本）
WHITE='\033[1;37m'        # 白色 - 强调文本（新增，用于需要突出的普通文本）
NC='\033[0m'              # 重置颜色（保持不变）

# 检查是否在 macOS 上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_fmt "$(tr_msg MSG_MACOS_ONLY)"
    exit 1
fi

#========================
# 清屏函数
#========================
clear_screen() {
    if [ "${CLASHFOX_GUI_MODE:-0}" = "1" ]; then
        return
    fi
    clear
}

#========================
# 显示标题
#========================
show_title() {
    clear_screen

    log_fmt "${GRAY}$(get_system_status_line)${NC}"
    log_blank

    log_fmt "${PURPLE}=============================================================================${NC}"
    log_fmt "${PURPLE}                         🦊  $SCRIPT_NAME 🦊${NC}"
    log_fmt "${PURPLE}=============================================================================${NC}"
    log_fmt "${CYAN}[$(tr_msg TAG_VERSION)]: ${WHITE} $SCRIPT_VERSION${NC}"
    log_blank

    # 显示欢迎提示
    log_fmt "${YELLOW}[$(tr_msg TAG_WARNING)]${NC} $(tr_msg MSG_WELCOME "${GRAY}$USER" "$SCRIPT_NAME") !${NC}"
    log_blank
}

#========================
# 显示分隔线
#========================
show_separator() {
    log_fmt "${BLUE}------------------------------------------------------------${NC}"
}

# Menu column width can be overridden via CLASHFOX_MENU_WIDTH
MENU_COL_WIDTH="${CLASHFOX_MENU_WIDTH:-}"

menu_col_width() {
    if [[ "$MENU_COL_WIDTH" =~ ^[0-9]+$ ]]; then
        echo "$MENU_COL_WIDTH"
        return
    fi
    local cols
    cols=$(tput cols 2>/dev/null)
    if [ -z "$cols" ] || [ "$cols" -le 0 ]; then
        cols=80
    fi
    local width=$(( (cols - 3) / 2 ))
    if [ "$width" -lt 28 ]; then
        width=28
    fi
    echo "$width"
}

display_width() {
    local s="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 - "$s" <<'PY'
import sys
import unicodedata
s = sys.argv[1]
width = 0
for ch in s:
    if unicodedata.east_asian_width(ch) in ("W", "F"):
        width += 2
    else:
        width += 1
print(width)
PY
        return
    fi
    echo "${#s}"
}

pad_right() {
    local s="$1"
    local width="$2"
    local w
    w=$(display_width "$s")
    if [ "$w" -ge "$width" ]; then
        printf "%s" "$s"
        return
    fi
    printf "%s%*s" "$s" "$((width - w))" ""
}

format_gb() {
    local bytes="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 - "$bytes" <<'PY'
import sys
b = float(sys.argv[1] or 0)
print(f"{b/1024/1024/1024:.1f}")
PY
        return
    fi
    awk -v b="$bytes" 'BEGIN { printf "%.1f", b/1024/1024/1024 }'
}

get_system_status_line() {
    local model cpu_name cores mem_bytes mem_gb disk_kb disk_gb refresh os_ver
    model=$(system_profiler SPHardwareDataType 2>/dev/null | awk -F": " '/Model Name/{print $2; exit}')
    if [ -z "$model" ]; then
        model=$(sysctl -n hw.model 2>/dev/null)
    fi

    cpu_name=$(sysctl -n machdep.cpu.brand_string 2>/dev/null | sed -E 's/\(R\)|\(TM\)//g; s/CPU//g; s/@.*//g; s/  +/ /g; s/^ //; s/ $//')
    cores=$(sysctl -n hw.physicalcpu 2>/dev/null)
    if [ -n "$cores" ] && [ -n "$cpu_name" ]; then
        cpu_name="${cores}-Core ${cpu_name}"
    fi

    mem_bytes=$(sysctl -n hw.memsize 2>/dev/null)
    mem_gb=$(format_gb "$mem_bytes")

    disk_kb=$(df -k / 2>/dev/null | awk 'NR==2 {print $2}')
    if [ -n "$disk_kb" ]; then
        disk_gb=$(awk -v k="$disk_kb" 'BEGIN { printf "%.1f", k/1024/1024 }')
    fi

    os_ver=$(sw_vers -productVersion 2>/dev/null)

    printf "${YELLOW}Status${NC} %s · %s · %s GB/%s GB · macOS %s" \
        "${model:-Unknown}" \
        "${cpu_name:-Unknown CPU}" \
        "${mem_gb:-0.0}" \
        "${disk_gb:-0.0}" \
        "${os_ver:-Unknown}"
}

# Two-column menu output helper for alignment
print_menu_two_cols() {
    local left="$1"
    local right="$2"
    local color_prefix="$3"
    local color_suffix="$4"
    local width
    local line
    width="$(menu_col_width)"
    line="$(pad_right "$left" "$width") $right"
    if [ -n "$color_prefix" ]; then
        log_fmt "  ${color_prefix}${line}${color_suffix}"
    else
        log_fmt "  ${line}"
    fi
}

#========================
# 公共日志输出方法
#========================

log_fmt() {
    if [ "${CLASHFOX_SILENT:-0}" = "1" ]; then
        return
    fi
    # 获取参数个数
    local arg_count=$#

    case $arg_count in
        0)
            # 无参数时输出空行
            printf "\n"
            ;;
        1)
            # 一个参数时只输出该参数
            printf "%b\n" "$1${NC}"
            ;;
        2)
            # 两个参数时保持现有行为：参数1 + 空格 + 参数2
            printf "%b %b\n" "$1" "$2${NC}"
            ;;
        *)
            # 三个或更多参数时，用空格连接所有参数
            local output=""
            for arg in "$@"; do
                output="$output$arg "
            done
            printf "%b\n" "${output% }${NC}"  # 移除末尾的空格
            ;;
    esac
}

# 输出成功消息（绿色）
log_success() {
    if [ "${CLASHFOX_SILENT:-0}" = "1" ]; then
        return
    fi
    printf "%b\n" "${GREEN}[$(tr_msg TAG_SUCCESS)] $1${NC}"
}

# 输出错误消息（红色）
log_error() {
    if [ "${CLASHFOX_SILENT:-0}" = "1" ]; then
        return
    fi
    printf "%b\n" "${RED}[$(tr_msg TAG_ERROR)] $1${NC}"
}

# 输出警告/提示消息（黄色）
log_warning() {
    if [ "${CLASHFOX_SILENT:-0}" = "1" ]; then
        return
    fi
    printf "%b\n" "${YELLOW}[$(tr_msg TAG_WARNING)] $1${NC}"
}

# 输出功能/状态消息（青色）
log_highlight() {
    if [ "${CLASHFOX_SILENT:-0}" = "1" ]; then
        return
    fi
    printf "%b\n" "${CYAN}[$1] $2${NC}"
}

# 输出空行
log_blank() {
    printf "\n"
}

#========================
# 等待用户按键
#========================
wait_for_key() {
    if [ "${CLASHFOX_GUI_MODE:-0}" = "1" ]; then
        return
    fi
    log_blank
    read -p "$(tr_msg MSG_PRESS_ENTER)"
}

#========================
# 请求 sudo 权限
#========================
request_sudo_permission() {
    # GUI 模式由上层处理授权弹窗，这里跳过交互式 sudo 提示
    if [ "${CLASHFOX_GUI_MODE:-0}" = "1" ]; then
        return 0
    fi

    # 先静默检查是否已经有 sudo 权限
    if sudo -n true 2>/dev/null; then
        # 保持 sudo 权限有效期（后台进程，每60秒刷新一次）
        sudo -v -s >/dev/null 2>&1 <<-EOF
            while true; do
                sudo -n true >/dev/null 2>&1  # 静默刷新 sudo 权限
                sleep 60                      # 等待60秒
                kill -0 "$$" 2>/dev/null || exit  # 检查主进程是否存活，否则退出
            done &
EOF
        return 0  # 已有权限，直接返回成功，不输出任何提示
    fi


    # 只有在需要授权时才显示提示信息
    log_fmt "${RED}========================================================================${NC}"
    log_fmt "${RED}⚠️  $(tr_msg MSG_REQUIRE_SUDO_TITLE)${NC}"
    log_fmt "${RED}========================================================================${NC}"
    log_fmt "${RED}$(tr_msg MSG_REQUIRE_SUDO_DESC)${NC}"
    log_fmt "${RED}$(tr_msg MSG_REQUIRE_SUDO_PROMPT)${NC}"
    log_blank

    if sudo -v 2>/dev/null; then
        # 保持 sudo 权限有效期（后台进程，每60秒刷新一次）
        sudo -v -s >/dev/null 2>&1 <<-EOF
            while true; do
                sudo -n true >/dev/null 2>&1  # 静默刷新 sudo 权限
                sleep 60                      # 等待60秒
                kill -0 "$$" 2>/dev/null || exit  # 检查主进程是否存活，否则退出
            done &
EOF
        log_success "$(tr_msg MSG_SUDO_OK)"
        # 清屏并重新显示标题
        clear_screen
        show_title
    else
        log_error "$(tr_msg MSG_SUDO_FAIL)"
        return 1
    fi
}

#========================
# 检查并创建必要的目录结构
#========================
check_and_create_directories() {
    log_fmt "${BLUE}$(tr_msg MSG_INIT_CHECK_DIRS)"

    # 检查是否有足够权限创建目录
    if [ ! -w "$(dirname "$CLASHFOX_DIR")" ]; then
        log_warning "$(tr_msg MSG_NEED_ADMIN)"
        if ! request_sudo_permission; then
            log_error "$(tr_msg MSG_NO_PERMISSION)"
            return 1
        fi
    fi

    # 检查并创建内核目录
    if [ ! -d "$CLASHFOX_CORE_DIR" ]; then
        log_warning "$(tr_msg MSG_CORE_DIR_CREATE "$CLASHFOX_CORE_DIR")"
        sudo mkdir -p "$CLASHFOX_CORE_DIR"
    fi
    log_success "$(tr_msg MSG_CORE_DIR_EXISTS "$CLASHFOX_CORE_DIR")"

    # 检查并创建内核备份目录
    if [ ! -d "$CLASHFOX_BACKUP_DIR" ]; then
        log_warning "$(tr_msg MSG_CORE_DIR_CREATE "$CLASHFOX_BACKUP_DIR")"
        sudo mkdir -p "$CLASHFOX_BACKUP_DIR"
    fi
    log_success "$(tr_msg MSG_CORE_DIR_EXISTS "$CLASHFOX_BACKUP_DIR")"

    # 检查并创建配置目录
    if [ ! -d "$CLASHFOX_CONFIG_DIR" ]; then
        log_warning "$(tr_msg MSG_CONFIG_DIR_CREATE "$CLASHFOX_CONFIG_DIR")"
        sudo mkdir -p "$CLASHFOX_CONFIG_DIR"
    fi
    log_success "$(tr_msg MSG_CONFIG_DIR_EXISTS "$CLASHFOX_CONFIG_DIR")"

    # 检查并创建数据目录
    if [ ! -d "$CLASHFOX_DATA_DIR" ]; then
        log_warning "$(tr_msg MSG_DATA_DIR_CREATE "$CLASHFOX_DATA_DIR")"
        sudo mkdir -p "$CLASHFOX_DATA_DIR"
    fi
    log_success "$(tr_msg MSG_DATA_DIR_EXISTS "$CLASHFOX_DATA_DIR")"

    # 检查并创建日志目录
    if [ ! -d "$CLASHFOX_LOG_DIR" ]; then
        log_warning "$(tr_msg MSG_LOG_DIR_CREATE "$CLASHFOX_LOG_DIR")"
        sudo mkdir -p "$CLASHFOX_LOG_DIR"
    fi
    log_success "$(tr_msg MSG_LOG_DIR_EXISTS "$CLASHFOX_LOG_DIR")"

    # 检查并创建运行时目录
    if [ ! -d "$CLASHFOX_PID_DIR" ]; then
        log_warning "$(tr_msg MSG_RUNTIME_DIR_CREATE "$CLASHFOX_PID_DIR")"
        sudo mkdir -p "$CLASHFOX_PID_DIR"
    fi
    log_success "$(tr_msg MSG_RUNTIME_DIR_EXISTS "$CLASHFOX_PID_DIR")"

    # 设置目录权限，确保当前用户可以访问
    log_fmt "${BLUE}$(tr_msg MSG_INIT_SET_PERMS)"
    sudo chown -R "$USER:admin" "$CLASHFOX_DIR"
    sudo chmod -R 755 "$CLASHFOX_DIR"
    log_success "$(tr_msg MSG_DIRS_PERMS_OK)"
}


#========================
# 检查内核目录
#========================
require_core_dir() {
    if [ ! -d "$CLASHFOX_CORE_DIR" ]; then
        log_warning "$(tr_msg MSG_CORE_DIR_MISSING_CREATE)"
        if ! check_and_create_directories; then
            log_error "$(tr_msg MSG_DIR_CREATE_FAIL)"
            wait_for_key
            return 1
        fi
    fi

    cd "$CLASHFOX_CORE_DIR" || {
        log_error "$(tr_msg MSG_CORE_DIR_ENTER_FAIL)"
        wait_for_key
        return 1
    }
    return 0
}

get_backup_files_sorted() {
    ls -1t "$CLASHFOX_BACKUP_DIR"/mihomo.backup.* 2>/dev/null | awk 'NF'
}

#============================
# 检查 Mihomo 状态并显示完整信息
#============================
check_mihomo_status() {
    local status
    status="$(tr_msg MSG_STATUS_STOPPED)"
    local exit_code=1

    # 快速检查：首先尝试不使用 sudo 检查进程状态（最快）
    if pgrep -x "$ACTIVE_CORE" > /dev/null 2>&1; then
        status="$(tr_msg MSG_STATUS_RUNNING)"
        exit_code=0
    # 如果快速检查失败，静默尝试使用 sudo 检查（不触发完整的权限请求流程）
    elif sudo -n pgrep -x "$ACTIVE_CORE" > /dev/null 2>&1; then
        status="$(tr_msg MSG_STATUS_RUNNING)"
        exit_code=0
    # 如果需要交互式sudo权限，才调用完整的权限请求函数
    elif ! sudo -n true > /dev/null 2>&1; then
        # 确保有sudo权限
        if request_sudo_permission; then
            if sudo pgrep -x "$ACTIVE_CORE" > /dev/null 2>&1; then
                status="$(tr_msg MSG_STATUS_RUNNING)"
                exit_code=0
            fi
        fi
    fi

    # 显示Mihomo状态
    if [ "$status" = "$(tr_msg MSG_STATUS_RUNNING)" ]; then
        log_fmt "$(tr_msg MSG_MIHOMO_STATUS_RUNNING "$(tr_msg MSG_STATUS_LABEL)" "${GREEN}$status${NC}")"
    else
        log_fmt "$(tr_msg MSG_MIHOMO_STATUS_STOPPED "$(tr_msg MSG_STATUS_LABEL)" "${RED}$status${NC}")"
    fi

    # 显示Mihomo版本
    MIHOMO_VERSION=$(get_mihomo_version)
    log_fmt "$(tr_msg MSG_MIHOMO_KERNEL_LINE "$(tr_msg MSG_KERNEL_LABEL)" "${GREEN}$MIHOMO_VERSION${NC}")"

    # 显示配置文件状态
    if [ -f "$CLASHFOX_CONFIG_DIR/default.yaml" ]; then
        log_fmt "$(tr_msg MSG_MIHOMO_CONFIG_FOUND "${GREEN}$CLASHFOX_CONFIG_DIR/default.yaml${NC}")"
    else
        log_fmt "$(tr_msg MSG_MIHOMO_CONFIG_NOT_FOUND "${YELLOW}$CLASHFOX_CONFIG_DIR/default.yaml${NC}")"
    fi

    # 返回原始的状态值和退出码
    return $exit_code
}

#========================
# 显示当前状态
#========================
show_status() {
    clear_screen
    show_title

    # 确保有sudo权限
    if ! request_sudo_permission; then
        return
    fi

    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_KERNEL_STATUS_CHECK)"
    show_separator

    # 内核运行状态
    log_fmt "\n${BLUE}$(tr_msg MSG_STATUS_SECTION)${NC}"
    check_mihomo_status

    # 目录和内核文件检查
    if require_core_dir; then
        log_fmt "\n${BLUE}$(tr_msg MSG_KERNEL_FILES_SECTION)${NC}"

        if [ -f "$ACTIVE_CORE" ]; then
            log_fmt "  ${GREEN}$(tr_msg MSG_KERNEL_FILE_OK)${NC}"

            if [ -x "$ACTIVE_CORE" ]; then
                CURRENT_RAW=$("./$ACTIVE_CORE" -v 2>/dev/null | head -n1)
                log_fmt "  ${BLUE}$(tr_msg MSG_KERNEL_VERSION_INFO "$CURRENT_RAW")${NC}"

                if [[ "$CURRENT_RAW" =~ ^Mihomo[[:space:]]+Meta[[:space:]]+([^[:space:]]+)[[:space:]]+darwin[[:space:]]+(amd64|arm64) ]]; then
                    CURRENT_VER="${BASH_REMATCH[1]}"
                    CURRENT_ARCH="${BASH_REMATCH[2]}"
                    CURRENT_DISPLAY="mihomo-darwin-${CURRENT_ARCH}-${CURRENT_VER}"
                    log_fmt "  ${BLUE}$(tr_msg MSG_KERNEL_DISPLAY_NAME "${RED}$CURRENT_DISPLAY${NC}")"
                else
                    log_fmt "  ${BLUE}$(tr_msg MSG_KERNEL_DISPLAY_NAME_PARSE_FAIL "${RED}$ACTIVE_CORE${NC}")"
                fi
            else
                log_fmt "  ${RED}$(tr_msg MSG_KERNEL_FILE_NOEXEC)${NC}"
            fi
        else
            log_fmt "  ${RED}$(tr_msg MSG_KERNEL_FILE_MISSING)${NC}"
        fi

        # 备份信息检查
        log_fmt "\n${BLUE}$(tr_msg MSG_BACKUP_SECTION)${NC}"
        LATEST=$(get_backup_files_sorted | head -n1)

        if [ -n "$LATEST" ]; then
            log_fmt "  ${GREEN}$(tr_msg MSG_BACKUP_FOUND)${NC}"
            log_fmt "  ${BLUE}$(tr_msg MSG_BACKUP_LATEST "$(basename "$LATEST")")"

            if [[ "$(basename "$LATEST")" =~ ^mihomo\.backup\.mihomo-darwin-(amd64|arm64)-(.+)\.([0-9]{8}_[0-9]{6})$ ]]; then
                BACKUP_VER="${BASH_REMATCH[2]}"
                BACKUP_TIMESTAMP="${BASH_REMATCH[3]}"
                log_fmt "  ${BLUE}$(tr_msg MSG_BACKUP_VERSION "${RED}$BACKUP_VER${NC}")"
                log_fmt "  ${BLUE}$(tr_msg MSG_BACKUP_TIME "${YELLOW}$BACKUP_TIMESTAMP${NC}")"
            else
                log_fmt "  ${BLUE}$(tr_msg MSG_BACKUP_VERSION_UNKNOWN)"
            fi
        else
            log_fmt "  ${YELLOW}$(tr_msg MSG_BACKUP_NONE)${NC}"
        fi
    fi

    wait_for_key
}

#========================
# 列出所有备份
#========================
show_list_backups() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_LIST_BACKUPS_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    BACKUP_FILES=$(get_backup_files_sorted)
    if [ -z "$BACKUP_FILES" ]; then
        log_fmt "${YELLOW}$(tr_msg MSG_NO_BACKUPS)${NC}"
        wait_for_key
        return
    fi

    log_fmt "${BLUE}$(tr_msg MSG_BACKUP_LIST_TITLE)${NC}"
    log_fmt "$(tr_msg MSG_BACKUP_LIST_COLUMNS)"
    # 创建临时数组存储备份信息
    declare -a backup_list=()

    # 收集所有备份文件的时间戳和文件名
    while read -r f; do
        base="$(basename "$f")"
        if [[ "$base" =~ ^mihomo\.backup\.mihomo-darwin-(amd64|arm64)-.+\.([0-9]{8}_[0-9]{6})$ ]]; then
            TS="${BASH_REMATCH[2]}"
            # 格式：时间戳 文件名（时间戳在前以便排序）
            backup_list+=("$TS $f")
        fi
    done <<< "$BACKUP_FILES"

    # 按时间戳倒序排序
    IFS=$'\n' sorted_backups=($(sort -r <<< "${backup_list[*]}"))
    unset IFS

    # 显示排序后的备份列表
    i=1
    for backup in "${sorted_backups[@]}"; do
        # 分离时间戳和文件名
        TS=$(echo "$backup" | cut -d' ' -f1)
        f=$(echo "$backup" | cut -d' ' -f2-)

        # 提取版本信息
        base="$(basename "$f")"
        if [[ "$base" =~ ^mihomo\.backup\.(mihomo-darwin-(amd64|arm64)-.+)\.[0-9]{8}_[0-9]{6}$ ]]; then
            VERSION_CLEAN="${BASH_REMATCH[1]}"
            printf "   %2d   | ${RED}%s${NC} | ${YELLOW}%s${NC}\n" "$i" "$VERSION_CLEAN" "$TS"
            i=$((i+1))
        fi
    done

    log_blank
    log_fmt "${GREEN}$(tr_msg MSG_BACKUP_TOTAL "$((i-1))")${NC}"
    wait_for_key
}

#========================
# 切换内核版本
#========================
switch_core() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_SWITCH_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    # 先列出所有备份
    list_backups_content

    # 让用户选择
    if [ -n "${CLASHFOX_SWITCH_INDEX:-}" ]; then
        CHOICE="$CLASHFOX_SWITCH_INDEX"
    else
        read -p "$(tr_msg MSG_SWITCH_PROMPT)" CHOICE
    fi

    if [ -z "$CHOICE" ]; then
        return
    fi

    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
        log_error "$(tr_msg MSG_INVALID_NUMBER)"
        wait_for_key
        return
    fi

    # 获取所有备份文件并排序
    BACKUP_FILES_SORTED=$(get_backup_files_sorted)

    # 根据选择获取目标备份
    TARGET_BACKUP=$(echo "$BACKUP_FILES_SORTED" | sed -n "${CHOICE}p")

    if [ -z "$TARGET_BACKUP" ]; then
        log_error "$(tr_msg MSG_BACKUP_NO_MATCH)"
        wait_for_key
        return
    fi

    log_blank
    log_fmt "${BLUE}$(tr_msg MSG_SWITCH_START)"
    log_fmt "${BLUE}$(tr_msg MSG_BACKUP_SELECTED "$(basename "$TARGET_BACKUP")")"

    # 显示当前内核信息
    if [ -f "$ACTIVE_CORE" ]; then
        CURRENT_RAW=$("./$ACTIVE_CORE" -v 2>/dev/null | head -n1 2>/dev/null)
        log_fmt "${BLUE}$(tr_msg MSG_CURRENT_KERNEL_VERSION "$CURRENT_RAW")"
    else
        log_fmt "${BLUE}$(tr_msg MSG_CURRENT_KERNEL_MISSING)"
    fi

    # 确认操作
    if [ "${CLASHFOX_AUTO_YES:-0}" = "1" ]; then
        CONFIRM="y"
    else
        read -p "$(tr_msg MSG_SWITCH_CONFIRM)" CONFIRM
    fi
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_warning "$(tr_msg MSG_OP_CANCELLED)"
        wait_for_key
        return
    fi

    # 备份当前内核
    if [ -f "$ACTIVE_CORE" ]; then
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        ROLLBACK_FILE="${ACTIVE_CORE}.bak.$TIMESTAMP"
        cp "$ACTIVE_CORE" "$ROLLBACK_FILE"
        log_fmt "${BLUE}$(tr_msg MSG_BACKUP_CURRENT_KERNEL "$ROLLBACK_FILE")"
    fi

    # 替换内核
    TMP_CORE="${ACTIVE_CORE}.tmp"
    cp "$TARGET_BACKUP" "$TMP_CORE"
    mv -f "$TMP_CORE" "$ACTIVE_CORE"
    chmod +x "$ACTIVE_CORE"
    log_fmt "${BLUE}$(tr_msg MSG_KERNEL_REPLACED "$(basename "$TARGET_BACKUP")")"

    # 删除临时备份
    rm -f "$ROLLBACK_FILE"
    log_fmt "${BLUE}$(tr_msg MSG_TEMP_BACKUP_REMOVED "$ROLLBACK_FILE")"

    log_fmt "${GREEN}$(tr_msg MSG_SWITCH_DONE)"
    wait_for_key
}

#========================
# 列出备份内容（用于切换功能）
#========================
list_backups_content() {
    BACKUP_FILES=$(get_backup_files_sorted)
    if [ -z "$BACKUP_FILES" ]; then
        log_fmt "${YELLOW}$(tr_msg MSG_NO_BACKUPS)${NC}"
        wait_for_key
        return 1
    fi

    log_fmt "${BLUE}$(tr_msg MSG_LIST_BACKUPS_SIMPLE_TITLE)"
    log_fmt "$(tr_msg MSG_BACKUP_LIST_COLUMNS)"
    show_separator

    i=1
    echo "$BACKUP_FILES" | while read -r f; do
        base="$(basename "$f")"
        TS=$(echo "$base" | sed -E 's/^mihomo\.backup\.mihomo-darwin-(amd64|arm64)-.+\.([0-9]{8}_[0-9]{6})$/\2/')
        echo "$TS $f"
    done | sort -r | while read -r TS f; do
        base="$(basename "$f")"
        VERSION_CLEAN=$(echo "$base" | sed -E 's/^mihomo\.backup\.(mihomo-darwin-(amd64|arm64)-.+)\.[0-9]{8}_[0-9]{6}$/\1/')
        printf "%2d   | ${RED}%s${NC} | ${YELLOW}%s${NC}\n" "$i" "$VERSION_CLEAN" "$TS"
        i=$((i+1))
    done
    log_blank
    return 0
}

#========================
# 安装内核
#========================
install_core() {
    show_title
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_INSTALL_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    if [ -n "${CLASHFOX_VERSION_BRANCH:-}" ]; then
        VERSION_BRANCH="$CLASHFOX_VERSION_BRANCH"
    else
        VERSION_BRANCH="$DEFAULT_BRANCH"
    fi

    # 选择 GitHub 用户
    if [ -n "${CLASHFOX_GITHUB_USER:-}" ]; then
        GITHUB_USER="$CLASHFOX_GITHUB_USER"
    elif [ "${CLASHFOX_GUI_MODE:-0}" = "1" ]; then
        GITHUB_USER="${GITHUB_USERS[0]}"
    else
        log_fmt "${BLUE}$(tr_msg MSG_SELECT_GITHUB_USER)${NC}"
        for i in "${!GITHUB_USERS[@]}"; do
            echo "  $((i+1))) ${GITHUB_USERS[$i]}"
        done
        read -p "$(tr_msg MSG_SELECT_USER_PROMPT)" CHOICE

        if [[ "$CHOICE" =~ ^[0-9]+$ ]] && [ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "${#GITHUB_USERS[@]}" ]; then
            GITHUB_USER="${GITHUB_USERS[$((CHOICE-1))]}"
        else
            GITHUB_USER="${GITHUB_USERS[0]}"
        fi
    fi

    log_fmt "${BLUE}$(tr_msg MSG_SELECTED_GITHUB_USER "${GREEN}$GITHUB_USER${NC}")"
    log_blank

    # 获取版本信息
    VERSION_URL="https://github.com/${GITHUB_USER}/mihomo/releases/download/$VERSION_BRANCH/version.txt"
    BASE_DOWNLOAD_URL="https://github.com/${GITHUB_USER}/mihomo/releases/download/$VERSION_BRANCH"

    log_fmt "${BLUE}$(tr_msg MSG_GET_VERSION_INFO)"
    VERSION_INFO=$(curl -sL "$VERSION_URL")

    if [ -z "$VERSION_INFO" ] || echo "$VERSION_INFO" | grep -iq "Not Found"; then
        log_error "$(tr_msg MSG_VERSION_INFO_FAIL)"
        wait_for_key
        return 1
    fi

    # 解析版本号
    if [ "$VERSION_BRANCH" = "Prerelease-Alpha" ]; then
        VERSION_HASH=$(echo "$VERSION_INFO" | grep -oE 'alpha(-smart)?-[0-9a-f]+' | head -1)
    else
        VERSION_HASH=$(echo "$VERSION_INFO" | head -1)
    fi

    log_fmt "${BLUE}$(tr_msg MSG_VERSION_INFO "${GREEN}$VERSION_HASH${NC}")"

    # 检测架构
    ARCH_RAW="$(uname -m)"
    if [ "$ARCH_RAW" = "arm64" ]; then
        MIHOMO_ARCH="arm64"
    elif [ "$ARCH_RAW" = "x86_64" ]; then
        MIHOMO_ARCH="amd64"
    else
        log_error "$(tr_msg MSG_ARCH_UNSUPPORTED "$ARCH_RAW")"
        wait_for_key
        return 1
    fi

    log_fmt "${BLUE}$(tr_msg MSG_ARCH_DETECTED "${YELLOW}$MIHOMO_ARCH${NC}")"

    # 构建下载信息
    VERSION="mihomo-darwin-${MIHOMO_ARCH}-${VERSION_HASH}"
    DOWNLOAD_URL="${BASE_DOWNLOAD_URL}/${VERSION}.gz"

    log_fmt "${BLUE}$(tr_msg MSG_DOWNLOAD_INFO)"
    log_fmt "$(tr_msg MSG_DOWNLOAD_URL "$DOWNLOAD_URL")"
    log_fmt "$(tr_msg MSG_VERSION_LABEL "$VERSION")"
    log_blank

    # 确认安装
    if [ "${CLASHFOX_AUTO_YES:-0}" = "1" ]; then
        CONFIRM="y"
    else
        read -p "$(tr_msg MSG_DOWNLOAD_CONFIRM)" CONFIRM
    fi
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_warning "$(tr_msg MSG_OP_CANCELLED)"
        wait_for_key
        return
    fi

    # 下载并安装
    TMP_FILE="$(mktemp)"
    log_fmt "${BLUE}$(tr_msg MSG_DOWNLOAD_START)"

    # 增加下载重试机制（最多3次）
    DOWNLOAD_SUCCESS=0
    MAX_RETRIES=3
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -fL "$DOWNLOAD_URL" -o "$TMP_FILE" -#; then
            DOWNLOAD_SUCCESS=1
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                log_warning "$(tr_msg MSG_DOWNLOAD_RETRY "$RETRY_COUNT" "$MAX_RETRIES")"
                sleep 5  # 等待5秒后重试
            fi
        fi
    done

    if [ $DOWNLOAD_SUCCESS -eq 1 ]; then
        log_success "$(tr_msg MSG_DOWNLOAD_OK)"

        log_fmt "${BLUE}$(tr_msg MSG_EXTRACT_START)"
        if gunzip -c "$TMP_FILE" > "$ACTIVE_CORE"; then
            chmod +x "$ACTIVE_CORE"
            rm -f "$TMP_FILE"

            # 备份新安装的内核（无论是否是首次安装）
            TIMESTAMP=$(date +%Y%m%d_%H%M%S)
            mkdir -p "$CLASHFOX_BACKUP_DIR"
            BACKUP_FILE="$CLASHFOX_BACKUP_DIR/mihomo.backup.${VERSION}.${TIMESTAMP}"
            cp "$ACTIVE_CORE" "$BACKUP_FILE"
            log_fmt "${BLUE}$(tr_msg MSG_BACKUP_NEW_KERNEL "${YELLOW}$BACKUP_FILE${NC}")"

            log_fmt "${GREEN}$(tr_msg MSG_INSTALL_DONE)"
        else
            log_error "$(tr_msg MSG_EXTRACT_FAIL)"
            rm -f "$TMP_FILE"
        fi
    else
        log_error "$(tr_msg MSG_DOWNLOAD_FAIL "$MAX_RETRIES")"
        rm -f "$TMP_FILE"
    fi

    wait_for_key
}

# 获取 Mihomo 版本
get_mihomo_version() {
    if [ -x "$CLASHFOX_CORE_DIR/$ACTIVE_CORE" ]; then
        CURRENT_RAW=$("$CLASHFOX_CORE_DIR/$ACTIVE_CORE" -v 2>/dev/null | head -n1)
        if [[ "$CURRENT_RAW" =~ ^Mihomo[[:space:]]+Meta[[:space:]]+([^[:space:]]+)[[:space:]]+darwin[[:space:]]+(amd64|arm64) ]]; then
            CURRENT_VER="${BASH_REMATCH[1]}"
            echo "$CURRENT_VER"
        else
            tr_msg MSG_VERSION_PARSE_FAIL
        fi
    else
        tr_msg MSG_NOT_INSTALLED
    fi
}
start_mihomo_kernel() {
    show_title

    # 验证用户权限
    if ! request_sudo_permission; then
        wait_for_key
        return
    fi

    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_START_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    # 检查内核是否已在运行
    if check_mihomo_status | grep -q "$(tr_msg MSG_STATUS_RUNNING)"; then
        log_warning "$(tr_msg MSG_KERNEL_RUNNING)"
        wait_for_key
        return
    fi

    log_fmt "${BLUE}$(tr_msg MSG_START_PRECHECK)"

    # 检查内核文件是否存在且可执行
    if [ ! -f "$ACTIVE_CORE" ]; then
        log_error "$(tr_msg MSG_KERNEL_NOT_FOUND)"
        wait_for_key
        return
    fi

    if [ ! -x "$ACTIVE_CORE" ]; then
        log_error "$(tr_msg MSG_KERNEL_NOT_EXEC)"
        log_fmt "${BLUE}$(tr_msg MSG_ADD_EXEC)"
        chmod +x "$ACTIVE_CORE"
        if [ $? -ne 0 ]; then
            log_error "$(tr_msg MSG_ADD_EXEC_FAIL)"
            wait_for_key
            return
        fi
    fi

    # 配置文件检查 - 增加更详细的检查逻辑
    CONFIG_PATH="${CLASHFOX_CONFIG_PATH:-$CLASHFOX_CONFIG_DIR/default.yaml}"

    # 检查默认配置文件是否存在
    if [ ! -f "$CONFIG_PATH" ]; then
        log_error "$(tr_msg MSG_CONFIG_DEFAULT_MISSING "$CONFIG_PATH")"
        if [ "${CLASHFOX_GUI_MODE:-0}" = "1" ]; then
            wait_for_key
            return
        fi
        log_fmt "${BLUE}$(tr_msg MSG_CONFIG_SCAN)"

        # 列出配置目录中的所有yaml文件
        CONFIG_FILES=$(find "$CLASHFOX_CONFIG_DIR" -name "*.yaml" -o -name "*.yml" -o -name "*.json" 2>/dev/null)

        if [ -z "$CONFIG_FILES" ]; then
            log_error "$(tr_msg MSG_CONFIG_NONE)"
            log_warning "$(tr_msg MSG_CONFIG_PUT_HINT "$CLASHFOX_CONFIG_DIR")"
            wait_for_key
            return
        fi

        log_fmt "${BLUE}$(tr_msg MSG_CONFIG_AVAILABLE)"
        log_fmt "$(tr_msg MSG_CONFIG_LIST_COLUMNS)"
        show_separator

        # 将配置文件列表转换为数组并显示
        IFS=$'\n' read -r -d '' -a CONFIG_FILE_ARRAY <<< "$CONFIG_FILES"
        for i in "${!CONFIG_FILE_ARRAY[@]}"; do
            log_fmt "  ${BLUE}$((i+1)))${NC} ${CONFIG_FILE_ARRAY[$i]}"
        done

        # 让用户选择配置文件
        log_blank
        read -p "$(tr_msg MSG_CONFIG_SELECT_PROMPT)" CONFIG_CHOICE

        if [ "$CONFIG_CHOICE" -eq 0 ] 2>/dev/null; then
            log_warning "$(tr_msg MSG_OP_CANCELLED)"
            wait_for_key
            return
        elif [ "$CONFIG_CHOICE" -ge 1 ] && [ "$CONFIG_CHOICE" -le "${#CONFIG_FILE_ARRAY[@]}" ] 2>/dev/null; then
            CONFIG_PATH="${CONFIG_FILE_ARRAY[$((CONFIG_CHOICE-1))]}"
            log_success "$(tr_msg MSG_CONFIG_SELECTED "$CONFIG_PATH")"
        else
            log_error "$(tr_msg MSG_CONFIG_INVALID)"
            wait_for_key
            return
        fi
    fi

    # 检查配置文件是否可读
    if [ ! -r "$CONFIG_PATH" ]; then
        log_error "$(tr_msg MSG_CONFIG_READ_FAIL "$CONFIG_PATH")"
        log_warning "$(tr_msg MSG_CONFIG_PERM_HINT)"
        wait_for_key
        return
    fi

    # 检查配置文件是否非空
    if [ ! -s "$CONFIG_PATH" ]; then
        log_error "$(tr_msg MSG_CONFIG_EMPTY "$CONFIG_PATH")"
        log_warning "$(tr_msg MSG_CONFIG_EMPTY_HINT)"
        wait_for_key
        return
    fi

    log_success "$(tr_msg MSG_CONFIG_WILL_USE "$CONFIG_PATH")"

    # 启动内核（GUI 无 TTY 场景下避免使用 nohup，防止 "can't detach from console"）
    log_fmt "${BLUE}$(tr_msg MSG_START_PROCESS)"
    sudo sh -c "exec ./\"$ACTIVE_CORE\" -f \"$CONFIG_PATH\" -d \"$CLASHFOX_DATA_DIR\" >> \"$CLASHFOX_LOG_DIR/clashfox.log\" 2>&1 < /dev/null" &
    log_success "$(tr_msg MSG_START_COMMAND "./$ACTIVE_CORE -f $CONFIG_PATH -d $CLASHFOX_DATA_DIR >> $CLASHFOX_LOG_DIR/clashfox.log 2>&1 < /dev/null")"

    # 等待内核拉起后再解析真实 PID（避免记录到短生命周期的 sudo 进程）
    sleep 3
    PID="$(find_mihomo_pid)"

    if [ -n "$PID" ]; then
        echo "$PID" > "$CLASHFOX_PID_DIR/clashfox.pid"
        log_success "$(tr_msg MSG_PID_WRITTEN "$CLASHFOX_PID_DIR/clashfox.pid")"
        log_success "$(tr_msg MSG_KERNEL_STARTED)"
        log_success "$(tr_msg MSG_PROCESS_ID "$PID")"
    else
        log_error "$(tr_msg MSG_KERNEL_START_FAIL)"
    fi

    wait_for_key
}

#========================
# 关闭 Mihomo 内核
#========================
kill_mihomo_kernel() {
    show_title

    # 验证用户权限
    if ! request_sudo_permission; then
        wait_for_key
        continue
    fi

    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_STOP_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    # 检查内核是否在运行
    if ! check_mihomo_status | grep -q "$(tr_msg MSG_STATUS_RUNNING)"; then
        log_warning "$(tr_msg MSG_KERNEL_NOT_RUNNING)"
        wait_for_key
        return
    fi

    log_fmt "${BLUE}$(tr_msg MSG_STOPPING_KERNEL)"

    # 获取 Mihomo 进程 ID（使用 sudo 确保能找到所有用户的进程）
    local pids=$(sudo pgrep -x "$ACTIVE_CORE")

    if [ -n "$pids" ]; then
        log_success "$(tr_msg MSG_PIDS_FOUND "$pids")"

        # 尝试正常关闭进程
        for pid in $pids; do
            log_fmt "${BLUE}$(tr_msg MSG_STOPPING_PROCESS "$pid")"
            sudo kill "$pid" 2>/dev/null
        done

        # 等待进程关闭
        sleep 2

        # 检查是否还有进程在运行
        local remaining_pids=$(sudo pgrep -x "$ACTIVE_CORE")
        if [ -n "$remaining_pids" ]; then
            log_warning "$(tr_msg MSG_FORCE_STOPPING)"
            for pid in $remaining_pids; do
                sudo kill -9 "$pid" 2>/dev/null
            done
        fi

        # 再次检查
        if sudo pgrep -x "$ACTIVE_CORE" > /dev/null 2>&1; then
            log_error "$(tr_msg MSG_KERNEL_STOP_FAIL)"
            log_warning "$(tr_msg MSG_KERNEL_STOP_HINT)"
        else
            log_success "$(tr_msg MSG_KERNEL_STOPPED)"
        fi
    else
        log_warning "$(tr_msg MSG_PROCESS_NOT_RUNNING)"
    fi

    # 清理PID文件（修复：检查正确的PID文件路径）
    PID_FILE="$CLASHFOX_PID_DIR/clashfox.pid"
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
        log_success "$(tr_msg MSG_PID_CLEANED "$PID_FILE")"
    fi

    wait_for_key
}

#========================
# 重启 Mihomo 内核
#========================
restart_mihomo_kernel() {
    show_title

    # 验证用户权限
    if ! request_sudo_permission; then
        wait_for_key
        continue
    fi

    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_RESTART_TITLE)"
    show_separator

    if ! require_core_dir; then
        return
    fi

    # 先关闭内核
    kill_mihomo_kernel

    # 清除标题和分隔线
    clear_screen

    # 再启动内核
    start_mihomo_kernel
}

#========================
# 内核控制菜单
#========================
manage_kernel_menu() {
    while true; do
        show_title

        # 验证用户权限
        if ! request_sudo_permission; then
            wait_for_key
            continue
        fi

        show_separator
        log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_KERNEL_MENU_TITLE)"
        show_separator

        # 显示当前内核状态
        check_mihomo_status

        log_blank
        log_fmt "${BLUE}$(tr_msg MSG_KERNEL_MENU_PROMPT)${NC}"
        log_fmt "  $(tr_msg MSG_MENU_START)"
        log_fmt "  $(tr_msg MSG_MENU_STOP)"
        log_fmt "  $(tr_msg MSG_MENU_RESTART)"
        log_fmt "  $(tr_msg MSG_MENU_BACK)"
        log_blank

        read -p "$(tr_msg MSG_MENU_CHOICE_0_3)" CHOICE

        case "$CHOICE" in
            1)
                start_mihomo_kernel
                ;;
            2)
                kill_mihomo_kernel
                ;;
            3)
                restart_mihomo_kernel
                ;;
            0)
                return
                ;;
            *)
                log_error "$(tr_msg MSG_MENU_INVALID)"
                wait_for_key
                ;;
        esac
    done
}

#========================
# 查看 Mihomo 内核日志
#========================
show_logs() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_LOGS_TITLE)"
    show_separator

    LOG_FILE="$CLASHFOX_LOG_DIR/clashfox.log"

    if [ ! -f "$LOG_FILE" ]; then
        log_warning "$(tr_msg MSG_LOG_FILE_MISSING "$LOG_FILE")"
        log_warning "$(tr_msg MSG_LOG_FILE_HINT)"
        wait_for_key
        return
    fi

    log_fmt "${BLUE}$(tr_msg MSG_LOG_FILE_PATH "$LOG_FILE")"
    log_fmt "${BLUE}$(tr_msg MSG_LOG_FILE_SIZE "$(du -h "$LOG_FILE" | cut -f1)")"
    log_fmt "${BLUE}$(tr_msg MSG_LOG_FILE_LINES "$(wc -l < "$LOG_FILE")")"
    log_blank

    log_fmt "${GREEN}$(tr_msg MSG_LOG_VIEW_OPTIONS)${NC}"
    log_fmt "  $(tr_msg MSG_LOG_OPTION_TAIL)"
    log_fmt "  $(tr_msg MSG_LOG_OPTION_FOLLOW)"
    log_fmt "  $(tr_msg MSG_LOG_OPTION_LESS)"
    log_fmt "  $(tr_msg MSG_LOG_OPTION_BACK)"
    log_blank

    read -p "$(tr_msg MSG_MENU_CHOICE_0_3)" CHOICE

    case "$CHOICE" in
        1)
            log_blank
            log_fmt "${BLUE}$(tr_msg MSG_LOG_TAIL_HEADER)"
            log_fmt "------------------------------------------------------------------------"
            tail -n 50 "$LOG_FILE"
            log_fmt "------------------------------------------------------------------------"
            wait_for_key
            ;;
        2)
            log_blank
            log_fmt "${BLUE}$(tr_msg MSG_LOG_FOLLOW_HEADER)"
            log_fmt "------------------------------------------------------------------------"
            tail -f "$LOG_FILE"
            log_blank
            ;;
        3)
            log_blank
            log_fmt "${BLUE}$(tr_msg MSG_LOG_LESS_HEADER)"
            log_fmt "------------------------------------------------------------------------"
            less "$LOG_FILE"
            ;;
        0)
            return
            ;;
        *)
            log_error "$(tr_msg MSG_MENU_INVALID)"
            wait_for_key
            ;;
    esac

    # 再次显示日志菜单，方便连续查看
    show_logs
}

#========================
# 显示帮助信息
#========================
show_help() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_HELP)" "$(tr_msg MSG_HELP_TITLE)"
    show_separator
    log_fmt "${BLUE}$(tr_msg MSG_HELP_ARGS)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_DIR_ARG)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_LANG_ARG)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_STATUS)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_LIST)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_SWITCH)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_LOGS)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_CLEAN)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_HELP)${NC}"
    log_fmt "${BLUE}$(tr_msg MSG_HELP_VERSION)${NC}"
    log_blank
    log_fmt "${BLUE}$(tr_msg MSG_HELP_MENU)${NC}"
    print_menu_two_cols "$(tr_msg MSG_MENU_INSTALL)" "$(tr_msg MSG_MENU_CONTROL)" "$GRAY" "$NC"
    print_menu_two_cols "$(tr_msg MSG_MENU_STATUS)" "$(tr_msg MSG_MENU_SWITCH)" "$GRAY" "$NC"
    print_menu_two_cols "$(tr_msg MSG_MENU_LIST)" "$(tr_msg MSG_MENU_LOGS)" "$GRAY" "$NC"
    print_menu_two_cols "$(tr_msg MSG_MENU_CLEAN)" "$(tr_msg MSG_MENU_HELP)" "$GRAY" "$NC"
    log_fmt "  ${GRAY}$(tr_msg MSG_MENU_EXIT)${NC}"
    log_blank
    log_warning "$(tr_msg MSG_HELP_NOTE)"

    wait_for_key
}

#========================
# 清理旧日志文件
#========================
clean_logs() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_CLEAN_TITLE)"
    show_separator

    LOG_FILE="$CLASHFOX_LOG_DIR/clashfox.log"
    LOG_BACKUPS="$CLASHFOX_LOG_DIR/clashfox.log.*.log"

    log_fmt "${BLUE}$(tr_msg MSG_CLEAN_CURRENT_LOG "$LOG_FILE")"
    log_fmt "${BLUE}$(tr_msg MSG_CLEAN_LOG_SIZE "$(du -h "$LOG_FILE" 2>/dev/null | cut -f1)")"
    log_fmt "${BLUE}$(tr_msg MSG_CLEAN_OLD_COUNT "$(ls -l $LOG_BACKUPS 2>/dev/null | wc -l)")"
    log_fmt "${BLUE}$(tr_msg MSG_CLEAN_OLD_SIZE "$(du -ch $LOG_BACKUPS 2>/dev/null | tail -n 1 | cut -f1)")"
    log_blank

    log_fmt "${GREEN}$(tr_msg MSG_CLEAN_OPTIONS)${NC}"
    log_fmt "  $(tr_msg MSG_CLEAN_ALL)"
    log_fmt "  $(tr_msg MSG_CLEAN_7D)"
    log_fmt "  $(tr_msg MSG_CLEAN_30D)"
    log_fmt "  $(tr_msg MSG_CLEAN_CANCEL)"
    log_blank

    read -p "$(tr_msg MSG_CLEAN_PROMPT)" CHOICE

    case "$CHOICE" in
        1)
            rm -f $LOG_BACKUPS
            rm -f "$CLASHFOX_LOG_DIR"/clashfox.log.*.gz
            log_success "$(tr_msg MSG_CLEAN_DONE_ALL)"
            ;;
        2)
            # 保留最近7天的日志
            find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.log" -mtime +7 -delete
            find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.gz" -mtime +7 -delete
            log_success "$(tr_msg MSG_CLEAN_DONE_7D)"
            ;;
        3)
            # 保留最近30天的日志
            find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.log" -mtime +30 -delete
            find "$CLASHFOX_LOG_DIR" -name "clashfox.log.*.gz" -mtime +30 -delete
            log_success "$(tr_msg MSG_CLEAN_DONE_30D)"
            ;;
        0)
            log_warning "$(tr_msg MSG_CLEAN_CANCELLED)"
            ;;
        *)
            log_error "$(tr_msg MSG_CLEAN_INVALID)"
            ;;
    esac

    wait_for_key
}

#========================
# 日志滚动功能（支持按大小和按日期备份）
#========================
rotate_logs() {
    LOG_FILE="$CLASHFOX_LOG_DIR/clashfox.log"
    MAX_SIZE=10  # MB
    BACKUP_DIR="$CLASHFOX_LOG_DIR"
    CURRENT_DATE=$(date +%Y%m%d)

    if [ ! -f "$LOG_FILE" ]; then
        return
    fi

    # 检查日志的最后修改日期
    if [ -f "$LOG_FILE" ]; then
        LOG_MODIFY_TS=$(stat -f "%Sm" -t "%Y%m%d_%H%M%S" "$LOG_FILE")
        LOG_MODIFY_DATE="${LOG_MODIFY_TS%%_*}"

        # 如果日志是昨天或更早的，进行日期备份（文件名包含日期+时分秒）
        if [ "$LOG_MODIFY_DATE" != "$CURRENT_DATE" ]; then
            DATE_BACKUP_FILE="$BACKUP_DIR/clashfox.log.$LOG_MODIFY_TS.log"

            # 如果备份文件已存在，添加时间戳避免覆盖
            if [ -f "$DATE_BACKUP_FILE" ]; then
                DATE_BACKUP_FILE="$BACKUP_DIR/clashfox.log.$LOG_MODIFY_TS.$(date +%H%M%S).log"
            fi

            # 直接复制日志，不做压缩
            cp "$LOG_FILE" "$DATE_BACKUP_FILE"
            # 清空当前日志
            > "$LOG_FILE"
            log_warning "$(tr_msg MSG_LOG_ROTATE_DATE "$DATE_BACKUP_FILE")"
        fi
    fi

    # 保留按大小滚动的功能
    LOG_SIZE=$(du -m "$LOG_FILE" | cut -f1)
    if [ "$LOG_SIZE" -ge "$MAX_SIZE" ]; then
        # 创建带时间戳的备份文件
        SIZE_BACKUP_FILE="$BACKUP_DIR/clashfox.log.$(date +%Y%m%d_%H%M%S).log"
        cp "$LOG_FILE" "$SIZE_BACKUP_FILE"
        # 清空当前日志
        > "$LOG_FILE"
        log_warning "$(tr_msg MSG_LOG_ROTATE_SIZE "$SIZE_BACKUP_FILE")"
    fi
}

#========================
# 显示主菜单
#========================
show_main_menu() {
    show_title
    show_separator
    log_highlight "$(tr_msg LABEL_STATUS)" "$(tr_msg MSG_MAIN_STATUS_TITLE)"
    show_separator
    check_mihomo_status
    log_blank
    show_separator
    log_highlight "$(tr_msg LABEL_FUNCTION)" "$(tr_msg MSG_MAIN_MENU_TITLE)"
    show_separator
    log_fmt "${BLUE}$(tr_msg MSG_MAIN_PROMPT)${NC}"
    print_menu_two_cols "$(tr_msg MSG_MENU_INSTALL)" "$(tr_msg MSG_MENU_CONTROL)"
    print_menu_two_cols "$(tr_msg MSG_MENU_STATUS)" "$(tr_msg MSG_MENU_SWITCH)"
    print_menu_two_cols "$(tr_msg MSG_MENU_LIST)" "$(tr_msg MSG_MENU_LOGS)"
    print_menu_two_cols "$(tr_msg MSG_MENU_CLEAN)" "$(tr_msg MSG_MENU_HELP)"
    log_fmt "  $(tr_msg MSG_MENU_EXIT)"
    log_blank
}

#========================
# 程序退出时的清理函数
#========================
cleanup() {
    # 只在有实际清理操作时才输出日志
    if [ -n "$LOG_CHECKER_PID" ]; then
        # 终止日志检查后台进程
        log_fmt "${BLUE}$(tr_msg MSG_CLEANUP_STOPPING "$LOG_CHECKER_PID")"

        # 先尝试正常终止
        kill "$LOG_CHECKER_PID" 2>/dev/null

        # 等待进程终止
        local timeout=5
        while ps -p "$LOG_CHECKER_PID" > /dev/null 2>&1 && [ $timeout -gt 0 ]; do
            sleep 1
            ((timeout--))
        done

        # 如果进程仍然存在，尝试强制终止
        if ps -p "$LOG_CHECKER_PID" > /dev/null 2>&1; then
            log_fmt "${BLUE}$(tr_msg MSG_CLEANUP_FORCE)"
            kill -9 "$LOG_CHECKER_PID" 2>/dev/null
        fi

        # 等待进程终止
        wait "$LOG_CHECKER_PID" 2>/dev/null

        # 输出终止结果
        if ps -p "$LOG_CHECKER_PID" > /dev/null 2>&1; then
            log_fmt "${BLUE}$(tr_msg MSG_CLEANUP_FAIL "$LOG_CHECKER_PID")"
        else
            log_success "$(tr_msg MSG_CLEANUP_OK)"
        fi
    fi
}

# 注册退出处理函数 - 只处理异常退出
trap 'cleanup; log_fmt "${RED}$(tr_msg MSG_EXIT_ABNORMAL)${NC}"; exit 1' SIGINT SIGTERM SIGTSTP

#========================
# 命令行参数解析
#========================
parse_arguments() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -d|--directory)
                shift
                if [ -n "$1" ]; then
                    # 确保目录以ClashFox结尾
                    if [[ "$1" != *"/ClashFox"* ]]; then
                        if [[ "$1" == */ ]]; then
                            CLASHFOX_DIR="${1}ClashFox"
                        else
                            CLASHFOX_DIR="${1}/ClashFox"
                        fi
                    else
                        CLASHFOX_DIR="$1"
                    fi
                    set_clashfox_subdirectories

                    # 保存选择的目录
                    save_directory

                    shift
                else
                    log_error "$(tr_msg MSG_ARG_DIR_REQUIRED)"
                    exit 1
                fi
                ;;
            -l|--lang)
                shift
                if [ -n "$1" ]; then
                    case "$1" in
                        zh|en|ja|ko|fr|de|ru|auto)
                            CLASHFOX_LANG="$1"
                            ;;
                        *)
                            log_error "$(tr_msg MSG_ARG_LANG_INVALID "$1")"
                            exit 1
                            ;;
                    esac
                    shift
                else
                    log_error "$(tr_msg MSG_ARG_LANG_REQUIRED)"
                    exit 1
                fi
                ;;
            --lang=*|-l=*)
                LANG_VALUE="${1#*=}"
                if [ -n "$LANG_VALUE" ]; then
                    case "$LANG_VALUE" in
                        zh|en|ja|ko|fr|de|ru|auto)
                            CLASHFOX_LANG="$LANG_VALUE"
                            ;;
                        *)
                            log_error "$(tr_msg MSG_ARG_LANG_INVALID "$LANG_VALUE")"
                            exit 1
                            ;;
                    esac
                else
                    log_error "$(tr_msg MSG_ARG_LANG_REQUIRED)"
                    exit 1
                fi
                shift
                ;;
            status)
                show_status
                exit 0
                ;;
            list)
                show_list_backups
                exit 0
                ;;
            switch)
                switch_core
                exit 0
                ;;
            logs|log)
                show_logs
                exit 0
                ;;
            clean|clear)
                clean_logs
                exit 0
                ;;
            help|-h)
                show_help
                exit 0
                ;;
            version|-v)
                show_title
                exit 0
                ;;
            *)
                if [ -n "$1" ]; then
                    log_error "$(tr_msg MSG_UNKNOWN_COMMAND "$1")"
                    log_warning "$(tr_msg MSG_AVAILABLE_COMMANDS)"
                    log_warning "$(tr_msg MSG_AVAILABLE_ARGS)"
                    exit 1
                fi
                ;;
        esac
    done
}

#========================
# 读取保存的自定义目录
#========================
read_saved_directory() {
    # 配置文件路径
    CONFIG_FILE="$HOME/.clashfox/config"

    # 如果配置文件存在且可读
    if [ -f "$CONFIG_FILE" ] && [ -r "$CONFIG_FILE" ]; then
        # 读取保存的目录
        SAVED_DIR=$(cat "$CONFIG_FILE")

        # 验证保存的目录是否有效
        if [ -n "$SAVED_DIR" ]; then
            CLASHFOX_DIR="$SAVED_DIR"
            set_clashfox_subdirectories
            log_success "$(tr_msg MSG_SAVED_DIR_LOADED "$CLASHFOX_DIR")"
            return 0
        fi
    fi

    # 没有找到有效配置，使用默认目录
    log_warning "$(tr_msg MSG_SAVED_DIR_NOT_FOUND "$CLASHFOX_DIR")"
    return 1
}

# 读取保存的自定义目录
read_saved_directory

#========================
# 保存自定义目录到配置文件
#========================
save_directory() {
    # 配置文件路径
    CONFIG_FILE="$HOME/.clashfox/config"

    # 创建配置文件目录
    mkdir -p "$(dirname "$CONFIG_FILE")"

    # 保存当前目录到配置文件
    echo "$CLASHFOX_DIR" > "$CONFIG_FILE"

    # 设置权限
    chmod 600 "$CONFIG_FILE"

    log_success "$(tr_msg MSG_DIR_SAVED "$CONFIG_FILE")"
    return 0
}

#========================
# 主程序
#========================
main() {
    # 检查是否有命令行参数
    if [ $# -gt 0 ]; then
        parse_arguments "$@"
    fi
    show_title

    # 程序启动时请求一次sudo权限
    if ! request_sudo_permission; then
        wait_for_key
        exit 1  # 改为exit，因为这里不是循环结构
    fi

    # 交互式询问用户是否修改默认目录 - 仅首次使用时提示
    if [ ! -d "$CLASHFOX_DIR" ]; then
        show_separator
        log_highlight "$(tr_msg LABEL_INIT)" "$(tr_msg MSG_DIR_SELECT_TITLE)"
        show_separator
        log_fmt "$(tr_msg MSG_DEFAULT_DIR_CURRENT "${GREEN}$CLASHFOX_DIR${NC}")"
        log_blank
        read -p "$(tr_msg MSG_USE_DEFAULT_DIR)" USE_DEFAULT_DIR

        if [[ ! "$USE_DEFAULT_DIR" =~ ^[Yy]$ ]]; then
            read -p "$(tr_msg MSG_CUSTOM_DIR_PROMPT)" CUSTOM_DIR

            # 验证目录路径
            if [ -n "$CUSTOM_DIR" ]; then
                # 确保目录以ClashFox结尾
                if [[ "$CUSTOM_DIR" != *"/ClashFox"* ]]; then
                    if [[ "$CUSTOM_DIR" == */ ]]; then
                        CLASHFOX_DIR="${CUSTOM_DIR}ClashFox"
                    else
                        CLASHFOX_DIR="${CUSTOM_DIR}/ClashFox"
                    fi
                else
                    CLASHFOX_DIR="$CUSTOM_DIR"
                fi
                set_clashfox_subdirectories
                log_success "$(tr_msg MSG_DIR_SET "$CLASHFOX_DIR")"

                # 保存选择的目录
                save_directory
            else
                log_warning "$(tr_msg MSG_DIR_INVALID_FALLBACK "$CLASHFOX_DIR")"
            fi
        else
            log_success "$(tr_msg MSG_DIR_USE_DEFAULT "$CLASHFOX_DIR")"

            # 保存选择的目录
            save_directory
        fi
        log_blank
        sleep 3
    else
        # 非首次使用，直接使用现有目录
        set_clashfox_subdirectories
        log_success "$(tr_msg MSG_DIR_EXISTING "$CLASHFOX_DIR")"
    fi

    # 调用日志回滚
    rotate_logs

    # 确保所有必要目录都已创建
    if ! require_core_dir; then
        return
    fi

    # 启动定期检查日志的后台进程（每30分钟检查一次）
    log_fmt "${BLUE}$(tr_msg MSG_LOG_CHECKER_START)"
    while true; do
        # 定期调用日志滚动函数
        rotate_logs
        # 等待30分钟
        sleep 1800
        # 检查主进程是否还在运行，不在则退出
        kill -0 "$$" || exit 0
    done 2>/dev/null &

    # 保存后台进程的PID
    LOG_CHECKER_PID=$!
    log_success "$(tr_msg MSG_LOG_CHECKER_OK "$LOG_CHECKER_PID")"
    log_blank

    # 检查 ClashFox 应用是否安装
    log_fmt "${BLUE}$(tr_msg MSG_APP_CHECK)"

    if [ ! -d "$CLASHFOX_DIR" ]; then
        log_warning "$(tr_msg MSG_APP_DIR_MISSING)"
        log_fmt "$(tr_msg MSG_APP_DIR_TARGET "$CLASHFOX_DIR")"
        # 如果主目录不存在，先创建主目录
        mkdir -p "$CLASHFOX_DIR"
        log_success "$(tr_msg MSG_APP_DIR_CREATED "$CLASHFOX_DIR")"
        log_blank
    else
        log_success "$(tr_msg MSG_APP_DIR_EXISTS "$CLASHFOX_DIR")"
        log_blank
    fi

    # 主循环
    while true; do
        show_main_menu

        read -p "$(tr_msg MSG_MAIN_CHOICE)" CHOICE

        case "$CHOICE" in
            1)
                install_core
                ;;
            2)
                manage_kernel_menu
                ;;
            3)
                show_status
                ;;
            4)
                switch_core
                ;;
            5)
                show_list_backups
                ;;
            6)
                show_logs
                ;;
            7)
                clean_logs
                ;;
            8)
                show_help
                ;;
            0)
                # 先执行清理操作
                log_blank
                cleanup
                log_blank
                # 然后输出感谢信息，确保它是最后一行
                log_fmt "${GREEN}$(tr_msg MSG_EXIT_THANKS)${NC}"
                exit 0
                ;;
            *)
                log_error "$(tr_msg MSG_MENU_INVALID)"
                wait_for_key
                ;;
        esac
    done
}

# 执行主程序（仅在直接运行时）
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
