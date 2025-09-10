import { Agent, ConsoleLogger, JsonTransformer, LogLevel } from '@credo-ts/core'
import { HederaDidCreateOptions } from '../../src/ledger/HederaLedgerService'
import { getHederaAgent } from './utils'

describe('Hedera DID resolver', () => {
  const logger = new ConsoleLogger(LogLevel.error)

  let agent: Agent
  let did: string

  beforeAll(async () => {
    agent = getHederaAgent({
      logger,
      label: 'alice',
    })
    await agent.initialize()

    const didResult = await agent.dids.create<HederaDidCreateOptions>({
      method: 'hedera',
    })
    if (!didResult.didState.did) {
      throw new Error('No DID created')
    }
    did = didResult.didState.did
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  it('should resolve a did:hedera did from testnet', async () => {
    const resolveResult = await agent.dids.resolve(did)

    expect(JsonTransformer.toJSON(resolveResult)).toMatchObject({
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        controller: did,
        verificationMethod: [
          {
            controller: did,
            id: `${did}#did-root-key`,
            type: 'Ed25519VerificationKey2020',
            publicKeyMultibase: expect.any(String),
          },
        ],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    })
  })
})
