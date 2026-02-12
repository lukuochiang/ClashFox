let navButtons = Array.from(document.querySelectorAll('.nav-btn'));
let panels = Array.from(document.querySelectorAll('.panel'));
let toast = document.getElementById('toast');
let contentRoot = document.getElementById('contentRoot');
let currentPage = document.body ? document.body.dataset.page : '';

let statusRunning = document.getElementById('statusRunning');
let statusVersion = document.getElementById('statusVersion');
let statusKernelPath = document.getElementById('statusKernelPath');
let statusConfig = document.getElementById('statusConfig');
let statusKernelPathRow = document.getElementById('statusKernelPathRow');
let statusConfigRow = document.getElementById('statusConfigRow');
let statusPill = document.getElementById('statusPill');
let overviewUptime = document.getElementById('overviewUptime');
let overviewConnections = document.getElementById('overviewConnections');
let overviewMemory = document.getElementById('overviewMemory');
let overviewStatus = document.getElementById('overviewStatus');
let overviewKernel = document.getElementById('overviewKernel');
let overviewSystem = document.getElementById('overviewSystem');
let overviewVersion = document.getElementById('overviewVersion');
let overviewInternet = document.getElementById('overviewInternet');
let overviewDns = document.getElementById('overviewDns');
let overviewRouter = document.getElementById('overviewRouter');
let overviewNetwork = document.getElementById('overviewNetwork');
let overviewLocalIp = document.getElementById('overviewLocalIp');
let overviewProxyIp = document.getElementById('overviewProxyIp');
let overviewInternetIp = document.getElementById('overviewInternetIp');
let trafficSystemDownloadRate = document.getElementById('trafficSystemDownloadRate');
let trafficSystemDownloadTotal = document.getElementById('trafficSystemDownloadTotal');
let trafficSystemUploadRate = document.getElementById('trafficSystemUploadRate');
let trafficSystemUploadTotal = document.getElementById('trafficSystemUploadTotal');
let trafficTotalDownload = document.getElementById('trafficTotalDownload');
let trafficTotalUpload = document.getElementById('trafficTotalUpload');
let trafficUploadLine = document.getElementById('trafficUploadLine');
let trafficUploadArea = document.getElementById('trafficUploadArea');
let trafficDownloadLine = document.getElementById('trafficDownloadLine');
let trafficDownloadArea = document.getElementById('trafficDownloadArea');
let trafficUploadAxis = [];
let trafficDownloadAxis = [];
let tunToggle = document.getElementById('tunToggle');
let tunStackSelect = document.getElementById('tunStackSelect');
let quickHintNodes = [];

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
let overviewNetworkRefresh = document.getElementById('overviewNetworkRefresh');

let githubUser = document.getElementById('githubUser');
let installBtn = document.getElementById('installBtn');
let installStatus = document.getElementById('installStatus');
let installProgress = document.getElementById('installProgress');
let installVersionRow = document.getElementById('installVersionRow');
let installVersion = document.getElementById('installVersion');
let cancelInstallBtn = document.getElementById('cancelInstallBtn');
let configPathInput = document.getElementById('configPath');
let overviewConfigPath = document.getElementById('overviewConfigPath');
let overviewBrowseConfig = document.getElementById('overviewBrowseConfig');
let overviewConfigReset = document.getElementById('overviewConfigReset');
let browseConfigBtn = document.getElementById('browseConfig');
let externalControllerInput = document.getElementById('externalController');
let externalSecretInput = document.getElementById('externalSecret');
let externalAuthInput = document.getElementById('externalAuth');
let settingsExternalUi = document.getElementById('settingsExternalUi');
let panelSelect = document.getElementById('panelSelect');
let startBtn = document.getElementById('startBtn');
let stopBtn = document.getElementById('stopBtn');
let restartBtn = document.getElementById('restartBtn');
let proxyModeSelect = document.getElementById('proxyModeSelect');
let refreshStatusBtn = document.getElementById('refreshStatus');
let refreshBackups = document.getElementById('refreshBackups');
let backupsRefresh = document.getElementById('backupsRefresh');
let switchBtn = document.getElementById('switchBtn');
let backupTable = document.getElementById('backupTable');
let backupTableFull = document.getElementById('backupTableFull');
let configsRefresh = document.getElementById('configsRefresh');
let configTable = document.getElementById('configTable');
let kernelTable = document.getElementById('kernelTable');
let kernelRefresh = document.getElementById('kernelRefresh');
let kernelPrev = document.getElementById('kernelPrev');
let kernelNext = document.getElementById('kernelNext');
let kernelPageInfo = document.getElementById('kernelPageInfo');
let kernelPageSize = document.getElementById('kernelPageSize');
let switchPrev = document.getElementById('switchPrev');
let switchNext = document.getElementById('switchNext');
let switchPageInfo = document.getElementById('switchPageInfo');
let backupsPrev = document.getElementById('backupsPrev');
let backupsNext = document.getElementById('backupsNext');
let backupsPageInfo = document.getElementById('backupsPageInfo');
let backupsPageSize = document.getElementById('backupsPageSize');
let recommendPrev = document.getElementById('recommendPrev');
let recommendNext = document.getElementById('recommendNext');
let recommendPageInfo = document.getElementById('recommendPageInfo');
let recommendPageSize = document.getElementById('recommendPageSize');
let recommendTableBody = document.getElementById('recommendTableBody');
let backupsDelete = document.getElementById('backupsDelete');
let logLines = document.getElementById('logLines');
let logRefresh = document.getElementById('logRefresh');
let logContent = document.getElementById('logContent');
let logAutoRefresh = document.getElementById('logAutoRefresh');
let logIntervalPreset = document.getElementById('logIntervalPreset');

const LAYOUT_CACHE_VERSION = 'v2';
let cleanBtn = document.getElementById('cleanBtn');
let dashboardFrame = document.getElementById('dashboardFrame');
let dashboardEmpty = document.getElementById('dashboardEmpty');
let dashboardHint = document.getElementById('dashboardHint');
let sudoModal = document.getElementById('sudoModal');
let sudoPassword = document.getElementById('sudoPassword');
let sudoCancel = document.getElementById('sudoCancel');
let sudoConfirm = document.getElementById('sudoConfirm');
let confirmModal = document.getElementById('confirmModal');
let confirmTitle = document.getElementById('confirmTitle');
let confirmBody = document.getElementById('confirmBody');
let confirmCancel = document.getElementById('confirmCancel');
let confirmOk = document.getElementById('confirmOk');
let appName = document.getElementById('appName');
let appVersion = document.getElementById('appVersion');
let themeToggle = document.getElementById('themeToggle');
let settingsTheme = document.getElementById('settingsTheme');
let settingsLang = document.getElementById('settingsLang');
let settingsGithubUser = document.getElementById('settingsGithubUser');
let settingsConfigPath = document.getElementById('settingsConfigPath');
let settingsBrowseConfig = document.getElementById('settingsBrowseConfig');
let settingsKernelPath = document.getElementById('settingsKernelPath');
let settingsConfigDefault = document.getElementById('settingsConfigDefault');
let settingsLogPath = document.getElementById('settingsLogPath');
let settingsConfigDir = document.getElementById('settingsConfigDir');
let settingsCoreDir = document.getElementById('settingsCoreDir');
let settingsDataDir = document.getElementById('settingsDataDir');
let settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
let settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
let settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
let settingsLogLines = document.getElementById('settingsLogLines');
let settingsLogAutoRefresh = document.getElementById('settingsLogAutoRefresh');
let settingsLogIntervalPreset = document.getElementById('settingsLogIntervalPreset');
let settingsKernelPageSize = document.getElementById('settingsKernelPageSize');
let settingsBackupsPageSize = document.getElementById('settingsBackupsPageSize');
let settingsDebugMode = document.getElementById('settingsDebugMode');

let langButtons = Array.from(document.querySelectorAll('.lang-btn'));

const I18N = window.CLASHFOX_I18N || {};
;

const SETTINGS_KEY = 'clashfox-settings';
const DEFAULT_SETTINGS = {
  lang: 'auto',
  themePreference: 'auto',
  githubUser: 'vernesong',
  configPath: '',
  configDir: '',
  coreDir: '',
  dataDir: '',
  panelChoice: '',
  externalUi: 'ui',
  externalController: '127.0.0.1:9090',
  secret: 'clashfox',
  authentication: ['mihomo:clashfox'],
  proxyMode: 'rule',
  tunEnabled: false,
  tunStack: 'mixed',
  logLines: 10,
  logAutoRefresh: false,
  logIntervalPreset: '3',
  kernelPageSize: '10',
  backupsPageSize: '10',
  debugMode: false,
};

let PANEL_PRESETS = {};
let RECOMMENDED_CONFIGS = [];

const STATIC_CONFIGS_URL = new URL('../../static/configs.json', window.location.href);

const state = {
  lang: 'auto',
  lastBackups: [],
  configs: [],
  kernels: [],
  fileSettings: {},
  logTimer: null,
  logIntervalMs: 3000,
  switchPage: 1,
  backupsPage: 1,
  recommendPage: 1,
  kernelsPage: 1,
  kernelPageSizeLocal: null,
  generalPageSizeLocal: null,
  selectedBackupPaths: new Set(),
  theme: 'night',
  themePreference: 'auto',
  installState: 'idle',
  dashboardAlerted: false,
  dashboardLoaded: false,
  autoPanelInstalled: false,
  panelInstallRequested: false,
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
  trafficHistoryRx: [],
  trafficHistoryTx: [],
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
    if (!current || typeof current !== 'object') return '';
    current = current[part];
  }
  return current || '';
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

  if (statusPill) {
    statusPill.setAttribute('aria-label', t('labels.unknown'));
    statusPill.setAttribute('title', t('labels.unknown'));
    statusPill.dataset.state = 'unknown';
  }
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
    return { ...DEFAULT_SETTINGS, ...(state.fileSettings || {}) };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.configFile && !parsed.configPath) {
      parsed.configPath = parsed.configFile;
      delete parsed.configFile;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    }
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (state.fileSettings) {
      if (!merged.configPath && state.fileSettings.configPath) merged.configPath = state.fileSettings.configPath;
      if (!merged.configDir && state.fileSettings.configDir) merged.configDir = state.fileSettings.configDir;
      if (!merged.coreDir && state.fileSettings.coreDir) merged.coreDir = state.fileSettings.coreDir;
      if (!merged.dataDir && state.fileSettings.dataDir) merged.dataDir = state.fileSettings.dataDir;
      if (!merged.logDir && state.fileSettings.logDir) merged.logDir = state.fileSettings.logDir;
      if (!merged.pidDir && state.fileSettings.pidDir) merged.pidDir = state.fileSettings.pidDir;
    }
    if (merged.configPath && (!parsed.configPath || parsed.configPath !== merged.configPath)) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, ...(state.fileSettings || {}) };
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
  if (merged.configFile && !merged.configPath) {
    merged.configPath = merged.configFile;
  }
  if (merged.configFile) {
    delete merged.configFile;
  }
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
  state.fileSettings = { ...merged };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { externalUiUrl, externalUiName, ...fileSettings } = merged;
    window.clashfox.writeSettings(fileSettings);
  }
}

function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  state.fileSettings = { ...state.fileSettings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  if (window.clashfox && typeof window.clashfox.writeSettings === 'function') {
    const { externalUiUrl, externalUiName, ...fileSettings } = state.settings;
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
  sendDashboardTheme();
  updateThemeToggle();
}

function applyThemePreference(preference, persist = true) {
  state.themePreference = preference;
  if (settingsTheme) {
    settingsTheme.value = preference;
  }
  applyTheme(resolveTheme(preference));
  syncThemeSource(preference);
  sendDashboardTheme();
  if (persist) {
    saveSettings({ themePreference: preference });
  }
  updateThemeToggle();
}

function applySettings(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  if (!state.settings.panelChoice) {
    state.settings.panelChoice = 'zashboard';
    saveSettings({ panelChoice: 'zashboard' });
  }
  if (!state.settings.externalUi) {
    state.settings.externalUi = 'ui';
    saveSettings({ externalUi: 'ui' });
  }
  const externalUi = state.settings.dataDir
    ? `${String(state.settings.dataDir).replace(/\/+$/, '')}/ui`
    : '';
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
  if (settingsExternalUi) {
    settingsExternalUi.value = state.settings.externalUi || 'ui';
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
  if (externalControllerInput) {
    externalControllerInput.value = state.settings.externalController || '';
  }
  if (externalSecretInput) {
    externalSecretInput.value = state.settings.secret || '';
  }
  if (externalAuthInput) {
    const auth = Array.isArray(state.settings.authentication) ? state.settings.authentication : (state.settings.authentication ? [state.settings.authentication] : []);
    externalAuthInput.value = auth.join('\n');
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
  if (proxyModeSelect) {
    proxyModeSelect.value = state.settings.proxyMode || 'rule';
  }
  if (tunToggle) {
    tunToggle.checked = Boolean(state.settings.tunEnabled);
  }
  if (tunStackSelect) {
    tunStackSelect.value = state.settings.tunStack || 'mixed';
  }
  if (panelSelect) {
    panelSelect.value = state.settings.panelChoice || '';
  }
  updateDashboardFrameSrc();
  if (kernelPageSize) {
    kernelPageSize.value = state.settings.kernelPageSize;
  }
  if (settingsKernelPageSize) {
    settingsKernelPageSize.value = state.settings.kernelPageSize;
  }
  state.kernelPageSizeLocal = state.settings.kernelPageSize || '10';
  state.generalPageSizeLocal = state.settings.backupsPageSize || '10';
  if (kernelPageSize) {
    kernelPageSize.value = state.kernelPageSizeLocal;
  }
  if (backupsPageSize) {
    backupsPageSize.value = state.kernelPageSizeLocal;
  }
  if (recommendPageSize) {
    recommendPageSize.value = state.generalPageSizeLocal;
  }
  if (settingsBackupsPageSize) {
    settingsBackupsPageSize.value = state.settings.backupsPageSize;
  }
  renderRecommendTable();
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

if (window.clashfox && typeof window.clashfox.onTrayRefresh === 'function') {
  window.clashfox.onTrayRefresh(() => {
    loadStatus();
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
  if (!message || message === 'empty_object') {
    return;
  }
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
  const effectiveSettings = { ...(state.fileSettings || {}), ...(state.settings || {}) };
  const pathArgs = [];
  if (effectiveSettings.configDir) {
    pathArgs.push('--config-dir', effectiveSettings.configDir);
  }
  if (effectiveSettings.coreDir) {
    pathArgs.push('--core-dir', effectiveSettings.coreDir);
  }
  if (effectiveSettings.dataDir) {
    pathArgs.push('--data-dir', effectiveSettings.dataDir);
  }
  return window.clashfox.runCommand(command, [...pathArgs, ...args]);
}

async function loadStaticConfigs() {
  try {
    const response = await fetch(STATIC_CONFIGS_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`load_failed_${response.status}`);
    }
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      if (payload.panelPresets && typeof payload.panelPresets === 'object') {
        PANEL_PRESETS = payload.panelPresets;
      }
      if (Array.isArray(payload.recommendedConfigs)) {
        RECOMMENDED_CONFIGS = payload.recommendedConfigs;
      }
    }
  } catch (error) {
    console.warn('Failed to load static configs.', error);
  }
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
    if (appName) {
      appName.textContent = response.data.name || 'ClashFox';
    }
    const version = response.data.version || '0.0.0';
    const buildNumber = response.data.buildNumber;
    const suffix = buildNumber ? `(${buildNumber})` : '';
    const displayVersion = `v${version}${suffix}`;
    if (appVersion) {
      appVersion.textContent = displayVersion;
    }
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
  if (overviewStatus) {
    overviewStatus.textContent = running ? t('labels.running') : t('labels.stopped');
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
    restartBtn.disabled = !hasKernel || !running || state.coreActionInFlight;
  }
  if (quickHintNodes.length) {
  // quick hint removed
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
  if (settingsExternalUi) {
    settingsExternalUi.placeholder = 'ui';
  }
  syncRunningIndicators(running, { allowTransitionOverride: true });
  renderConfigTable();
}

function setStatusInterim(running) {
  syncRunningIndicators(running, { allowTransitionOverride: true });
}

function setCoreActionState(inFlight) {
  state.coreActionInFlight = inFlight;
  startBtn.disabled = inFlight;
  stopBtn.disabled = inFlight;
  restartBtn.disabled = inFlight || !state.coreRunning;
}

function syncRunningIndicators(running, { allowTransitionOverride = false } = {}) {
  const label = running ? t('labels.running') : t('labels.stopped');
  if (statusRunning) {
    statusRunning.textContent = label;
  }
  if (overviewStatus) {
    overviewStatus.textContent = label;
  }
  if (statusPill) {
    if (statusPill.dataset.state === 'transition' && !allowTransitionOverride) {
      return;
    }
    statusPill.dataset.state = running ? 'running' : 'stopped';
    statusPill.setAttribute('aria-label', label);
    statusPill.setAttribute('title', label);
  }
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

const TRAFFIC_HISTORY_POINTS = 26;

function niceMaxValue(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 8;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let factor = 10;
  if (normalized <= 1) factor = 1;
  else if (normalized <= 2) factor = 2;
  else if (normalized <= 5) factor = 5;
  return factor * magnitude;
}

function formatKbpsLabel(kbPerSec) {
  const num = Number.parseFloat(kbPerSec);
  if (!Number.isFinite(num)) {
    return '-';
  }
  if (num >= 1024) {
    const value = num / 1024;
    const fixed = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(fixed)} MB/s`;
  }
  return `${Math.round(num)} KB/s`;
}

function buildSparkPath(values, maxValue) {
  if (!values.length) {
    return '';
  }
  const width = 100;
  const height = 40;
  const len = values.length;
  const denom = maxValue > 0 ? maxValue : 1;
  const points = values.map((value, index) => {
    const x = len === 1 ? 0 : (index / (len - 1)) * width;
    const y = height - (Math.min(Math.max(value, 0), denom) / denom) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${points.join(' L ')}`;
}

function buildSparkArea(values, maxValue) {
  if (!values.length) {
    return '';
  }
  const width = 100;
  const height = 40;
  const line = buildSparkPath(values, maxValue);
  if (!line) {
    return '';
  }
  const lastX = values.length === 1 ? 0 : 100;
  return `${line} L ${lastX},${height} L 0,${height} Z`;
}

function renderTrafficChart(values, lineEl, areaEl, axisEls) {
  if (!lineEl || !areaEl || !axisEls.length) {
    return;
  }
  if (!values.length) {
    axisEls.forEach((el) => {
      el.textContent = '-';
    });
    lineEl.setAttribute('d', '');
    areaEl.setAttribute('d', '');
    return;
  }
  const maxValue = Math.max(...values, 0);
  let niceMax = niceMaxValue(maxValue);
  if (niceMax < 8) {
    niceMax = 8;
  }
  const step = niceMax / 4;
  axisEls.forEach((el, index) => {
    const labelValue = step * (4 - index);
    el.textContent = formatKbpsLabel(labelValue);
  });
  lineEl.setAttribute('d', buildSparkPath(values, niceMax));
  areaEl.setAttribute('d', buildSparkArea(values, niceMax));
}

function updateTrafficHistory(rxRate, txRate) {
  const rxK = Math.max(0, rxRate / 1024);
  const txK = Math.max(0, txRate / 1024);
  state.trafficHistoryRx.push(rxK);
  state.trafficHistoryTx.push(txK);
  if (state.trafficHistoryRx.length > TRAFFIC_HISTORY_POINTS) {
    state.trafficHistoryRx.shift();
  }
  if (state.trafficHistoryTx.length > TRAFFIC_HISTORY_POINTS) {
    state.trafficHistoryTx.shift();
  }
  renderTrafficChart(state.trafficHistoryTx, trafficUploadLine, trafficUploadArea, trafficUploadAxis);
  renderTrafficChart(state.trafficHistoryRx, trafficDownloadLine, trafficDownloadArea, trafficDownloadAxis);
}

function resetTrafficHistory() {
  state.trafficHistoryRx = [];
  state.trafficHistoryTx = [];
  renderTrafficChart(state.trafficHistoryTx, trafficUploadLine, trafficUploadArea, trafficUploadAxis);
  renderTrafficChart(state.trafficHistoryRx, trafficDownloadLine, trafficDownloadArea, trafficDownloadAxis);
}

function parseAuthList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    if (trafficTotalDownload) {
      trafficTotalDownload.textContent = '-';
    }
    if (trafficTotalUpload) {
      trafficTotalUpload.textContent = '-';
    }
    state.trafficRxBytes = null;
    state.trafficTxBytes = null;
    state.trafficAt = 0;
    resetTrafficHistory();
    return;
  }

  if (trafficSystemDownloadTotal) {
    trafficSystemDownloadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(rx)}`;
  }
  if (trafficSystemUploadTotal) {
    trafficSystemUploadTotal.textContent = `${t('status.trafficTotal')}: ${formatBytes(tx)}`;
  }
  if (trafficTotalDownload) {
    trafficTotalDownload.textContent = formatBytes(rx);
  }
  if (trafficTotalUpload) {
    trafficTotalUpload.textContent = formatBytes(tx);
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
  updateTrafficHistory(rxRate, txRate);
}

function updateProxyTraffic(rxBytes, txBytes) {
  return;
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
  syncRunningIndicators(state.overviewRunning, { allowTransitionOverride: false });
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
  // 运行状态统一由 updateStatusUI / setStatusInterim 管理，避免并发刷新不同步
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
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  const response = await runCommand('status', args);
  if (!response.ok) {
    const msg = response.error === 'bridge_missing' ? t('labels.bridgeMissing') : (response.error || 'Status error');
    showToast(msg, 'error');
    return;
  }
  updateStatusUI(response.data);
  loadTunStatus(false);
}

async function loadOverview(showToastOnSuccess = false) {
  if (state.overviewLoading) {
    return false;
  }
  state.overviewLoading = true;
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  args.push(...getControllerArgs());
  const response = await runCommand('overview', args);
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
  loadTunStatus(false);
  return true;
}

async function loadTunStatus(showToastOnSuccess = false) {
  if (!tunToggle && !tunStackSelect) {
    return;
  }
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  args.push(...getControllerArgs());
  const response = await runCommand('tun-status', args);
  if (!response.ok || !response.data) {
    return;
  }
  if (tunToggle && typeof response.data.enabled === 'boolean') {
    tunToggle.checked = response.data.enabled;
    if (state.settings.tunEnabled !== response.data.enabled) {
      saveSettings({ tunEnabled: response.data.enabled });
    }
  }
  if (tunStackSelect && typeof response.data.stack === 'string') {
    tunStackSelect.value = response.data.stack;
    if (state.settings.tunStack !== response.data.stack) {
      saveSettings({ tunStack: response.data.stack });
    }
  }
  if (showToastOnSuccess) {
    showToast(t('labels.tunRefreshed'));
  }
}

async function loadOverviewLite() {
  if (state.overviewLiteLoading) {
    return false;
  }
  state.overviewLiteLoading = true;
  const configPath = getCurrentConfigPath();
  const args = configPath ? ['--config', configPath] : [];
  args.push(...getControllerArgs());
  const response = await runCommand('overview-lite', args);
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
  args.push(...getControllerArgs());
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
    const selected = state.settings.configPath.trim();
    if (selected) {
      if (!state.configs || state.configs.length === 0) {
        candidates.push(selected);
      } else {
        const exists = state.configs.some((item) => item && item.path === selected);
        if (exists) {
          candidates.push(selected);
        }
      }
    }
  }
  const explicit = candidates.find((value) => value && value.trim());
  return (explicit || state.configDefault || '').trim();
}

function syncThemeSource(preference) {
  if (!window.clashfox || typeof window.clashfox.setThemeSource !== 'function') {
    return;
  }
  let source = 'system';
  if (preference === 'day') {
    source = 'light';
  } else if (preference === 'night') {
    source = 'dark';
  }
  window.clashfox.setThemeSource(source);
}

function sendDashboardTheme() {
  if (!dashboardFrame || !dashboardFrame.contentWindow) {
    return;
  }
  updateDashboardFrameSrc();
  const themeValue = state.theme === 'night' ? 'dark' : 'light';
  try {
    dashboardFrame.contentWindow.postMessage(
      { type: 'clashfox-theme', theme: themeValue },
      '*'
    );
  } catch {
    // ignore cross-origin errors
  }
}


function getControllerArgs() {
  const settings = state.settings || readSettings();
  const args = [];
  const controller = (settings.externalController || '').trim();
  const secret = (settings.secret || '').trim();
  if (controller) {
    args.push('--controller', controller);
  }
  if (secret) {
    args.push('--secret', secret);
  }
  return args;
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
  // html += `<th class="path-col">${t('table.path')}</th>`;
  html += `<th class="modified-col">${t('table.modified')}</th>`;
  html += `<th class="current-col">${t('table.current')}</th>`;
  html += '</tr></thead><tbody>';
  items.forEach((item) => {
    const isCurrent = currentPath && item.path === currentPath;
    const rowClass = isCurrent ? 'selectable selected' : 'selectable';
    html += `<tr class="${rowClass}" data-path="${item.path || ''}">`;
    html += `<td class="name-col">${item.name || '-'}</td>`;
    // html += `<td class="path-col">${item.path || '-'}</td>`;
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
  const pageSizeRaw = state.kernelPageSizeLocal || (kernelPageSize && kernelPageSize.value) || state.settings.kernelPageSize || '10';
  const size = Number.parseInt(pageSizeRaw, 10) || 10;
  const pageData = paginate(items, state.kernelsPage, size);
  state.kernelsPage = pageData.page;
  kernelPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${items.length}`;
  kernelPrev.disabled = pageData.page <= 1;
  kernelNext.disabled = pageData.page >= pageData.totalPages;

  let html = '<div class="table-row header kernel">';
  html += `<div class="version-head">${t('table.version')}</div>`;
  html += `<div class="time-head">${t('table.time')}</div></div>`;

  pageData.items.forEach((item) => {
    const name = item && item.name ? item.name : '-';
    const backupMatch = /^mihomo\\.backup\\.(mihomo-darwin-(amd64|arm64)-.+)\\.([0-9]{8}_[0-9]{6})$/.exec(name);
    const isBackup = Boolean(backupMatch);
    const isCurrent = !isBackup && (name === 'mihomo' || name.startsWith('mihomo-darwin-'));
    const displayName = backupMatch ? backupMatch[1] : name;
    const timestamp = backupMatch ? backupMatch[4] : (item.modified || '-');
    const tags = [];
    if (isCurrent) {
      tags.push(`<span class="tag current">${t('labels.current')}</span>`);
    }
    if (isBackup) {
      tags.push(`<span class="tag backup">${t('labels.backup')}</span>`);
    }
    html += '<div class="table-row kernel">';
    html += `<div class="version-cell"><span class="kernel-name">${displayName || '-'}</span>${tags.length ? ` <span class="tag-group">${tags.join('')}</span>` : ''}</div>`;
    html += `<div class="time-cell">${timestamp}</div></div>`;
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
  if (!backupTable || !kernelPageSize || !switchPageInfo || !switchPrev || !switchNext) {
    return;
  }
  const size = Number.parseInt(state.kernelPageSizeLocal || kernelPageSize.value || '10', 10) || 10;
  const pageData = renderBackups(backupTable, true, state.switchPage, size, false);
  state.switchPage = pageData.page;
  switchPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  switchPrev.disabled = pageData.page <= 1;
  switchNext.disabled = pageData.page >= pageData.totalPages;
}

function renderBackupsTable() {
  if (!backupTableFull || !backupsPageInfo || !backupsPrev || !backupsNext) {
    return;
  }
  const pageSizeRaw = state.kernelPageSizeLocal || (kernelPageSize && kernelPageSize.value) || state.settings.kernelPageSize || '10';
  const size = Number.parseInt(pageSizeRaw, 10) || 10;
  const pageData = renderBackups(backupTableFull, false, state.backupsPage, size, true);
  state.backupsPage = pageData.page;
  backupsPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${state.lastBackups.length}`;
  backupsPrev.disabled = pageData.page <= 1;
  backupsNext.disabled = pageData.page >= pageData.totalPages;
}

function renderRecommendTable() {
  if (!recommendTableBody || !recommendPageSize || !recommendPageInfo || !recommendPrev || !recommendNext) {
    return;
  }
  const size = Number.parseInt(state.generalPageSizeLocal || recommendPageSize.value || '10', 10) || 10;
  const pageData = paginate(RECOMMENDED_CONFIGS, state.recommendPage, size);
  state.recommendPage = pageData.page;
  recommendPageInfo.textContent = `${pageData.page} / ${pageData.totalPages} · ${RECOMMENDED_CONFIGS.length}`;
  recommendPrev.disabled = pageData.page <= 1;
  recommendNext.disabled = pageData.page >= pageData.totalPages;

  const startIndex = (pageData.page - 1) * size;
  let html = '';
  pageData.items.forEach((item, index) => {
    const githubLabel = (item.github || '').replace(/^https?:\/\//, '');
    html += '<tr>';
    html += `<td class="index-col">${startIndex + index + 1}</td>`;
    html += `<td class="name-col">${item.name || '-'}</td>`;
    html += '<td class="github-col">';
    html += `<a class="recommend-link" href="${item.github}" target="_blank" rel="noopener noreferrer">${githubLabel || '-'}</a>`;
    html += '</td>';
    html += `<td class="dir-col">${item.dir || '-'}</td>`;
    html += `<td class="rating-col">${item.rating || '-'}</td>`;
    html += '</tr>';
  });
  if (pageData.items.length === 0) {
    html = `<tr><td class="empty-cell" colspan="5">${t('labels.configsEmpty')}</td></tr>`;
  }
  recommendTableBody.innerHTML = html;
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

function refreshLayoutRefs() {
  navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  appName = document.getElementById('appName');
  appVersion = document.getElementById('appVersion');
  themeToggle = document.getElementById('themeToggle');
  refreshStatusBtn = document.getElementById('refreshStatus');
  statusPill = document.getElementById('statusPill');
}

function refreshPageRefs() {
  panels = Array.from(document.querySelectorAll('.panel'));
  toast = document.getElementById('toast');
  contentRoot = document.getElementById('contentRoot');

  statusRunning = document.getElementById('statusRunning');
  statusVersion = document.getElementById('statusVersion');
  statusKernelPath = document.getElementById('statusKernelPath');
  statusConfig = document.getElementById('statusConfig');
  statusKernelPathRow = document.getElementById('statusKernelPathRow');
  statusConfigRow = document.getElementById('statusConfigRow');
  statusPill = document.getElementById('statusPill');
  overviewUptime = document.getElementById('overviewUptime');
  overviewConnections = document.getElementById('overviewConnections');
  overviewMemory = document.getElementById('overviewMemory');
  overviewStatus = document.getElementById('overviewStatus');
  overviewKernel = document.getElementById('overviewKernel');
  overviewSystem = document.getElementById('overviewSystem');
  overviewVersion = document.getElementById('overviewVersion');
  overviewInternet = document.getElementById('overviewInternet');
  overviewDns = document.getElementById('overviewDns');
  overviewRouter = document.getElementById('overviewRouter');
  overviewNetwork = document.getElementById('overviewNetwork');
  overviewLocalIp = document.getElementById('overviewLocalIp');
  overviewProxyIp = document.getElementById('overviewProxyIp');
  overviewInternetIp = document.getElementById('overviewInternetIp');
  trafficSystemDownloadRate = document.getElementById('trafficSystemDownloadRate');
  trafficSystemDownloadTotal = document.getElementById('trafficSystemDownloadTotal');
  trafficSystemUploadRate = document.getElementById('trafficSystemUploadRate');
  trafficSystemUploadTotal = document.getElementById('trafficSystemUploadTotal');
  trafficTotalDownload = document.getElementById('trafficTotalDownload');
  trafficTotalUpload = document.getElementById('trafficTotalUpload');
  trafficUploadLine = document.getElementById('trafficUploadLine');
  trafficUploadArea = document.getElementById('trafficUploadArea');
  trafficDownloadLine = document.getElementById('trafficDownloadLine');
  trafficDownloadArea = document.getElementById('trafficDownloadArea');
  trafficUploadAxis = [
    document.getElementById('trafficUploadAxis4'),
    document.getElementById('trafficUploadAxis3'),
    document.getElementById('trafficUploadAxis2'),
    document.getElementById('trafficUploadAxis1'),
  ].filter(Boolean);
  trafficDownloadAxis = [
    document.getElementById('trafficDownloadAxis4'),
    document.getElementById('trafficDownloadAxis3'),
    document.getElementById('trafficDownloadAxis2'),
    document.getElementById('trafficDownloadAxis1'),
  ].filter(Boolean);
  quickHintNodes = [];
  overviewNetworkRefresh = document.getElementById('overviewNetworkRefresh');

  githubUser = document.getElementById('githubUser');
  installBtn = document.getElementById('installBtn');
  installStatus = document.getElementById('installStatus');
  installProgress = document.getElementById('installProgress');
  installVersionRow = document.getElementById('installVersionRow');
  installVersion = document.getElementById('installVersion');
  cancelInstallBtn = document.getElementById('cancelInstallBtn');
  configPathInput = document.getElementById('configPath');
  overviewConfigPath = document.getElementById('overviewConfigPath');
  overviewBrowseConfig = document.getElementById('overviewBrowseConfig');
  overviewConfigReset = document.getElementById('overviewConfigReset');
  browseConfigBtn = document.getElementById('browseConfig');
  externalControllerInput = document.getElementById('externalController');
  externalSecretInput = document.getElementById('externalSecret');
  externalAuthInput = document.getElementById('externalAuth');
  settingsExternalUi = document.getElementById('settingsExternalUi');
  panelSelect = document.getElementById('panelSelect');
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  restartBtn = document.getElementById('restartBtn');
  proxyModeSelect = document.getElementById('proxyModeSelect');
  tunToggle = document.getElementById('tunToggle');
  tunStackSelect = document.getElementById('tunStackSelect');
  refreshStatusBtn = document.getElementById('refreshStatus');
  refreshBackups = document.getElementById('refreshBackups');
  backupsRefresh = document.getElementById('backupsRefresh');
  switchBtn = document.getElementById('switchBtn');
  backupTable = document.getElementById('backupTable');
  backupTableFull = document.getElementById('backupTableFull');
  configsRefresh = document.getElementById('configsRefresh');
  configTable = document.getElementById('configTable');
  kernelTable = document.getElementById('kernelTable');
  kernelRefresh = document.getElementById('kernelRefresh');
  kernelPrev = document.getElementById('kernelPrev');
  kernelNext = document.getElementById('kernelNext');
  kernelPageInfo = document.getElementById('kernelPageInfo');
  kernelPageSize = document.getElementById('kernelPageSize');
  switchPrev = document.getElementById('switchPrev');
  switchNext = document.getElementById('switchNext');
  switchPageInfo = document.getElementById('switchPageInfo');
  backupsPrev = document.getElementById('backupsPrev');
  backupsNext = document.getElementById('backupsNext');
  backupsPageInfo = document.getElementById('backupsPageInfo');
  backupsPageSize = document.getElementById('backupsPageSize');
  recommendPrev = document.getElementById('recommendPrev');
  recommendNext = document.getElementById('recommendNext');
  recommendPageInfo = document.getElementById('recommendPageInfo');
  recommendPageSize = document.getElementById('recommendPageSize');
  recommendTableBody = document.getElementById('recommendTableBody');
  backupsDelete = document.getElementById('backupsDelete');
  logLines = document.getElementById('logLines');
  logRefresh = document.getElementById('logRefresh');
  logContent = document.getElementById('logContent');
  logAutoRefresh = document.getElementById('logAutoRefresh');
  logIntervalPreset = document.getElementById('logIntervalPreset');
  cleanBtn = document.getElementById('cleanBtn');
  dashboardFrame = document.getElementById('dashboardFrame');
  dashboardEmpty = document.getElementById('dashboardEmpty');
  dashboardHint = document.getElementById('dashboardHint');
  sudoModal = document.getElementById('sudoModal');
  sudoPassword = document.getElementById('sudoPassword');
  sudoCancel = document.getElementById('sudoCancel');
  sudoConfirm = document.getElementById('sudoConfirm');
  confirmModal = document.getElementById('confirmModal');
  confirmTitle = document.getElementById('confirmTitle');
  confirmBody = document.getElementById('confirmBody');
  confirmCancel = document.getElementById('confirmCancel');
  confirmOk = document.getElementById('confirmOk');
  appName = document.getElementById('appName');
  appVersion = document.getElementById('appVersion');
  themeToggle = document.getElementById('themeToggle');
  settingsTheme = document.getElementById('settingsTheme');
  settingsLang = document.getElementById('settingsLang');
  settingsGithubUser = document.getElementById('settingsGithubUser');
  settingsConfigPath = document.getElementById('settingsConfigPath');
  settingsBrowseConfig = document.getElementById('settingsBrowseConfig');
  settingsKernelPath = document.getElementById('settingsKernelPath');
  settingsConfigDefault = document.getElementById('settingsConfigDefault');
  settingsLogPath = document.getElementById('settingsLogPath');
  settingsConfigDir = document.getElementById('settingsConfigDir');
  settingsCoreDir = document.getElementById('settingsCoreDir');
  settingsDataDir = document.getElementById('settingsDataDir');
  settingsConfigDirReveal = document.getElementById('settingsConfigDirReveal');
  settingsCoreDirReveal = document.getElementById('settingsCoreDirReveal');
  settingsDataDirReveal = document.getElementById('settingsDataDirReveal');
  settingsLogLines = document.getElementById('settingsLogLines');
  settingsLogAutoRefresh = document.getElementById('settingsLogAutoRefresh');
  settingsLogIntervalPreset = document.getElementById('settingsLogIntervalPreset');
  settingsKernelPageSize = document.getElementById('settingsKernelPageSize');
  settingsBackupsPageSize = document.getElementById('settingsBackupsPageSize');
  settingsDebugMode = document.getElementById('settingsDebugMode');
  langButtons = Array.from(document.querySelectorAll('.lang-btn'));
}

function bindNavButtons() {
  navButtons.forEach((btn) => {
    if (btn.dataset.bound === 'true') {
      return;
    }
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const targetUrl = btn.dataset.url;
      if (targetUrl) {
        if (window.clashfox && typeof window.clashfox.openExternal === 'function') {
          window.clashfox.openExternal(targetUrl);
        } else {
          window.open(targetUrl);
        }
        return;
      }
      const targetPage = btn.dataset.page;
      if (targetPage) {
        navigatePage(targetPage);
        return;
      }
      const target = btn.dataset.section;
      if (target) {
        setActiveSection(target);
      }
    });
  });
}

function bindTopbarActions() {
  if (themeToggle && themeToggle.dataset.bound !== 'true') {
    themeToggle.dataset.bound = 'true';
    themeToggle.addEventListener('click', () => {
      const nextTheme = state.theme === 'night' ? 'day' : 'night';
      applyThemePreference(nextTheme);
    });
  }
  if (refreshStatusBtn && refreshStatusBtn.dataset.bound !== 'true') {
    refreshStatusBtn.dataset.bound = 'true';
    refreshStatusBtn.addEventListener('click', async () => {
      await Promise.all([
        loadStatus(),
        loadOverviewLite(),
        loadOverview(),
        loadOverviewMemory(),
      ]);
      showToast(t('labels.statusRefreshed'));
    });
  }
}

function refreshPageView() {
  renderConfigTable();
  renderKernelTable();
  renderSwitchTable();
  renderBackupsTable();
  renderRecommendTable();
  if (logContent || logLines) {
    loadLogs();
  }
  loadStatus();
  if (currentPage === 'install') {
    loadKernels();
  }
  if (currentPage === 'overview') {
    Promise.all([
      loadOverview(),
      loadOverviewLite(),
      loadOverviewMemory(),
    ]);
  }
}

function normalizePageName(page) {
  if (page === 'status') return 'overview';
  if (page === 'control') return 'config';
  return page;
}

function getPageFromLocation() {
  const path = window.location.pathname || '';
  const match = path.match(/([^/]+)\.html$/);
  return normalizePageName(match ? match[1] : currentPage);
}

async function navigatePage(targetPage, pushState = true) {
  const normalized = normalizePageName(targetPage);
  if (!normalized || normalized === currentPage) {
    return;
  }
  if (!contentRoot) {
    window.location.href = `${normalized}.html`;
    return;
  }
  const response = await fetch(`${normalized}.html`);
  if (!response.ok) {
    window.location.href = `${normalized}.html`;
    return;
  }
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const newRoot = doc.getElementById('contentRoot');
  if (!newRoot || !newRoot.firstElementChild) {
    window.location.href = `${targetPage}.html`;
    return;
  }
  const newSection = document.importNode(newRoot.firstElementChild, true);
  newSection.classList.add('page-section');
  contentRoot.innerHTML = '';
  contentRoot.appendChild(newSection);

  currentPage = normalized;
  if (document.body) {
    document.body.dataset.page = normalized;
  }
  setActiveNav(normalized);
  refreshPageRefs();
  applySettings(state.settings || readSettings());
  applyI18n();
  bindPageEvents();
  refreshPageView();
  if (normalized === 'dashboard') {
    initDashboardFrame();
  }
  if (pushState) {
    history.pushState({ page: normalized }, '', `${normalized}.html`);
  }
}

function setLayoutReady() {
  if (document.body && !document.body.classList.contains('layout-ready')) {
    document.body.classList.add('layout-ready');
  }
}

function updateScrollbarWidthVar() {
  const measure = document.createElement('div');
  measure.style.width = '100px';
  measure.style.height = '100px';
  measure.style.overflow = 'scroll';
  measure.style.position = 'absolute';
  measure.style.top = '-9999px';
  document.body.appendChild(measure);
  const width = measure.offsetWidth - measure.clientWidth;
  document.body.removeChild(measure);
  document.documentElement.style.setProperty('--scrollbar-width', `${width}px`);
}

async function loadLayoutParts() {
  const menuContainer = document.getElementById('menuContainer');
  const topbarContainer = document.getElementById('topbarContainer');
  const overlayRoot = document.getElementById('overlayRoot');
  let hasCache = false;
  const layoutKey = (key) => `layout:${LAYOUT_CACHE_VERSION}:${key}`;
  const applyCachedFragment = (key, target) => {
    if (!target) {
      return;
    }
    const cached = sessionStorage.getItem(layoutKey(key));
    if (cached) {
      target.innerHTML = cached;
      hasCache = true;
    }
  };
  try {
    if (menuContainer) {
      const cachedMenu = sessionStorage.getItem(layoutKey('menu'));
      if (cachedMenu) {
        menuContainer.innerHTML = cachedMenu;
        hasCache = true;
      }
    }
    if (topbarContainer) {
      const cachedTopbar = sessionStorage.getItem(layoutKey('topbar'));
      if (cachedTopbar) {
        topbarContainer.innerHTML = cachedTopbar;
        hasCache = true;
      }
    }
    if (overlayRoot) {
      const cachedOverlays = sessionStorage.getItem(layoutKey('overlays'));
      if (cachedOverlays) {
        overlayRoot.innerHTML = cachedOverlays;
        hasCache = true;
      }
      if (cachedOverlays) {
        applyCachedFragment('sudo', document.getElementById('sudoRoot'));
        applyCachedFragment('confirm', document.getElementById('confirmRoot'));
      }
    }
  } catch {
    // Ignore cache errors
  }
  if (hasCache) {
    refreshLayoutRefs();
    refreshPageRefs();
    bindNavButtons();
    bindTopbarActions();
    setLayoutReady();
  }
  const tasks = [];
  if (menuContainer) {
    tasks.push(
      fetch('menu.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            menuContainer.innerHTML = html;
            try {
              sessionStorage.setItem(layoutKey('menu'), html);
            } catch {
              // Ignore cache errors
            }
          }
        })
    );
  }
  if (topbarContainer) {
    tasks.push(
      fetch('topbar.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            topbarContainer.innerHTML = html;
            try {
              sessionStorage.setItem(layoutKey('topbar'), html);
            } catch {
              // Ignore cache errors
            }
          }
        })
    );
  }
  if (overlayRoot) {
    tasks.push(
      fetch('overlays.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            overlayRoot.innerHTML = html;
            try {
              sessionStorage.setItem(layoutKey('overlays'), html);
            } catch {
              // Ignore cache errors
            }
          }
        })
    );
  }
  if (tasks.length) {
    await Promise.all(tasks);
  }
  const sudoRoot = document.getElementById('sudoRoot');
  const confirmRoot = document.getElementById('confirmRoot');
  const fragmentTasks = [];
  if (sudoRoot) {
    fragmentTasks.push(
      fetch('authorize.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            sudoRoot.innerHTML = html;
            try {
              sessionStorage.setItem(layoutKey('sudo'), html);
            } catch {
              // Ignore cache errors
            }
          }
        })
    );
  }
  if (confirmRoot) {
    fragmentTasks.push(
      fetch('confirm.html')
        .then((res) => (res.ok ? res.text() : ''))
        .then((html) => {
          if (html) {
            confirmRoot.innerHTML = html;
            try {
              sessionStorage.setItem(layoutKey('confirm'), html);
            } catch {
              // Ignore cache errors
            }
          }
        })
    );
  }
  if (fragmentTasks.length) {
    await Promise.all(fragmentTasks);
  }
  refreshLayoutRefs();
  refreshPageRefs();
  bindNavButtons();
  bindTopbarActions();
  setLayoutReady();
}

function bindPageEvents() {
const externalLinks = Array.from(document.querySelectorAll('[data-open-external="true"]'));
externalLinks.forEach((link) => {
  if (link.dataset.bound === 'true') {
    return;
  }
  link.dataset.bound = 'true';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const url = link.getAttribute('href');
    if (!url) {
      return;
    }
    if (window.clashfox && typeof window.clashfox.openExternal === 'function') {
      window.clashfox.openExternal(url);
    } else {
      window.open(url);
    }
  });
});
langButtons.forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});

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

const getRevealPath = (inputEl) => {
  if (!inputEl) {
    return '';
  }
  const value = (inputEl.value || '').trim();
  if (value && value !== '-') {
    return value;
  }
  const placeholder = (inputEl.placeholder || '').trim();
  if (placeholder && placeholder !== '-') {
    return placeholder;
  }
  return '';
};

if (settingsConfigDirReveal) {
  settingsConfigDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsConfigDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
  });
}

if (settingsCoreDirReveal) {
  settingsCoreDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsCoreDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
  });
}

if (settingsDataDirReveal) {
  settingsDataDirReveal.addEventListener('click', async () => {
    const target = getRevealPath(settingsDataDir);
    if (target && window.clashfox && typeof window.clashfox.revealInFinder === 'function') {
      await window.clashfox.revealInFinder(target);
    }
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
      showToast(t('labels.installConfigHint'), 'info');
      loadKernels();
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
    if (backupsPageSize) {
      backupsPageSize.value = kernelPageSize.value;
    }
    state.kernelPageSizeLocal = kernelPageSize.value;
    state.kernelsPage = 1;
    state.switchPage = 1;
    state.backupsPage = 1;
    renderKernelTable();
    renderSwitchTable();
    renderBackupsTable();
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

if (panelSelect) {
  panelSelect.addEventListener('change', async (event) => {
    const value = event.target.value || '';
    if (!value) {
      return;
    }
    const currentChoice = (state.settings && state.settings.panelChoice) || 'zashboard';
    if (value !== currentChoice) {
      const confirmed = await promptConfirm({
        title: t('confirm.panelTitle'),
        body: t('confirm.panelBody'),
        confirmLabel: t('confirm.panelConfirm'),
        confirmTone: 'primary',
      });
      if (!confirmed) {
        panelSelect.value = currentChoice;
        return;
      }
    }
    const preset = PANEL_PRESETS[value];
    if (!preset) {
      return;
    }
    state.panelInstallRequested = true;
    showToast(t('labels.panelSwitchHint'), 'info');
    saveSettings({ panelChoice: value });
    updateDashboardFrameSrc();
    const response = await runCommand('panel-install', ['--name', preset.name, '--url', preset.url]);
    if (response.ok) {
      await runCommand('panel-activate', ['--name', preset.name]);
      const installed = response.data && response.data.installed === true;
      if (state.panelInstallRequested && installed) {
        showToast(t('labels.panelInstalled'));
      }
      state.panelInstallRequested = false;
      return;
    }
    let errorMsg = t('labels.panelInstallFailed');
    if (response.error) {
      errorMsg = `${errorMsg} (${response.error})`;
      if (response.error === 'empty_output' && response.details) {
        errorMsg = `${errorMsg}: ${response.details}`;
      }
    }
    if (state.panelInstallRequested) {
      showToast(errorMsg, 'error');
    }
    state.panelInstallRequested = false;
  });
}
if (externalControllerInput) {
  externalControllerInput.addEventListener('change', (event) => {
    saveSettings({ externalController: event.target.value.trim() });
  });
}
if (externalSecretInput) {
  externalSecretInput.addEventListener('change', (event) => {
    saveSettings({ secret: event.target.value.trim() });
  });
}
if (externalAuthInput) {
  externalAuthInput.addEventListener('change', (event) => {
    saveSettings({ authentication: parseAuthList(event.target.value) });
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
      await loadStatus();
      loadOverviewLite();
      setTimeout(() => loadStatus(), 3000);
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
      if (action === 'start' || action === 'restart') {
        await loadStatus();
        loadOverviewLite();
      }
      if (action === 'start' || action === 'restart') {
        if (state.coreRunning) {
          const successMessages = {
            'start': t('labels.startSuccess'),
            'restart': t('labels.restartSuccess')
          };
          showToast(successMessages[action]);
        } else {
          showToast('Start failed', 'error');
        }
      } else {
        showToast(t('labels.stopped'));
      }
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

if (proxyModeSelect) {
  proxyModeSelect.addEventListener('change', async () => {
    const value = proxyModeSelect.value || 'rule';
    const previous = (state.settings && state.settings.proxyMode) || 'rule';
    saveSettings({ proxyMode: value });
    const response = await runCommand('mode', ['--mode', value, ...getControllerArgs()]);
    if (response.ok) {
      showToast(t('labels.proxyModeUpdated'));
      return;
    }
    proxyModeSelect.value = previous;
    saveSettings({ proxyMode: previous });
    const message = response.error === 'controller_missing'
      ? t('labels.controllerMissing')
      : (response.error || 'Mode update failed');
    showToast(message, 'error');
  });
}

if (tunToggle) {
  tunToggle.addEventListener('change', async () => {
    const enabled = Boolean(tunToggle.checked);
    const response = await runCommand('tun', ['--enable', enabled ? 'true' : 'false', ...getControllerArgs()]);
    if (!response.ok) {
      tunToggle.checked = !enabled;
      const message = response.error === 'controller_missing'
        ? t('labels.controllerMissing')
        : (response.error || 'TUN update failed');
      showToast(message, 'error');
      return;
    }
    saveSettings({ tunEnabled: enabled });
  });
}

if (tunStackSelect) {
  tunStackSelect.addEventListener('change', async () => {
    const value = tunStackSelect.value || 'mixed';
    const response = await runCommand('tun', ['--stack', value, ...getControllerArgs()]);
    if (!response.ok) {
      const fallback = (state.settings && state.settings.tunStack) || 'mixed';
      tunStackSelect.value = fallback;
      const message = response.error === 'controller_missing'
        ? t('labels.controllerMissing')
        : (response.error || 'TUN stack update failed');
      showToast(message, 'error');
      return;
    }
    saveSettings({ tunStack: value });
  });
}

if (configTable) {
  configTable.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-path]');
    if (!row) {
      return;
    }
    const path = row.getAttribute('data-path') || '';
    if (!path || path === getCurrentConfigPath()) {
      return;
    }
    saveSettings({ configPath: path });
    showToast(t('labels.configNeedsRestart'));
    renderConfigTable();
  });
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
if (settingsKernelPageSize) {
  settingsKernelPageSize.addEventListener('change', () => {
    if (kernelPageSize) {
      kernelPageSize.value = settingsKernelPageSize.value;
    }
    if (backupsPageSize) {
      backupsPageSize.value = settingsKernelPageSize.value;
    }
    state.kernelPageSizeLocal = settingsKernelPageSize.value;
    state.switchPage = 1;
    state.kernelsPage = 1;
    state.backupsPage = 1;
    renderKernelTable();
    renderSwitchTable();
    renderBackupsTable();
    saveSettings({ kernelPageSize: settingsKernelPageSize.value });
  });
}

if (settingsBackupsPageSize) {
  settingsBackupsPageSize.addEventListener('change', () => {
    if (recommendPageSize) {
      recommendPageSize.value = settingsBackupsPageSize.value;
    }
    state.generalPageSizeLocal = settingsBackupsPageSize.value;
    state.recommendPage = 1;
    renderRecommendTable();
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
    if (kernelPageSize) {
      kernelPageSize.value = backupsPageSize.value;
    }
    state.kernelPageSizeLocal = backupsPageSize.value;
    state.kernelsPage = 1;
    state.switchPage = 1;
    state.backupsPage = 1;
    renderKernelTable();
    renderSwitchTable();
    renderBackupsTable();
  });
}

if (recommendPrev) {
  recommendPrev.addEventListener('click', () => {
    state.recommendPage = Math.max(1, state.recommendPage - 1);
    renderRecommendTable();
  });
}
if (recommendNext) {
  recommendNext.addEventListener('click', () => {
    state.recommendPage += 1;
    renderRecommendTable();
  });
}
if (recommendPageSize) {
  recommendPageSize.addEventListener('change', () => {
    state.recommendPage = 1;
    renderRecommendTable();
    state.generalPageSizeLocal = recommendPageSize.value;
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
  });
}
if (logIntervalPreset) {
  logIntervalPreset.addEventListener('change', () => {
    updateInterval();
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
    if (logLines) {
      logLines.value = value;
    }
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


if (overviewNetworkRefresh) {
  overviewNetworkRefresh.addEventListener('click', async () => {
    overviewNetworkRefresh.classList.add('is-loading');
    await loadOverview(true);
    setTimeout(() => overviewNetworkRefresh.classList.remove('is-loading'), 400);
  });
}
}

function startOverviewTimer() {
  if (state.overviewTimer) {
    clearInterval(state.overviewTimer);
  }
  state.overviewTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadOverview();
    }
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
    if (currentPage === 'overview') {
      loadOverviewLite();
    }
  }, 2000);

  if (state.overviewMemoryTimer) {
    clearInterval(state.overviewMemoryTimer);
  }
  state.overviewMemoryTimer = setInterval(() => {
    if (currentPage === 'overview') {
      loadOverviewMemory();
    }
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

function showDashboardAlert() {
  if (state.dashboardAlerted) {
    return;
  }
  state.dashboardAlerted = true;
  showToast(t('dashboard.hint'), 'info');
}

function getSelectedPanelName() {
  const choice = (panelSelect && panelSelect.value) || (state.settings && state.settings.panelChoice) || '';
  return choice || 'zashboard';
}

function updateDashboardFrameSrc() {
  if (!dashboardFrame) {
    return;
  }
  const panelName = getSelectedPanelName();
  const previousPanel = dashboardFrame.dataset.panelName || '';
  const themeValue = state.theme === 'night' ? 'dark' : 'light';
  const token = [
    state.settings && state.settings.secret,
    state.fileSettings && state.fileSettings.secret,
    externalSecretInput && externalSecretInput.value,
  ].map((value) => (value ? String(value).trim() : '')).find((value) => value);
  let targetUrl = `http://127.0.0.1:9090/ui/${panelName}/index.html`;
  if (panelName === 'metacubexd') {
    const params = new URLSearchParams();
    params.set('theme', themeValue);
    if (token) {
      params.set('token', token);
      params.set('secret', token);
    }
    targetUrl = `${targetUrl}?${params.toString()}`;
  }
  const targetKey = `${panelName}:${themeValue}`;
  if (dashboardFrame.dataset.panel === targetKey) {
    return;
  }
  const applyFrameSrc = () => {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const stampedUrl = `${targetUrl}${separator}_ts=${Date.now()}`;
    dashboardFrame.dataset.panelName = panelName;
    dashboardFrame.dataset.panel = targetKey;
    dashboardFrame.src = stampedUrl;
    if (dashboardHint) {
      dashboardHint.textContent = stampedUrl;
    }
  };

  if (previousPanel && previousPanel !== panelName && window.clashfox && typeof window.clashfox.clearUiStorage === 'function') {
    window.clashfox.clearUiStorage()
      .then(applyFrameSrc)
      .catch(applyFrameSrc);
    return;
  }

  applyFrameSrc();
}

function initDashboardFrame() {
  if (!dashboardFrame || !dashboardEmpty) {
    return;
  }
  updateDashboardFrameSrc();
  const showEmpty = () => {
    dashboardEmpty.classList.add('show');
  };
  const hideEmpty = () => {
    dashboardEmpty.classList.remove('show');
  };

  showEmpty();
  const timeout = setTimeout(() => {
    showEmpty();
    showDashboardAlert();
  }, 1200);

  dashboardFrame.addEventListener('load', () => {
    clearTimeout(timeout);
    hideEmpty();
    state.dashboardAlerted = false;
    state.dashboardLoaded = true;
    sendDashboardTheme();
  });
  dashboardFrame.addEventListener('error', () => {
    clearTimeout(timeout);
    showEmpty();
    showDashboardAlert();
    state.dashboardLoaded = false;
  });
}

async function initApp() {
  await loadLayoutParts();
  await loadStaticConfigs();
  await syncSettingsFromFile();
  applySettings(readSettings());
  if (state.themePreference === 'auto' && prefersDarkQuery) {
    applySystemTheme(prefersDarkQuery.matches);
  }
  updateScrollbarWidthVar();
  window.addEventListener('resize', updateScrollbarWidthVar);
  bindPageEvents();
  renderRecommendTable();
  if (contentRoot && contentRoot.firstElementChild) {
    contentRoot.firstElementChild.classList.add('page-section');
  }
  setActiveNav(currentPage);
  loadAppInfo();
  if (currentPage === 'dashboard') {
    initDashboardFrame();
  }
  const ok = await waitForBridge();
  if (!ok) {
    showToast(t('labels.bridgeMissing'), 'error');
    return;
  }
  if (state.settings && state.settings.panelChoice && !state.autoPanelInstalled) {
    const preset = PANEL_PRESETS[state.settings.panelChoice];
    if (preset) {
      state.autoPanelInstalled = true;
      runCommand('panel-install', ['--name', preset.name, '--url', preset.url]).then((response) => {
        if (response.ok) {
          runCommand('panel-activate', ['--name', preset.name]);
        }
        if (!response.ok && response.error && response.error !== 'cancelled') {
          const errorMsg = response.error ? `${t('labels.panelInstallFailed')} (${response.error})` : t('labels.panelInstallFailed');
          showToast(errorMsg, 'error');
        }
      });
    }
  }
  loadStatus();
  setTimeout(() => loadStatus(), 1200);
  setTimeout(() => loadStatus(), 4000);
  if (currentPage === 'overview') {
    Promise.all([
      loadOverview(),
      loadOverviewLite(),
      loadOverviewMemory(),
    ]);
  }
  updateInstallVersionVisibility();
  startOverviewTimer();
  loadConfigs();
  loadKernels();
  loadBackups();
  loadLogs();
}

window.addEventListener('popstate', () => {
  const target = (history.state && history.state.page) || getPageFromLocation();
  navigatePage(target, false);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
