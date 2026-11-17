import type { AbstractCheqdSDKModule } from '@cheqd/sdk'
import { CheqdNetwork, createCheqdSDK, DIDModule, ResourceModule } from '@cheqd/sdk'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'

// Read-only: queries live chain parameters and the Oracle, never signs or broadcasts.
// Skipped unless CHEQD_LIVE_FEE_TEST is set, because it needs outbound access to the public RPC nodes.
const STATIC_CREATE_DID_FEE = '50000000000' // 50 CHEQ, the pre-Oracle static fee

describe.skipIf(!process.env.CHEQD_LIVE_FEE_TEST)('cheqd DID fees on live networks', () => {
  const networks = [
    { network: CheqdNetwork.Mainnet, rpcUrl: 'https://rpc.cheqd.net' },
    { network: CheqdNetwork.Testnet, rpcUrl: 'https://rpc.cheqd.network' },
  ]

  for (const { network, rpcUrl } of networks) {
    it(`uses Oracle (USD-priced) fees for DID creation on ${network}`, async () => {
      const wallet = await DirectSecp256k1HdWallet.generate(12, { prefix: 'cheqd' })
      const [account] = await wallet.getAccounts()
      const sdk = await createCheqdSDK({
        modules: [DIDModule as unknown as AbstractCheqdSDKModule, ResourceModule as unknown as AbstractCheqdSDKModule],
        rpcUrl,
        wallet,
      })

      const fee = await sdk.generateCreateDidDocFees(account.address, undefined, { slippageBps: 1000 })

      expect(fee.amount[0].denom).toBe('ncheq')
      // The static fee is what the SDK falls back to when it wrongly decides the Oracle is unavailable
      expect(fee.amount[0].amount).not.toBe(STATIC_CREATE_DID_FEE)
    }, 60_000)
  }
})
