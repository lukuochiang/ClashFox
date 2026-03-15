const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const productFilename = String(
    (context && context.packager && context.packager.appInfo && context.packager.appInfo.productFilename)
      || 'ClashFox',
  ).trim() || 'ClashFox';
  const resources = path.join(
    context.appOutDir,
    `${productFilename}.app`,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Resources',
  );

  const locales = path.join(resources, 'locales');
  if (fs.existsSync(locales)) {
    const keep = new Set(['en.pak', 'zh-CN.pak']);
    for (const fileName of fs.readdirSync(locales)) {
      if (!keep.has(fileName)) {
        fs.rmSync(path.join(locales, fileName), { recursive: true, force: true });
      }
    }
  }

  for (const name of ['inspector', 'crashpad_handler']) {
    const targetPath = path.join(resources, name);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  }

  console.log('Electron optimized');
};
