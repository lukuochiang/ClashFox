const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const pkg = require(path.join(ROOT, 'package.json'));
const forceWithoutHelper = process.argv.includes('--without-helper') || process.env.CLASHFOX_WITH_HELPER === '0';
const forceWithHelper = process.argv.includes('--with-helper') || process.env.CLASHFOX_WITH_HELPER === '1';
const withHelper = forceWithHelper || !forceWithoutHelper;
const dualOutputFromHelper = withHelper && process.env.CLASHFOX_DUAL_FROM_HELPER === '1';
const artifactNameOverride = String(process.env.CLASHFOX_ARTIFACT_NAME || '').trim();
const configMode = withHelper ? 'helper' : 'no-helper';
const tempConfigPath = path.join(ROOT, 'dist', `electron-builder.${configMode}.json`);
const tempX64ConfigPath = path.join(ROOT, 'dist', `electron-builder.${configMode}.x64.json`);

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
  if (artifactNameOverride) {
    config.mac = {
      ...(config.mac || {}),
      artifactName: artifactNameOverride,
    };
  }
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
  writeTempConfig(tempConfigPath, baseConfig);
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
  run('npx', ['electron-builder', ...commonArgs, '--x64', '--publish', 'never', '--config', tempX64ConfigPath], { env });
  renameUnpackedMacDir('mac', 'mac-x64');
  run('npx', ['electron-builder', ...commonArgs, '--arm64', '--publish', 'never', '--config', tempConfigPath], { env });
  renameUnpackedMacDir('mac', 'mac-arm64');
  run('npx', ['electron-builder', ...commonArgs, '--universal', '--publish', 'never', '--config', tempConfigPath], { env });
  renameUnpackedMacDir('mac', 'mac-universal');
}

function findAppBundlePath(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      return path.join(baseDir, entry.name);
    }
  }
  return '';
}

function renderArtifactName(pattern, arch, ext = 'zip') {
  const productName = String((pkg.build && pkg.build.productName) || pkg.productName || pkg.name || 'ClashFox');
  const version = String(pkg.version || '0.0.0');
  const buildNumber = String(process.env.CLASHFOX_BUILD_NUMBER || pkg.buildNumber || '');
  return String(pattern || '')
    .replace(/\$\{productName\}/g, productName)
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{arch\}/g, arch)
    .replace(/\$\{ext\}/g, ext)
    .replace(/\$\{env\.CLASHFOX_BUILD_NUMBER\}/g, buildNumber)
    .replace(/\$\{env\.[A-Z0-9_]+\}/g, '');
}

function resolveDualArtifactNames(arch) {
  const fallbackPattern = '${productName}-${version}-mac-${arch}.zip';
  const helperPattern = (artifactNameOverride || fallbackPattern).replace(/\.zip$/i, '.zip');
  const helperName = renderArtifactName(helperPattern, arch, 'zip');
  const normalName = helperName.includes('-helper.')
    ? helperName.replace(/-helper(?=\.[^.]+$)/i, '')
    : renderArtifactName(fallbackPattern, arch, 'zip');
  return { helperName, normalName };
}

function zipAppBundle(appPath, outputZipPath) {
  const parentDir = path.dirname(appPath);
  const appName = path.basename(appPath);
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appName, outputZipPath], { cwd: parentDir });
}

function zipAppBundleWithoutHelper(appPath, outputZipPath) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clashfox-no-helper-'));
  try {
    const tempAppPath = path.join(tempRoot, path.basename(appPath));
    run('ditto', [appPath, tempAppPath]);
    const helperDirs = [
      path.join(tempAppPath, 'Contents', 'Resources', 'helper'),
      path.join(tempAppPath, 'Contents', 'Resources', 'static', 'helper'),
    ];
    for (const helperDir of helperDirs) {
      if (fs.existsSync(helperDir)) {
        fs.rmSync(helperDir, { recursive: true, force: true });
      }
    }
    zipAppBundle(tempAppPath, outputZipPath);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function buildDualArtifactsFromUnpacked() {
  const archDirs = [
    { arch: 'x64', dir: path.join(ROOT, 'dist', 'mac-x64') },
    { arch: 'arm64', dir: path.join(ROOT, 'dist', 'mac-arm64') },
    { arch: 'universal', dir: path.join(ROOT, 'dist', 'mac-universal') },
  ];
  for (const item of archDirs) {
    if (!fs.existsSync(item.dir)) {
      continue;
    }
    const appPath = findAppBundlePath(item.dir);
    if (!appPath) {
      throw new Error(`Cannot locate .app bundle in ${item.dir}`);
    }
    const { helperName, normalName } = resolveDualArtifactNames(item.arch);
    const helperZipPath = path.join(ROOT, 'dist', helperName);
    const normalZipPath = path.join(ROOT, 'dist', normalName);
    zipAppBundle(appPath, helperZipPath);
    zipAppBundleWithoutHelper(appPath, normalZipPath);
  }
}

run('node', ['static/scripts/clean-dist-mac.js', '--pre']);

ensureDistDir();
writeBuildConfigs();

let exitCode = 0;
try {
  buildMac();
  if (dualOutputFromHelper) {
    buildDualArtifactsFromUnpacked();
  }
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
