import { Agent, JsonTransformer, utils } from '@credo-ts/core'
import { getAgentOptions } from '../../core/tests/helpers'
import type { CheqdDidCreateOptions } from '../src'
import { CheqdDidRegistrar, CheqdDidResolver } from '../src'
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

  describe('resolving a resource by name and type', () => {
    const resolve = (query: string) =>
      new CheqdDidResolver().resolveResource(resolverAgent.context, `${did}?${query}`) as Promise<{
        resource?: { n: number }
        resourceMetadata?: { version: string; created: Date }
        error?: string
      }>

    const create = async (name: string, version: string, n: number) => {
      const registrar = resolverAgent.dependencyManager.resolve(CheqdDidRegistrar)
      const result = await registrar.createResource(resolverAgent.context, did, {
        id: utils.uuid(),
        name,
        resourceType: 'versioned',
        data: { n },
        version,
      })
      if (result.resourceState.state !== 'finished') {
        throw new Error(`Resource creation failed: ${result.resourceState.reason}`)
      }
    }

    beforeAll(async () => {
      await create('Versioned Name', 'v1', 1)
      await create('Versioned Name', 'v2', 2)
      // a name that contains a literal percent sequence, as names written before query parameters were decoded could
      await create('Literal%20Percent', 'v1', 3)
    })

    it('resolves the latest version', async () => {
      const result = await resolve('resourceName=Versioned%20Name&resourceType=versioned')
      expect(result.resource).toEqual({ n: 2 })
      expect(result.resourceMetadata?.version).toBe('v2')
    })

    it('resolves a specific version', async () => {
      const result = await resolve('resourceName=Versioned%20Name&resourceType=versioned&version=v1')
      expect(result.resource).toEqual({ n: 1 })
    })

    it('resolves the version that was current at a given time', async () => {
      const first = await resolve('resourceName=Versioned%20Name&resourceType=versioned&version=v1')
      if (!first.resourceMetadata) throw new Error('Expected resource metadata')
      const createdAt = Math.floor(first.resourceMetadata.created.getTime() / 1000)

      // at the time the first version was created, the first version is the latest
      const result = await resolve(
        `resourceName=Versioned%20Name&resourceType=versioned&resourceVersionTime=${createdAt}`
      )
      expect(result.resource).toEqual({ n: 1 })
    })

    it('returns notFound for a time before the first version', async () => {
      const first = await resolve('resourceName=Versioned%20Name&resourceType=versioned&version=v1')
      if (!first.resourceMetadata) throw new Error('Expected resource metadata')
      const beforeFirst = Math.floor(first.resourceMetadata.created.getTime() / 1000) - 3600

      // nothing was current yet: the resolver must not fall back to the nearest later version
      const result = await resolve(
        `resourceName=Versioned%20Name&resourceType=versioned&resourceVersionTime=${beforeFirst}`
      )
      expect(result.error).toBe('notFound')
      expect(result.resource).toBeUndefined()
    })

    it('resolves a name that was written with a literal percent sequence', async () => {
      // decoded it is 'Literal Percent', which does not exist, so the literal name is used
      const literal = await resolve('resourceName=Literal%20Percent&resourceType=versioned')
      expect(literal.resource).toEqual({ n: 3 })

      // percent-encoding the percent sign addresses the same name
      const encoded = await resolve('resourceName=Literal%2520Percent&resourceType=versioned')
      expect(encoded.resource).toEqual({ n: 3 })
    })

    it('returns notFound for a name and type that do not exist', async () => {
      const result = await resolve('resourceName=Missing&resourceType=versioned')
      expect(result.error).toBe('notFound')
    })
  })
})
