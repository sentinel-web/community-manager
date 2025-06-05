module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended', // For import rules
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020, // Or higher
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
      },
      // Crucial for Meteor's absolute imports:
      // You might need to configure this to resolve Meteor's absolute paths
      // A simple 'node' resolver might be enough with proper jsconfig/tsconfig
      // For more complex cases, you might need 'eslint-import-resolver-meteor'
      // or a custom resolver if your paths are non-standard.
      // For typical Meteor setup, the 'node' resolver with jsconfig/tsconfig baseUrl
      // should work fine.
    },
  },
  rules: {
    'import/no-unresolved': 'error', // Warns about paths that can't be resolved
    'import/order': [
      // Enforces a specific order for imports
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/newline-after-import': 'error', // Ensures a blank line after imports
    'import/no-duplicates': 'error', // Prevents duplicate import statements
    // Other rules...
  },
  // If using TypeScript, set parserOptions
  // If you're encountering issues with absolute imports in ESLint,
  // you might need a specific resolver for Meteor or configure 'import/resolver' further.
};
