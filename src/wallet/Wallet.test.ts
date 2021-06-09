import { getBaseConfig } from '../__tests__/helpers'
import { AgentConfig } from '../agent/AgentConfig'

import { IndyWallet } from './IndyWallet'

describe('Wallet', () => {
  const wallet = new IndyWallet(new AgentConfig(getBaseConfig('WalletTest')))

  test('initialize public did', async () => {
    await wallet.init()

    await wallet.initPublicDid({ seed: '00000000000000000000000Forward01' })

    expect(wallet.publicDid).toEqual({
      did: 'DtWRdd6C5dN5vpcN6XRAvu',
      verkey: '82RBSn3heLgXzZd74UsMC8Q8YRfEEhQoAM7LUqE6bevJ',
    })
  })

  afterEach(async () => {
    await wallet.close()
    await wallet.delete()
  })
})
