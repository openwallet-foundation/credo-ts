import type { IndyVdrPoolConfig } from '../pool'

import { indyVdr } from '@hyperledger/indy-vdr-nodejs'

import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'

describe('IndyVdrModuleConfig', () => {
  test('sets values', () => {
    const networkConfig = {} as IndyVdrPoolConfig

    const config = new IndyVdrModuleConfig({
      indyVdr,
      networks: [networkConfig],
    })

    expect(config.networks).toEqual([networkConfig])
  })
})
