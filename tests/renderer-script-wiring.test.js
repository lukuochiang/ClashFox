'use strict';

// Regression guard: app.js is an ES module loaded by several renderer pages. At module top
// level it destructures helper functions from globalThis.CLASHFOX_TOPOLOGY_UTILS (loaded via a
// classic <script> that runs before app.js). If a page loads app.js but forgets the util script,
// topology rendering throws at runtime. This test asserts the wiring invariant stays intact.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML_DIR = path.join(__dirname, '..', 'src', 'ui', 'html');

// Global namespaces that app.js destructures eagerly and that MUST have their classic script
// present on every page that loads app.js, mapped to the file that provides them.
const REQUIRED_SCRIPTS_FOR_APP_PAGES = [
  'utils/topology-utils.js',
];

function appLoadingPages() {
  return fs
    .readdirSync(HTML_DIR)
    .filter((name) => name.endsWith('.html'))
    .map((name) => {
      const content = fs.readFileSync(path.join(HTML_DIR, name), 'utf8');
      return { name, content };
    })
    .filter((page) => /src="\.\.\/js\/app\.js"/.test(page.content));
}

test('every page loading app.js also loads its required util scripts', () => {
  const pages = appLoadingPages();
  assert.ok(pages.length > 0, 'expected at least one page to load app.js');
  for (const page of pages) {
    for (const script of REQUIRED_SCRIPTS_FOR_APP_PAGES) {
      assert.ok(
        page.content.includes(`src="../${script}"`),
        `${page.name} loads app.js but is missing <script src="../${script}">`,
      );
    }
  }
});

test('util script tags appear before app.js so globals are defined at module eval', () => {
  for (const page of appLoadingPages()) {
    for (const script of REQUIRED_SCRIPTS_FOR_APP_PAGES) {
      const utilIndex = page.content.indexOf(`src="../${script}"`);
      const appIndex = page.content.indexOf('src="../js/app.js"');
      assert.ok(utilIndex >= 0 && appIndex >= 0);
      assert.ok(
        utilIndex < appIndex,
        `${page.name}: ${script} must be loaded before app.js`,
      );
    }
  }
});
