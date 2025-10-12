import type { Agent } from '@credo-ts/core'
import { DidCommV1Service, DidDocumentService, NewDidCommV2Service, NewDidCommV2ServiceEndpoint } from '@credo-ts/core'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { sleep } from '../../core/src/utils/sleep'
import { genesisTransactions } from '../../core/tests/helpers'
import type { IndyVdrDidCreateOptions } from '../src/dids/IndyVdrIndyDidRegistrar'
import { IndyVdrModuleConfig } from '../src/IndyVdrModuleConfig'

export const indyVdrModuleConfig = new IndyVdrModuleConfig({
  indyVdr,
  networks: [
    {
      genesisTransactions,
      indyNamespace: 'pool:localtest',
      isProduction: false,
      transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
    },
  ],
})

export async function createDidOnLedger(agent: Agent, endorserDid: string) {
  const key = await agent.kms.createKey({
    type: {
      kty: 'OKP',
      crv: 'Ed25519',
    },
  })

  const createResult = await agent.dids.create<IndyVdrDidCreateOptions>({
    method: 'indy',
    options: {
      endorserMode: 'internal',
      endorserDid: endorserDid,
      alias: 'Alias',
      role: 'TRUSTEE',
      keyId: key.keyId,
      useEndpointAttrib: true,
      services: [
        new DidDocumentService({
          id: '#endpoint',
          serviceEndpoint: 'http://localhost:3000',
          type: 'endpoint',
        }),
        new DidCommV1Service({
          id: '#did-communication',
          priority: 0,
          recipientKeys: ['#key-agreement-1'],
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'http://localhost:3000',
          accept: ['didcomm/aip2;env=rfc19'],
        }),
        new NewDidCommV2Service({
          id: '#didcomm--messaging-1',
          serviceEndpoint: new NewDidCommV2ServiceEndpoint({
            accept: ['didcomm/v2'],
            routingKeys: ['a-routing-key'],
            uri: 'http://localhost:3000',
          }),
        }),
      ],
    },
  })

  if (!createResult.didState.did) {
    throw new Error(
      `Did was not created. ${createResult.didState.state === 'failed' ? createResult.didState.reason : 'Not finished'}`
    )
  }

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  return { did: createResult.didState.did, key }
}
