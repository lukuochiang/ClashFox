import FOXBOARD_I18N from '../locales/foxboard-i18n.js';
import { initDashboardPanel, teardownDashboardPanel, setDashboardLocale } from './dashboard.js';

const foxboardLocaleUtils = globalThis.CLASHFOX_LOCALE_UTILS || {};
const resolveLocaleFromSettings = typeof foxboardLocaleUtils.resolveLocaleFromSettings === 'function'
  ? foxboardLocaleUtils.resolveLocaleFromSettings
  : (() => 'en');

let foxboardDebugMode = false;
let systemLocaleFromMain = '';
let foxboardThemeSettingsSnapshot = null;

function foxboardLog(scope, message, payload = null, level = 'log') {
  return;
}

function unwrapSettingsPayload(response) {
  if (!response || typeof response !== 'object') {
    return {};
  }
  if (response.ok && response.data && typeof response.data === 'object') {
    return response.data;
  }
  return response;
}

function applyTheme(theme = 'auto', dark = false) {
  const normalized = String(theme || 'auto').trim().toLowerCase();
  const resolved = normalized === 'day' || normalized === 'light'
    ? 'day'
    : normalized === 'night' || normalized === 'dark'
      ? 'night'
      : (dark ? 'night' : 'day');
  document.documentElement.setAttribute('data-theme', resolved);
  if (document.body) {
    document.body.dataset.theme = resolved;
  }
  try {
    localStorage.setItem('lastTheme', resolved);
  } catch {
    // ignore storage failures
  }
}

function applyMergedThemeSnapshot(preloadedSettings = null) {
  const nextSettings = preloadedSettings && typeof preloadedSettings === 'object'
    ? preloadedSettings
    : null;
  if (nextSettings) {
    foxboardThemeSettingsSnapshot = {
      ...(foxboardThemeSettingsSnapshot || {}),
      ...nextSettings,
    };
  }
  return foxboardThemeSettingsSnapshot && typeof foxboardThemeSettingsSnapshot === 'object'
    ? foxboardThemeSettingsSnapshot
    : nextSettings;
}

function applyLocaleTexts(locale = 'en') {
  const text = FOXBOARD_I18N[locale] || FOXBOARD_I18N.en;
  const title = document.getElementById('foxboardTitle');
  const subtitle = document.getElementById('foxboardSubtitle');
  if (title) title.textContent = text.title;
  if (subtitle) subtitle.textContent = text.subtitle;

  document.querySelectorAll('[data-dashboard-tab="recent"]').forEach((el) => { el.textContent = text.tabs.recent; });
  document.querySelectorAll('[data-dashboard-tab="active"]').forEach((el) => { el.textContent = text.tabs.active; });
  document.querySelectorAll('[data-dashboard-tab="dns"]').forEach((el) => { el.textContent = text.tabs.dns; });
  document.querySelectorAll('[data-dashboard-tab="devices"]').forEach((el) => { el.textContent = text.tabs.devices; });
  document.querySelectorAll('[data-dashboard-tab="traffic"]').forEach((el) => { el.textContent = text.tabs.traffic; });

  document.querySelectorAll('[data-dashboard-group="client"]').forEach((el) => { el.textContent = text.group.client; });
  document.querySelectorAll('[data-dashboard-group="host"]').forEach((el) => { el.textContent = text.group.host; });
  document.querySelectorAll('.dashboard-sidebar-label').forEach((el) => { el.textContent = text.sidebarLabel; });

  document.querySelectorAll('[data-recent-status="all"]').forEach((el) => { el.textContent = text.status.all; });
  document.querySelectorAll('[data-recent-status="active"]').forEach((el) => { el.textContent = text.status.active; });
  document.querySelectorAll('[data-recent-status="completed"]').forEach((el) => { el.textContent = text.status.completed; });
  document.querySelectorAll('[data-recent-status="failed"]').forEach((el) => { el.textContent = text.status.failed; });

  document.querySelectorAll('[data-recent-range="0"]').forEach((el) => { el.textContent = text.rangeAll; });

  const search = document.getElementById('dashboardSearchInput');
  if (search) {
    search.placeholder = text.searchPlaceholder;
  }
}

let currentTheme = 'auto';
let unsubscribeSystemTheme = null;
let unsubscribeSettingsUpdated = null;
let foxboardWindowVisible = !document.hidden;
let lastSettingsSignature = '';
let systemLocaleCached = '';

async function refreshSystemLocaleFromMain() {
  if (systemLocaleCached) {
    return false;
  }
  if (!window.clashfox || typeof window.clashfox.getSystemLocale !== 'function') {
    return false;
  }
  try {
    const response = await window.clashfox.getSystemLocale();
    if (!response || !response.ok) {
      return false;
    }
    const locale = String(response.locale || '').trim();
    if (!locale) {
      return false;
    }
    const changed = locale !== systemLocaleFromMain;
    systemLocaleFromMain = locale;
    systemLocaleCached = locale;
    return changed;
  } catch {
    return false;
  }
}

function resolveLocaleWithSystem(settings = {}) {
  return resolveLocaleFromSettings(settings, {
    systemLocale: systemLocaleFromMain || '',
  });
}

async function syncSettings() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return;
  }
  try {
    await refreshSystemLocaleFromMain();
    const response = await window.clashfox.readSettings();
    const settings = unwrapSettingsPayload(response);
    const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
    foxboardThemeSettingsSnapshot = settings;
    foxboardDebugMode = Boolean(settings && settings.debugMode);
    window.__clashfoxFoxboardDebug = foxboardDebugMode;
    currentTheme = String(settings.theme || appearance.theme || 'auto').trim().toLowerCase();
    const locale = resolveLocaleWithSystem(settings);
    foxboardLog('settings', 'sync completed', {
      theme: currentTheme,
      locale,
    });
    applyLocaleTexts(locale);
    setDashboardLocale(locale);
    const dark = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : document.documentElement.getAttribute('data-theme') === 'night';
    applyTheme(currentTheme, dark);
    lastSettingsSignature = JSON.stringify({
      theme: currentTheme,
      locale,
      debug: foxboardDebugMode,
    });
  } catch {
    foxboardLog('settings', 'sync failed', null, 'warn');
  }
}

async function bootFoxboard() {
  try {
    foxboardLog('lifecycle', 'boot started');
    await syncSettings();
    if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
      unsubscribeSystemTheme = window.clashfox.onSystemThemeChange((payload = {}) => {
        if (currentTheme === 'auto') {
          foxboardLog('theme', 'system theme changed', { dark: Boolean(payload.dark) });
          applyTheme('auto', Boolean(payload.dark));
        }
      });
    }
    if (window.clashfox && typeof window.clashfox.onSettingsUpdated === 'function') {
    unsubscribeSettingsUpdated = window.clashfox.onSettingsUpdated((settings = {}) => {
        const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
        const mergedSettings = applyMergedThemeSnapshot(settings) || settings;
        const nextSignature = JSON.stringify({
          theme: String(mergedSettings.theme || (mergedSettings.appearance && mergedSettings.appearance.theme) || 'auto').trim().toLowerCase(),
          locale: resolveLocaleWithSystem(mergedSettings),
          debug: Boolean(mergedSettings && mergedSettings.debugMode),
        });
        if (nextSignature === lastSettingsSignature) {
          return;
        }
        lastSettingsSignature = nextSignature;
        Promise.resolve(systemLocaleCached ? false : refreshSystemLocaleFromMain()).then(() => {
          foxboardDebugMode = Boolean(mergedSettings && mergedSettings.debugMode);
          window.__clashfoxFoxboardDebug = foxboardDebugMode;
          currentTheme = String(mergedSettings.theme || (mergedSettings.appearance && mergedSettings.appearance.theme) || 'auto').trim().toLowerCase();
          const locale = resolveLocaleWithSystem(mergedSettings);
          foxboardLog('settings', 'event update received', {
            theme: currentTheme,
            locale,
          });
          applyLocaleTexts(locale);
          setDashboardLocale(locale);
          const dark = window.matchMedia
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : document.documentElement.getAttribute('data-theme') === 'night';
          applyTheme(currentTheme, dark);
        }).catch(() => {
          foxboardLog('settings', 'event update failed', null, 'warn');
        });
      });
    }
    if (!document.hidden) {
      await initDashboardPanel();
    }
    foxboardLog('lifecycle', 'boot completed');
  } catch (error) {
    // Keep standalone window stable even if panel init fails.
    foxboardLog('lifecycle', 'boot failed', {
      error: error && error.message ? error.message : String(error || ''),
    }, 'error');
  }
}

function syncFoxboardVisibility() {
  const visible = !document.hidden;
  if (foxboardWindowVisible === visible) {
    return;
  }
  foxboardWindowVisible = visible;
  if (!visible) {
    teardownDashboardPanel();
    return;
  }
  syncSettings().then(() => {
    initDashboardPanel().catch(() => {});
  }).catch(() => {});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootFoxboard().catch(() => {});
  }, { once: true });
} else {
  bootFoxboard().catch(() => {});
}

window.addEventListener('beforeunload', () => {
  foxboardLog('lifecycle', 'beforeunload');
  if (typeof unsubscribeSystemTheme === 'function') {
    unsubscribeSystemTheme();
  }
  if (typeof unsubscribeSettingsUpdated === 'function') {
    unsubscribeSettingsUpdated();
  }
  teardownDashboardPanel();
});

document.addEventListener('visibilitychange', syncFoxboardVisibility);
window.addEventListener('focus', syncFoxboardVisibility);
