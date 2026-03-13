const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const distDir = path.join(rootDir, 'dist');
const isPreclean = process.argv.includes('--pre');
const pkgPath = path.join(rootDir, 'package.json');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

let version = 'unknown';
try {
  const releaseVersion = String(process.env.CLASHFOX_RELEASE_VERSION || '').trim();
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const resolvedVersion = releaseVersion || (pkg && pkg.version ? String(pkg.version) : '');
  if (resolvedVersion) {
    version = String(`v${resolvedVersion}`);
  }
} catch {
  // ignore
}

const versionDir = path.join(distDir, version);
if (!fs.existsSync(versionDir)) {
  fs.mkdirSync(versionDir, { recursive: true });
}

if (isPreclean) {
  process.exit(0);
}

const keepExts = new Set(['.zip', '.yml']);
const keepNames = new Set([
  'latest.yml',
]);
const dropNames = new Set([
  'builder-debug.yml',
  'latest-mac.yml',
]);

for (const name of fs.readdirSync(distDir)) {
  const filePath = path.join(distDir, name);
  if (name === version) {
    continue;
  }
  if (name.startsWith('mac')) {
    fs.rmSync(filePath, { recursive: true, force: true });
    continue;
  }
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    continue;
  }
  if (!stat.isFile()) {
    continue;
  }
  const ext = path.extname(name);
  if (dropNames.has(name)) {
    fs.unlinkSync(filePath);
    continue;
  }
  if (!keepExts.has(ext) && !keepNames.has(name)) {
    fs.unlinkSync(filePath);
    continue;
  }
  if (ext === '.yml' || keepNames.has(name)) {
    continue;
  }
  const destPath = path.join(versionDir, name);
  if (destPath !== filePath) {
    fs.renameSync(filePath, destPath);
  }
}
