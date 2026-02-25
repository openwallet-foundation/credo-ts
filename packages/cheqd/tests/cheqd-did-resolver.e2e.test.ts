import { Agent, JsonTransformer, utils } from '@credo-ts/core'
import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions } from '../src'
import { CheqdDidRegistrar } from '../src'
import { getClosestResourceVersion } from '../src/dids/didCheqdUtil'

import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

export const resolverAgent = new Agent(getAgentOptions('Cheqd resolver', {}, {}, getCheqdModules(cheqdPayerSeeds[1])))

describe('Cheqd DID resolver', () => {
  let did: string
  let resourceResult1: Awaited<ReturnType<CheqdDidRegistrar['createResource']>>
  let resourceResult2: Awaited<ReturnType<CheqdDidRegistrar['createResource']>>
  let resourceResult3: Awaited<ReturnType<CheqdDidRegistrar['createResource']>>

  beforeAll(async () => {
    await resolverAgent.initialize()
    const cheqdDidRegistrar = resolverAgent.dependencyManager.resolve(CheqdDidRegistrar)

    const didResult = await resolverAgent.dids.create<CheqdDidCreateOptions>({
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

    resourceResult1 = await cheqdDidRegistrar.createResource(resolverAgent.context, did, {
      id: utils.uuid(),
      name: 'LocalResource',
      resourceType: 'test',
      data: { hello: 'world' },
      version: '1',
    })
    resourceResult2 = await cheqdDidRegistrar.createResource(resolverAgent.context, did, {
      id: utils.uuid(),
      name: 'LocalResource1',
      resourceType: 'test',
      data: { hello: 'world' },
      version: '1',
    })

    resourceResult3 = await cheqdDidRegistrar.createResource(resolverAgent.context, did, {
      id: utils.uuid(),
      name: 'LocalResource2',
      resourceType: 'test',
      data: { hello: 'world' },
      version: '1',
    })

    for (const resource of [resourceResult1, resourceResult2, resourceResult3]) {
      if (resource.resourceState.state !== 'finished') {
        throw new Error(`Resource creation failed: ${resource.resourceState.reason}`)
      }
    }
  })

  afterAll(async () => {
    await resolverAgent.shutdown()
  })

  it('should resolve a did:cheqd did from local testnet', async () => {
    const resolveResult = await resolverAgent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })
    expect(JsonTransformer.toJSON(resolveResult)).toMatchObject({
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
        id: did,
        controller: [did],
        verificationMethod: [
          {
            controller: did,
            id: `${did}#key-1`,
            publicKeyJwk: {
              kty: 'OKP',
              crv: 'Ed25519',
              x: expect.any(String),
            },
            type: 'JsonWebKey2020',
          },
        ],
        authentication: [`${did}#key-1`],
      },
      didDocumentMetadata: {
        created: expect.any(String),
        updated: undefined,
        deactivated: false,
        versionId: expect.any(String),
        nextVersionId: '',
      },
      didResolutionMetadata: {},
    })
  })

  it('should getClosestResourceVersion', async () => {
    const didResult = await resolverAgent.dids.resolve(did, {
      useLocalCreatedDidRecord: false,
    })

    const inFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10) // 10 years in future

    // should get the latest resource
    let resource = getClosestResourceVersion(didResult.didDocumentMetadata.linkedResourceMetadata, inFuture)
    expect(resource).toMatchObject({
      id: resourceResult3.resourceState.resourceId,
    })

    // Date in past should return undefined
    resource = getClosestResourceVersion(
      didResult.didDocumentMetadata.linkedResourceMetadata,
      new Date('2022-11-16T10:56:34Z')
    )
    expect(resource).toBeUndefined()
  })
})
