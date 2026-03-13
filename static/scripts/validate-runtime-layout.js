const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

function fail(message) {
  throw new Error(message);
}

function readText(relativePath) {
  const absPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absPath)) {
    fail(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(absPath, 'utf8');
}

function ensureIncludes(text, pattern, label) {
  if (!text.includes(pattern)) {
    fail(`Missing expected runtime path logic in ${label}: ${pattern}`);
  }
}

function ensureNotIncludes(text, pattern, label) {
  if (text.includes(pattern)) {
    fail(`Found stale path logic in ${label}: ${pattern}`);
  }
}

function checkShellSyntax(relativePath) {
  const result = spawnSync('bash', ['-n', relativePath], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: false,
  });
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    fail(`Shell syntax check failed for ${relativePath}${stderr ? `: ${stderr}` : ''}`);
  }
}

function validateBridgeScriptLayout() {
  const guiBridge = readText('static/scripts/gui_bridge.sh');
  ensureIncludes(guiBridge, 'SCRIPT_PATH="$SCRIPT_DIR/lib/clashfox_mihomo_toolkit.sh"', 'static/scripts/gui_bridge.sh');
  ensureIncludes(guiBridge, 'COMMON_LIB="$SCRIPT_DIR/lib/clashfox_script_common.sh"', 'static/scripts/gui_bridge.sh');
  ensureIncludes(guiBridge, 'SCRIPT_PATH="$ROOT_DIR/static/scripts/lib/clashfox_mihomo_toolkit.sh"', 'static/scripts/gui_bridge.sh');
  ensureIncludes(guiBridge, 'COMMON_LIB="$ROOT_DIR/static/scripts/lib/clashfox_script_common.sh"', 'static/scripts/gui_bridge.sh');
  checkShellSyntax('static/scripts/gui_bridge.sh');
}

function validateToolkitScriptLayout() {
  const toolkit = readText('static/scripts/lib/clashfox_mihomo_toolkit.sh');
  ensureIncludes(toolkit, 'COMMON_LIB="$SCRIPT_DIR/clashfox_script_common.sh"', 'static/scripts/lib/clashfox_mihomo_toolkit.sh');
  ensureIncludes(toolkit, `COMMON_LIB="$(cd "$SCRIPT_DIR/.." && pwd)/lib/clashfox_script_common.sh"`, 'static/scripts/lib/clashfox_mihomo_toolkit.sh');
  ensureNotIncludes(toolkit, 'COMMON_LIB="$SCRIPT_DIR/lib/clashfox_script_common.sh"', 'static/scripts/lib/clashfox_mihomo_toolkit.sh');
  checkShellSyntax('static/scripts/lib/clashfox_mihomo_toolkit.sh');
}

function validateMainBridgeCandidates() {
  const mainJs = readText('src/main.js');
  ensureIncludes(mainJs, "path.join(ROOT_DIR, 'static', 'scripts', 'gui_bridge.sh')", 'src/main.js');
  ensureIncludes(mainJs, "path.join(process.resourcesPath || '', 'scripts', 'gui_bridge.sh')", 'src/main.js');
}

function validateRequiredFilesExist() {
  [
    'static/scripts/gui_bridge.sh',
    'static/scripts/lib/clashfox_mihomo_toolkit.sh',
    'static/scripts/lib/clashfox_script_common.sh',
  ].forEach((relativePath) => {
    if (!fs.existsSync(path.join(ROOT, relativePath))) {
      fail(`Missing required runtime file: ${relativePath}`);
    }
  });
}

function main() {
  validateRequiredFilesExist();
  validateBridgeScriptLayout();
  validateToolkitScriptLayout();
  validateMainBridgeCandidates();
  process.stdout.write('Validated runtime layout for dev and packaged script paths.\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
  process.exit(1);
}
