import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // NOTE: overridden in e2e test. Make sure to
  // update that match as well when changing this one
  testMatch: ['**/?(*.)test.ts'],
  transform: {
    '\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          isolatedModules: true,
        },
      },
    ],
  },
}

export default config
