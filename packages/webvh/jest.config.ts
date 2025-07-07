import type { Config } from '@jest/types'

import base from '../../jest.config.base'

import packageJson from './package.json'

const config: Config.InitialOptions = {
  ...base,
  displayName: packageJson.name,
  setupFilesAfterEnv: [],
}

export default config
