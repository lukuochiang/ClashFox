import { initDashboardPanel, teardownDashboardPanel, setDashboardLocale } from './dashboard-local.js';

const FOXBOARD_TEXTS = {
  en: {
    title: 'Foxboard',
    subtitle: 'Live traffic intelligence with request, DNS, device, and policy views.',
    tabs: {
      recent: 'Recent Requests',
      active: 'Active Connection',
      dns: 'DNS',
      devices: 'Devices',
      traffic: 'Traffic Statistics',
    },
    group: {
      client: 'By Client',
      host: 'By Host',
    },
    sidebarLabel: 'Requests',
    status: {
      all: 'All',
      active: 'Active',
      completed: 'Completed',
      failed: 'Failed',
    },
    rangeAll: 'All Time',
    searchPlaceholder: 'Filter client, host, policy',
  },
  zh: {
    title: 'Foxboard',
    subtitle: '实时流量情报：请求、DNS、设备与策略视图。',
    tabs: {
      recent: '近期请求',
      active: '活动连接',
      dns: 'DNS',
      devices: '设备',
      traffic: '流量统计',
    },
    group: {
      client: '按客户端',
      host: '按主机',
    },
    sidebarLabel: '请求',
    status: {
      all: '全部',
      active: '活跃',
      completed: '完成',
      failed: '失败',
    },
    rangeAll: '全部时间',
    searchPlaceholder: '筛选客户端、主机、策略',
  },
  ja: {
    title: 'Foxboard',
    subtitle: 'リクエスト、DNS、デバイス、ポリシーを含むリアルタイムトラフィック可視化。',
    tabs: {
      recent: '最近のリクエスト',
      active: 'アクティブ接続',
      dns: 'DNS',
      devices: 'デバイス',
      traffic: 'トラフィック統計',
    },
    group: {
      client: 'クライアント別',
      host: 'ホスト別',
    },
    sidebarLabel: 'リクエスト',
    status: {
      all: 'すべて',
      active: 'アクティブ',
      completed: '完了',
      failed: '失敗',
    },
    rangeAll: '全期間',
    searchPlaceholder: 'クライアント、ホスト、ポリシーで絞り込み',
  },
  ko: {
    title: 'Foxboard',
    subtitle: '요청, DNS, 디바이스, 정책을 포함한 실시간 트래픽 인텔리전스.',
    tabs: {
      recent: '최근 요청',
      active: '활성 연결',
      dns: 'DNS',
      devices: '디바이스',
      traffic: '트래픽 통계',
    },
    group: {
      client: '클라이언트별',
      host: '호스트별',
    },
    sidebarLabel: '요청',
    status: {
      all: '전체',
      active: '활성',
      completed: '완료',
      failed: '실패',
    },
    rangeAll: '전체 기간',
    searchPlaceholder: '클라이언트, 호스트, 정책 필터',
  },
  fr: {
    title: 'Foxboard',
    subtitle: 'Vue trafic en direct avec requêtes, DNS, appareils et politiques.',
    tabs: {
      recent: 'Requêtes récentes',
      active: 'Connexions actives',
      dns: 'DNS',
      devices: 'Appareils',
      traffic: 'Statistiques trafic',
    },
    group: {
      client: 'Par client',
      host: 'Par hôte',
    },
    sidebarLabel: 'Requêtes',
    status: {
      all: 'Tous',
      active: 'Actif',
      completed: 'Terminé',
      failed: 'Échec',
    },
    rangeAll: 'Toute période',
    searchPlaceholder: 'Filtrer client, hôte, politique',
  },
  de: {
    title: 'Foxboard',
    subtitle: 'Live‑Traffic mit Anfragen, DNS, Geräten und Richtlinien.',
    tabs: {
      recent: 'Letzte Anfragen',
      active: 'Aktive Verbindungen',
      dns: 'DNS',
      devices: 'Geräte',
      traffic: 'Traffic‑Statistik',
    },
    group: {
      client: 'Nach Client',
      host: 'Nach Host',
    },
    sidebarLabel: 'Anfragen',
    status: {
      all: 'Alle',
      active: 'Aktiv',
      completed: 'Abgeschlossen',
      failed: 'Fehlgeschlagen',
    },
    rangeAll: 'Gesamter Zeitraum',
    searchPlaceholder: 'Client, Host, Richtlinie filtern',
  },
  ru: {
    title: 'Foxboard',
    subtitle: 'Аналитика трафика в реальном времени: запросы, DNS, устройства и правила.',
    tabs: {
      recent: 'Последние запросы',
      active: 'Активные соединения',
      dns: 'DNS',
      devices: 'Устройства',
      traffic: 'Статистика трафика',
    },
    group: {
      client: 'По клиенту',
      host: 'По хосту',
    },
    sidebarLabel: 'Запросы',
    status: {
      all: 'Все',
      active: 'Активные',
      completed: 'Завершённые',
      failed: 'С ошибкой',
    },
    rangeAll: 'За всё время',
    searchPlaceholder: 'Фильтр по клиенту, хосту, политике',
  },
};

function resolveLocaleFromSettings(settings = {}) {
  const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
  const raw = String(
    settings.lang
    || settings.language
    || settings.locale
    || appearance.lang
    || appearance.language
    || appearance.locale
    || 'auto',
  ).trim().toLowerCase();
  if (raw && raw !== 'auto') {
    if (raw.startsWith('zh')) return 'zh';
    if (raw.startsWith('ja')) return 'ja';
    if (raw.startsWith('ko')) return 'ko';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('ru')) return 'ru';
    return 'en';
  }
  const system = String(navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if (system.startsWith('zh')) return 'zh';
  if (system.startsWith('ja')) return 'ja';
  if (system.startsWith('ko')) return 'ko';
  if (system.startsWith('fr')) return 'fr';
  if (system.startsWith('de')) return 'de';
  if (system.startsWith('ru')) return 'ru';
  return 'en';
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

function applyLocaleTexts(locale = 'en') {
  const text = FOXBOARD_TEXTS[locale] || FOXBOARD_TEXTS.en;
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
let settingsSyncTimer = null;

async function syncSettings() {
  if (!window.clashfox || typeof window.clashfox.readSettings !== 'function') {
    return;
  }
  try {
    const response = await window.clashfox.readSettings();
    const settings = unwrapSettingsPayload(response);
    const appearance = settings && typeof settings.appearance === 'object' ? settings.appearance : {};
    currentTheme = String(settings.theme || appearance.theme || 'auto').trim().toLowerCase();
    const locale = resolveLocaleFromSettings(settings);
    applyLocaleTexts(locale);
    setDashboardLocale(locale);
    const dark = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : document.documentElement.getAttribute('data-theme') === 'night';
    applyTheme(currentTheme, dark);
  } catch {
    // ignore settings sync failures
  }
}

async function bootFoxboard() {
  try {
    await syncSettings();
    if (window.clashfox && typeof window.clashfox.onSystemThemeChange === 'function') {
      unsubscribeSystemTheme = window.clashfox.onSystemThemeChange((payload = {}) => {
        if (currentTheme === 'auto') {
          applyTheme('auto', Boolean(payload.dark));
        }
      });
    }
    settingsSyncTimer = setInterval(() => {
      syncSettings().catch(() => {});
    }, 3000);
    await initDashboardPanel();
  } catch (error) {
    // Keep standalone window stable even if panel init fails.
    console.warn('[foxboard] init failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootFoxboard().catch(() => {});
  }, { once: true });
} else {
  bootFoxboard().catch(() => {});
}

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeSystemTheme === 'function') {
    unsubscribeSystemTheme();
  }
  if (settingsSyncTimer) {
    clearInterval(settingsSyncTimer);
    settingsSyncTimer = null;
  }
  teardownDashboardPanel();
});
