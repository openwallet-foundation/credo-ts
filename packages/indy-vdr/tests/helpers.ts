import { parseIndyDid } from '@credo-ts/anoncreds'
import type { Agent } from '@credo-ts/core'
import { DidCommV1Service, DidDocumentService, NewDidCommV2Service, NewDidCommV2ServiceEndpoint } from '@credo-ts/core'
import type { IndyVdrPool, IndyVdrRequest } from '@hyperledger/indy-vdr-nodejs'
import { GetAttribRequest, indyVdr, PoolCreate } from '@hyperledger/indy-vdr-nodejs'
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

  const { namespaceIdentifier } = parseIndyDid(createResult.didState.did)
  await waitForAllLedgerNodes(() => new GetAttribRequest({ targetDid: namespaceIdentifier, raw: 'endpoint' }))

  return { did: createResult.didState.did, key }
}

let allNodesPool: IndyVdrPool | undefined

// seqNo is only set when the node has the object (a missing schema still returns data).
// Replies of nodes that failed or timed out are not always JSON.
function nodeHasObject(reply: string | undefined) {
  try {
    return reply !== undefined && Boolean(JSON.parse(reply).result?.seqNo)
  } catch {
    return false
  }
}

/**
 * A write is confirmed once a quorum of nodes applied it, but a read is served by a single node that can still
 * be behind. Waits until every node returns the object, so any read that follows finds it.
 */
export async function waitForAllLedgerNodes(createRequest: () => IndyVdrRequest, timeoutMs = 20000) {
  allNodesPool ??= new PoolCreate({ parameters: { transactions: genesisTransactions } })
  const { nodes } = await allNodesPool.status
  const deadline = Date.now() + timeoutMs

  while (true) {
    const replies = (await allNodesPool.submitAction(createRequest(), { nodes })) as Record<string, string>
    if (nodes.every((node) => nodeHasObject(replies[node]))) return

    if (Date.now() > deadline) throw new Error(`Not all ledger nodes have the object after ${timeoutMs}ms`)
    await sleep(200)
  }
}
