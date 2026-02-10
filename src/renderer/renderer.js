const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const panels = Array.from(document.querySelectorAll('.panel'));
const toast = document.getElementById('toast');
const pageId = document.body ? document.body.dataset.page : '';

const statusRunning = document.getElementById('statusRunning');
const statusVersion = document.getElementById('statusVersion');
const statusKernelPath = document.getElementById('statusKernelPath');
const statusConfig = document.getElementById('statusConfig');
const statusKernelPathRow = document.getElementById('statusKernelPathRow');
const statusConfigRow = document.getElementById('statusConfigRow');
const statusPill = document.getElementById('statusPill');
const overviewUptime = document.getElementById('overviewUptime');
const overviewConnections = document.getElementById('overviewConnections');
const overviewMemory = document.getElementById('overviewMemory');
const overviewStatus = document.getElementById('overviewStatus');
const overviewKernel = document.getElementById('overviewKernel');
const overviewSystem = document.getElementById('overviewSystem');
const overviewVersion = document.getElementById('overviewVersion');
const overviewInternet = document.getElementById('overviewInternet');
const overviewDns = document.getElementById('overviewDns');
const overviewRouter = document.getElementById('overviewRouter');
const overviewNetwork = document.getElementById('overviewNetwork');
const overviewLocalIp = document.getElementById('overviewLocalIp');
const overviewProxyIp = document.getElementById('overviewProxyIp');
const overviewInternetIp = document.getElementById('overviewInternetIp');
const trafficSystemDownloadRate = document.getElementById('trafficSystemDownloadRate');
const trafficSystemDownloadTotal = document.getElementById('trafficSystemDownloadTotal');
const trafficSystemUploadRate = document.getElementById('trafficSystemUploadRate');
const trafficSystemUploadTotal = document.getElementById('trafficSystemUploadTotal');
const trafficProxyDownloadRate = document.getElementById('trafficProxyDownloadRate');
const trafficProxyDownloadTotal = document.getElementById('trafficProxyDownloadTotal');
const trafficProxyUploadRate = document.getElementById('trafficProxyUploadRate');
const trafficProxyUploadTotal = document.getElementById('trafficProxyUploadTotal');
const quickHintNodes = Array.from(document.querySelectorAll('[data-i18n="status.quickHint"]'));

// IP地址隐私保护函数
function maskIpAddress(ip) {
  if (!ip || ip === '-') return ip;
  
  // 处理IPv4地址
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // 保留前两段，后两段替换为星号
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  
  // 处理IPv6地址（简化处理）
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      // 保留前两段和后两段，中间替换为星号
      return `${parts[0]}:${parts[1]}:****:****:****:****:${parts[parts.length-2]}:${parts[parts.length-1]}`;
    }
  }
  
  return ip;
}
const overviewNetworkRefresh = document.getElementById('overviewNetworkRefresh');

const githubUser = document.getElementById('githubUser');
const installBtn = document.getElementById('installBtn');
const installStatus = document.getElementById('installStatus');
const installProgress = document.getElementById('installProgress');
const installVersionRow = document.getElementById('installVersionRow');
const installVersion = document.getElementById('installVersion');
const cancelInstallBtn = document.getElementById('cancelInstallBtn');
const configPathInput = document.getElementById('configPath');
const overviewConfigPath = document.getElementById('overviewConfigPath');
const overviewBrowseConfig = document.getElementById('overviewBrowseConfig');
const overviewConfigReset = document.getElementById('overviewConfigReset');
const browseConfigBtn = document.getElementById('browseConfig');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');
const refreshStatusBtn = document.getElementById('refreshStatus');
const refreshBackups = document.getElementById('refreshBackups');
const backupsRefresh = document.getElementById('backupsRefresh');
const switchBtn = document.getElementById('switchBtn');
const backupTable = document.getElementById('backupTable');
const backupTableFull = document.getElementById('backupTableFull');
const configsRefresh = document.getElementById('configsRefresh');
const configTable = document.getElementById('configTable');
const kernelTable = document.getElementById('kernelTable');
const kernelRefresh = document.getElementById('kernelRefresh');
const kernelPrev = document.getElementById('kernelPrev');
const kernelNext = document.getElementById('kernelNext');
const kernelPageInfo = document.getElementById('kernelPageInfo');
const kernelPageSize = document.getElementById('kernelPageSize');
const switchPrev = document.getElementById('switchPrev');
const switchNext = document.getElementById('switchNext');
const switchPageInfo = document.getElementById('switchPageInfo');
const switchPageSize = document.getElementById('switchPageSize');
const backupsPrev = document.getElementById('backupsPrev');
const backupsNext = document.getElementById('backupsNext');
const backupsPageInfo = document.getElementById('backupsPageInfo');
const backupsPageSize = document.getElementById('backupsPageSize');
const backupsDelete = document.getElementById('backupsDelete');
const logLines = document.getElementById('logLines');
const logRefresh = document.getElementById('logRefresh');
const logContent = document.getElementById('logContent');
const logAutoRefresh = document.getElementById('logAutoRefresh');
const logIntervalPreset = document.getElementById('logIntervalPreset');
const cleanBtn = document.getElementById('cleanBtn');
const sudoModal = document.getElementById('sudoModal');
const sudoPassword = document.getElementById('sudoPassword');
const sudoCancel = document.getElementById('sudoCancel');
const sudoConfirm = document.getElementById('sudoConfirm');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmBody = document.getElementById('confirmBody');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');
const appName = document.getElementById('appName');
const appVersion = document.getElementById('appVersion');
const themeToggle = document.getElementById('themeToggle');
const settingsTheme = document.getElementById('settingsTheme');
const settingsLang = document.getElementById('settingsLang');
const settingsGithubUser = document.getElementById('settingsGithubUser');
const settingsConfigPath = document.getElementById('settingsConfigPath');
const settingsBrowseConfig = document.getElementById('settingsBrowseConfig');
const settingsKernelPath = document.getElementById('settingsKernelPath');
const settingsConfigDefault = document.getElementById('settingsConfigDefault');
const settingsLogPath = document.getElementById('settingsLogPath');
const settingsConfigDir = document.getElementById('settingsConfigDir');
const settingsCoreDir = document.getElementById('settingsCoreDir');
const settingsDataDir = document.getElementById('settingsDataDir');
const settingsConfigDirBrowse = document.getElementById('settingsConfigDirBrowse');
const settingsCoreDirBrowse = document.getElementById('settingsCoreDirBrowse');
const settingsDataDirBrowse = document.getElementById('settingsDataDirBrowse');
const settingsConfigDirReset = document.getElementById('settingsConfigDirReset');
const settingsCoreDirReset = document.getElementById('settingsCoreDirReset');
const settingsDataDirReset = document.getElementById('settingsDataDirReset');
const settingsLogLines = document.getElementById('settingsLogLines');
const settingsLogAutoRefresh = document.getElementById('settingsLogAutoRefresh');
const settingsLogIntervalPreset = document.getElementById('settingsLogIntervalPreset');
const settingsSwitchPageSize = document.getElementById('settingsSwitchPageSize');
const settingsBackupsPageSize = document.getElementById('settingsBackupsPageSize');
const settingsDebugMode = document.getElementById('settingsDebugMode');

const langButtons = Array.from(document.querySelectorAll('.lang-btn'));

const I18N = {
  en: {
    language: 'Language',
    nav: {
      status: 'Overview',
      install: 'Install / Update',
      config: 'Config',
      switch: 'Switch Kernel',
      backups: 'Backups',
      logs: 'Logs',
      settings: 'Settings',
      help: 'Help',
    },
    overview: {
      runningTitle: 'Running Status',
      networkTitle: 'Network Status',
      uptime: 'Uptime',
      connections: 'Connections',
      memory: 'Memory',
      statusLabel: 'Status',
      kernel: 'Kernel',
      system: 'System',
      version: 'Version',
      internet: 'Internet',
      internetIp: 'Internet IP',
      dns: 'DNS',
      router: 'Router',
      network: 'Network',
      localIp: 'Local IP',
      proxyIp: 'Proxy IP',
      connected: 'Connected',
    },
    topbar: {
      eyebrow: 'Kernel Dashboard',
      title: 'Mihomo Control Center',
    },
    status: {
      core: 'Core Status',
      running: 'Running',
      version: 'Version',
      kernelPath: 'Kernel Path',
      config: 'Default Config',
      quick: 'Quick Actions',
      quickHint: 'Actions use the default config unless a custom path is set in Control.',
      quickHintMissing: 'Kernel not installed. Please install it first.',
      trafficTitle: 'Traffic Stats',
      trafficHint: 'Updated every 1 second.',
      trafficSystemDown: 'Download',
      trafficSystemUp: 'Upload',
      trafficProxyDown: 'Proxy Download',
      trafficProxyUp: 'Proxy Upload',
      trafficTotal: 'Total',
    },
    install: {
      title: 'Install / Update Mihomo',
      github: 'GitHub Source',
      version: 'Version',
      versionPlaceholder: 'e.g. v1.19.0',
      action: 'Install / Update',
      cancel: 'Cancel',
      ready: 'Ready to install.',
      progress: 'Installing kernel...',
      done: 'Install completed.',
      failed: 'Install failed.',
      cancelSuccess: 'Installation cancelled',
      cancelFailed: 'Failed to cancel installation',
      hint: 'Downloads the latest kernel for your architecture and backs up the previous one.',
      kernelsTitle: 'Kernel List',
      kernelsHint: 'Read-only list of available cores.',
    },
    control: {
      title: 'Config Control',
      config: 'Config Path',
      browse: 'Browse',
      refresh: 'Refresh',
    },
    switch: {
      title: 'Switch Kernel',
      refresh: 'Refresh Backups',
      action: 'Switch to Selected',
    },
    backups: {
      title: 'Backup Inventory',
      refresh: 'Refresh Backups',
      selectAll: 'Select all',
      delete: 'Delete',
    },
    logs: {
      title: 'ClashFlox Logs',
      lines: 'Lines',
      refresh: 'Refresh',
      auto: 'Auto refresh',
      interval: 'Interval',
    },
    clean: {
      title: 'Clean Logs',
      all: 'Delete all backups',
      '7d': 'Keep last 7 days',
      '30d': 'Keep last 30 days',
      action: 'Clean Logs',
    },
    pagination: {
      size: 'Per page',
    },
    help: {
      title: 'Help & Notes',
      line1: 'This GUI invokes the original ClashFox Mihomo Toolkit script under the hood.',
      line2: 'Some actions require sudo and may prompt for your macOS password.',
      line3: 'If you are running on non-macOS, the toolkit functions are disabled.',
    },
    actions: {
      start: 'Start',
      stop: 'Stop',
      restart: 'Restart',
      refresh: 'Refresh',
      startTip: 'Start Mihomo with default config',
      stopTip: 'Stop Mihomo service',
      restartTip: 'Restart Mihomo immediately',
    },
    table: {
      index: '#',
      version: 'Version',
      time: 'Backup Time',
      name: 'Name',
      path: 'Path',
      modified: 'Modified',
      size: 'Size',
      current: 'Current',
    },
    labels: {
      running: 'Running',
      stopped: 'Stopped',
      unknown: 'Unknown',
      notInstalled: 'Not installed',
      noBackups: 'No backups found.',
      configsEmpty: 'No configs found.',
      kernelsEmpty: 'No kernels found.',
      current: 'Current',
      configsRefreshed: 'Configs refreshed.',
      statusRefreshed: 'Status refreshed.',
      backupsRefreshed: 'Backups refreshed.',
      startSuccess: 'Kernel started.',
      restartSuccess: 'Kernel restarted.',
      bridgeMissing: 'Bridge unavailable.',
      sudoInvalid: 'Password incorrect.',
      alreadyRunning: 'Kernel is already running.',
      alreadyStopped: 'Kernel is already stopped.',
      restartStarts: 'Kernel is stopped, starting now.',
      switchNeedsRestart: 'Switch completed. Please restart the kernel.',
      configNeedsRestart: 'Config updated. Please restart the kernel.',
      selectBackup: 'Select a backup first.',
      installSuccess: 'Install request sent.',
      installFailed: 'Install failed. Try using backups to restore.',
      switchSuccess: 'Switch request sent.',
      logMissing: 'Log file not found.',
      cleanDone: 'Cleanup completed.',
      deleteSuccess: 'Deleted selected backups.',
      deleteEmpty: 'Select backups to delete.',
    },
    sudo: {
      title: 'Authorization Required',
      body: 'Enter your macOS password to continue.',
      cancel: 'Cancel',
      confirm: 'Authorize',
      hint: 'Password is only used for this action and not stored.',
    },
    confirm: {
      title: 'Please Confirm',
      body: 'Are you sure you want to continue?',
      resetTitle: 'Reset to Default?',
      resetBody: 'Reset this path to the default location for',
      resetConfirm: 'Reset',
      deleteTitle: 'Delete Backups?',
      deleteBody: 'This will delete the selected backups and cannot be undone.',
      deleteConfirm: 'Delete',
      switchTitle: 'Switch Kernel?',
      switchBody: 'Switch to the selected backup version now?',
      switchConfirm: 'Switch',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    theme: {
      toDay: 'Switch to day mode',
      toNight: 'Switch to night mode',
    },
    settings: {
      appearance: 'Appearance',
      theme: 'Theme',
      themeNight: 'Night',
      themeDay: 'Day',
      themeAuto: 'Auto',
      language: 'Language',
      defaults: 'Defaults',
      paths: 'Paths',
      pathsReset: 'Reset to Default',
      reset: 'Reset',
      github: 'GitHub Source',
      configPath: 'Config Path',
      kernelPath: 'Kernel Path',
      configDefault: 'Default Config',
      logPath: 'Log Path',
      configDir: 'Config Dir',
      coreDir: 'Core Dir',
      dataDir: 'Data Dir',
      logs: 'Log Settings',
      pagination: 'Pagination',
      switchPageSize: 'Switch Page Size',
      backupsPageSize: 'Backups Page Size',
      debugMode: 'Debug Mode',
      debugModeLabel: 'Enable Debug Mode',
    },
  },
  zh: {
    language: '语言',
    nav: {
      status: '概览',
      install: '安装 / 更新',
      config: '配置',
      switch: '切换内核',
      backups: '备份',
      logs: '日志',
      settings: '设置',
      help: '帮助',
    },
    overview: {
      runningTitle: '运行状态',
      networkTitle: '网络状态',
      uptime: '运行时长',
      connections: '连接数',
      memory: '内存',
      statusLabel: '状态',
      kernel: '内核',
      system: '系统',
      version: '版本',
      internet: '互联网',
      internetIp: '互联网 IP',
      dns: 'DNS',
      router: '路由器',
      network: '网络',
      localIp: '本地 IP',
      proxyIp: '代理 IP',
      connected: '已连接',
    },
    topbar: {
      eyebrow: '内核仪表盘',
      title: 'Mihomo 控制中心',
    },
    status: {
      core: '内核状态',
      running: '运行中',
      version: '版本',
      kernelPath: '内核路径',
      config: '默认配置',
      quick: '快捷操作',
      quickHint: '快捷操作使用默认配置，除非在控制页指定自定义路径。',
      quickHintMissing: '未安装内核，请先前往安装。',
      trafficTitle: '流量统计',
      trafficHint: '每 1 秒更新一次。',
      trafficSystemDown: '下载',
      trafficSystemUp: '上传',
      trafficProxyDown: '代理下载',
      trafficProxyUp: '代理上传',
      trafficTotal: '总量',
    },
    install: {
      title: '安装 / 更新 Mihomo',
      github: 'GitHub 源',
      version: '版本',
      versionPlaceholder: '例如 v1.19.0',
      action: '安装 / 更新',
      ready: '准备安装。',
      progress: '正在安装内核...',
      done: '安装完成。',
      failed: '安装失败。',
      cancelSuccess: '安装已取消',
      cancelFailed: '取消安装失败',
      hint: '下载适配架构的最新内核，并备份当前版本。',
      kernelsTitle: '内核列表',
      kernelsHint: '仅供浏览的核心文件列表。',
    },
    control: {
      title: '配置控制',
      config: '配置路径',
      browse: '浏览',
      refresh: '刷新',
    },
    switch: {
      title: '切换内核',
      refresh: '刷新备份',
      action: '切换到所选版本',
    },
    backups: {
      title: '备份清单',
      refresh: '刷新备份',
      selectAll: '全选',
      delete: '删除所选',
    },
    logs: {
      title: '内核日志',
      lines: '行数',
      refresh: '刷新',
      auto: '自动刷新',
      interval: '间隔',
    },
    clean: {
      title: '清理日志',
      all: '删除全部旧日志',
      '7d': '保留最近 7 天',
      '30d': '保留最近 30 天',
      action: '清理日志',
    },
    pagination: {
      size: '每页',
    },
    help: {
      title: '帮助与说明',
      line1: '此 GUI 在后台调用 ClashFox Mihomo Toolkit 脚本。',
      line2: '部分操作需要 sudo 权限，可能会提示输入 macOS 密码。',
      line3: '如果运行在非 macOS 系统，工具功能会被禁用。',
    },
    actions: {
      start: '启动',
      stop: '停止',
      restart: '重启',
      refresh: '刷新',
      startTip: '使用默认配置启动',
      stopTip: '停止内核服务',
      restartTip: '立即重启内核',
    },
    table: {
      index: '序号',
      version: '版本',
      time: '备份时间',
      name: '文件名',
      path: '路径',
      modified: '修改时间',
      size: '大小',
      current: '当前',
    },
    labels: {
      running: '运行中',
      stopped: '已停止',
      unknown: '未知',
      notInstalled: '未安装',
      noBackups: '没有可用备份。',
      configsEmpty: '没有可用配置。',
      kernelsEmpty: '没有可用内核。',
      current: '当前',
      configsRefreshed: '配置已刷新。',
      statusRefreshed: '状态已刷新。',
      backupsRefreshed: '备份已刷新。',
      startSuccess: '内核已启动。',
      restartSuccess: '内核已重启。',
      bridgeMissing: '桥接服务不可用。',
      sudoInvalid: '密码不正确。',
      alreadyRunning: '内核已在运行。',
      alreadyStopped: '内核已停止。',
      restartStarts: '内核未运行，正在启动。',
      switchNeedsRestart: '切换完成，请重启内核。',
      configNeedsRestart: '配置已更新，请重启内核。',
      selectBackup: '请先选择一个备份。',
      installSuccess: '已发送安装请求。',
      installFailed: '安装失败。请尝试使用备份恢复。',
      switchSuccess: '已发送切换请求。',
      logMissing: '日志文件不存在。',
      cleanDone: '清理完成。',
      deleteSuccess: '已删除所选备份。',
      deleteEmpty: '请选择要删除的备份。',
    },
    sudo: {
      title: '授权请求',
      body: '需要管理员权限才能继续操作。',
      cancel: '取消',
      confirm: '授权',
      hint: '密码仅用于本次操作，不会被保存。',
    },
    confirm: {
      title: '请确认',
      body: '确定要继续吗？',
      resetTitle: '重置为默认？',
      resetBody: '重置为默认路径：',
      resetConfirm: '重置',
      deleteTitle: '删除备份？',
      deleteBody: '将删除所选备份，且无法恢复。',
      deleteConfirm: '删除',
      switchTitle: '切换内核？',
      switchBody: '确定切换到所选备份版本吗？',
      switchConfirm: '切换',
      cancel: '取消',
      confirm: '确认',
    },
    theme: {
      toDay: '切换到日间模式',
      toNight: '切换到夜间模式',
    },
    settings: {
      appearance: '外观',
      theme: '主题',
      themeNight: '夜间',
      themeDay: '日间',
      themeAuto: '自动',
      language: '语言',
      defaults: '默认设置',
      paths: '路径',
      pathsReset: '重置为默认',
      reset: '重置',
      github: 'GitHub 源',
      configPath: '配置路径',
      kernelPath: '内核路径',
      configDefault: '默认配置',
      logPath: '日志路径',
      configDir: '配置目录',
      coreDir: '内核目录',
      dataDir: '数据目录',
      logs: '日志设置',
      pagination: '分页',
      switchPageSize: '切换页大小',
      backupsPageSize: '备份页大小',
      debugMode: '调试模式',
      debugModeLabel: '启用调试模式',
    },
  },
  ja: {
    language: '言語',
    nav: {
      status: '概要',
      install: 'インストール / 更新',
      config: '設定',
      switch: 'カーネル切替',
      backups: 'バックアップ',
      logs: 'ログ',
      settings: '設定',
      help: 'ヘルプ',
    },
    overview: {
      runningTitle: '稼働状況',
      networkTitle: 'ネットワーク状況',
      uptime: '稼働時間',
      connections: '接続数',
      memory: 'メモリ',
      statusLabel: '状態',
      kernel: 'カーネル',
      system: 'システム',
      version: 'バージョン',
      internet: 'インターネット',
      internetIp: 'インターネット IP',
      dns: 'DNS',
      router: 'ルーター',
      network: 'ネットワーク',
      localIp: 'ローカル IP',
      proxyIp: 'プロキシ IP',
      connected: '接続済み',
    },
    topbar: {
      eyebrow: 'カーネルダッシュボード',
      title: 'Mihomo コントロールセンター',
    },
    status: {
      core: 'コア状態',
      running: '稼働中',
      version: 'バージョン',
      kernelPath: 'カーネルパス',
      config: '既定の設定',
      quick: 'クイック操作',
      quickHint: 'コントロールでカスタムパスが設定されていない場合、既定の設定を使用します。',
      quickHintMissing: 'カーネル未インストールです。先にインストールしてください。',
      trafficTitle: 'トラフィック統計',
      trafficHint: '1 秒ごとに更新します。',
      trafficSystemDown: '受信',
      trafficSystemUp: '送信',
      trafficProxyDown: 'プロキシ受信',
      trafficProxyUp: 'プロキシ送信',
      trafficTotal: '合計',
    },
    install: {
      title: 'Mihomo のインストール / 更新',
      github: 'GitHub ソース',
      version: '版本',
      versionPlaceholder: '例: v1.19.0',
      action: 'インストール / 更新',
      ready: 'インストールの準備ができました。',
      progress: 'カーネルをインストール中...',
      done: 'インストールが完了しました。',
      failed: 'インストールに失敗しました。',
      cancelSuccess: 'インストールはキャンセルされました',
      cancelFailed: 'インストールのキャンセルに失敗しました',
      hint: 'アーキテクチャに適した最新カーネルをダウンロードし、前のバージョンをバックアップします。',
      kernelsTitle: 'カーネル一覧',
      kernelsHint: '閲覧専用のコア一覧です。',
    },
    control: {
      title: '設定コントロール',
      config: '設定パス',
      browse: '参照',
      refresh: '更新',
    },
    switch: {
      title: 'カーネル切替',
      refresh: 'バックアップを更新',
      action: '選択したバージョンへ切替',
    },
    backups: {
      title: 'バックアップ一覧',
      refresh: 'バックアップを更新',
      selectAll: 'すべて選択',
      delete: '削除',
    },
    logs: {
      title: 'カーネルログ',
      lines: '行数',
      refresh: '更新',
      auto: '自動更新',
      interval: '間隔',
    },
    clean: {
      title: 'ログの削除',
      all: '古いログをすべて削除',
      '7d': '最近 7 日間を保持',
      '30d': '最近 30 日間を保持',
      action: 'ログの削除',
    },
    pagination: {
      size: '1ページあたり',
    },
    help: {
      title: 'ヘルプ & メモ',
      line1: 'この GUI は内部で ClashFox Mihomo Toolkit スクリプトを実行します。',
      line2: '一部の操作には sudo が必要で、macOS のパスワードを求められる場合があります。',
      line3: 'macOS 以外の場合、ツール機能は無効になります。',
    },
    actions: {
      start: '開始',
      stop: '停止',
      restart: '再起動',
      refresh: '更新',
      startTip: '既定の設定で起動',
      stopTip: 'カーネルを停止',
      restartTip: 'すぐに再起動',
    },
    table: {
      index: '番号',
      version: 'バージョン',
      time: 'バックアップ時間',
      name: 'ファイル名',
      path: 'パス',
      modified: '更新日時',
      size: 'サイズ',
      current: '現在',
    },
    labels: {
      running: '稼働中',
      stopped: '停止中',
      unknown: '不明',
      notInstalled: '未インストール',
      noBackups: 'バックアップが見つかりません。',
      configsEmpty: '設定が見つかりません。',
      kernelsEmpty: 'カーネルが見つかりません。',
      current: '現在',
      configsRefreshed: '設定を更新しました。',
      statusRefreshed: '状態を更新しました。',
      backupsRefreshed: 'バックアップを更新しました。',
      startSuccess: 'カーネルを起動しました。',
      restartSuccess: 'カーネルを再起動しました。',
      bridgeMissing: 'ブリッジが利用できません。',
      sudoInvalid: 'パスワードが正しくありません。',
      alreadyRunning: 'カーネルは既に稼働中です。',
      alreadyStopped: 'カーネルは停止しています。',
      restartStarts: '停止中のため起動します。',
      switchNeedsRestart: '切替完了。カーネルを再起動してください。',
      configNeedsRestart: '設定を更新しました。カーネルを再起動してください。',
      selectBackup: '先にバックアップを選択してください。',
      installSuccess: 'インストール要求を送信しました。',
      switchSuccess: '切替要求を送信しました。',
      logMissing: 'ログファイルが見つかりません。',
      cleanDone: '削除が完了しました。',
      deleteSuccess: '選択したバックアップを削除しました。',
      deleteEmpty: '削除するバックアップを選択してください。',
    },
    sudo: {
      title: '認証が必要',
      body: '続行するには macOS のパスワードを入力してください。',
      cancel: 'キャンセル',
      confirm: '認証',
      hint: 'パスワードはこの操作のみに使用され、保存されません。',
    },
    confirm: {
      title: '確認してください',
      body: '続行してもよろしいですか？',
      resetTitle: 'デフォルトに戻しますか？',
      resetBody: 'このパスをデフォルトに戻します：',
      resetConfirm: 'リセット',
      deleteTitle: 'バックアップを削除しますか？',
      deleteBody: '選択したバックアップは削除され、元に戻せません。',
      deleteConfirm: '削除',
      switchTitle: 'カーネルを切替えますか？',
      switchBody: '選択したバックアップ版に切替えますか？',
      switchConfirm: '切替',
      cancel: 'キャンセル',
      confirm: '確認',
    },
    theme: {
      toDay: '日中モードに切り替え',
      toNight: '夜間モードに切り替え',
    },
    settings: {
      appearance: '外観',
      theme: 'テーマ',
      themeNight: '夜間',
      themeDay: '日中',
      themeAuto: '自動',
      language: '言語',
      defaults: '既定値',
      paths: 'パス',
      pathsReset: 'デフォルトにリセット',
      reset: 'リセット',
      github: 'GitHub ソース',
      configPath: '設定パス',
      kernelPath: 'カーネルパス',
      configDefault: '既定設定',
      logPath: 'ログパス',
      configDir: '設定ディレクトリ',
      coreDir: 'コアディレクトリ',
      dataDir: 'データディレクトリ',
      logs: 'ログ設定',
      pagination: 'ページング',
      switchPageSize: '切替ページサイズ',
      backupsPageSize: 'バックアップページサイズ',
      debugMode: 'デバッグモード',
      debugModeLabel: 'デバッグモードを有効にする',
    },
  },
  ko: {
    language: '언어',
    nav: {
      status: '개요',
      install: '설치 / 업데이트',
      config: '설정',
      switch: '커널 전환',
      backups: '백업',
      logs: '로그',
      settings: '설정',
      help: '도움말',
    },
    overview: {
      runningTitle: '실행 상태',
      networkTitle: '네트워크 상태',
      uptime: '가동 시간',
      connections: '연결 수',
      memory: '메모리',
      statusLabel: '상태',
      kernel: '커널',
      system: '시스템',
      version: '버전',
      internet: '인터넷',
      internetIp: '인터넷 IP',
      dns: 'DNS',
      router: '라우터',
      network: '네트워크',
      localIp: '로컬 IP',
      proxyIp: '프록시 IP',
      connected: '연결됨',
    },
    topbar: {
      eyebrow: '커널 대시보드',
      title: 'Mihomo 제어 센터',
    },
    status: {
      core: '코어 상태',
      running: '실행 중',
      version: '버전',
      kernelPath: '커널 경로',
      config: '기본 설정',
      quick: '빠른 작업',
      quickHint: '컨트롤에서 사용자 경로를 지정하지 않으면 기본 설정을 사용합니다.',
      quickHintMissing: '커널이 설치되지 않았습니다. 먼저 설치하세요.',
      trafficTitle: '트래픽 통계',
      trafficHint: '1초마다 업데이트됩니다.',
      trafficSystemDown: '다운로드',
      trafficSystemUp: '업로드',
      trafficProxyDown: '프록시 다운로드',
      trafficProxyUp: '프록시 업로드',
      trafficTotal: '총량',
    },
    install: {
      title: 'Mihomo 설치 / 업데이트',
      github: 'GitHub 소스',
      version: '버전',
      versionPlaceholder: '예: v1.19.0',
      action: '설치 / 업데이트',
      ready: '설치를 준비합니다.',
      progress: '커널을 설치하는 중...',
      done: '설치가 완료되었습니다.',
      failed: '설치에 실패했습니다.',
      cancelSuccess: '설치가 취소되었습니다',
      cancelFailed: '설치 취소에 실패했습니다',
      hint: '아키텍처에 맞는 최신 커널을 다운로드하고 이전 버전을 백업합니다.',
      kernelsTitle: '커널 목록',
      kernelsHint: '읽기 전용 코어 목록입니다.',
    },
    control: {
      title: '설정 제어',
      config: '설정 경로',
      browse: '찾아보기',
      refresh: '새로고침',
    },
    switch: {
      title: '커널 전환',
      refresh: '백업 새로고침',
      action: '선택한 버전으로 전환',
    },
    backups: {
      title: '백업 목록',
      refresh: '백업 새로고침',
      selectAll: '전체 선택',
      delete: '삭제',
    },
    logs: {
      title: '커널 로그',
      lines: '줄 수',
      refresh: '새로고침',
      auto: '자동 새로고침',
      interval: '간격',
    },
    clean: {
      title: '로그 정리',
      all: '오래된 로그 모두 삭제',
      '7d': '최근 7일 유지',
      '30d': '최근 30일 유지',
      action: '로그 정리',
    },
    pagination: {
      size: '페이지당',
    },
    help: {
      title: '도움말 및 안내',
      line1: '이 GUI는 내부적으로 ClashFox Mihomo Toolkit 스크립트를 실행합니다.',
      line2: '일부 작업은 sudo 권한이 필요하며 macOS 비밀번호를 요청할 수 있습니다.',
      line3: 'macOS가 아닌 경우 도구 기능이 비활성화됩니다.',
    },
    actions: {
      start: '시작',
      stop: '중지',
      restart: '재시작',
      refresh: '새로고침',
      startTip: '기본 설정으로 시작',
      stopTip: '커널을 중지',
      restartTip: '즉시 재시작',
    },
    table: {
      index: '#',
      version: '버전',
      time: '백업 시간',
      name: '파일명',
      path: '경로',
      modified: '수정 시간',
      size: '크기',
      current: '현재',
    },
    labels: {
      running: '실행 중',
      stopped: '중지됨',
      unknown: '알 수 없음',
      notInstalled: '미설치',
      noBackups: '백업이 없습니다.',
      configsEmpty: '설정을 찾을 수 없습니다.',
      kernelsEmpty: '커널을 찾을 수 없습니다.',
      current: '현재',
      configsRefreshed: '설정을 새로고침했습니다.',
      statusRefreshed: '상태를 새로고침했습니다.',
      backupsRefreshed: '백업을 새로고침했습니다.',
      startSuccess: '커널을 시작했습니다.',
      restartSuccess: '커널을 재시작했습니다.',
      bridgeMissing: '브리지 서비스를 사용할 수 없습니다.',
      sudoInvalid: '비밀번호가 올바르지 않습니다.',
      alreadyRunning: '커널이 이미 실행 중입니다.',
      alreadyStopped: '커널이 이미 중지되었습니다.',
      restartStarts: '커널이 중지되어 있어 시작합니다.',
      switchNeedsRestart: '전환 완료. 커널을 재시작하세요.',
      configNeedsRestart: '설정을 업데이트했습니다. 커널을 재시작하세요.',
      selectBackup: '먼저 백업을 선택하세요.',
      installSuccess: '설치 요청을 보냈습니다.',
      switchSuccess: '전환 요청을 보냈습니다.',
      logMissing: '로그 파일이 없습니다.',
      cleanDone: '정리가 완료되었습니다.',
      deleteSuccess: '선택한 백업을 삭제했습니다.',
      deleteEmpty: '삭제할 백업을 선택하세요.',
    },
    sudo: {
      title: '권한 필요',
      body: '계속하려면 macOS 비밀번호를 입력하세요.',
      cancel: '취소',
      confirm: '인증',
      hint: '비밀번호는 이번 작업에만 사용되며 저장되지 않습니다.',
    },
    confirm: {
      title: '확인해주세요',
      body: '계속하시겠습니까?',
      resetTitle: '기본값으로 되돌릴까요?',
      resetBody: '이 경로를 기본값으로 되돌립니다:',
      resetConfirm: '재설정',
      deleteTitle: '백업을 삭제할까요?',
      deleteBody: '선택한 백업이 삭제되며 되돌릴 수 없습니다.',
      deleteConfirm: '삭제',
      switchTitle: '커널을 전환할까요?',
      switchBody: '선택한 백업 버전으로 전환하시겠습니까?',
      switchConfirm: '전환',
      cancel: '취소',
      confirm: '확인',
    },
    theme: {
      toDay: '주간 모드로 전환',
      toNight: '야간 모드로 전환',
    },
    settings: {
      appearance: '모양',
      theme: '테마',
      themeNight: '야간',
      themeDay: '주간',
      themeAuto: '자동',
      language: '언어',
      defaults: '기본값',
      paths: '경로',
      pathsReset: '기본값으로 재설정',
      reset: '재설정',
      github: 'GitHub 소스',
      configPath: '설정 경로',
      kernelPath: '커널 경로',
      configDefault: '기본 설정',
      logPath: '로그 경로',
      configDir: '설정 디렉터리',
      coreDir: '코어 디렉터리',
      dataDir: '데이터 디렉터리',
      logs: '로그 설정',
      pagination: '페이지네이션',
      switchPageSize: '전환 페이지 크기',
      backupsPageSize: '백업 페이지 크기',
      debugMode: '디버그 모드',
      debugModeLabel: '디버그 모드 활성화',
    },
  },
  fr: {
    language: 'Langue',
    nav: {
      status: 'Apercu',
      install: 'Installer / Mettre à jour',
      config: 'Configuration',
      switch: 'Changer le noyau',
      backups: 'Sauvegardes',
      logs: 'Journaux',
      settings: 'Paramètres',
      help: 'Aide',
    },
    overview: {
      runningTitle: 'Statut d\'execution',
      networkTitle: 'Statut du réseau',
      uptime: 'Temps de fonctionnement',
      connections: 'Connexions',
      memory: 'Mémoire',
      statusLabel: 'Statut',
      kernel: 'Noyau',
      system: 'Système',
      version: 'Version',
      internet: 'Internet',
      internetIp: 'IP Internet',
      dns: 'DNS',
      router: 'Routeur',
      network: 'Réseau',
      localIp: 'IP locale',
      proxyIp: 'IP proxy',
      connected: 'Connecté',
    },
    topbar: {
      eyebrow: 'Tableau de bord du noyau',
      title: 'Centre de contrôle Mihomo',
    },
    status: {
      core: 'État du noyau',
      running: 'En marche',
      version: 'Version',
      kernelPath: 'Chemin du noyau',
      config: 'Configuration par défaut',
      quick: 'Actions rapides',
      quickHint: 'Les actions utilisent la configuration par défaut sauf si un chemin personnalisé est défini dans Contrôle.',
      quickHintMissing: 'Noyau non installé. Veuillez l’installer d’abord.',
      trafficTitle: 'Statistiques de trafic',
      trafficHint: 'Mise à jour toutes les 1 seconde.',
      trafficSystemDown: 'Téléchargement',
      trafficSystemUp: 'Téléversement',
      trafficProxyDown: 'Téléchargement proxy',
      trafficProxyUp: 'Téléversement proxy',
      trafficTotal: 'Total',
    },
    install: {
      title: 'Installer / Mettre à jour Mihomo',
      github: 'Source GitHub',
      version: 'Version',
      versionPlaceholder: 'ex : v1.19.0',
      action: 'Installer / Mettre à jour',
      ready: 'Prêt à installer.',
      progress: 'Installation du noyau...',
      done: 'Installation terminée.',
      failed: 'Échec de l’installation.',
      cancelSuccess: 'Installation annulée',
      cancelFailed: 'Échec de l’annulation de l’installation',
      hint: 'Télécharge le dernier noyau pour votre architecture et sauvegarde la version précédente.',
      kernelsTitle: 'Liste des noyaux',
      kernelsHint: 'Liste en lecture seule des cœurs disponibles.',
    },
    control: {
      title: 'Contrôle de configuration',
      config: 'Chemin de configuration',
      browse: 'Parcourir',
      refresh: 'Actualiser',
    },
    switch: {
      title: 'Changer le noyau',
      refresh: 'Actualiser les sauvegardes',
      action: 'Basculer vers la version sélectionnée',
    },
    backups: {
      title: 'Inventaire des sauvegardes',
      refresh: 'Actualiser les sauvegardes',
      selectAll: 'Tout sélectionner',
      delete: 'Supprimer',
    },
    logs: {
      title: 'Journaux du noyau',
      lines: 'Lignes',
      refresh: 'Actualiser',
      auto: 'Actualisation automatique',
      interval: 'Intervalle',
    },
    clean: {
      title: 'Nettoyer les journaux',
      all: 'Supprimer tous les anciens journaux',
      '7d': 'Conserver les 7 derniers jours',
      '30d': 'Conserver les 30 derniers jours',
      action: 'Nettoyer les journaux',
    },
    pagination: {
      size: 'Par page',
    },
    help: {
      title: 'Aide & Notes',
      line1: 'Cette interface appelle le script ClashFox Mihomo Toolkit en arrière-plan.',
      line2: 'Certaines actions exigent sudo et peuvent demander votre mot de passe macOS.',
      line3: 'Si vous n’êtes pas sur macOS, les fonctions sont désactivées.',
    },
    actions: {
      start: 'Démarrer',
      stop: 'Arrêter',
      restart: 'Redémarrer',
      refresh: 'Actualiser',
      startTip: 'Démarrer avec la configuration par défaut',
      stopTip: 'Arrêter le noyau',
      restartTip: 'Redémarrer immédiatement',
    },
    table: {
      index: '#',
      version: 'Version',
      time: 'Heure de sauvegarde',
      name: 'Nom',
      path: 'Chemin',
      modified: 'Modifié',
      size: 'Taille',
      current: 'Actuelle',
    },
    labels: {
      running: 'En marche',
      stopped: 'Arrêté',
      unknown: 'Inconnu',
      notInstalled: 'Non installé',
      noBackups: 'Aucune sauvegarde trouvée.',
      configsEmpty: 'Aucune configuration trouvée.',
      kernelsEmpty: 'Aucun noyau trouvé.',
      current: 'Actuelle',
      configsRefreshed: 'Configurations actualisées.',
      statusRefreshed: 'Statut actualisé.',
      backupsRefreshed: 'Sauvegardes actualisées.',
      startSuccess: 'Noyau démarré.',
      restartSuccess: 'Noyau redémarré.',
      bridgeMissing: 'Pont indisponible.',
      sudoInvalid: 'Mot de passe incorrect.',
      alreadyRunning: 'Le noyau est déjà en marche.',
      alreadyStopped: 'Le noyau est déjà arrêté.',
      restartStarts: 'Le noyau est arrêté, démarrage en cours.',
      switchNeedsRestart: 'Bascule terminée. Redémarrez le noyau.',
      configNeedsRestart: 'Configuration mise à jour. Redémarrez le noyau.',
      selectBackup: 'Sélectionnez d’abord une sauvegarde.',
      installSuccess: 'Demande d’installation envoyée.',
      switchSuccess: 'Demande de bascule envoyée.',
      logMissing: 'Fichier journal introuvable.',
      cleanDone: 'Nettoyage terminé.',
      deleteSuccess: 'Sauvegardes sélectionnées supprimées.',
      deleteEmpty: 'Sélectionnez des sauvegardes à supprimer.',
    },
    sudo: {
      title: 'Autorisation requise',
      body: 'Entrez votre mot de passe macOS pour continuer.',
      cancel: 'Annuler',
      confirm: 'Autoriser',
      hint: 'Le mot de passe est utilisé uniquement pour cette action et n’est pas stocké.',
    },
    confirm: {
      title: 'Veuillez confirmer',
      body: 'Voulez-vous vraiment continuer ?',
      resetTitle: 'Rétablir par défaut ?',
      resetBody: 'Réinitialiser ce chemin par défaut :',
      resetConfirm: 'Réinitialiser',
      deleteTitle: 'Supprimer les sauvegardes ?',
      deleteBody: 'Les sauvegardes sélectionnées seront supprimées définitivement.',
      deleteConfirm: 'Supprimer',
      switchTitle: 'Changer le noyau ?',
      switchBody: 'Basculer vers la version sélectionnée ?',
      switchConfirm: 'Basculer',
      cancel: 'Annuler',
      confirm: 'Confirmer',
    },
    theme: {
      toDay: 'Passer en mode jour',
      toNight: 'Passer en mode nuit',
    },
    settings: {
      appearance: 'Apparence',
      theme: 'Thème',
      themeNight: 'Nuit',
      themeDay: 'Jour',
      themeAuto: 'Auto',
      language: 'Langue',
      defaults: 'Valeurs par défaut',
      paths: 'Chemins',
      pathsReset: 'Réinitialiser par défaut',
      reset: 'Réinitialiser',
      github: 'Source GitHub',
      configPath: 'Chemin de configuration',
      kernelPath: 'Chemin du noyau',
      configDefault: 'Config par défaut',
      logPath: 'Chemin des journaux',
      configDir: 'Dossier config',
      coreDir: 'Dossier core',
      dataDir: 'Dossier data',
      logs: 'Paramètres des journaux',
      pagination: 'Pagination',
      switchPageSize: 'Taille de page pour la bascule',
      backupsPageSize: 'Taille de page des sauvegardes',
      debugMode: 'Mode débogage',
      debugModeLabel: 'Activer le mode débogage',
    },
  },
  de: {
    language: 'Sprache',
    nav: {
      status: 'Übersicht',
      install: 'Installieren / Aktualisieren',
      config: 'Konfiguration',
      switch: 'Kernel wechseln',
      backups: 'Backups',
      logs: 'Logs',
      settings: 'Einstellungen',
      help: 'Hilfe',
    },
    overview: {
      runningTitle: 'Laufstatus',
      networkTitle: 'Netzwerkstatus',
      uptime: 'Laufzeit',
      connections: 'Verbindungen',
      memory: 'Speicher',
      statusLabel: 'Status',
      kernel: 'Kernel',
      system: 'System',
      version: 'Version',
      internet: 'Internet',
      internetIp: 'Internet IP',
      dns: 'DNS',
      router: 'Router',
      network: 'Netzwerk',
      localIp: 'Lokale IP',
      proxyIp: 'Proxy-IP',
      connected: 'Verbunden',
    },
    topbar: {
      eyebrow: 'Kernel-Dashboard',
      title: 'Mihomo Kontrollzentrum',
    },
    status: {
      core: 'Kernelstatus',
      running: 'Läuft',
      version: 'Version',
      kernelPath: 'Kernelpfad',
      config: 'Standardkonfiguration',
      quick: 'Schnellaktionen',
      quickHint: 'Aktionen verwenden die Standardkonfiguration, sofern kein benutzerdefinierter Pfad in Steuerung gesetzt ist.',
      quickHintMissing: 'Kernel nicht installiert. Bitte zuerst installieren.',
      trafficTitle: 'Datenverkehr',
      trafficHint: 'Aktualisiert jede Sekunde.',
      trafficSystemDown: 'Download',
      trafficSystemUp: 'Upload',
      trafficProxyDown: 'Proxy Download',
      trafficProxyUp: 'Proxy Upload',
      trafficTotal: 'Gesamt',
    },
    install: {
      title: 'Mihomo installieren / aktualisieren',
      github: 'GitHub-Quelle',
      version: 'Version',
      versionPlaceholder: 'z. B. v1.19.0',
      action: 'Installieren / Aktualisieren',
      ready: 'Bereit zur Installation.',
      progress: 'Kernel wird installiert...',
      done: 'Installation abgeschlossen.',
      failed: 'Installation fehlgeschlagen.',
      cancelSuccess: 'Installation abgebrochen',
      cancelFailed: 'Abbruch der Installation fehlgeschlagen',
      hint: 'Lädt den neuesten Kernel für Ihre Architektur und sichert die vorherige Version.',
      kernelsTitle: 'Kernel-Liste',
      kernelsHint: 'Nur-Lesen-Liste der verfügbaren Kerne.',
    },
    control: {
      title: 'Konfigurationssteuerung',
      config: 'Konfigurationspfad',
      browse: 'Durchsuchen',
      refresh: 'Aktualisieren',
    },
    switch: {
      title: 'Kernel wechseln',
      refresh: 'Backups aktualisieren',
      action: 'Auf ausgewählte Version wechseln',
    },
    backups: {
      title: 'Backup-Übersicht',
      refresh: 'Backups aktualisieren',
      selectAll: 'Alle auswählen',
      delete: 'Löschen',
    },
    logs: {
      title: 'Kernel-Logs',
      lines: 'Zeilen',
      refresh: 'Aktualisieren',
      auto: 'Automatisch aktualisieren',
      interval: 'Intervall',
    },
    clean: {
      title: 'Logs bereinigen',
      all: 'Alle alten Logs löschen',
      '7d': 'Letzte 7 Tage behalten',
      '30d': 'Letzte 30 Tage behalten',
      action: 'Logs bereinigen',
    },
    pagination: {
      size: 'Pro Seite',
    },
    help: {
      title: 'Hilfe & Hinweise',
      line1: 'Diese GUI ruft im Hintergrund das ClashFox Mihomo Toolkit-Skript auf.',
      line2: 'Einige Aktionen erfordern sudo und können nach Ihrem macOS-Passwort fragen.',
      line3: 'Wenn Sie nicht unter macOS laufen, sind die Toolkit-Funktionen deaktiviert.',
    },
    actions: {
      start: 'Starten',
      stop: 'Stoppen',
      restart: 'Neu starten',
      refresh: 'Aktualisieren',
      startTip: 'Mit Standardkonfiguration starten',
      stopTip: 'Kernel stoppen',
      restartTip: 'Sofort neu starten',
    },
    table: {
      index: '#',
      version: 'Version',
      time: 'Backup-Zeit',
      name: 'Name',
      path: 'Pfad',
      modified: 'Geändert',
      size: 'Größe',
      current: 'Aktuell',
    },
    labels: {
      running: 'Läuft',
      stopped: 'Gestoppt',
      unknown: 'Unbekannt',
      notInstalled: 'Nicht installiert',
      noBackups: 'Keine Backups gefunden.',
      configsEmpty: 'Keine Konfigurationen gefunden.',
      kernelsEmpty: 'Keine Kernel gefunden.',
      current: 'Aktuell',
      configsRefreshed: 'Konfigurationen aktualisiert.',
      statusRefreshed: 'Status aktualisiert.',
      backupsRefreshed: 'Backups aktualisiert.',
      startSuccess: 'Kernel gestartet.',
      restartSuccess: 'Kernel neu gestartet.',
      bridgeMissing: 'Bridge nicht verfügbar.',
      sudoInvalid: 'Passwort falsch.',
      alreadyRunning: 'Kernel läuft bereits.',
      alreadyStopped: 'Kernel ist bereits gestoppt.',
      restartStarts: 'Kernel ist gestoppt, starte jetzt.',
      switchNeedsRestart: 'Wechsel abgeschlossen. Kernel bitte neu starten.',
      configNeedsRestart: 'Konfiguration aktualisiert. Kernel neu starten.',
      selectBackup: 'Bitte zuerst ein Backup auswählen.',
      installSuccess: 'Installationsanfrage gesendet.',
      switchSuccess: 'Wechselanfrage gesendet.',
      logMissing: 'Logdatei nicht gefunden.',
      cleanDone: 'Bereinigung abgeschlossen.',
      deleteSuccess: 'Ausgewählte Backups gelöscht.',
      deleteEmpty: 'Backups zum Löschen auswählen.',
    },
    sudo: {
      title: 'Autorisierung erforderlich',
      body: 'Geben Sie Ihr macOS-Passwort ein, um fortzufahren.',
      cancel: 'Abbrechen',
      confirm: 'Autorisieren',
      hint: 'Passwort wird nur für diese Aktion verwendet und nicht gespeichert.',
    },
    confirm: {
      title: 'Bitte bestätigen',
      body: 'Möchten Sie wirklich fortfahren?',
      resetTitle: 'Auf Standard zurücksetzen?',
      resetBody: 'Diesen Pfad auf Standard zurücksetzen:',
      resetConfirm: 'Zurücksetzen',
      deleteTitle: 'Backups löschen?',
      deleteBody: 'Die ausgewählten Backups werden endgültig gelöscht.',
      deleteConfirm: 'Löschen',
      switchTitle: 'Kernel wechseln?',
      switchBody: 'Zur ausgewählten Backup-Version wechseln?',
      switchConfirm: 'Wechseln',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
    },
    theme: {
      toDay: 'Zum Tagmodus wechseln',
      toNight: 'Zum Nachtmodus wechseln',
    },
    settings: {
      appearance: 'Erscheinungsbild',
      theme: 'Thema',
      themeNight: 'Nacht',
      themeDay: 'Tag',
      themeAuto: 'Auto',
      language: 'Sprache',
      defaults: 'Voreinstellungen',
      paths: 'Pfade',
      pathsReset: 'Auf Standard zurücksetzen',
      reset: 'Zurücksetzen',
      github: 'GitHub-Quelle',
      configPath: 'Konfigurationspfad',
      kernelPath: 'Kernelpfad',
      configDefault: 'Standardkonfig',
      logPath: 'Logpfad',
      configDir: 'Konfigordner',
      coreDir: 'Core-Ordner',
      dataDir: 'Datenordner',
      logs: 'Log-Einstellungen',
      pagination: 'Paginierung',
      switchPageSize: 'Seitengröße Umschalten',
      backupsPageSize: 'Seitengröße Backups',
      debugMode: 'Debug-Modus',
      debugModeLabel: 'Debug-Modus aktivieren',
    },
  },
  ru: {
    language: 'Язык',
    nav: {
      status: 'Обзор',
      install: 'Установка / Обновление',
      config: 'Конфигурация',
      switch: 'Смена ядра',
      backups: 'Резервные копии',
      logs: 'Журналы',
      settings: 'Настройки',
      help: 'Помощь',
    },
    overview: {
      runningTitle: 'Состояние работы',
      networkTitle: 'Состояние сети',
      uptime: 'Время работы',
      connections: 'Подключения',
      memory: 'Память',
      statusLabel: 'Статус',
      kernel: 'Ядро',
      system: 'Система',
      version: 'Версия',
      internet: 'Интернет',
      internetIp: 'Интернет IP',
      dns: 'DNS',
      router: 'Маршрутизатор',
      network: 'Сеть',
      localIp: 'Локальный IP',
      proxyIp: 'Прокси IP',
      connected: 'Подключено',
    },
    topbar: {
      eyebrow: 'Панель ядра',
      title: 'Центр управления Mihomo',
    },
    status: {
      core: 'Состояние ядра',
      running: 'Работает',
      version: 'Версия',
      kernelPath: 'Путь к ядру',
      config: 'Конфигурация по умолчанию',
      quick: 'Быстрые действия',
      quickHint: 'Действия используют конфигурацию по умолчанию, если в разделе Управление не задан пользовательский путь.',
      quickHintMissing: 'Ядро не установлено. Сначала установите его.',
      trafficTitle: 'Статистика трафика',
      trafficHint: 'Обновляется каждую секунду.',
      trafficSystemDown: 'Загрузка',
      trafficSystemUp: 'Отдача',
      trafficProxyDown: 'Прокси загрузка',
      trafficProxyUp: 'Прокси отдача',
      trafficTotal: 'Всего',
    },
    install: {
      title: 'Установка / обновление Mihomo',
      github: 'Источник GitHub',
      version: 'Версия',
      versionPlaceholder: 'например v1.19.0',
      action: 'Установить / обновить',
      ready: 'Готово к установке.',
      progress: 'Установка ядра...',
      done: 'Установка завершена.',
      failed: 'Ошибка установки.',
      cancelSuccess: 'Установка отменена',
      cancelFailed: 'Не удалось отменить установку',
      hint: 'Загружает последнюю версию ядра для вашей архитектуры и делает резервную копию предыдущей.',
      kernelsTitle: 'Список ядер',
      kernelsHint: 'Список доступных ядер только для просмотра.',
    },
    control: {
      title: 'Управление конфигурацией',
      config: 'Путь к конфигурации',
      browse: 'Обзор',
      refresh: 'Обновить',
    },
    switch: {
      title: 'Смена ядра',
      refresh: 'Обновить резервные копии',
      action: 'Переключить на выбранную версию',
    },
    backups: {
      title: 'Список резервных копий',
      refresh: 'Обновить резервные копии',
      selectAll: 'Выбрать все',
      delete: 'Удалить',
    },
    logs: {
      title: 'Журналы ядра',
      lines: 'Строки',
      refresh: 'Обновить',
      auto: 'Автообновление',
      interval: 'Интервал',
    },
    clean: {
      title: 'Очистка журналов',
      all: 'Удалить все старые журналы',
      '7d': 'Хранить последние 7 дней',
      '30d': 'Хранить последние 30 дней',
      action: 'Очистить журналы',
    },
    pagination: {
      size: 'На страницу',
    },
    help: {
      title: 'Помощь и заметки',
      line1: 'Этот интерфейс вызывает скрипт ClashFox Mihomo Toolkit.',
      line2: 'Некоторые действия требуют sudo и могут запросить пароль macOS.',
      line3: 'Если вы не на macOS, функции инструмента отключены.',
    },
    actions: {
      start: 'Запустить',
      stop: 'Остановить',
      restart: 'Перезапустить',
      refresh: 'Обновить',
      startTip: 'Запуск с настройками по умолчанию',
      stopTip: 'Остановить ядро',
      restartTip: 'Перезапустить сразу',
    },
    table: {
      index: '#',
      version: 'Версия',
      time: 'Время резервной копии',
      name: 'Имя',
      path: 'Путь',
      modified: 'Изменено',
      size: 'Размер',
      current: 'Текущая',
    },
    labels: {
      running: 'Работает',
      stopped: 'Остановлено',
      unknown: 'Неизвестно',
      notInstalled: 'Не установлено',
      noBackups: 'Резервные копии не найдены.',
      configsEmpty: 'Конфигурации не найдены.',
      kernelsEmpty: 'Ядра не найдены.',
      current: 'Текущая',
      configsRefreshed: 'Конфигурации обновлены.',
      statusRefreshed: 'Статус обновлен.',
      backupsRefreshed: 'Резервные копии обновлены.',
      startSuccess: 'Ядро запущено.',
      restartSuccess: 'Ядро перезапущено.',
      bridgeMissing: 'Мост недоступен.',
      sudoInvalid: 'Пароль неверный.',
      alreadyRunning: 'Ядро уже запущено.',
      alreadyStopped: 'Ядро уже остановлено.',
      restartStarts: 'Ядро остановлено, запускаем.',
      switchNeedsRestart: 'Переключение завершено. Перезапустите ядро.',
      configNeedsRestart: 'Конфигурация обновлена. Перезапустите ядро.',
      selectBackup: 'Сначала выберите резервную копию.',
      installSuccess: 'Запрос на установку отправлен.',
      switchSuccess: 'Запрос на переключение отправлен.',
      logMissing: 'Файл журнала не найден.',
      cleanDone: 'Очистка завершена.',
      deleteSuccess: 'Выбранные резервные копии удалены.',
      deleteEmpty: 'Выберите резервные копии для удаления.',
    },
    sudo: {
      title: 'Требуется авторизация',
      body: 'Введите пароль macOS для продолжения.',
      cancel: 'Отмена',
      confirm: 'Авторизовать',
      hint: 'Пароль используется только для этого действия и не сохраняется.',
    },
    confirm: {
      title: 'Подтвердите действие',
      body: 'Вы уверены, что хотите продолжить?',
      resetTitle: 'Сбросить по умолчанию?',
      resetBody: 'Сбросить путь по умолчанию:',
      resetConfirm: 'Сбросить',
      deleteTitle: 'Удалить резервные копии?',
      deleteBody: 'Выбранные резервные копии будут удалены без возможности восстановления.',
      deleteConfirm: 'Удалить',
      switchTitle: 'Переключить ядро?',
      switchBody: 'Переключить на выбранную резервную версию?',
      switchConfirm: 'Переключить',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
    },
    theme: {
      toDay: 'Переключить на дневной режим',
      toNight: 'Переключить на ночной режим',
    },
    settings: {
      appearance: 'Внешний вид',
      theme: 'Тема',
      themeNight: 'Ночной',
      themeDay: 'Дневной',
      themeAuto: 'Авто',
      language: 'Язык',
      defaults: 'По умолчанию',
      paths: 'Пути',
      pathsReset: 'Сбросить по умолчанию',
      reset: 'Сбросить',
      github: 'Источник GitHub',
      configPath: 'Путь к конфигурации',
      kernelPath: 'Путь ядра',
      configDefault: 'Конфиг по умолчанию',
      logPath: 'Путь логов',
      configDir: 'Каталог конфигов',
      coreDir: 'Каталог ядра',
      dataDir: 'Каталог данных',
      logs: 'Настройки журнала',
      pagination: 'Пагинация',
      switchPageSize: 'Размер страницы переключения',
      backupsPageSize: 'Размер страницы резервных копий',
      debugMode: 'Режим отладки',
      debugModeLabel: 'Включить режим отладки',
    },
  },
};

const SETTINGS_KEY = 'clashfox-settings';
const DEFAULT_SETTINGS = {
  lang: 'auto',
  themePreference: 'auto',
  githubUser: 'vernesong',
  configPath: '',
  configDir: '',
  coreDir: '',
  dataDir: '',
  logLines: 10,
  logAutoRefresh: false,
  logIntervalPreset: '3',
  switchPageSize: '10',
  backupsPageSize: '10',
  debugMode: false,
};

const state = {
  lang: 'auto',
  lastBackups: [],
  configs: [],
  kernels: [],
  logTimer: null,
  logIntervalMs: 3000,
  switchPage: 1,
  backupsPage: 1,
  kernelsPage: 1,
  selectedBackupPaths: new Set(),
  theme: 'night',
  themePreference: 'auto',
  installState: 'idle',
  overviewTimer: null,
  overviewTickTimer: null,
  overviewLoading: false,
  overviewLiteTimer: null,
  overviewLiteLoading: false,
  overviewMemoryTimer: null,
  overviewMemoryLoading: false,
  trafficTimer: null,
  trafficRxBytes: null,
  trafficTxBytes: null,
  trafficAt: 0,
  proxyRxBytes: null,
  proxyTxBytes: null,
  proxyAt: 0,
  coreActionInFlight: false,
  overviewRunning: false,
  overviewUptimeBaseSec: 0,
  overviewUptimeAt: 0,
  configDefault: '',
  settings: { ...DEFAULT_SETTINGS },
};

function t(path) {
  const lang = state.lang === 'auto' ? getAutoLanguage() : state.lang;

  const parts = path.split('.');
  let current = I18N[lang];
  for (const part of parts) {
    if (!current || typeof current !== 'object') return path;
    current = current[part];
  }
  return current || path;
}

function getAutoLanguage() {
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  return 'en';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const tip = t(key);
    if (tip && tip.trim() !== '') {
      el.setAttribute('title', tip);
    }
    el.textContent = tip;
  });
  document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
    const key = el.dataset.i18nTip;
    const tip = t(key);
    el.dataset.tip = tip;
    // 替换现有的title设置
    el.setAttribute('data-tooltip', tip);
    // 保持title属性用于可访问性
    el.setAttribute('title', tip);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.setAttribute('placeholder', t(key));
  });

  statusPill.setAttribute('aria-label', t('labels.unknown'));
  statusPill.setAttribute('title', t('labels.unknown'));
  statusPill.dataset.state = 'unknown';
  updateThemeToggle();
  setInstallState(state.installState);
  renderConfigTable();
}

function setLanguage(lang, persist = true, refreshStatus = true) {
  state.lang = lang;
  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  if (settingsLang) {
    settingsLang.value = lang;
  }
  if (persist) {
    saveSettings({ lang });
  }
  applyI18n();
  if (refreshStatus) {
    loadStatus();
  }
}

function readSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function syncSettingsFromFile() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return;
  }
  const response = await window.clashfox.readSettings();
  if (!response || !response.ok || !response.data) {
    return;
  }
  const merged = { ...DEFAULT_SETTINGS, ...response.data };
  if (window.clashfox && typeof window.clashfox.getUserDataPath === 'function') {
    const userData = await window.clashfox.getUserDataPath();
    if (userData && userData.ok && userData.path) {
      const base = userData.path;
      if (!merged.configDir) {
        merged.configDir = `${base}/config`;
      }
      if (!merged.coreDir) {
        merged.coreDir = `${base}/core`;
      }
      if (!merged.dataDir) {
        merged.dataDir = `${base}/data`;
      }
      if (!merged.logDir) {
        merged.logDir = `${base}/logs`;
      }
      if (!merged.pidDir) {
        merged.pidDir = `${base}/runtime`;
      }
    }
  }
  delete merged.configPath;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { configPath, ...fileSettings } = merged;
    window.clashfox.writeSettings(fileSettings);
  }
}

function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { configPath, ...fileSettings } = state.settings;
    window.clashfox.writeSettings(fileSettings);
  }
}

function resolveTheme(preference) {
  if (preference !== 'auto') {
    return preference;
  }
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  }
  return 'night';
}

function updateThemeToggle() {
  if (!themeToggle) {
    return;
  }
  const nextTheme = state.theme === 'night' ? 'day' : 'night';
  const label = t(nextTheme === 'day' ? 'theme.toDay' : 'theme.toNight');
  themeToggle.setAttribute('aria-label', label);
  themeToggle.setAttribute('title', label);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
}

function syncDebugMode(enabled) {
  if (settingsDebugMode) {
    settingsDebugMode.checked = Boolean(enabled);
  }
  if (window.clashfox && typeof window.clashfox.setDebugMode === 'function') {
    window.clashfox.setDebugMode(Boolean(enabled));
  }
}

function applySystemTheme(isDark) {
  if (state.themePreference !== 'auto') {
    return;
  }
  applyTheme(isDark ? 'night' : 'day');
  updateThemeToggle();
}

function applyThemePreference(preference, persist = true) {
  state.themePreference = preference;
  if (settingsTheme) {
    settingsTheme.value = preference;
  }
  applyTheme(resolveTheme(preference));
  if (persist) {
    saveSettings({ themePreference: preference });
  }
  updateThemeToggle();
}

function applySettings(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  applyThemePreference(state.settings.themePreference, false);
  setLanguage(state.settings.lang, false, false);
  syncDebugMode(state.settings.debugMode);
  if (settingsConfigDir) {
    settingsConfigDir.value = state.settings.configDir;
  }
  if (settingsCoreDir) {
    settingsCoreDir.value = state.settings.coreDir;
  }
  if (settingsDataDir) {
    settingsDataDir.value = state.settings.dataDir;
  }
  if (githubUser) {
    githubUser.value = state.settings.githubUser;
  }
  if (settingsGithubUser) {
    settingsGithubUser.value = state.settings.githubUser;
  }
  if (configPathInput) {
    configPathInput.value = state.settings.configPath;
  }
  if (overviewConfigPath) {
    overviewConfigPath.value = state.settings.configPath;
  }
  if (settingsConfigPath) {
    settingsConfigPath.value = state.settings.configPath;
  }
  if (logLines) {
    logLines.value = state.settings.logLines;
  }
  if (settingsLogLines) {
    settingsLogLines.value = state.settings.logLines;
  }
  if (logIntervalPreset) {
    logIntervalPreset.value = state.settings.logIntervalPreset;
  }
  if (settingsLogIntervalPreset) {
    settingsLogIntervalPreset.value = state.settings.logIntervalPreset;
  }
  updateInterval();
  if (logAutoRefresh) {
    logAutoRefresh.checked = state.settings.logAutoRefresh;
  }
  if (settingsLogAutoRefresh) {
    settingsLogAutoRefresh.checked = state.settings.logAutoRefresh;
  }
  setLogAutoRefresh(state.settings.logAutoRefresh);
  if (switchPageSize) {
    switchPageSize.value = state.settings.switchPageSize;
  }
  if (settingsSwitchPageSize) {
    settingsSwitchPageSize.value = state.settings.switchPageSize;
  }
  if (backupsPageSize) {
    backupsPageSize.value = state.settings.backupsPageSize;
  }
  if (settingsBackupsPageSize) {
    settingsBackupsPageSize.value = state.settings.backupsPageSize;
  }
}

const prefersDarkQuery = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

if (prefersDarkQuery) {
  prefersDarkQuery.addEventListener('change', () => {
    if (state.themePreference === 'auto') {
      applyThemePreference('auto', false);
    }
  });
}

if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
  window.clashfox.onSystemThemeChange((payload) => {
    if (!payload || typeof payload.dark !== 'boolean') {
      return;
    }
    applySystemTheme(payload.dark);
  });
}

function promptSudoPassword() {
  sudoPassword.value = '';
  sudoModal.classList.add('show');
  sudoModal.setAttribute('aria-hidden', 'false');
  sudoPassword.focus();

  return new Promise((resolve) => {
    const cleanup = () => {
      sudoModal.classList.remove('show');
      sudoModal.setAttribute('aria-hidden', 'true');
      sudoCancel.removeEventListener('click', onCancel);
      sudoConfirm.removeEventListener('click', onConfirm);
      sudoPassword.removeEventListener('keydown', onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onConfirm = () => {
      const value = sudoPassword.value.trim();
      cleanup();
      resolve(value || null);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    sudoCancel.addEventListener('click', onCancel);
    sudoConfirm.addEventListener('click', onConfirm);
    sudoPassword.addEventListener('keydown', onKeydown);
  });
}

function promptConfirm({ title, body, confirmLabel, confirmTone = 'danger' }) {
  confirmTitle.textContent = title || t('confirm.title');
  confirmBody.textContent = body || t('confirm.body');
  confirmCancel.textContent = t('confirm.cancel');
  confirmOk.textContent = confirmLabel || t('confirm.confirm');
  confirmOk.classList.remove('primary', 'danger');
  confirmOk.classList.add(confirmTone === 'primary' ? 'primary' : 'danger');
  confirmModal.classList.add('show');
  confirmModal.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    const cleanup = () => {
      confirmModal.classList.remove('show');
      confirmModal.setAttribute('aria-hidden', 'true');
      confirmCancel.removeEventListener('click', onCancel);
      confirmOk.removeEventListener('click', onConfirm);
      confirmModal.removeEventListener('keydown', onKeydown);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
      if (event.key === 'Enter') {
        onConfirm();
      }
    };

    confirmCancel.addEventListener('click', onCancel);
    confirmOk.addEventListener('click', onConfirm);
    confirmModal.addEventListener('keydown', onKeydown);
    confirmOk.focus();
  });
}

async function runCommandWithSudo(command, args = []) {
  const response = await runCommand(command, args);
  if (response.ok || response.error !== 'sudo_required') {
    return response;
  }

  const password = await promptSudoPassword();
  if (!password) {
    return { ok: false, error: 'cancelled' };
  }

  const retry = await runCommand(command, [...args, '--sudo-pass', password]);
  if (!retry.ok && retry.error === 'sudo_invalid') {
    showToast(t('labels.sudoInvalid'), 'error');
  }
  return retry;
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function setInstallState(nextState, errorMessage = '') {
  state.installState = nextState;
  if (!installStatus || !installProgress) {
    return;
  }
  let message = t('install.ready');
  if (nextState === 'loading') {
    message = t('install.progress');
  } else if (nextState === 'success') {
    message = t('install.done');
  } else if (nextState === 'error') {
    message = t('install.failed');
  }

  installStatus.textContent = message;
  installStatus.dataset.state = nextState;
  installProgress.classList.toggle('show', nextState === 'loading');
  installBtn.disabled = nextState === 'loading';
  githubUser.disabled = nextState === 'loading';
  if (cancelInstallBtn) {
    cancelInstallBtn.style.display = nextState === 'loading' ? 'block' : 'none';
    cancelInstallBtn.disabled = nextState !== 'loading';
  }
  if (installVersion) {
    installVersion.disabled = nextState === 'loading';
  }
}

function setActiveSection(sectionId) {
  navButtons.forEach((btn) => {
    const match = btn.dataset.section === sectionId || btn.dataset.page === sectionId;
    btn.classList.toggle('active', match);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === sectionId);
  });
}

function setActiveNav(page) {
  if (!page) {
    return;
  }
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

async function runCommand(command, args = []) {
  if (!window.clashfox || typeof window.clashfox.runCommand !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  const pathArgs = [];
  if (state.settings.configDir) {
    pathArgs.push('--config-dir', state.settings.configDir);
  }
  if (state.settings.coreDir) {
    pathArgs.push('--core-dir', state.settings.coreDir);
  }
  if (state.settings.dataDir) {
    pathArgs.push('--data-dir', state.settings.dataDir);
  }
  return window.clashfox.runCommand(command, [...pathArgs, ...args]);
}

async function cancelCommand() {
  if (!window.clashfox || typeof window.clashfox.cancelCommand !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return window.clashfox.cancelCommand();
}

async function loadAppInfo() {
  if (!window.clashfox || typeof window.clashfox.getAppInfo !== 'function') {
    return;
  }
  const response = await window.clashfox.getAppInfo();
  if (response && response.ok && response.data) {
    appName.textContent = response.data.name || 'ClashFox';
    const version = response.data.version || '0.0.0';
    const buildNumber = response.data.buildNumber;
    const suffix = buildNumber ? `(${buildNumber})` : '';
    appVersion.textContent = `v${version}${suffix}`;
  }
}

function updateStatusUI(data) {
  const running = data.running;
  state.coreRunning = running;
  state.configDefault = data.configDefault || '';
  const configValue = getCurrentConfigPath() || data.configDefault || '-';
  const hasKernel = Boolean(data.kernelExists);
  if (statusRunning) {
    statusRunning.textContent = running ? t('labels.running') : t('labels.stopped');
  }
  if (statusVersion) {
    statusVersion.textContent = data.version || t('labels.notInstalled');
  }
  if (startBtn) {
    startBtn.disabled = !hasKernel || state.coreActionInFlight;
  }
  if (stopBtn) {
    stopBtn.disabled = !hasKernel || state.coreActionInFlight;
  }
  if (restartBtn) {
    restartBtn.disabled = !hasKernel || state.coreActionInFlight;
  }
  if (quickHintNodes.length) {
    const hint = hasKernel ? t('status.quickHint') : t('status.quickHintMissing');
    quickHintNodes.forEach((node) => {
      node.textContent = hint;
    });
  }
  if (statusKernelPath) {
    statusKernelPath.textContent = hasKernel ? (data.kernelPath || '-') : '-';
  }
  if (statusConfig) {
    statusConfig.textContent = hasKernel ? configValue : '-';
  }
  if (statusKernelPathRow) {
    statusKernelPathRow.classList.toggle('is-hidden', !hasKernel);
  }
  if (statusConfigRow) {
    statusConfigRow.classList.toggle('is-hidden', !hasKernel);
  }
  if (settingsKernelPath) {
    settingsKernelPath.textContent = data.kernelPath || '-';
  }
  if (settingsConfigDefault) {
    settingsConfigDefault.textContent = data.configDefault || '-';
  }
  if (settingsLogPath) {
    settingsLogPath.textContent = data.logPath || '-';
  }
  if (settingsConfigDir) {
    settingsConfigDir.placeholder = data.configDir || '-';
  }
  if (settingsCoreDir) {
    settingsCoreDir.placeholder = data.coreDir || '-';
  }
  if (settingsDataDir) {
    settingsDataDir.placeholder = data.dataDir || '-';
  }
  if (statusPill) {
    statusPill.dataset.state = running ? 'running' : 'stopped';
    const label = running ? t('labels.running') : t('labels.stopped');
    statusPill.setAttribute('aria-label', label);
    statusPill.setAttribute('title', label);
  }
  renderConfigTable();
}

function setStatusInterim(running) {
  if (statusRunning) {
    statusRunning.textContent = running ? t('labels.running') : t('labels.stopped');
  }
  if (statusPill) {
    statusPill.dataset.state = running ? 'running' : 'stopped';
    const label = running ? t('labels.running') : t('labels.stopped');
    statusPill.setAttribute('aria-label', label);
    statusPill.setAttribute('title', label);
  }
}

function setCoreActionState(inFlight) {
  state.coreActionInFlight = inFlight;
  startBtn.disabled = inFlight;
  stopBtn.disabled = inFlight;
  restartBtn.disabled = inFlight;
}

function updateInstallVersionVisibility() {
  if (!installVersionRow || !installVersion) {
    return;
  }
  const isMetaCubeX = ((githubUser && githubUser.value) || '').toLowerCase() === 'metacubex';
  installVersionRow.classList.toggle('is-hidden', !isMetaCubeX);
  if (!isMetaCubeX) {
    installVersion.value = '';
  }
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '-';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${base}` : base;
}

function formatLatency(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return '-';
  }
  return `${Math.round(num)} ms`;
}

function formatBytes(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = num;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const fixed = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(fixed)} ${units[idx]}`;
}

function formatBitrate(bytesPerSec) {
  const num = Number.parseFloat(bytesPerSec);
  if (!Number.isFinite(num) || num < 0) {
    return '-';
  }
  const bitsPerSec = (num * 8) / 1000;
  const units = ['Kb/s', 'Mb/s', 'Gb/s', 'Tb/s'];
  let value = bitsPerSec;
  let idx = 0;
  while (value >= 1000 && idx < units.length - 1) {
    value /= 1000;
    idx += 1;
  }
  const fixed = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fixed)} ${units[idx]}`;
}

function updateSystemTraffic(rxBytes, txBytes) {
  const rx = Number.parseFloat(rxBytes);
  const tx = Number.parseFloat(txBytes);
  const now = Date.now();
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) {
    if (trafficSystemDownloadRate) {
      trafficSystemDownloadRate.textContent = '-';
    }
    if (trafficSystemDownloadTotal) {
      trafficSystemDownloadTotal.textContent = '-';
    }
    if (trafficSystemUploadRate) {
      trafficSystemUploadRate.textContent = '-';
    }
    if (trafficSystemUploadTotal) {
      trafficSystemUploadTotal.textContent = '-';
    }
    state.trafficRxBytes = null;
    state.trafficTxBytes = null;
    state.trafficAt = 0;
    return;
  }

  if (trafficSystemDownloadTotal) {
    trafficSystemDownloadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(rx)}`;
  }
  if (trafficSystemUploadTotal) {
    trafficSystemUploadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(tx)}`;
  }

  if (state.trafficRxBytes === null || state.trafficTxBytes === null || !state.trafficAt) {
    state.trafficRxBytes = rx;
    state.trafficTxBytes = tx;
    state.trafficAt = now;
    if (trafficSystemDownloadRate) {
      trafficSystemDownloadRate.textContent = '-';
    }
    if (trafficSystemUploadRate) {
      trafficSystemUploadRate.textContent = '-';
    }
    return;
  }

  const deltaSec = (now - state.trafficAt) / 1000;
  if (deltaSec <= 0) {
    return;
  }
  const rxRate = (rx - state.trafficRxBytes) / deltaSec;
  const txRate = (tx - state.trafficTxBytes) / deltaSec;
  state.trafficRxBytes = rx;
  state.trafficTxBytes = tx;
  state.trafficAt = now;

  if (trafficSystemDownloadRate) {
    trafficSystemDownloadRate.textContent = formatBitrate(rxRate);
  }
  if (trafficSystemUploadRate) {
    trafficSystemUploadRate.textContent = formatBitrate(txRate);
  }
}

function updateProxyTraffic(rxBytes, txBytes) {
  const rx = Number.parseFloat(rxBytes);
  const tx = Number.parseFloat(txBytes);
  const now = Date.now();
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) {
    if (trafficProxyDownloadRate) {
      trafficProxyDownloadRate.textContent = '-';
    }
    if (trafficProxyDownloadTotal) {
      trafficProxyDownloadTotal.textContent = '-';
    }
    if (trafficProxyUploadRate) {
      trafficProxyUploadRate.textContent = '-';
    }
    if (trafficProxyUploadTotal) {
      trafficProxyUploadTotal.textContent = '-';
    }
    state.proxyRxBytes = null;
    state.proxyTxBytes = null;
    state.proxyAt = 0;
    return;
  }

  if (trafficProxyDownloadTotal) {
    trafficProxyDownloadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(rx)}`;
  }
  if (trafficProxyUploadTotal) {
    trafficProxyUploadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(tx)}`;
  }

  if (state.proxyRxBytes === null || state.proxyTxBytes === null || !state.proxyAt) {
    state.proxyRxBytes = rx;
    state.proxyTxBytes = tx;
    state.proxyAt = now;
    if (trafficProxyDownloadRate) {
      trafficProxyDownloadRate.textContent = '-';
    }
    if (trafficProxyUploadRate) {
      trafficProxyUploadRate.textContent = '-';
    }
    return;
  }

  const deltaSec = (now - state.proxyAt) / 1000;
  if (deltaSec <= 0) {
    return;
  }
  const rxRate = (rx - state.proxyRxBytes) / deltaSec;
  const txRate = (tx - state.proxyTxBytes) / deltaSec;
  state.proxyRxBytes = rx;
  state.proxyTxBytes = tx;
  state.proxyAt = now;

  if (trafficProxyDownloadRate) {
    trafficProxyDownloadRate.textContent = formatBitrate(rxRate);
  }
  if (trafficProxyUploadRate) {
    trafficProxyUploadRate.textContent = formatBitrate(txRate);
  }
}

function formatKernelDisplay(value) {
  if (!value) {
    return '-';
  }
  const match = String(value).match(/alpha(?:-smart)?-[0-9a-f]+/i);
  if (match) {
    return match[0];
  }
  const first = String(value).trim().split(/\s+/)[2];
  return first || '-';
}

function updateOverviewUI(data) {
  if (!data) {
    return;
  }
  state.overviewRunning = Boolean(data.running);
  
  // 检查元素是否存在再设置textContent
  if (overviewStatus) {
    overviewStatus.textContent = state.overviewRunning ? t('labels.running') : t('labels.stopped');
  }
  if (overviewKernel) {
    overviewKernel.textContent = formatKernelDisplay(data.kernelVersion);
  }
  if (overviewSystem) {
    overviewSystem.textContent = data.systemName || '-';
  }
  if (overviewVersion) {
    const systemParts = [data.systemVersion, data.systemBuild].filter(Boolean);
    overviewVersion.textContent = systemParts.length ? systemParts.join(' ') : '-';
  }
  
  const parsedUptime = Number.parseInt(data.uptimeSec, 10);
  state.overviewUptimeBaseSec = Number.isFinite(parsedUptime) ? parsedUptime : 0;
  state.overviewUptimeAt = Date.now();
  
  if (overviewUptime) {
    overviewUptime.textContent = state.overviewRunning
      ? formatUptime(state.overviewUptimeBaseSec)
      : '-';
  }
  if (overviewConnections) {
    overviewConnections.textContent = data.connections === '' || data.connections === null || data.connections === undefined
      ? '-'
      : data.connections;
  }
  if (overviewMemory) {
    overviewMemory.textContent = data.memory === '' || data.memory === null || data.memory === undefined
      ? '-'
      : data.memory;
  }
  if (overviewInternet) {
    overviewInternet.textContent = formatLatency(data.internetMs);
  }
  if (overviewDns) {
    overviewDns.textContent = formatLatency(data.dnsMs);
  }
  if (overviewRouter) {
    overviewRouter.textContent = formatLatency(data.routerMs);
  }
  if (overviewNetwork) {
    overviewNetwork.textContent = data.networkName || '-';
  }
  if (overviewLocalIp) {
    overviewLocalIp.textContent = data.localIp || '-';
  }
  if (overviewProxyIp) {
    overviewProxyIp.textContent = maskIpAddress(data.proxyIp) || '-';
  }
  if (overviewInternetIp) {
    const ipValue = data.internetIp4 || data.internetIp || data.internetIp6 || '-';
    overviewInternetIp.textContent = maskIpAddress(ipValue) || '-';
  }
  updateSystemTraffic(data.rxBytes, data.txBytes);
}

function updateOverviewRuntimeUI(data) {
  if (!data) {
    return;
  }
  state.overviewRunning = Boolean(data.running);
  
  // 检查元素是否存在再设置textContent
  if (overviewStatus) {
    overviewStatus.textContent = state.overviewRunning ? t('labels.running') : t('labels.stopped');
  }
  
  if (state.overviewRunning) {
    const parsedUptime = Number.parseInt(data.uptimeSec, 10);
    if (Number.isFinite(parsedUptime)) {
      if (parsedUptime >= state.overviewUptimeBaseSec) {
        state.overviewUptimeBaseSec = parsedUptime;
        state.overviewUptimeAt = Date.now();
      }
    }
    if (overviewUptime) {
      overviewUptime.textContent = formatUptime(state.overviewUptimeBaseSec);
    }
  } else {
    state.overviewUptimeBaseSec = 0;
    state.overviewUptimeAt = 0;
    if (overviewUptime) {
      overviewUptime.textContent = '-';
    }
  }
  
  if (overviewConnections) {
    overviewConnections.textContent = data.connections === '' || data.connections === null || data.connections === undefined
      ? '-'
      : data.connections;
  }
  
  if (overviewMemory) {
    overviewMemory.textContent = data.memory === '' || data.memory === null || data.memory === undefined
      ? '-'
      : data.memory;
  }
}

async function loadStatus() {
  const response = await runCommand('status');
  if (!response.ok) {
    const msg = response.error === 'bridge_missing' ? t('labels.bridgeMissing') : (response.error || 'Status error');
    showToast(msg, 'error');
    return;
  }
  updateStatusUI(response.data);
}

async function loadOverview(showToastOnSuccess = false) {
  if (state.overviewLoading) {
    return false;
  }
  state.overviewLoading = true;
  const response = await runCommand('overview');
  if (!response.ok) {
    state.overviewLoading = false;
    if (showToastOnSuccess) {
      showToast(response.error || 'Overview error', 'error');
    }
    return false;
  }
  updateOverviewUI(response.data);
  state.overviewLoading = false;
  if (showToastOnSuccess) {
    showToast(t('labels.statusRefreshed'));
  }
  return true;
}

async function loadOverviewLite() {
  if (state.overviewLiteLoading) {
    return false;
  }
  state.overviewLiteLoading = true;
  const response = await runCommand('overview-lite');
  if (!response.ok) {
    state.overviewLiteLoading = false;
    return false;
  }
  updateOverviewRuntimeUI(response.data);
  state.overviewLiteLoading = false;
  return true;
}

async function loadTraffic() {
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  const response = await runCommand('traffic', args);
  if (!response.ok || !response.data) {
    updateProxyTraffic(null, null);
    return;
  }
  updateProxyTraffic(response.data.down, response.data.up);
}

async function loadOverviewMemory() {
  if (state.overviewMemoryLoading) {
    return false;
  }
  state.overviewMemoryLoading = true;
  const response = await runCommand('overview-memory');
  if (!response.ok) {
    state.overviewMemoryLoading = false;
    return false;
  }
  if (response.data && overviewMemory) {
    overviewMemory.textContent = response.data.memory || '-';
  }
  state.overviewMemoryLoading = false;
  return true;
}

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, end),
  };
}

function renderBackups(targetEl, withRadio, pageInfo, pageSize, multiSelect) {
  const items = state.lastBackups;
  const pageData = paginate(items, pageInfo, pageSize);
  if (multiSelect) {
    const totalCount = state.lastBackups.length;
    const allChecked = totalCount > 0 && state.selectedBackupPaths.size === totalCount;
    const checkedAttr = allChecked ? 'checked' : '';
    let html = '<table class="backup-table" aria-label="Backups">';
    html += '<thead><tr>';
    html += `<th class="check-col"><input type="checkbox" id="backupsHeaderSelect" ${checkedAttr} /></th>`;
    html += `<th class="index-col">${t('table.index')}</th>`;
    html += `<th class="version-col">${t('table.version')}</th>`;
    html += `<th class="time-col">${t('table.time')}</th>`;
    html += '</tr></thead><tbody>';

    pageData.items.forEach((item) => {
      const checked = state.selectedBackupPaths.has(item.path) ? 'checked' : '';
      const selectedClass = checked ? 'selected' : '';
      html += `<tr class="${selectedClass}" data-path="${item.path}">`;
      html += `<td class="check-col"><input type="checkbox" data-path="${item.path}" ${checked} /></td>`;
      html += `<td class="index-col">${item.index}</td>`;
      html += `<td class="version-col">${item.version || item.name}</td>`;
      html += `<td class="time-col">${item.timestamp || '-'}</td>`;
      html += '</tr>';
    });

    if (items.length === 0) {
      html += `<tr><td class="empty-cell" colspan="4">${t('labels.noBackups')}</td></tr>`;
    }
    html += '</tbody></table>';
    targetEl.innerHTML = html;
    return pageData;
  }

  let headerClass = 'table-row header backup';
  let html = `<div class="${headerClass}">`;
  html += withRadio ? '<div></div>' : `<div class="index-head">${t('table.index')}</div>`;
  html += `<div class="version-head">${t('table.version')}</div><div class="time-head">${t('table.time')}</div></div>`;

  pageData.items.forEach((item) => {
    const rowClass = withRadio ? 'table-row backup selectable' : 'table-row backup';
    html += `<div class="${rowClass}" data-index="${item.index}">`;
    if (withRadio) {
      html += '<div class="pick-cell"><span class="pick-dot" aria-hidden="true"></span></div>';
    } else {
      html += `<div class="index-cell">${item.index}</div>`;
    }
    html += `<div class="version-cell">${item.version || item.name}</div><div class="time-cell">${item.timestamp || '-'}</div></div>`;
  });

  if (items.length === 0) {
    html += `<div class="table-row empty"><div class="empty-cell">${t('labels.noBackups')}</div></div>`;
  }

  targetEl.innerHTML = html;
  return pageData;
}

function getCurrentConfigPath() {
  const candidates = [];
  if (configPathInput && typeof configPathInput.value === 'string') {
    candidates.push(configPathInput.value);
  }
  if (overviewConfigPath && typeof overviewConfigPath.value === 'string') {
    candidates.push(overviewConfigPath.value);
  }
  if (settingsConfigPath && typeof settingsConfigPath.value === 'string') {
    candidates.push(settingsConfigPath.value);
  }
  if (state.settings && typeof state.settings.configPath === 'string') {
    candidates.push(state.settings.configPath);
  }
  const explicit = candidates.find((value) => value && value.trim());
  return (explicit || state.configDefault || '').trim();
}

function renderConfigTable() {
  if (!configTable) {
    return;
  }
  const items = state.configs;
  const currentPath = getCurrentConfigPath();
  let html = '<table class="backup-table" aria-label="Configs">';
  html += '<thead><tr>';
  html += `<th class="name-col">${t('table.name')}</th>`;
  html += `<th class="path-col">${t('table.path')}</th>`;
  html += `<th class="modified-col">${t('table.modified')}</th>`;
  html += `<th class="current-col">${t('table.current')}</th>`;
  html += '</tr></thead><tbody>';
  items.forEach((item) => {
    const isCurrent = currentPath && item.path === currentPath;
    html += '<tr>';
    html += `<td class="name-col">${item.name || '-'}</td>`;
    html += `<td class="path-col">${item.path || '-'}</td>`;
    html += `<td class="modified-col">${item.modified || '-'}</td>`;
    html += `<td class="current-col">${isCurrent ? t('labels.current') : '-'}</td>`;
    html += '</tr>';
  });
  if (items.length === 0) {
    html += `<tr><td class="empty-cell" colspan="4">${t('labels.configsEmpty')}</td></tr>`;
  }
  html += '</tbody></table>';
  configTable.innerHTML = html;
}

function renderKernelTable() {
  if (!kernelTable || !kernelPageSize || !kernelPageInfo || !kernelPrev || !kernelNext) {
    return;
  }
  const items = state.kernels || [];
  const size = Number.parseInt(kernelPageSize.value, 10) || 5;
  const pageData = paginate(items, state.kernelsPage, size);
  state.kernelsPage = pageData.page;
  kernelPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${items.length}`;
  kernelPrev.disabled = pageData.page <= 1;
  kernelNext.disabled = pageData.page >= pageData.totalPages;

  let html = '<div class="table-row header kernel">';
  html += `<div class="version-head">${t('table.version')}</div>`;
  html += `<div class="time-head">${t('table.time')}</div></div>`;

  pageData.items.forEach((item) => {
    html += '<div class="table-row kernel">';
    html += `<div class="version-cell">${item.name || '-'}</div>`;
    html += `<div class="time-cell">${item.modified || '-'}</div></div>`;
  });

  if (items.length === 0) {
    html += `<div class="table-row kernel empty"><div class="empty-cell">${t('labels.kernelsEmpty')}</div></div>`;
  }

  kernelTable.innerHTML = html;
}

async function loadConfigs(showToastOnSuccess = false) {
  const response = await runCommand('configs');
  if (!response.ok) {
    showToast(response.error || 'Configs error', 'error');
    return;
  }
  state.configs = response.data || [];
  renderConfigTable();
  if (showToastOnSuccess) {
    showToast(t('labels.configsRefreshed'));
  }
}

async function loadKernels() {
  if (!kernelTable) {
    return;
  }
  const response = await runCommand('cores');
  if (!response.ok) {
    renderKernelTable();
    return;
  }
  state.kernels = response.data || [];
  renderKernelTable();
}

async function loadBackups(showToastOnSuccess = false) {
  const response = await runCommand('backups');
  if (!response.ok) {
    showToast(response.error || 'Backups error', 'error');
    return;
  }
  state.lastBackups = response.data;
  state.switchPage = 1;
  state.backupsPage = 1;
  state.selectedBackupPaths.clear();
  renderSwitchTable();
  renderBackupsTable();
  if (showToastOnSuccess) {
    showToast(t('labels.backupsRefreshed'));
  }
}

function renderSwitchTable() {
  if (!backupTable || !switchPageSize || !switchPageInfo || !switchPrev || !switchNext) {
    return;
  }
  const size = Number.parseInt(switchPageSize.value, 10) || 10;
  const pageData = renderBackups(backupTable, true, state.switchPage, size, false);
  state.switchPage = pageData.page;
  switchPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  switchPrev.disabled = pageData.page <= 1;
  switchNext.disabled = pageData.page >= pageData.totalPages;
}

function renderBackupsTable() {
  if (!backupTableFull || !backupsPageSize || !backupsPageInfo || !backupsPrev || !backupsNext) {
    return;
  }
  const size = Number.parseInt(backupsPageSize.value, 10) || 10;
  const pageData = renderBackups(backupTableFull, false, state.backupsPage, size, true);
  state.backupsPage = pageData.page;
  backupsPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  backupsPrev.disabled = pageData.page <= 1;
  backupsNext.disabled = pageData.page >= pageData.totalPages;
}

async function loadLogs() {
  if (!logLines || !logContent) {
    return;
  }
  const lines = logLines.value || 200;
  const response = await runCommand('logs', ['--lines', String(lines)]);
  if (!response.ok) {
    logContent.textContent = t('labels.logMissing');
    return;
  }
  if (response.data && response.data.contentBase64) {
    const binary = atob(response.data.contentBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const linesList = decoded.replace(/\n$/, '').split('\n').reverse();
    logContent.textContent = linesList.join('\n');
  } else {
    logContent.textContent = response.data.content || '';
  }
}

function setLogAutoRefresh(enabled) {
  if (state.logTimer) {
    clearInterval(state.logTimer);
    state.logTimer = null;
  }
  if (!logIntervalPreset) {
    return;
  }
  logIntervalPreset.disabled = !enabled;
  if (!enabled || !logAutoRefresh) {
    return;
  }
  state.logTimer = setInterval(() => {
    loadLogs();
  }, state.logIntervalMs);
}

function getIntervalMs() {
  const presetValue = Number.parseInt(logIntervalPreset.value, 10);
  const clamped = Math.min(Math.max(presetValue || 3, 1), 60);
  return clamped * 1000;
}

function updateInterval() {
  if (!logIntervalPreset || !logAutoRefresh) {
    return;
  }
  state.logIntervalMs = getIntervalMs();
  if (logAutoRefresh.checked) {
    setLogAutoRefresh(true);
  }
}

function getSelectedBackupIndex() {
  if (!backupTable) {
    return null;
  }
  const selectedRow = backupTable.querySelector('.table-row.selectable.selected');
  return selectedRow ? selectedRow.dataset.index : null;
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetPage = btn.dataset.page;
    if (targetPage) {
      if (window.clashfox && typeof window.clashfox.navigate === 'function') {
        window.clashfox.navigate(targetPage);
      } else {
        window.location.href = `${targetPage}.html`;
      }
      return;
    }
    const target = btn.dataset.section;
    if (target) {
      setActiveSection(target);
    }
  });
});

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = state.theme === 'night' ? 'day' : 'night';
    applyThemePreference(nextTheme);
  });
}

if (settingsLang) {
  settingsLang.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });
}

if (settingsTheme) {
  settingsTheme.addEventListener('change', (event) => {
    applyThemePreference(event.target.value);
  });
}

if (settingsDebugMode) {
  settingsDebugMode.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    saveSettings({ debugMode: enabled });
    syncDebugMode(enabled);
  });
}

if (settingsConfigDir) {
  settingsConfigDir.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    saveSettings({ configDir: value });
    refreshPathDependentViews();
  });
}

if (settingsCoreDir) {
  settingsCoreDir.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    saveSettings({ coreDir: value });
    refreshPathDependentViews();
  });
}

if (settingsDataDir) {
  settingsDataDir.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    saveSettings({ dataDir: value });
    refreshPathDependentViews();
  });
}

if (settingsConfigDirBrowse) {
  settingsConfigDirBrowse.addEventListener('click', async () => {
    const result = await handleDirectoryBrowse('Select Config Directory');
    if (result.ok) {
      settingsConfigDir.value = result.path;
      saveSettings({ configDir: result.path });
      refreshPathDependentViews();
    }
  });
}

if (settingsCoreDirBrowse) {
  settingsCoreDirBrowse.addEventListener('click', async () => {
    const result = await handleDirectoryBrowse('Select Core Directory');
    if (result.ok) {
      settingsCoreDir.value = result.path;
      saveSettings({ coreDir: result.path });
      refreshPathDependentViews();
    }
  });
}

if (settingsDataDirBrowse) {
  settingsDataDirBrowse.addEventListener('click', async () => {
    const result = await handleDirectoryBrowse('Select Data Directory');
    if (result.ok) {
      settingsDataDir.value = result.path;
      saveSettings({ dataDir: result.path });
      refreshPathDependentViews();
    }
  });
}

if (settingsConfigDirReset) {
  settingsConfigDirReset.addEventListener('click', () => {
    resetPathSetting('configDir', t('settings.configDir'));
  });
}

if (settingsCoreDirReset) {
  settingsCoreDirReset.addEventListener('click', () => {
    resetPathSetting('coreDir', t('settings.coreDir'));
  });
}

if (settingsDataDirReset) {
  settingsDataDirReset.addEventListener('click', () => {
    resetPathSetting('dataDir', t('settings.dataDir'));
  });
}

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    setInstallState('loading');
    const args = ['--github-user', githubUser ? githubUser.value : 'vernesong'];
    if (githubUser && githubUser.value === 'MetaCubeX' && installVersion && installVersion.value.trim()) {
      args.push('--version', installVersion.value.trim());
    }
    const response = await runCommandWithSudo('install', args);
    if (response.ok) {
      setInstallState('success');
      showToast(t('labels.installSuccess'));
      loadStatus();
    } else if (response.error === 'cancelled') {
        setInstallState('idle');
        showToast(t('install.cancelSuccess'), 'info');
      } else {
      setInstallState('error', response.error || '');
    }
  });
}

// 添加取消按钮事件监听
if (cancelInstallBtn) {
  cancelInstallBtn.addEventListener('click', async () => {
    const response = await cancelCommand();
    if (response.ok) {
      setInstallState('idle');
      showToast(t('install.cancelSuccess'), 'info');
    } else {
      showToast(response.message || t('install.cancelFailed'), 'error');
    }
  });
}

if (settingsGithubUser) {
  settingsGithubUser.addEventListener('change', (event) => {
    const value = event.target.value;
    if (githubUser) {
      githubUser.value = value;
    }
    updateInstallVersionVisibility();
    saveSettings({ githubUser: value });
  });
}

if (githubUser) {
  githubUser.addEventListener('change', (event) => {
    const value = event.target.value;
    if (settingsGithubUser) {
      settingsGithubUser.value = value;
    }
    updateInstallVersionVisibility();
    saveSettings({ githubUser: value });
  });
}

async function handleConfigBrowse() {
  const result = await window.clashfox.selectConfig();
  if (result.ok) {
    configPathInput.value = result.path;
    if (overviewConfigPath) {
      overviewConfigPath.value = result.path;
    }
    if (settingsConfigPath) {
      settingsConfigPath.value = result.path;
    }
    saveSettings({ configPath: result.path });
    showToast(t('labels.configNeedsRestart'));
    renderConfigTable();
  }
}

async function handleDirectoryBrowse(title) {
  if (!window.clashfox || typeof window.clashfox.selectDirectory !== 'function') {
    return { ok: false };
  }
  return window.clashfox.selectDirectory(title);
}

function refreshPathDependentViews() {
  loadStatus();
  loadConfigs();
  loadKernels();
  loadBackups();
  loadLogs();
}

async function resetConfigPath() {
  const ok = await promptConfirm({
    title: t('confirm.resetTitle'),
    body: `${t('confirm.resetBody')} ${t('control.config')}`,
    confirmLabel: t('confirm.resetConfirm'),
    confirmTone: 'primary',
  });
  if (!ok) {
    return;
  }
  if (configPathInput) {
    configPathInput.value = '';
  }
  if (overviewConfigPath) {
    overviewConfigPath.value = '';
  }
  if (settingsConfigPath) {
    settingsConfigPath.value = '';
  }
  saveSettings({ configPath: '' });
  showToast(t('labels.configNeedsRestart'));
  renderConfigTable();
}

async function resetPathSetting(key, label) {
  const ok = await promptConfirm({
    title: t('confirm.resetTitle'),
    body: `${t('confirm.resetBody')} ${label}`,
    confirmLabel: t('confirm.resetConfirm'),
    confirmTone: 'primary',
  });
  if (!ok) {
    return;
  }
  if (key === 'configDir' && settingsConfigDir) {
    settingsConfigDir.value = '';
  }
  if (key === 'coreDir' && settingsCoreDir) {
    settingsCoreDir.value = '';
  }
  if (key === 'dataDir' && settingsDataDir) {
    settingsDataDir.value = '';
  }
  saveSettings({ [key]: '' });
  refreshPathDependentViews();
}

if (browseConfigBtn) {
  browseConfigBtn.addEventListener('click', handleConfigBrowse);
}
if (overviewBrowseConfig) {
  overviewBrowseConfig.addEventListener('click', handleConfigBrowse);
}
if (overviewConfigReset) {
  overviewConfigReset.addEventListener('click', () => {
    resetConfigPath();
  });
}

if (kernelRefresh) {
  kernelRefresh.addEventListener('click', () => {
    loadKernels();
  });
}

if (kernelPrev) {
  kernelPrev.addEventListener('click', () => {
    state.kernelsPage = Math.max(1, state.kernelsPage - 1);
    renderKernelTable();
  });
}
if (kernelNext) {
  kernelNext.addEventListener('click', () => {
    state.kernelsPage += 1;
    renderKernelTable();
  });
}
if (kernelPageSize) {
  kernelPageSize.addEventListener('change', () => {
    state.kernelsPage = 1;
    renderKernelTable();
  });
}

if (settingsConfigPath) {
  settingsConfigPath.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (configPathInput) {
      configPathInput.value = value;
    }
    if (overviewConfigPath) {
      overviewConfigPath.value = value;
    }
    saveSettings({ configPath: value });
    renderConfigTable();
  });
}

if (configPathInput) {
  configPathInput.addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (overviewConfigPath) {
      overviewConfigPath.value = value;
    }
    if (settingsConfigPath) {
      settingsConfigPath.value = value;
    }
    saveSettings({ configPath: value });
    renderConfigTable();
  });
}

if (settingsBrowseConfig) {
  settingsBrowseConfig.addEventListener('click', () => {
    if (browseConfigBtn) {
      browseConfigBtn.click();
    }
  });
}

// 统一的核心操作处理函数
async function handleCoreAction(action, button) {
  // 检查是否有操作正在进行
  if (state.coreActionInFlight) {
    return;
  }
  
  // 设置操作中状态
  setCoreActionState(true);
  
  try {
    // 检查当前运行状态
    if (action === 'start' && state.coreRunning) {
      showToast(t('labels.alreadyRunning'));
      setStatusInterim(true);
      loadStatus();
      setTimeout(() => loadStatus(), 1200);
      return;
    }
    
    if (action === 'stop' && !state.coreRunning) {
      showToast(t('labels.alreadyStopped'));
      return;
    }
    
    // 重启操作的特殊处理
    if (action === 'restart') {
      if (!state.coreRunning) {
        showToast(t('labels.restartStarts'));
        // 直接调用启动操作
        handleCoreAction('start', startBtn);
        return;
      }
      
      // 先停止
      setStatusInterim(false);
      const stopResponse = await runCommandWithSudo('stop');
      if (!stopResponse.ok) {
        showToast(stopResponse.error || 'Stop failed', 'error');
        return;
      }
    }
    
    // 准备启动参数
    const args = [];
    if (action === 'start' || action === 'restart') {
      const configPath = getCurrentConfigPath();
      if (configPath) {
        args.push('--config', configPath);
      }
      setStatusInterim(true);
    }
    
    // 执行操作
    const response = await runCommandWithSudo(action === 'restart' ? 'start' : action, args);
    if (response.ok) {
      // 根据操作类型显示不同的成功消息
      const successMessages = {
        'start': t('labels.startSuccess'),
        'stop': t('labels.stopped'),
        'restart': t('labels.restartSuccess')
      };
      showToast(successMessages[action]);
    } else {
      showToast(response.error || `${action.charAt(0).toUpperCase() + action.slice(1)} failed`, 'error');
    }
    
  } catch (error) {
    showToast(error.message || 'An unexpected error occurred', 'error');
  } finally {
    // 无论成功失败，都更新状态
    await loadStatus();
    const delay = action === 'restart' ? 1500 : 1200;
    setTimeout(() => loadStatus(), delay);
    
    // 重置操作中状态
    setCoreActionState(false);
  }
}

// 使用统一的处理函数
if (startBtn) {
  startBtn.addEventListener('click', () => handleCoreAction('start', startBtn));
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => handleCoreAction('stop', stopBtn));
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => handleCoreAction('restart', restartBtn));
}

if (refreshBackups) {
  refreshBackups.addEventListener('click', () => loadBackups(true));
}
if (backupsRefresh) {
  backupsRefresh.addEventListener('click', () => loadBackups(true));
}
if (configsRefresh) {
  configsRefresh.addEventListener('click', () => loadConfigs(true));
}
if (backupTable) {
  backupTable.addEventListener('click', (event) => {
    const row = event.target.closest('.table-row.selectable');
    if (!row) {
      return;
    }
    const index = row.dataset.index;
    backupTable.querySelectorAll('.table-row.selectable').forEach((el) => {
      el.classList.toggle('selected', el.dataset.index === index);
    });
  });
}
if (backupTableFull) {
  backupTableFull.addEventListener('click', (event) => {
    const row = event.target.closest('tr');
    if (!row) {
      return;
    }
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox) {
      return;
    }
    if (checkbox.id === 'backupsHeaderSelect') {
      if (event.target.tagName !== 'INPUT') {
        checkbox.checked = !checkbox.checked;
      }
      applySelectAll(checkbox.checked);
      return;
    }
    if (event.target.tagName !== 'INPUT') {
      checkbox.checked = !checkbox.checked;
    }
    if (checkbox.checked) {
      state.selectedBackupPaths.add(checkbox.dataset.path);
    } else {
      state.selectedBackupPaths.delete(checkbox.dataset.path);
    }
    row.classList.toggle('selected', checkbox.checked);
    renderBackupsTable();
  });
}

if (backupTableFull) {
  backupTableFull.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'backupsHeaderSelect') {
      applySelectAll(event.target.checked);
    }
  });
}
if (switchPrev) {
  switchPrev.addEventListener('click', () => {
    state.switchPage = Math.max(1, state.switchPage - 1);
    renderSwitchTable();
  });
}
if (switchNext) {
  switchNext.addEventListener('click', () => {
    state.switchPage += 1;
    renderSwitchTable();
  });
}
if (switchPageSize) {
  switchPageSize.addEventListener('change', () => {
    state.switchPage = 1;
    renderSwitchTable();
    if (settingsSwitchPageSize) {
      settingsSwitchPageSize.value = switchPageSize.value;
    }
    saveSettings({ switchPageSize: switchPageSize.value });
  });
}

// 添加settings页面上Log Settings的事件监听器
if (settingsLogLines) {
  settingsLogLines.addEventListener('change', () => {
    if (logLines) {
      logLines.value = settingsLogLines.value;
    }
    saveSettings({ logLines: parseInt(settingsLogLines.value, 10) });
  });
}

if (settingsLogIntervalPreset) {
  settingsLogIntervalPreset.addEventListener('change', () => {
    if (logIntervalPreset) {
      logIntervalPreset.value = settingsLogIntervalPreset.value;
    }
    updateInterval();
    saveSettings({ logIntervalPreset: settingsLogIntervalPreset.value });
  });
}

// 添加settings页面上Pagination的事件监听器
if (settingsSwitchPageSize) {
  settingsSwitchPageSize.addEventListener('change', () => {
    if (switchPageSize) {
      switchPageSize.value = settingsSwitchPageSize.value;
    }
    state.switchPage = 1;
    renderSwitchTable();
    saveSettings({ switchPageSize: settingsSwitchPageSize.value });
  });
}

if (settingsBackupsPageSize) {
  settingsBackupsPageSize.addEventListener('change', () => {
    if (backupsPageSize) {
      backupsPageSize.value = settingsBackupsPageSize.value;
    }
    state.backupsPage = 1;
    renderBackupsTable();
    saveSettings({ backupsPageSize: settingsBackupsPageSize.value });
  });
}
if (backupsPrev) {
  backupsPrev.addEventListener('click', () => {
    state.backupsPage = Math.max(1, state.backupsPage - 1);
    renderBackupsTable();
  });
}
if (backupsNext) {
  backupsNext.addEventListener('click', () => {
    state.backupsPage += 1;
    renderBackupsTable();
  });
}
if (backupsPageSize) {
  backupsPageSize.addEventListener('change', () => {
    state.backupsPage = 1;
    renderBackupsTable();
    if (settingsBackupsPageSize) {
      settingsBackupsPageSize.value = backupsPageSize.value;
    }
    saveSettings({ backupsPageSize: backupsPageSize.value });
  });
}

if (settingsSwitchPageSize) {
  settingsSwitchPageSize.addEventListener('change', () => {
    switchPageSize.value = settingsSwitchPageSize.value;
    state.switchPage = 1;
    renderSwitchTable();
    saveSettings({ switchPageSize: settingsSwitchPageSize.value });
  });
}

if (settingsBackupsPageSize) {
  settingsBackupsPageSize.addEventListener('change', () => {
    backupsPageSize.value = settingsBackupsPageSize.value;
    state.backupsPage = 1;
    renderBackupsTable();
    saveSettings({ backupsPageSize: settingsBackupsPageSize.value });
  });
}

function applySelectAll(checked) {
  if (checked) {
    state.lastBackups.forEach((item) => {
      state.selectedBackupPaths.add(item.path);
    });
  } else {
    state.selectedBackupPaths.clear();
  }
  renderBackupsTable();
}

if (backupsDelete) {
  backupsDelete.addEventListener('click', async () => {
    if (state.selectedBackupPaths.size === 0) {
      showToast(t('labels.deleteEmpty'), 'error');
      return;
    }
    const confirmed = await promptConfirm({
      title: t('confirm.deleteTitle'),
      body: t('confirm.deleteBody'),
      confirmLabel: t('confirm.deleteConfirm'),
      confirmTone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const args = [];
    state.selectedBackupPaths.forEach((path) => {
      args.push('--path', path);
    });
    const response = await runCommandWithSudo('delete-backups', args);
    if (response.ok) {
      showToast(t('labels.deleteSuccess'));
      loadBackups();
    } else {
      showToast(response.error || 'Delete failed', 'error');
    }
  });
}

if (switchBtn) {
  switchBtn.addEventListener('click', async () => {
    const index = getSelectedBackupIndex();
    if (!index) {
      showToast(t('labels.selectBackup'), 'error');
      return;
    }
    const confirmed = await promptConfirm({
      title: t('confirm.switchTitle'),
      body: t('confirm.switchBody'),
      confirmLabel: t('confirm.switchConfirm'),
      confirmTone: 'primary',
    });
    if (!confirmed) {
      return;
    }
    const response = await runCommand('switch', ['--index', String(index)]);
    if (response.ok) {
      showToast(t('labels.switchNeedsRestart'));
      loadStatus();
    } else {
      showToast(response.error || 'Switch failed', 'error');
    }
  });
}

if (logRefresh) {
  logRefresh.addEventListener('click', loadLogs);
}
if (logAutoRefresh) {
  logAutoRefresh.addEventListener('change', (event) => {
    setLogAutoRefresh(event.target.checked);
    if (settingsLogAutoRefresh) {
      settingsLogAutoRefresh.checked = event.target.checked;
    }
    saveSettings({ logAutoRefresh: event.target.checked });
  });
}
if (logIntervalPreset) {
  logIntervalPreset.addEventListener('change', () => {
    updateInterval();
    if (settingsLogIntervalPreset) {
      settingsLogIntervalPreset.value = logIntervalPreset.value;
    }
    saveSettings({ logIntervalPreset: logIntervalPreset.value });
  });
}

if (settingsLogAutoRefresh) {
  settingsLogAutoRefresh.addEventListener('change', (event) => {
    if (logAutoRefresh) {
      logAutoRefresh.checked = event.target.checked;
      setLogAutoRefresh(event.target.checked);
      saveSettings({ logAutoRefresh: event.target.checked });
    }
  });
}

if (settingsLogIntervalPreset) {
  settingsLogIntervalPreset.addEventListener('change', () => {
    if (logIntervalPreset) {
      logIntervalPreset.value = settingsLogIntervalPreset.value;
      updateInterval();
      saveSettings({ logIntervalPreset: settingsLogIntervalPreset.value });
    }
  });
}

if (settingsLogLines) {
  settingsLogLines.addEventListener('change', (event) => {
    const value = Number.parseInt(event.target.value, 10) || 10;
    if (logLines) {
      logLines.value = value;
      saveSettings({ logLines: value });
    }
  });
}

if (logLines) {
  logLines.addEventListener('change', (event) => {
    const value = Number.parseInt(event.target.value, 10) || 10;
    if (settingsLogLines) {
      settingsLogLines.value = value;
    }
    saveSettings({ logLines: value });
  });
}

if (cleanBtn) {
  cleanBtn.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="cleanMode"]:checked');
    const mode = selected ? selected.value : 'all';
    const response = await runCommand('clean', ['--mode', mode]);
    if (response.ok) {
      showToast(t('labels.cleanDone'));
    } else {
      showToast(response.error || 'Clean failed', 'error');
    }
  });
}


if (refreshStatusBtn) {
  refreshStatusBtn.addEventListener('click', async () => {
    await loadStatus();
    showToast(t('labels.statusRefreshed'));
  });
}

if (overviewNetworkRefresh) {
  overviewNetworkRefresh.addEventListener('click', async () => {
    overviewNetworkRefresh.classList.add('is-loading');
    await loadOverview(true);
    setTimeout(() => overviewNetworkRefresh.classList.remove('is-loading'), 400);
  });
}

function startOverviewTimer() {
  if (state.overviewTimer) {
    clearInterval(state.overviewTimer);
  }
  state.overviewTimer = setInterval(() => {
    loadOverview();
  }, 5000);

  if (state.trafficTimer) {
    clearInterval(state.trafficTimer);
  }
  state.trafficTimer = setInterval(() => {
    loadTraffic();
  }, 1000);

  if (state.overviewLiteTimer) {
    clearInterval(state.overviewLiteTimer);
  }
  state.overviewLiteTimer = setInterval(() => {
    loadOverviewLite();
  }, 2000);

  if (state.overviewMemoryTimer) {
    clearInterval(state.overviewMemoryTimer);
  }
  state.overviewMemoryTimer = setInterval(() => {
    loadOverviewMemory();
  }, 1000);

  if (state.overviewTickTimer) {
    clearInterval(state.overviewTickTimer);
  }
  state.overviewTickTimer = setInterval(() => {
    if (!state.overviewRunning || !state.overviewUptimeAt || !overviewUptime) {
      return;
    }
    const elapsedSec = Math.max(0, Math.floor((Date.now() - state.overviewUptimeAt) / 1000));
    overviewUptime.textContent = formatUptime(state.overviewUptimeBaseSec + elapsedSec);
  }, 1000);
}

function bridgeReady() {
  return Boolean(window.clashfox && typeof window.clashfox.runCommand === 'function');
}

function waitForBridge(timeoutMs = 5000) {
  if (bridgeReady()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (bridgeReady()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 200);
  });
}

async function initApp() {
  await syncSettingsFromFile();
  applySettings(readSettings());
  setActiveNav(pageId);
  loadAppInfo();
  const ok = await waitForBridge();
  if (!ok) {
    showToast(t('labels.bridgeMissing'), 'error');
    return;
  }
  loadStatus();
  setTimeout(() => loadStatus(), 1200);
  setTimeout(() => loadStatus(), 4000);
  loadOverview();
  loadOverviewLite();
  loadOverviewMemory();
  updateInstallVersionVisibility();
  startOverviewTimer();
  loadConfigs();
  loadBackups();
  loadLogs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
