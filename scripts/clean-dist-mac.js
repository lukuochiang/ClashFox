const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const isPreclean = process.argv.includes('--pre');
const pkgPath = path.join(__dirname, '..', 'package.json');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

let version = 'unknown';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg && pkg.version) {
    version = String("v" + pkg.version);// prepend 'v' to match the naming convention, e.g., 'v1.2.3'
  }
} catch {
  // ignore
}

const versionDir = path.join(distDir, version);
if (!fs.existsSync(versionDir)) {
  fs.mkdirSync(versionDir, { recursive: true });
}

if (isPreclean) {
  for (const name of fs.readdirSync(versionDir)) {
    fs.rmSync(path.join(versionDir, name), { recursive: true, force: true });
  }
  process.exit(0);
}

const keepExts = new Set(['.dmg', '.zip', '.yml']);
const keepNames = new Set([
  'latest-mac.yml',
  'latest.yml',
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
