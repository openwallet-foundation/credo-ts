import type { IndyVdrPoolConfig } from '../pool'

import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'

describe('IndyVdrModuleConfig', () => {
  test('sets values', () => {
    const networkConfig = {} as IndyVdrPoolConfig

    const config = new IndyVdrModuleConfig({
      networks: [networkConfig],
    })

    expect(config.networks).toEqual([networkConfig])
  })
})
