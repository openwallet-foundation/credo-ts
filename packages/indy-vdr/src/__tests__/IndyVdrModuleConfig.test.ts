import type { IndyVdrNetworkConfig } from '../IndyVdrModuleConfig'

import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'

describe('IndyVdrModuleConfig', () => {
  test('sets values', () => {
    const networkConfig = {} as IndyVdrNetworkConfig

    const config = new IndyVdrModuleConfig({
      networks: [networkConfig],
    })

    expect(config.networkConfigs).toEqual([networkConfig])
  })
})
