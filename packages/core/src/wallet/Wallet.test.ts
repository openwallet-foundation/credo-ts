import { agentDependencies } from '@aries-framework/node'

import { getAgentConfig, getBaseConfig } from '../../tests/helpers'
import { AgentConfig } from '../agent/AgentConfig'

import { IndyWallet } from './IndyWallet'

describe('Wallet', () => {
  const wallet = new IndyWallet(getAgentConfig('WalletTest'))

  test('initialize public did', async () => {
    await wallet.initialize(config.walletConfig!, config.walletCredentials!)

    await wallet.initPublicDid({ seed: '00000000000000000000000Forward01' })

    expect(wallet.publicDid).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  afterEach(async () => {
    await wallet.delete()
  })
})
