import { Agent, SdJwtVcIssuer, TokenStatusListService } from '@credo-ts/core'
import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions } from '../src'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

const agent = new Agent(
  getAgentOptions('Cheqd Token Status List Registry', {}, {}, getCheqdModules(cheqdPayerSeeds[3]))
)

describe('Cheqd DID Token Status List Registry', () => {
  let did: string

  beforeAll(async () => {
    await agent.initialize()
    const didResult = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        createKey: { type: { kty: 'OKP', crv: 'Ed25519' } },
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
      },
    })

    if (!didResult.didState.did) {
      throw new Error('No DID created')
    }
    did = didResult.didState.did
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  it('should publish and retreive a token status list in local testnet', async () => {
    const tokenStatusListService = agent.dependencyManager.resolve(TokenStatusListService)
    const resolveResult = await agent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(resolveResult.didDocument).toBeDefined()

    const issuer: SdJwtVcIssuer = {
      method: 'did',
      didUrl: `${did}#key-1`,
    }

    const result = await tokenStatusListService.createStatusList(agent.context, issuer, {
      name: 'test-token-status-list',
      size: 10,
      publish: true,
    })
    expect(result.jwt).toBeDefined()
    expect(result.uri).toBeDefined()
    expect(result.uri).toContain(did)

    const uri = result.uri as string

    // fetch token status list
    const statusList = await tokenStatusListService.getStatusList(agent.context, uri)
    expect(statusList).toBeDefined()

    // verify token status at index 0
    const status = await tokenStatusListService.getStatus(agent.context, uri, 0)
    expect(status).toBe(0)

    // revoke index 0
    await tokenStatusListService.revokeIndex(agent.context, issuer, { indices: [0], publish: true, uri })

    // verify token status at index 0
    const isRevoked = await tokenStatusListService.getStatus(agent.context, uri, 0)
    expect(isRevoked).toBe(1)
  })
})
