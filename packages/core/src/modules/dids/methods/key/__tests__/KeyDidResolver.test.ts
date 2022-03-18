import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import didKeyEd25519Fixture from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import { DidKey } from '../DidKey'
import { KeyDidResolver } from '../KeyDidResolver'

describe('DidResolver', () => {
  describe('KeyDidResolver', () => {
    let keyDidResolver: KeyDidResolver

    beforeEach(() => {
      keyDidResolver = new KeyDidResolver()
    })

    it('should correctly resolve a did:key document', async () => {
      const fromDidSpy = jest.spyOn(DidKey, 'fromDid')
      const result = await keyDidResolver.resolve('did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didKeyEd25519Fixture,
        didDocumentMetadata: {},
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      })
      expect(result.didDocument)
      expect(fromDidSpy).toHaveBeenCalledTimes(1)
      expect(fromDidSpy).toHaveBeenCalledWith('did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')
    })

    it('should return did resolution metadata with error if the did contains an unsupported multibase', async () => {
      const result = await keyDidResolver.resolve('did:key:asdfkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')

      expect(result).toEqual({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:key:asdfkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th': Error: No decoder found for multibase prefix 'a'`,
        },
      })
    })

    it('should return did resolution metadata with error if the did contains an unsupported multibase', async () => {
      const result = await keyDidResolver.resolve('did:key:z6MkmjYasdfasfd8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')

      expect(result).toEqual({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:key:z6MkmjYasdfasfd8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th': Error: Unsupported key type from multicodec code '107'`,
        },
      })
    })
  })
})
