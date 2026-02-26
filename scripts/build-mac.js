const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const withHelper = process.argv.includes('--with-helper') || process.env.CLASHFOX_WITH_HELPER === '1';
const tempConfigPath = path.join(ROOT, 'dist', 'electron-builder.no-helper.json');
const helperBinaryPath = path.join(ROOT, 'helper', 'com.clashfox.helper');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} failed`);
    error.code = result.status || 1;
    throw error;
  }
}

function ensureDistDir() {
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
}

function writeNoHelperConfig() {
  const base = pkg.build || {};
  const files = Array.isArray(base.files)
    ? base.files.filter((entry) => !String(entry).includes('helper/'))
    : base.files;
  const extraResources = Array.isArray(base.extraResources)
    ? base.extraResources.filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        return entry.from !== 'helper' && entry.to !== 'helper';
      })
    : base.extraResources;
  const config = {
    ...base,
    files,
    extraResources,
  };
  fs.writeFileSync(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

function cleanupNoHelperConfig() {
  try {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  } catch {
    // ignore cleanup errors
  }
}

function buildMac() {
  const buildNumberFromEnv = process.env.CLASHFOX_BUILD_NUMBER;
  const env = {
    ...process.env,
    CLASHFOX_BUILD_NUMBER: buildNumberFromEnv || String(pkg.buildNumber || ''),
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    PYTHON: process.env.PYTHON || 'python3',
  };
  const commonArgs = ['--mac', 'zip'];
  const configArgs = withHelper ? [] : ['--config', tempConfigPath];
  run('npx', ['electron-builder', ...commonArgs, '--x64', '--publish', 'never', ...configArgs], { env });
  run('npx', ['electron-builder', ...commonArgs, '--arm64', '--publish', 'never', ...configArgs], { env });
  run('npx', ['electron-builder', ...commonArgs, '--universal', '--publish', 'never', ...configArgs], { env });
}

run('node', ['scripts/clean-dist-mac.js', '--pre']);

if (withHelper) {
  if (!fs.existsSync(helperBinaryPath)) {
    console.error(`Helper binary not found: ${helperBinaryPath}`);
    console.error('Please prepare helper/com.clashfox.helper before running with --with-helper.');
    process.exit(1);
  }
}

if (!withHelper) {
  ensureDistDir();
  writeNoHelperConfig();
}

let exitCode = 0;
try {
  buildMac();
} catch {
  exitCode = 1;
} finally {
  cleanupNoHelperConfig();
  const post = spawnSync('node', ['scripts/clean-dist-mac.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (post.status !== 0 && exitCode === 0) {
    exitCode = post.status || 1;
  }
}

process.exit(exitCode);
