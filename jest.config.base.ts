import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/build/', '/node_modules/', '/__tests__/', 'tests'],
  coverageDirectory: '<rootDir>/coverage/',
  verbose: true,
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '@aries-framework/(.+)': [
      '<rootDir>/../../packages/$1/src',
      '<rootDir>/../packages/$1/src',
      '<rootDir>/packages/$1/src',
    ],
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
}

export default config
