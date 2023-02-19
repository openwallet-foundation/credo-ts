import type { DidResolver } from '../../domain'

import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../tests/helpers'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { DidsModuleConfig } from '../../DidsModuleConfig'
import didKeyEd25519Fixture from '../../__tests__/__fixtures__/didKeyEd25519.json'
import { DidDocument } from '../../domain'
import { parseDid } from '../../domain/parse'
import { DidResolverService } from '../DidResolverService'

const didResolverMock = {
  supportedMethods: ['key'],
  resolve: jest.fn(),
} as DidResolver

const agentConfig = getAgentConfig('DidResolverService')
const agentContext = getAgentContext()

describe('DidResolverService', () => {
  const didResolverService = new DidResolverService(
    agentConfig.logger,
    new DidsModuleConfig({ resolvers: [didResolverMock] })
  )

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
    expect(result).toEqual(returnValue)

    expect(didResolverMock.resolve).toHaveBeenCalledTimes(1)
    expect(didResolverMock.resolve).toHaveBeenCalledWith(agentContext, 'did:key:xxxx', parseDid('did:key:xxxx'), {
      someKey: 'string',
    })
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
