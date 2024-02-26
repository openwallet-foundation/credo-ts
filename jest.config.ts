import type { Config } from '@jest/types'

import base from './jest.config.base'

const config: Config.InitialOptions = {
  ...base,
  roots: ['<rootDir>'],
  coveragePathIgnorePatterns: ['/build/', '/node_modules/', '/__tests__/', 'tests'],
  coverageDirectory: '<rootDir>/coverage/',
  projects: ['<rootDir>/packages/core/jest.config.ts'],
}

export default config
