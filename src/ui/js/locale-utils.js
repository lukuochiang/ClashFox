(function initLocaleUtils(globalScope) {
  function normalizeLocaleCode(value) {
    const lang = String(value || '').trim().toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('de')) return 'de';
    if (lang.startsWith('ru')) return 'ru';
    return 'en';
  }

  function detectSystemLocale(systemLocale) {
    const source = systemLocale
      || (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage))
      || 'en';
    return normalizeLocaleCode(source);
  }

  function resolveLocaleFromSettings(settings = {}, options = {}) {
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
      return normalizeLocaleCode(raw);
    }
    return detectSystemLocale(options.systemLocale || '');
  }

  const api = {
    normalizeLocaleCode,
    detectSystemLocale,
    resolveLocaleFromSettings,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.CLASHFOX_LOCALE_UTILS = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
