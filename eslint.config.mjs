import css from '@eslint/css';
import js from '@eslint/js';
import json from '@eslint/json';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Repo-specific conventions documented in CLAUDE.md / agent memory, encoded as
// syntactic rules so they are enforced by CI rather than living only as prose.
const conventionRestrictions = [
  {
    selector:
      'TSTypeReference[typeName.name="FC"], TSTypeReference[typeName.name="FunctionComponent"], TSTypeReference[typeName.left.name="React"][typeName.right.name=/^(FC|FunctionComponent)$/]',
    message: 'Do not use React.FC / FunctionComponent. Type props with an interface above the component (CLAUDE.md).',
  },
  {
    selector:
      'ImportDeclaration[source.value="prop-types"], MemberExpression[object.name="PropTypes"], AssignmentExpression[left.property.name="propTypes"]',
    message: 'PropTypes are not used in this codebase — props are typed with TypeScript interfaces (CLAUDE.md).',
  },
  {
    selector:
      'MemberExpression[optional=true][object.type="MemberExpression"][object.property.name="profile"][object.object.name="member"]',
    message: 'Do not use optional chaining on member.profile.X — it masks crashes. Use a non-null assertion per CLAUDE.md.',
  },
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.meteor/**', // Meteor build cache (also inside any nested worktree checkout)
    '_build/**', // production build output
    '.claude/**', // agent tooling + stale worktrees, not application code
    '.agents/**',
    '.remember/**',
    '.github/**',
    'public/**',
    'private/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'e2e/**/.auth/**',
    'package-lock.json',
    'skills-lock.json',
  ]),

  // Plain JS/JSX (rare in this repo, but keep it covered).
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // TypeScript — the bulk of the codebase.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // CLAUDE.md mandates `!` (non-null assertion) on member.profile.X access,
      // so this typescript-eslint rule directly conflicts with house style.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow intentionally-unused identifiers prefixed with _ (e.g. type-level
      // test placeholders, ignored args).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-restricted-syntax': ['error', ...conventionRestrictions],
    },
  },

  // React rules for JSX/TSX.
  {
    ...pluginReact.configs.flat.recommended,
    files: ['**/*.{jsx,tsx}'],
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReact.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 18 automatic JSX runtime
      'react/prop-types': 'off', // props are typed with TypeScript
    },
  },

  // React Hooks rules. The plugin's `recommended` now also pulls in the
  // aggressive React Compiler ruleset; we enable only the two classic rules
  // (matching the prior .eslintrc.cjs intent) to avoid a repo-wide refactor.
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Test-only relaxations. Tests legitimately: use require() to break a
  // crud.lib circular dependency (see reference_crud_lib_circular_dep), pass
  // cross-collection helpers typed as Mongo.Collection<any>, and assert against
  // `{}` in type-level checks.
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // Non-code languages.
  { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
  { files: ['**/*.jsonc'], plugins: { json }, language: 'json/jsonc', extends: ['json/recommended'] },
  { files: ['**/*.json5'], plugins: { json }, language: 'json/json5', extends: ['json/recommended'] },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: ['css/recommended'],
    // !important is used deliberately to override Ant Design styles.
    rules: { 'css/no-important': 'off' },
  },
]);
