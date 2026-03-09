export const DEFAULT_HELPER_LOG_PATH = '/var/log/clashfox-helper.log';

function getBridge(bridge = globalThis.window && window.clashfox) {
  return bridge && typeof bridge === 'object' ? bridge : null;
}

export async function readHelperSettings(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.readSettings !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.readSettings();
}

export async function getHelperStatus(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.getHelperStatus !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.getHelperStatus();
}

export function buildHelperStatusSnapshot(data = {}, options = {}) {
  return {
    state: String(data.state || 'unknown'),
    installed: Boolean(data.installed),
    running: Boolean(data.running),
    binaryExists: Boolean(data.binaryExists),
    plistExists: Boolean(data.plistExists),
    launchdLoaded: Boolean(data.launchdLoaded),
    socketExists: Boolean(data.socketExists),
    socketPingOk: Boolean(data.socketPingOk),
    httpPingOk: Boolean(data.httpPingOk),
    helperVersion: String(data.helperVersion || ''),
    helperTargetVersion: String(data.helperTargetVersion || ''),
    helperUpdateAvailable: Boolean(data.helperUpdateAvailable),
    logPath: String(data.logPath || options.defaultLogPath || DEFAULT_HELPER_LOG_PATH),
    updatedAt: options.updatedAt || new Date().toISOString(),
  };
}

export async function getHelperInstallPath(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.getHelperInstallPath !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.getHelperInstallPath();
}

export async function installHelper(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.installHelper !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.installHelper();
}

export async function uninstallHelper(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.uninstallHelper !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.uninstallHelper();
}

export async function doctorHelper(options = {}, bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.doctorHelper !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.doctorHelper(options);
}

export async function repairHelper(bridge) {
  const doctorResult = await doctorHelper({ repair: true }, bridge);
  if (doctorResult && doctorResult.ok) {
    return doctorResult;
  }
  if (doctorResult && doctorResult.error !== 'bridge_missing') {
    return doctorResult;
  }
  return installHelper(bridge);
}

export async function runHelperInstallInTerminal(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.runHelperInstallInTerminal !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.runHelperInstallInTerminal();
}

export async function checkHelperUpdates(options = {}, bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.checkHelperUpdates !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.checkHelperUpdates(options);
}

export async function revealInFinder(targetPath, bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.revealInFinder !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.revealInFinder(targetPath);
}

export async function openPath(targetPath, bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.openPath !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.openPath(targetPath);
}

export async function openHelperLogs(bridge) {
  const api = getBridge(bridge);
  if (!api || typeof api.openHelperLogs !== 'function') {
    return { ok: false, error: 'bridge_missing' };
  }
  return api.openHelperLogs();
}

export async function openHelperLogsWithFallback(logPath = DEFAULT_HELPER_LOG_PATH, bridge) {
  const primary = await openHelperLogs(bridge);
  if (primary && primary.ok) {
    return primary;
  }
  return openPath(logPath, bridge);
}
