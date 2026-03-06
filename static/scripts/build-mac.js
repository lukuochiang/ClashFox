const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const pkg = require(path.join(ROOT, 'package.json'));
const withHelper = process.argv.includes('--with-helper') || process.env.CLASHFOX_WITH_HELPER === '1';
const tempConfigPath = path.join(ROOT, 'dist', 'electron-builder.no-helper.json');
const tempX64ConfigPath = path.join(ROOT, 'dist', withHelper ? 'electron-builder.x64.json' : 'electron-builder.no-helper.x64.json');

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

function renameUnpackedMacDir(fromName, toName) {
  const fromPath = path.join(ROOT, 'dist', fromName);
  const toPath = path.join(ROOT, 'dist', toName);
  if (!fs.existsSync(fromPath) || fromPath === toPath) {
    return;
  }
  try {
    if (fs.existsSync(toPath)) {
      fs.rmSync(toPath, { recursive: true, force: true });
    }
    fs.renameSync(fromPath, toPath);
  } catch {
    // ignore unpacked app rename failures
  }
}

function buildConfig({ includeHelper = true, forceX64Suffix = false } = {}) {
  const base = pkg.build || {};
  const files = includeHelper || !Array.isArray(base.files)
    ? base.files
    : base.files.filter((entry) => !String(entry).includes('helper/'));
  const extraResources = includeHelper || !Array.isArray(base.extraResources)
    ? base.extraResources
    : base.extraResources.filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        return entry.from !== 'helper' && entry.from !== 'static/helper' && entry.to !== 'helper';
      });
  const config = {
    ...base,
    files,
    extraResources,
  };
  if (forceX64Suffix) {
    config.mac = {
      ...(config.mac || {}),
      defaultArch: 'arm64',
    };
  }
  return config;
}

function writeTempConfig(filePath, config) {
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

function writeBuildConfigs() {
  const baseConfig = buildConfig({ includeHelper: withHelper });
  const x64Config = buildConfig({ includeHelper: withHelper, forceX64Suffix: true });
  if (!withHelper) {
    writeTempConfig(tempConfigPath, baseConfig);
  }
  writeTempConfig(tempX64ConfigPath, x64Config);
}

function cleanupNoHelperConfig() {
  try {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
    if (fs.existsSync(tempX64ConfigPath)) {
      fs.unlinkSync(tempX64ConfigPath);
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
  run('npx', ['electron-builder', ...commonArgs, '--x64', '--publish', 'never', '--config', tempX64ConfigPath], { env });
  renameUnpackedMacDir('mac', 'mac-x64');
  run('npx', ['electron-builder', ...commonArgs, '--arm64', '--publish', 'never', ...configArgs], { env });
  renameUnpackedMacDir('mac', 'mac-arm64');
  run('npx', ['electron-builder', ...commonArgs, '--universal', '--publish', 'never', ...configArgs], { env });
  renameUnpackedMacDir('mac', 'mac-universal');
}

run('node', ['static/scripts/clean-dist-mac.js', '--pre']);

ensureDistDir();
writeBuildConfigs();

let exitCode = 0;
try {
  buildMac();
} catch {
  exitCode = 1;
} finally {
  cleanupNoHelperConfig();
  const post = spawnSync('node', ['static/scripts/clean-dist-mac.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (post.status !== 0 && exitCode === 0) {
    exitCode = post.status || 1;
  }
}

process.exit(exitCode);
