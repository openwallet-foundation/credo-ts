import type { DependencyManager } from '@credo-ts/core'

import { indyVdr } from '@hyperledger/indy-vdr-nodejs'

import { IndyVdrModule } from '../IndyVdrModule'
import { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'
import { IndyVdrPoolService } from '../pool'

const dependencyManager = {
  registerInstance: vi.fn(),
  registerSingleton: vi.fn(),
  registerContextScoped: vi.fn(),
  resolve: vi.fn().mockReturnValue({ logger: { warn: vi.fn() } }),
} as unknown as DependencyManager

describe('IndyVdrModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const indyVdrModule = new IndyVdrModule({
      indyVdr,
      networks: [
        {
          isProduction: false,
          genesisTransactions: 'xxx',
          indyNamespace: 'localhost:test',
          transactionAuthorAgreement: {
            version: '1',
            acceptanceMechanism: 'accept',
          },
        },
      ],
    })

    indyVdrModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(IndyVdrPoolService)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(IndyVdrModuleConfig, indyVdrModule.config)
  })
})
