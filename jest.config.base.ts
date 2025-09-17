import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // NOTE: overridden in e2e test. Make sure to
  // update that match as well when changing this one
  testMatch: ['**/?(*.)test.ts'],
  moduleNameMapper: {
    '@credo-ts/(.+)': ['<rootDir>/../../packages/$1/src', '<rootDir>/../packages/$1/src', '<rootDir>/packages/$1/src'],
  },
  transform: {
    '\\.tsx?$': 'ts-jest',
  },
}

export default config
