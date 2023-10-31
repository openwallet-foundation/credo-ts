import { AskarModule } from '@aries-framework/askar'
import { Agent } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { cleanAll, enableNetConnect } from 'nock'

import { OpenId4VcIssuerModule } from '../src'

const modules = {
  openId4VcIssuer: new OpenId4VcIssuerModule(),
  askar: new AskarModule({
    ariesAskar,
  }),
}

describe('OpenId4VcIssuer', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    agent = new Agent({
      config: {
        label: 'OpenId4VcIssuer Test',
        walletConfig: {
          id: 'openid4vc-Issuer-test',
          key: 'openid4vc-Issuer-test',
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
