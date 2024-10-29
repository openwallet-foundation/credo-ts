import type { Config } from '@jest/types'
import path from 'path'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // NOTE: overridden in e2e test. Make sure to
  // update that match as well when changing this one
  testMatch: ['**/?(*.)test.ts'],
  moduleNameMapper: {
    '@credo-ts/(.+)': ['<rootDir>/../../packages/$1/src', '<rootDir>/../packages/$1/src', '<rootDir>/packages/$1/src'],
  },
  // oauth4webapi is an esm module
  // transformIgnorePatterns: ['node_modules/.pnpm/(?!oauth4webapi)'],
  transform: {
    '\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
    // '\\.jsx?$': ['babel-jest', { extends: path.join(__dirname, '.babelrc') }],
  },
}

export default config
