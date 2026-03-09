function normalizeControllerSource(source = {}) {
  return {
    controller: String(source.controller || source.externalController || '').trim(),
    secret: String(source.secret || '').trim(),
  };
}

function getBridge(bridge = globalThis.window && window.clashfox) {
  return bridge && typeof bridge === 'object' ? bridge : null;
}

export function resolveMihomoControllerAccess(source = {}) {
  const normalized = normalizeControllerSource(source);
  const controller = normalized.controller || '127.0.0.1:9090';
  const secret = normalized.secret || 'clashfox';
  const baseUrl = /^https?:\/\//.test(controller) ? controller : `http://${controller}`;
  return {
    baseUrl: String(baseUrl || '').replace(/\/+$/, ''),
    secret,
  };
}

function buildAuthHeaders(secret, headers = {}) {
  const nextHeaders = { ...headers };
  if (secret) {
    nextHeaders.Authorization = `Bearer ${secret}`;
  }
  return nextHeaders;
}

async function runConfigRequestCandidates(source = {}, candidates = []) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  let lastError = { ok: false, error: 'request_failed' };
  for (const candidate of candidates) {
    const headers = buildAuthHeaders(secret, candidate.headers || {});
    try {
      const resp = await fetch(`${baseUrl}${candidate.path || '/configs'}`, {
        method: candidate.method || 'GET',
        headers,
        body: candidate.body === undefined ? undefined : JSON.stringify(candidate.body),
      });
      if (resp.ok) {
        return { ok: true };
      }
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      lastError = { ok: false, error: 'request_failed', details };
    } catch (error) {
      lastError = {
        ok: false,
        error: 'request_failed',
        details: String(error && error.message ? error.message : error || ''),
      };
    }
  }
  return lastError;
}

export async function fetchMihomoConfigs(source = {}) {
  const { baseUrl, secret } = resolveMihomoControllerAccess(source);
  if (!baseUrl) {
    return { ok: false, error: 'controller_missing' };
  }
  try {
    const resp = await fetch(`${baseUrl}/configs`, {
      headers: buildAuthHeaders(secret),
    });
    if (!resp.ok) {
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      return { ok: false, error: 'request_failed', details };
    }
    return { ok: true, data: await resp.json() };
  } catch (error) {
    return {
      ok: false,
      error: 'request_failed',
      details: String(error && error.message ? error.message : error || ''),
    };
  }
}

export async function fetchTunConfigFromController(source = {}) {
  const response = await fetchMihomoConfigs(source);
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
  return {
    enabled,
    stack,
  };
}

export async function updateTunConfigViaController(partialTun = {}, source = {}) {
  try {
    const { baseUrl, secret } = resolveMihomoControllerAccess(source);
    if (!baseUrl) {
      return { ok: false, error: 'controller_missing' };
    }
    const headers = buildAuthHeaders(secret, { 'Content-Type': 'application/json' });

    const tunBody = {};
    if (Object.prototype.hasOwnProperty.call(partialTun, 'enable')) {
      tunBody.enable = Boolean(partialTun.enable);
    }
    if (Object.prototype.hasOwnProperty.call(partialTun, 'stack') && partialTun.stack) {
      tunBody.stack = String(partialTun.stack);
    }
    if (Object.keys(tunBody).length === 0) {
      return { ok: false, error: 'invalid_tun' };
    }

    const candidates = [
      { method: 'PATCH', payload: { tun: tunBody } },
      { method: 'PUT', payload: { tun: tunBody } },
    ];
    if (Object.prototype.hasOwnProperty.call(tunBody, 'enable')) {
      const enabledBody = { ...tunBody };
      enabledBody.enabled = enabledBody.enable;
      delete enabledBody.enable;
      candidates.push({ method: 'PATCH', payload: { tun: enabledBody } });
      candidates.push({ method: 'PUT', payload: { tun: enabledBody } });
    }

    let lastError = { ok: false, error: 'request_failed' };
    for (const candidate of candidates) {
      const resp = await fetch(`${baseUrl}/configs`, {
        method: candidate.method,
        headers,
        body: JSON.stringify(candidate.payload),
      });
      if (resp.ok) {
        return { ok: true };
      }
      const details = (await resp.text().catch(() => '')) || `http_status=${resp.status}`;
      lastError = { ok: false, error: 'request_failed', details };
    }
    return lastError;
  } catch (error) {
    return {
      ok: false,
      error: 'request_failed',
      details: String(error && error.message ? error.message : error || ''),
    };
  }
}

export async function reloadMihomoCore(source = {}) {
  return runConfigRequestCandidates(source, [
    {
      method: 'PUT',
      path: '/configs?force=true',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    },
    {
      method: 'PUT',
      path: '/configs?force=true',
    },
    {
      method: 'PATCH',
      path: '/configs?force=true',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    },
  ]);
}

export async function reloadMihomoConfig(source = {}) {
  return runConfigRequestCandidates(source, [
    {
      method: 'PATCH',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    },
    {
      method: 'PUT',
      path: '/configs',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    },
    {
      method: 'PATCH',
      path: '/configs?force=true',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    },
  ]);
}

export async function fetchProviderSubscriptionOverview(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.providerSubscriptionOverview !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.providerSubscriptionOverview();
}

export async function fetchRulesOverview(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.rulesOverview !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.rulesOverview();
}

export async function fetchRuleProvidersOverview(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.ruleProvidersOverview !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.ruleProvidersOverview();
}

export async function fetchRulesOverviewBundle(bridge) {
  const api = getBridge(bridge);
  const tasks = [
    fetchRulesOverview(api),
    fetchRuleProvidersOverview(api),
  ];
  const [rules, providers] = await Promise.all(tasks);
  return { rules, providers };
}
