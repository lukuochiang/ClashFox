const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

const ROOT = path.join(__dirname, '..', '..');
const pkg = require(path.join(ROOT, 'package.json'));

function toAsarRelative(absPath) {
  return absPath.replace(`${ROOT}${path.sep}`, '').split(path.sep).join('/');
}

function findPackageJsonForResolvedEntry(entryPath) {
  let currentDir = path.dirname(entryPath);
  const rootDir = ROOT;
  while (currentDir && currentDir.startsWith(rootDir)) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
    const parentDir = path.dirname(currentDir);
    if (!parentDir || parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return '';
}

function buildCriticalRuntimeFiles() {
  const files = new Set(['src/main.js']);
  Object.keys(pkg.dependencies || {}).forEach((name) => {
    const entryPath = require.resolve(name, { paths: [ROOT] });
    files.add(toAsarRelative(entryPath));
    const pkgPath = findPackageJsonForResolvedEntry(entryPath);
    if (pkgPath) {
      files.add(toAsarRelative(pkgPath));
    }
  });
  return Array.from(files);
}

function findAppBundlePath(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return '';
  }
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      return path.join(baseDir, entry.name);
    }
  }
  return '';
}

function buildAppAsarPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', 'app.asar');
}

function validateAppBundle(appPath) {
  const appAsarPath = buildAppAsarPath(appPath);
  if (!fs.existsSync(appAsarPath)) {
    throw new Error(`Missing app.asar in ${appPath}`);
  }
  const entries = new Set(asar.listPackage(appAsarPath));
  const missing = buildCriticalRuntimeFiles().filter((entry) => !entries.has(entry));
  if (missing.length) {
    throw new Error(
      `${path.basename(appPath)} is missing runtime files:\n${missing.map((item) => `- ${item}`).join('\n')}`,
    );
  }
}

function validateArtifacts() {
  const targets = [
    path.join(ROOT, 'dist', 'mac-x64'),
    path.join(ROOT, 'dist', 'mac-arm64'),
    path.join(ROOT, 'dist', 'mac-universal'),
  ];
  let validated = 0;
  targets.forEach((targetDir) => {
    const appPath = findAppBundlePath(targetDir);
    if (!appPath) {
      return;
    }
    validateAppBundle(appPath);
    validated += 1;
  });
  if (!validated) {
    throw new Error('No unpacked macOS app bundles found to validate.');
  }
  process.stdout.write(`Validated ${validated} packaged macOS app bundle(s).\n`);
}

try {
  validateArtifacts();
} catch (error) {
  process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
  process.exit(1);
}
