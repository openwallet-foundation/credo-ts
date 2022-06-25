import type { IndyLedgerService } from '../../ledger'
import type { DidRepository } from '../repository'

import { getAgentConfig, getAgentContext, mockProperty } from '../../../../tests/helpers'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidDocument } from '../domain'
import { parseDid } from '../domain/parse'
import { KeyDidResolver } from '../methods/key/KeyDidResolver'
import { DidResolverService } from '../services/DidResolverService'

import didKeyEd25519Fixture from './__fixtures__/didKeyEd25519.json'

jest.mock('../methods/key/KeyDidResolver')

const agentConfig = getAgentConfig('DidResolverService')
const agentContext = getAgentContext()

describe('DidResolverService', () => {
  const indyLedgerServiceMock = jest.fn() as unknown as IndyLedgerService
  const didDocumentRepositoryMock = jest.fn() as unknown as DidRepository
  const didResolverService = new DidResolverService(
    indyLedgerServiceMock,
    didDocumentRepositoryMock,
    agentConfig.logger
  )

  it('should correctly find and call the correct resolver for a specified did', async () => {
    const didKeyResolveSpy = jest.spyOn(KeyDidResolver.prototype, 'resolve')
    mockProperty(KeyDidResolver.prototype, 'supportedMethods', ['key'])

    const returnValue = {
      didDocument: JsonTransformer.fromJSON(didKeyEd25519Fixture, DidDocument),
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    }
    didKeyResolveSpy.mockResolvedValue(returnValue)

    const result = await didResolverService.resolve(agentContext, 'did:key:xxxx', { someKey: 'string' })
    expect(result).toEqual(returnValue)

    expect(didKeyResolveSpy).toHaveBeenCalledTimes(1)
    expect(didKeyResolveSpy).toHaveBeenCalledWith(agentContext, 'did:key:xxxx', parseDid('did:key:xxxx'), {
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
      },
    })
  })
})
