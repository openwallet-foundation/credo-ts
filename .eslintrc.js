module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    // Type is enforced by callers. Not entirely, but it's good enough.
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // Aries protocol defines attributes with snake case.
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    '@typescript-eslint/explicit-member-accessibility': 'error',
    'no-console': 'error',
    // Because of early development, we only warn on ts-ignore. In future we want to move to error
    '@typescript-eslint/ban-ts-comment': 'warn',
  },
  overrides: [
    {
      files: ['*.test.*'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['jest.config.js', '.eslintrc.js'],
      env: {
        node: true,
      },
    },
  ],
}
