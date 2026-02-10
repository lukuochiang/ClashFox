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

function shouldSkipForDevSession() {
  const lifecycle = process.env.npm_lifecycle_event || '';
  if (lifecycle !== 'dev') {
    return false;
  }
  try {
    const raw = fs.readFileSync(devLockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number') {
      const age = Date.now() - parsed.ts;
      if (age >= 0 && age < DEV_BUMP_WINDOW_MS) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

if (shouldSkipForDevSession()) {
  console.log('[bump-version] skipped (dev session already bumped)');
  process.exit(0);
}

const currentBuild = Number.parseInt(pkg.buildNumber, 10);
const nextBuild = Number.isFinite(currentBuild) ? currentBuild + 1 : 1;
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
  fs.writeFileSync(devLockPath, JSON.stringify({ ts: Date.now() }));
} catch {
  // ignore lock write failures
}

console.log(`[bump-version] buildNumber ${nextBuild}`);
