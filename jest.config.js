// TODO: maybe we use runner groups to make it
// easier to run specific groups of tests
// @see https://www.npmjs.com/package/jest-runner-groups
module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src', '<rootDir>/samples'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx,tsx,ts}'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  testTimeout: 60000,
}
