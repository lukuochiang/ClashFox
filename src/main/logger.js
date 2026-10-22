const fs = require('fs');
const path = require('path');

const LOG_FILE_NAME = 'clashfox-main.log';
const MAX_LOG_BYTES = 1024 * 1024;

let debugEnabled = false;
let logDirectory = null;

function setDebugEnabled(value) {
  debugEnabled = Boolean(value);
}

function setLogDirectory(value) {
  logDirectory = typeof value === 'string' && value ? value : null;
}

function formatLine(level, scope, message, error) {
  const timestamp = new Date().toISOString();
  const scopeText = scope ? ` [${scope}]` : '';
  const errorText = error
    ? ` :: ${String((error && error.message) || error || '')}`
    : '';
  return `${timestamp} [${String(level).toUpperCase()}]${scopeText} ${message}${errorText}`;
}

function appendToLogFile(line) {
  if (!logDirectory) {
    return;
  }
  const filePath = path.join(logDirectory, LOG_FILE_NAME);
  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.size > MAX_LOG_BYTES) {
      fs.renameSync(filePath, `${filePath}.1`);
    }
  } catch {
    // rotation failure must never block logging
  }
  try {
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch (err) {
    console.error('[clashfox:logger] failed to write log file:', err && err.message);
  }
}

function write(level, scope, message, error) {
  const line = formatLine(level, scope, message, error);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (debugEnabled) {
    console.log(line);
  }
  if (level === 'error' || level === 'warn' || debugEnabled) {
    appendToLogFile(line);
  }
}

module.exports = {
  setDebugEnabled,
  setLogDirectory,
  debug: (scope, message) => write('debug', scope, message, null),
  info: (scope, message) => write('info', scope, message, null),
  warn: (scope, message, error) => write('warn', scope, message, error || null),
  error: (scope, message, error) => write('error', scope, message, error || null),
};
