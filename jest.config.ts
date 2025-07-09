import type { Config } from '@jest/types'

import base from './jest.config.base'

const config: Config.InitialOptions = {
  ...base,
  roots: ['<rootDir>'],
  verbose: true,
  coverageReporters: ['text-summary', 'lcov', 'json'],
  coveragePathIgnorePatterns: ['/build/', '/node_modules/', '/__tests__/', 'tests'],
  coverageDirectory: '<rootDir>/coverage/',
  projects: [
    '<rootDir>/packages/*/jest.config.ts',
    '<rootDir>/tests/jest.config.ts',
    '<rootDir>/samples/extension-module/jest.config.ts',
  ],
}

export default config
