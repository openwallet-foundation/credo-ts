module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:workspaces/recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  plugins: ['workspaces'],
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
    '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    '@typescript-eslint/explicit-member-accessibility': 'error',
    'no-console': 'error',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/no-cycle': 'error',
    'import/newline-after-import': ['error', { count: 1 }],
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
    '@typescript-eslint/no-non-null-assertion': 'error',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: false,
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: ['packages/*'],
      },
    ],
    // Do not allow const enums
    // https://github.com/typescript-eslint/typescript-eslint/issues/561#issuecomment-593059472
    // https://ncjamieson.com/dont-export-const-enums/
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSEnumDeclaration[const=true]',
        message: "Don't declare const enums",
      },
    ],
  },
  overrides: [
    {
      files: ['packages/core/**'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            name: 'Buffer',
            message: 'Global buffer is not supported on all platforms. Import buffer from `src/utils/buffer`',
          },
        ],
      },
    },
    {
      files: ['jest.config.ts', '.eslintrc.js', './scripts/**'],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['demo/**', 'demo-openid/**'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: [
        '*.test.ts',
        '**/__tests__/**',
        '**/tests/**',
        'jest.*.ts',
        'samples/**',
        'demo/**',
        'demo-openid/**',
        'scripts/**',
        '**/tests/**',
      ],
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
    {
      files: ['*.test.ts', '**/__tests__/**', '**/tests/**', '**/tests/**'],
      rules: {
        'workspaces/no-relative-imports': 'off',
        'workspaces/require-dependency': 'off',
        'workspaces/no-absolute-imports': 'off',
      },
    },
  ],
}
