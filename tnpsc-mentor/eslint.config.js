// Flat ESLint config (ESLint 9) for the TS + React SPA.
// Pragmatic by design: stylistic / nice-to-have rules are warnings (not errors)
// so the existing codebase keeps building while we adopt linting incrementally.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // Paths we never lint (build output, deps, native shell, server has its own tsconfig).
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'server/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      // React Hooks correctness — keep as warnings on day one.
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // Stylistic / low-risk TS rules downgraded to warnings so they don't
      // block CI builds until the codebase is cleaned up.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
    },
  },
  // Node tooling scripts + root/deploy config files (not part of the SPA bundle):
  // declare Node globals so `no-undef` stops firing on process/module/console,
  // and keep the same stylistic rules as warnings as the app source does. Browser
  // globals are included too because the automation scripts embed browser-context
  // code (e.g. page.evaluate blocks that touch localStorage).
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'deploy/**/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Service worker — browser + service-worker globals (self / caches / clients).
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    rules: {
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  }
)
