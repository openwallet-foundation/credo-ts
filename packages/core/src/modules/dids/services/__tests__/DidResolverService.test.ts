import type { DidResolver } from '../../domain'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { CacheModuleConfig, InMemoryLruCache } from '../../../cache'
import { DidsModuleConfig } from '../../DidsModuleConfig'
import didKeyEd25519Fixture from '../../__tests__/__fixtures__/didKeyEd25519.json'
import { DidDocument } from '../../domain'
import { parseDid } from '../../domain/parse'
import { DidResolverService } from '../DidResolverService'

const didResolverMock = {
  allowsCaching: true,
  supportedMethods: ['key'],
  resolve: jest.fn(),
} as DidResolver

const cache = new InMemoryLruCache({ limit: 10 })
const agentConfig = getAgentConfig('DidResolverService')
const agentContext = getAgentContext({
  registerInstances: [[CacheModuleConfig, new CacheModuleConfig({ cache })]],
})

describe('DidResolverService', () => {
  const didResolverService = new DidResolverService(
    agentConfig.logger,
    new DidsModuleConfig({ resolvers: [didResolverMock] })
  )

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should correctly find and call the correct resolver for a specified did', async () => {
    const returnValue = {
      didDocument: JsonTransformer.fromJSON(didKeyEd25519Fixture, DidDocument),
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    }
    mockFunction(didResolverMock.resolve).mockResolvedValue(returnValue)

    const result = await didResolverService.resolve(agentContext, 'did:key:xxxx', { someKey: 'string' })
    expect(result).toEqual({
      ...returnValue,
      didResolutionMetadata: {
        ...returnValue.didResolutionMetadata,
        resolutionTime: expect.any(Number),
        servedFromCache: false,
      },
    })

    expect(didResolverMock.resolve).toHaveBeenCalledTimes(1)
    expect(didResolverMock.resolve).toHaveBeenCalledWith(agentContext, 'did:key:xxxx', parseDid('did:key:xxxx'), {
      someKey: 'string',
    })
  })

  it('should return cached did document when resolved multiple times within caching duration', async () => {
    const returnValue = {
      didDocument: JsonTransformer.fromJSON(didKeyEd25519Fixture, DidDocument),
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    }
    mockFunction(didResolverMock.resolve).mockResolvedValue(returnValue)

    const result = await didResolverService.resolve(agentContext, 'did:key:cached', { someKey: 'string' })
    const cachedValue = await cache.get(agentContext, 'did:resolver:did:key:cached')

    expect(result).toEqual({
      ...returnValue,
      didResolutionMetadata: {
        ...returnValue.didResolutionMetadata,
        resolutionTime: expect.any(Number),
        servedFromCache: false,
      },
    })

    expect(cachedValue).toEqual({
      ...returnValue,
      didDocument: returnValue.didDocument.toJSON(),
      didResolutionMetadata: {
        ...returnValue.didResolutionMetadata,
        resolutionTime: expect.any(Number),
        servedFromCache: false,
      },
    })

    expect(didResolverMock.resolve).toHaveBeenCalledTimes(1)
    expect(didResolverMock.resolve).toHaveBeenCalledWith(agentContext, 'did:key:cached', parseDid('did:key:cached'), {
      someKey: 'string',
    })

    const resultCached = await didResolverService.resolve(agentContext, 'did:key:cached', { someKey: 'string' })
    expect(resultCached).toEqual({
      ...returnValue,
      didResolutionMetadata: {
        ...returnValue.didResolutionMetadata,
        resolutionTime: expect.any(Number),
        servedFromCache: true,
      },
    })

    // Still called once because served from cache
    expect(didResolverMock.resolve).toHaveBeenCalledTimes(1)
  })

  it("should return an error with 'invalidDid' if the did string couldn't be parsed", async () => {
    const did = 'did:__Asd:asdfa'

    const result = await didResolverService.resolve(agentContext, did)

    expect(result).toEqual({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'invalidDid',
      },
    })
  })

  it("should return an error with 'unsupportedDidMethod' if the did has no resolver", async () => {
    const did = 'did:example:asdfa'

    const result = await didResolverService.resolve(agentContext, did)

    expect(result).toEqual({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'unsupportedDidMethod',
        message: 'No did resolver registered for did method example',
      },
    })
  })
})
