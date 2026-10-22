'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const logger = require('../src/main/logger.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-log-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('logger: debug/info are gated by debugEnabled flag', () => {
  withTempDir((dir) => {
    logger.setLogDirectory(dir);
    logger.setDebugEnabled(false);
    logger.debug('scope', 'hidden-when-disabled');
    const logFile = path.join(dir, 'clashfox-main.log');
    assert.strictEqual(fs.existsSync(logFile), false, 'debug must not write when disabled');

    logger.setDebugEnabled(true);
    logger.debug('scope', 'visible-when-enabled');
    assert.strictEqual(fs.existsSync(logFile), true, 'debug should write when enabled');
    const content = fs.readFileSync(logFile, 'utf8');
    assert.match(content, /visible-when-enabled/);
    assert.match(content, /\[DEBUG\]/);
  });
});

test('logger: warn and error always persist to the log file', () => {
  withTempDir((dir) => {
    logger.setLogDirectory(dir);
    logger.setDebugEnabled(false);
    logger.warn('net', 'warn-line');
    logger.error('net', 'error-line', new Error('boom'));
    const content = fs.readFileSync(path.join(dir, 'clashfox-main.log'), 'utf8');
    assert.match(content, /\[WARN\].*warn-line/);
    assert.match(content, /\[ERROR\].*error-line.*boom/);
  });
});

test('logger: without a log directory writes are swallowed (no throw)', () => {
  logger.setLogDirectory(null);
  logger.setDebugEnabled(true);
  assert.doesNotThrow(() => logger.info('scope', 'dropped-without-dir'));
});
