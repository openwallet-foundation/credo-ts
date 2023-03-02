import type { IndyVdrDidCreateOptions } from '../src/dids/IndyVdrIndyDidRegistrar'
import type { Agent } from '@aries-framework/core'

import { DidCommV1Service, DidCommV2Service, DidDocumentService, KeyType } from '@aries-framework/core'

import { genesisTransactions } from '../../core/tests/helpers'
import { IndyVdrModuleConfig } from '../src/IndyVdrModuleConfig'

export const indyVdrModuleConfig = new IndyVdrModuleConfig({
  networks: [
    {
      genesisTransactions,
      indyNamespace: 'pool:localtest',
      isProduction: false,
      transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
    },
  ],
})

export async function createDidOnLedger(agent: Agent, submitterDid: string) {
  const key = await agent.wallet.createKey({ keyType: KeyType.Ed25519 })

  const createResult = await agent.dids.create<IndyVdrDidCreateOptions>({
    method: 'indy',
    options: {
      submitterDid,
      alias: 'Alias',
      role: 'TRUSTEE',
      verkey: key.publicKeyBase58,
      useEndpointAttrib: true,
      services: [
        new DidDocumentService({
          id: `#endpoint`,
          serviceEndpoint: 'http://localhost:3000',
          type: 'endpoint',
        }),
        new DidCommV1Service({
          id: `#did-communication`,
          priority: 0,
          recipientKeys: [`#key-agreement-1`],
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'http://localhost:3000',
          accept: ['didcomm/aip2;env=rfc19'],
        }),
        new DidCommV2Service({
          accept: ['didcomm/v2'],
          id: `#didcomm-1`,
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'http://localhost:3000',
        }),
      ],
    },
  })

  if (!createResult.didState.did) {
    throw new Error(
      `Did was not created. ${createResult.didState.state === 'failed' ? createResult.didState.reason : 'Not finished'}`
    )
  }

  return { did: createResult.didState.did, key }
}
