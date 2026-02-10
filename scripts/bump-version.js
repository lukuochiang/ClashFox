const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkgLockPath = path.join(rootDir, 'package-lock.json');
const devLockPath = path.join(rootDir, '.dev-bump.lock');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const pkg = readJson(pkgPath);
const DEV_BUMP_WINDOW_MS = 30000;

function readDevLock() {
  try {
    const raw = fs.readFileSync(devLockPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shouldSkipForDevSession(lock) {
  const lifecycle = process.env.npm_lifecycle_event || '';
  if (lifecycle !== 'dev') {
    return false;
  }
  if (lock && typeof lock.ts === 'number') {
    const age = Date.now() - lock.ts;
    if (age >= 0 && age < DEV_BUMP_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

const devLock = readDevLock();
const lastVersion = devLock && typeof devLock.version === 'string' ? devLock.version : '';
const versionChanged = lastVersion && lastVersion !== pkg.version;

if (!versionChanged && shouldSkipForDevSession(devLock)) {
  console.log('[bump-version] skipped (dev session already bumped)');
  process.exit(0);
}

const currentBuild = Number.parseInt(pkg.buildNumber, 10);
const nextBuild = versionChanged ? 1 : (Number.isFinite(currentBuild) ? currentBuild + 1 : 1);
pkg.buildNumber = nextBuild;
writeJson(pkgPath, pkg);

if (fs.existsSync(pkgLockPath)) {
  const lock = readJson(pkgLockPath);
  if (!lock.packages) {
    lock.packages = {};
  }
  if (!lock.packages['']) {
    lock.packages[''] = {};
  }
  lock.packages[''].buildNumber = nextBuild;
  writeJson(pkgLockPath, lock);
}

try {
  fs.writeFileSync(
    devLockPath,
    JSON.stringify({ ts: Date.now(), version: pkg.version, buildNumber: nextBuild })
  );
} catch {
  // ignore lock write failures
}

console.log(`[bump-version] buildNumber ${nextBuild}`);
