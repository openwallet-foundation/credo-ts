import type { Config } from '@jest/types'

import base from '../jest.config.base'

const config: Config.InitialOptions = {
  ...base,
  name: '@aries-framework/e2e-test',
  displayName: '@aries-framework/e2e-test',
  setupFilesAfterEnv: ['./setup.ts'],
}

export default config
