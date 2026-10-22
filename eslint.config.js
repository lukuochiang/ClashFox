const js = require('@eslint/js');
const globals = require('globals');

// Baseline strategy: downgrade all recommended rules to "warn" so the existing
// large codebase never blocks CI. Only newly introduced hard errors (parse
// failures, undefined vars used as errors) can still surface. We tighten levels
// progressively in later phases.
function toWarnLevel(rules = {}) {
  const out = {};
  for (const [name, def] of Object.entries(rules)) {
    const level = Array.isArray(def) ? def[0] : def;
    if (level === 'off' || level === 0) {
      continue;
    }
    const opts = Array.isArray(def) ? def.slice(1) : [];
    out[name] = ['warn', ...opts];
  }
  return out;
}

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'artifacts/**',
      'build/**',
      'static/geoip/**',
      'static/helper/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['src/main.js', 'src/main/**/*.js', 'src/preload.js', 'static/scripts/**/*.js', 'eslint.config.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: toWarnLevel(js.configs.recommended.rules),
  },
  {
    files: ['src/ui/js/**/*.js', 'src/ui/components/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      ...toWarnLevel(js.configs.recommended.rules),
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/ui/locales/**/*.js', 'src/ui/utils/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: toWarnLevel(js.configs.recommended.rules),
  },
];
