const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

const keepExts = new Set(['.dmg', '.zip', '.yml']);
const keepNames = new Set([
  'latest-mac.yml',
  'latest.yml',
]);

for (const name of fs.readdirSync(distDir)) {
  const filePath = path.join(distDir, name);
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
  }
}
