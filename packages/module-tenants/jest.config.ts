import type { Config } from '@jest/types'

import base from '../../jest.config.base'

import packageJson from './package.json'

const config: Config.InitialOptions = {
  ...base,
  name: packageJson.name,
  displayName: packageJson.name,
  setupFilesAfterEnv: ['./tests/setup.ts'],
}

export default config
