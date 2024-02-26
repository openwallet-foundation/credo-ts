import type { Config } from '@jest/types'

import base from '../../jest.config.base'

import packageJson from './package.json'

process.env.TZ = 'GMT'

const config: Config.InitialOptions = {
  ...base,
  displayName: packageJson.name,
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testMatch: ['**/*/sdJwtVc.test.ts', '**/*/SdJwtVcService.test.ts', '**/*/SdJwtVcModule.test.ts'],
}

export default config
