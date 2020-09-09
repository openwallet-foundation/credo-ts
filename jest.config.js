// TODO: maybe we use runner groups to make it
// easier to run specific groups of tests
// @see https://www.npmjs.com/package/jest-runner-groups
module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/lib/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
  },
  testTimeout: 30000,
};
