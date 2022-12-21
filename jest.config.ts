import type { Config } from '@jest/types'

import base from './jest.config.base'

const config: Config.InitialOptions = {
  ...base,
  roots: ['<rootDir>'],
  projects: [
    '<rootDir>/packages/*/jest.config.ts',
    '<rootDir>/tests/jest.config.ts',
    '<rootDir>/samples/extension-module/jest.config.ts',
  ],
}

export default config
