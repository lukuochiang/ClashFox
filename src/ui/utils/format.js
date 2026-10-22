(function initFormatUtils(globalScope) {
  const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

  function formatBytes(value, options = {}) {
    const fallback = typeof options.fallback === 'string' ? options.fallback : '-';
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num) || num < 0) {
      return fallback;
    }
    if (num === 0 && typeof options.zeroText === 'string') {
      return options.zeroText;
    }
    let size = num;
    let idx = 0;
    while (size >= 1024 && idx < BYTE_UNITS.length - 1) {
      size /= 1024;
      idx += 1;
    }
    const fixed = size >= 100 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(fixed)} ${BYTE_UNITS[idx]}`;
  }

  function formatRate(value, options = {}) {
    return `${formatBytes(value, options)}/s`;
  }

  const api = { formatBytes, formatRate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.CLASHFOX_FORMAT_UTILS = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
