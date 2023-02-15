import type { IndyVdrPoolService } from '../src/pool/IndyVdrPoolService'
import type { AgentContext, Key } from '@aries-framework/core'

import { KeyType } from '@aries-framework/core'
import { AttribRequest, NymRequest } from '@hyperledger/indy-vdr-shared'

import { genesisTransactions } from '../../core/tests/helpers'
import { IndyVdrModuleConfig } from '../src/IndyVdrModuleConfig'
import { indyDidFromPublicKeyBase58 } from '../src/utils/did'

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

export async function createDidOnLedger(
  indyVdrPoolService: IndyVdrPoolService,
  agentContext: AgentContext,
  submitterDid: string,
  signerKey: Key
) {
  const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

  const key = await agentContext.wallet.createKey({ keyType: KeyType.Ed25519 })
  const did = indyDidFromPublicKeyBase58(key.publicKeyBase58)

  const nymRequest = new NymRequest({
    dest: did,
    submitterDid,
    verkey: key.publicKeyBase58,
  })

  await pool.submitWriteRequest(agentContext, nymRequest, signerKey)

  const attribRequest = new AttribRequest({
    submitterDid: did,
    targetDid: did,
    raw: JSON.stringify({
      endpoint: {
        endpoint: 'https://agent.com',
        types: ['endpoint', 'did-communication', 'DIDComm'],
        routingKeys: ['routingKey1', 'routingKey2'],
      },
    }),
  })

  await pool.submitWriteRequest(agentContext, attribRequest, key)

  return { did, key }
}
