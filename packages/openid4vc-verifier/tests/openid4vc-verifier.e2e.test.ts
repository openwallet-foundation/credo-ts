import { AskarModule } from '@aries-framework/askar'
import { Agent } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { cleanAll, enableNetConnect } from 'nock'

import { OpenId4VcVerifierModule } from '../src'

const modules = {
  openId4VcVerifier: new OpenId4VcVerifierModule(),
  askar: new AskarModule({
    ariesAskar,
  }),
}

describe('OpenId4VcVerifier', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    agent = new Agent({
      config: {
        label: 'OpenId4VcVerifier Test',
        walletConfig: {
          id: 'openid4vc-Verifier-test',
          key: 'openid4vc-Verifier-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('[DRAFT 08]: Pre-authorized flow', () => {
    afterEach(() => {
      cleanAll()
      enableNetConnect()
    })

    it('test', async () => {
      expect(true).toBe(true)
    })
  })
})
