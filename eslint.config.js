// Lint rules for `npm run lint`. The site's code runs in Node.js; public/app.js runs in the browser.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'tutorial/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
];
