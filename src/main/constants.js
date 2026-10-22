const { presets: PANEL_PRESETS } = require('../ui/utils/panel-presets.js');

const CHECK_UPDATE_API_URL = 'https://api.github.com/repos/lukuochiang/ClashFox/releases?per_page=30';
const CHECK_UPDATE_STABLE_URL = 'https://github.com/lukuochiang/ClashFox/releases/latest';
const CHECK_UPDATE_BETA_URL = 'https://github.com/lukuochiang/ClashFox/releases';
const HELPER_RELEASE_LATEST_URL = 'https://github.com/lukuochiang/ClashFox-Helper/releases/latest';

const KERNEL_RELEASE_API = {
  vernesong: 'https://api.github.com/repos/vernesong/mihomo/releases?per_page=50',
  MetaCubeX: 'https://api.github.com/repos/MetaCubeX/mihomo/releases?per_page=50',
};
const KERNEL_TAGS_API = {
  vernesong: 'https://api.github.com/repos/vernesong/mihomo/tags?per_page=100',
  MetaCubeX: 'https://api.github.com/repos/MetaCubeX/mihomo/tags?per_page=100',
};
const KERNEL_BETA_VERSION_TXT_URL = {
  vernesong: 'https://github.com/vernesong/mihomo/releases/download/Prerelease-Alpha/version.txt',
  MetaCubeX: 'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt',
};

module.exports = {
  PANEL_PRESETS,
  CHECK_UPDATE_API_URL,
  CHECK_UPDATE_STABLE_URL,
  CHECK_UPDATE_BETA_URL,
  HELPER_RELEASE_LATEST_URL,
  KERNEL_RELEASE_API,
  KERNEL_TAGS_API,
  KERNEL_BETA_VERSION_TXT_URL,
};
