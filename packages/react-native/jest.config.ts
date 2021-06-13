import type { Config } from '@jest/types'

import base from '../../jest.config.base'

import packageJson from './package.json'

const config: Config.InitialOptions = {
  ...base,
  preset: 'react-native',
  name: packageJson.name,
  displayName: packageJson.name,
  moduleNameMapper: {
    ...base.moduleNameMapper,
    'rn-indy-sdk': 'indy-sdk',
  },
}

export default config
