module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.eslint.json'],
  },
  settings: {
    'import/extensions': ['.js', '.ts'],
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        project: 'packages/*/tsconfig.json',
        alwaysTryTypes: true,
      },
    },
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    '@typescript-eslint/explicit-member-accessibility': 'error',
    'no-console': 'error',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/no-cycle': 'error',
    'import/order': [
      'error',
      {
        groups: ['type', ['builtin', 'external'], 'parent', 'sibling', 'index'],
        alphabetize: {
          order: 'asc',
        },
        'newlines-between': 'always',
      },
    ],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: false,
      },
    ],
  },
  overrides: [
    {
      files: ['jest.config.ts', '.eslintrc.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['*.test.ts', '**/__tests__/**', '**/tests/**', 'jest.*.ts', 'samples'],
      env: {
        jest: true,
        node: false,
      },
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: true,
          },
        ],
      },
    },
  ],
}
