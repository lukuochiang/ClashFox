function normalizeControllerSource(source = {}) {
  return {
    controller: String(source.controller || source.externalController || '').trim(),
    secret: String(source.secret || '').trim(),
  };
}

export function resolveMihomoApiSourceFromState(state = {}) {
  const settings = state && typeof state === 'object' ? (state.settings || {}) : {};
  const fileSettings = state && typeof state === 'object' ? (state.fileSettings || {}) : {};
  return {
    externalController: String(
      fileSettings.externalController
      || settings.externalController
      || '127.0.0.1:9090',
    ).trim(),
    secret: String(fileSettings.secret || settings.secret || 'clashfox').trim(),
  };
}

function getBridge(bridge = globalThis.window && window.clashfox) {
  return bridge && typeof bridge === 'object' ? bridge : null;
}

export function resolveMihomoControllerAccess(source = {}) {
  const normalized = normalizeControllerSource(source);
  const controller = normalized.controller || '127.0.0.1:9090';
  const secret = normalized.secret || 'clashfox';
  const baseUrl = /^https?:\/\//i.test(controller) ? controller : `http://${controller}`;
  return {
    baseUrl: String(baseUrl || '').replace(/\/+$/, ''),
    secret,
  };
}

export function resolveMihomoConnectionsWebSocketUrl(source = {}) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return '';
  }
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/connections';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function resolveMihomoTrafficWebSocketUrl(source = {}) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return '';
  }
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/traffic';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function resolveMihomoMemoryWebSocketUrl(source = {}) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return '';
  }
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/memory';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function resolveMihomoLogsWebSocketUrl(source = {}, level = 'info') {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return '';
  }
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/logs';
    if (secret) {
      url.searchParams.set('token', secret);
    } else {
      url.searchParams.delete('token');
    }
    url.searchParams.set('level', String(level || 'info').trim() || 'info');
    return url.toString();
  } catch {
    return '';
  }
}

function buildAuthHeaders(secret, headers = {}) {
  const nextHeaders = { ...headers };
  if (secret) {
    nextHeaders.Authorization = `Bearer ${secret}`;
  }
  return nextHeaders;
}

function normalizeConfigPatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return {};
  }
  return { ...patch };
}

function normalizeModeValue(mode = 'rule') {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'direct' || normalized === 'global' || normalized === 'rule') {
    return normalized;
  }
  return 'rule';
}

function resolveReloadConfigPath(source = {}) {
  const candidate = source && typeof source === 'object'
    ? (source.configPath || source.configFile || source.path || '')
    : '';
  return String(candidate || '').trim();
}

function sanitizeHeadersForLog(headers = {}) {
  const nextHeaders = { ...(headers || {}) };
  if (Object.prototype.hasOwnProperty.call(nextHeaders, 'Authorization')) {
    nextHeaders.Authorization = '[redacted]';
  }
  return nextHeaders;
}

function safeSerializeForLog(value) {
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncateLogValue(value, maxLength = 1200) {
  const text = String(value === undefined || value === null ? '' : value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...[truncated ${text.length - maxLength} chars]`;
}

function resolveMihomoRequestKind(method = 'GET', url = '') {
  const normalizedMethod = String(method || '').trim().toUpperCase();
  const normalizedUrl = String(url || '').trim();
  if (normalizedMethod === 'GET' && /\/configs(?:\?|$)/i.test(normalizedUrl)) {
    return 'auto';
  }
  return 'manual';
}

function shouldSuppressMihomoRequestLog(method = 'GET', url = '', ok = true) {
  return ok && resolveMihomoRequestKind(method, url) === 'auto';
}

function logMihomoApi(event, payload = {}) {
  // console.log(`[MihomoAPI] ${event}:`, payload);
}

let mihomoRequestSeq = 0;

function nextMihomoRequestId() {
  mihomoRequestSeq += 1;
  return `renderer-${Date.now()}-${mihomoRequestSeq}`;
}

async function fetchJsonThroughController(source = {}, path = '/configs', init = {}) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  const method = init.method || 'GET';
  const headers = buildAuthHeaders(secret, init.headers || {});
  const requestUrl = `${baseUrl}${path}`;
  const requestId = nextMihomoRequestId();
  const kind = resolveMihomoRequestKind(method, requestUrl);
  if (!shouldSuppressMihomoRequestLog(method, requestUrl, true)) {
    logMihomoApi('request', {
      requestId,
      kind,
      method,
      url: requestUrl,
      headers: sanitizeHeadersForLog(headers),
      body: truncateLogValue(safeSerializeForLog(init.body)),
    });
  }
  try {
    const resp = await fetch(requestUrl, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!resp.ok) {
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      logMihomoApi('response', {
        requestId,
        kind,
        method,
        url: requestUrl,
        ok: false,
        status: resp.status,
        details: truncateLogValue(details),
      });
      return { ok: false, error: 'request_failed', details };
    }
    if (resp.status === 204) {
      logMihomoApi('response', {
        requestId,
        kind,
        method,
        url: requestUrl,
        ok: true,
        status: resp.status,
        data: '',
      });
      return { ok: true };
    }
    const data = await resp.json();
    if (!shouldSuppressMihomoRequestLog(method, requestUrl, true)) {
      logMihomoApi('response', {
        requestId,
        kind,
        method,
        url: requestUrl,
        ok: true,
        status: resp.status,
        data: truncateLogValue(safeSerializeForLog(data)),
      });
    }
    return { ok: true, data };
  } catch (error) {
    logMihomoApi('response', {
      requestId,
      kind,
      method,
      url: requestUrl,
      ok: false,
      error: truncateLogValue(String(error && error.message ? error.message : error || '')),
    });
    return {
      ok: false,
      error: 'request_failed',
      details: String(error && error.message ? error.message : error || ''),
    };
  }
}

async function runConfigRequestCandidates(source = {}, candidates = []) {
  let lastError = { ok: false, error: 'request_failed' };
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const response = await fetchJsonThroughController(source, candidate.path || '/configs', {
      method: candidate.method || 'GET',
      headers: candidate.headers || {},
      body: candidate.body,
    });
    if (response && response.ok) {
      return response;
    }
    lastError = response || lastError;
  }
  return lastError;
}

// Removed callBridge function - no longer needed for Mihomo API requests

// Direct fetch to Mihomo controller - bypassing Bridge layer for better performance
async function getConfigsViaBridgeOrFetch(source = {}, bridge) {
  return fetchJsonThroughController(source, '/configs');
}

async function getVersionViaBridgeOrFetch(source = {}, bridge) {
  return fetchJsonThroughController(source, '/version');
}

async function patchConfigsViaBridgeOrFetch(patch = {}, source = {}, bridge) {
  const configPatch = normalizeConfigPatch(patch);
  if (!Object.keys(configPatch).length) {
    return { ok: false, error: 'invalid_config_patch' };
  }
  // Direct fetch to Mihomo controller - bypassing Bridge layer for better performance
  return runConfigRequestCandidates(source, [
    {
      method: 'PATCH',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: configPatch,
    },
    {
      method: 'PUT',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: configPatch,
    },
  ]);
}

export async function fetchMihomoConfigs(source = {}, bridge) {
  return getConfigsViaBridgeOrFetch(source, bridge);
}

export async function fetchMihomoVersion(source = {}, bridge) {
  return getVersionViaBridgeOrFetch(source, bridge);
}

// Mihomo returns tun either as a boolean or as an object. Normalize that once
// here so the UI can consume a stable shape.
export async function fetchTunConfigFromController(source = {}, bridge) {
  const response = await fetchMihomoConfigs(source, bridge);
  if (!response.ok || !response.data || !Object.prototype.hasOwnProperty.call(response.data, 'tun')) {
    return null;
  }
  const tun = response.data.tun;
  let enabled;
  let stack;
  if (typeof tun === 'boolean') {
    enabled = tun;
  } else if (tun && typeof tun === 'object') {
    if (typeof tun.enable === 'boolean') {
      enabled = tun.enable;
    } else if (typeof tun.enabled === 'boolean') {
      enabled = tun.enabled;
    }
    if (typeof tun.stack === 'string' && tun.stack.trim()) {
      stack = tun.stack.trim();
    }
  }
  return { enabled, stack };
}

export async function updateMihomoConfigViaController(patch = {}, source = {}, bridge) {
  return patchConfigsViaBridgeOrFetch(patch, source, bridge);
}

export async function updateTunConfigViaController(partialTun = {}, source = {}, bridge) {
  const tunBody = {};
  if (Object.prototype.hasOwnProperty.call(partialTun, 'enable')) {
    tunBody.enable = Boolean(partialTun.enable);
  }
  if (Object.prototype.hasOwnProperty.call(partialTun, 'stack') && partialTun.stack) {
    tunBody.stack = String(partialTun.stack).trim();
  }
  if (!Object.keys(tunBody).length) {
    return { ok: false, error: 'invalid_tun' };
  }
  return updateMihomoConfigViaController({ tun: tunBody }, source, bridge);
}

export async function updateAllowLanViaController(enabled, source = {}, bridge) {
  return updateMihomoConfigViaController({ 'allow-lan': Boolean(enabled) }, source, bridge);
}

export async function updateModeViaController(mode = 'rule', source = {}, bridge) {
  return updateMihomoConfigViaController({ mode: normalizeModeValue(mode) }, source, bridge);
}

export async function reloadMihomoCore(source = {}, bridge) {
  // Direct fetch to Mihomo controller - bypassing Bridge layer for better performance
  return runConfigRequestCandidates(source, [
    {
      method: 'POST',
      path: '/restart',
    },
  ]);
}

export async function reloadMihomoConfig(source = {}, bridge) {
  // Direct fetch to Mihomo controller - bypassing Bridge layer for better performance
  const configPath = resolveReloadConfigPath(source);
  return runConfigRequestCandidates(source, [
    {
      method: 'PUT',
      path: '/configs?reload=true',
      headers: { 'Content-Type': 'application/json' },
      body: { path: configPath, payload: '' },
    },
  ]);
}

export async function flushMihomoDnsCache(source = {}, bridge) {
  return runConfigRequestCandidates(source, [
    {
      method: 'POST',
      path: '/cache/dns/flush',
    },
  ]);
}

export async function flushMihomoFakeIpCache(source = {}, bridge) {
  return runConfigRequestCandidates(source, [
    {
      method: 'POST',
      path: '/cache/fakeip/flush',
    },
  ]);
}

export async function updateMihomoGeoData(source = {}, bridge) {
  return runConfigRequestCandidates(source, [
    {
      method: 'POST',
      path: '/configs/geo',
    },
  ]);
}

export async function upgradeMihomoUi(source = {}, bridge) {
  return runConfigRequestCandidates(source, [
    {
      method: 'POST',
      path: '/upgrade/ui',
    },
  ]);
}

function requireBridgeMethod(bridge, methodName) {
  const api = getBridge(bridge);
  if (!api || typeof api[methodName] !== 'function') {
    return null;
  }
  return api;
}

export async function fetchProviderSubscriptionOverview(bridge) {
  const api = requireBridgeMethod(bridge, 'providerSubscriptionOverview');
  if (!api) {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.providerSubscriptionOverview();
}

export async function fetchRulesOverview(bridge) {
  const api = requireBridgeMethod(bridge, 'rulesOverview');
  if (!api) {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.rulesOverview();
}

export async function fetchRuleProvidersOverview(bridge) {
  const api = requireBridgeMethod(bridge, 'ruleProvidersOverview');
  if (!api) {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.ruleProvidersOverview();
}

export async function fetchMihomoProvidersProxies(source = {}) {
  const { baseUrl } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  try {
    const response = await fetch(`${baseUrl}/providers/proxies`, {
      method: 'GET',
      headers: source.secret ? { Authorization: `Bearer ${source.secret}` } : {},
    });
    if (!response.ok) {
      return { ok: false, error: 'request_failed', status: response.status };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'request_failed', details: error.message };
  }
}

export async function fetchMihomoRules(source = {}) {
  const { baseUrl } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  try {
    const response = await fetch(`${baseUrl}/rules`, {
      method: 'GET',
      headers: source.secret ? { Authorization: `Bearer ${source.secret}` } : {},
    });
    if (!response.ok) {
      return { ok: false, error: 'request_failed', status: response.status };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'request_failed', details: error.message };
  }
}

export async function fetchMihomoProvidersRules(source = {}) {
  const { baseUrl } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  try {
    const response = await fetch(`${baseUrl}/providers/rules`, {
      method: 'GET',
      headers: source.secret ? { Authorization: `Bearer ${source.secret}` } : {},
    });
    if (!response.ok) {
      return { ok: false, error: 'request_failed', status: response.status };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: 'request_failed', details: error.message };
  }
}

export async function fetchRulesOverviewBundle(bridge) {
  const api = getBridge(bridge);
  const [rules, providers] = await Promise.all([
    fetchRulesOverview(api),
    fetchRuleProvidersOverview(api),
  ]);
  return { rules, providers };
}
