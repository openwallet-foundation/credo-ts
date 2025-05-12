import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src/utils'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { TypedArrayEncoder } from '../../../../../utils'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { KeyManagementApi } from '../../../../kms'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { JwkDidRegistrar } from '../JwkDidRegistrar'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const didRepositoryMock = new DidRepositoryMock()
const jwkDidRegistrar = new JwkDidRegistrar()

const agentContext = getAgentContext({
  registerInstances: [[DidRepository, didRepositoryMock]],
  agentConfig: getAgentConfig('JwkDidRegistrar'),
})

const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

describe('DidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('JwkDidRegistrar', () => {
    it('should correctly create a did:jwk document using P256 key type', async () => {
      const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
      const { privateJwk } = transformPrivateKeyToPrivateJwk({
        type: {
          kty: 'EC',
          crv: 'P-256',
        },
        privateKey,
      })

      const { keyId } = await kms.importKey({
        privateJwk,
      })

      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        options: {
          keyId,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9',
          didDocument: {
            '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
            id: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9',
            verificationMethod: [
              {
                id: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
                type: 'JsonWebKey2020',
                controller:
                  'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9',
                publicKeyJwk: {
                  crv: 'P-256',
                  kty: 'EC',
                  x: 'teA3XWZPMu2aTmzPuiS5yTdyHTcrF5bIPn2NSXKH0-Q',
                  y: '_t2lM5tcF8Uvt6tBQYE5e8upxkelkDgt-XW4ixrAIJk',
                },
              },
            ],
            assertionMethod: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
            ],
            authentication: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
            ],
            capabilityInvocation: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
            ],
            capabilityDelegation: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
            ],
            keyAgreement: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9#0',
            ],
          },
        },
      })
    })

    it('should return an error state if no key or key type is provided', async () => {
      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        // @ts-ignore
        options: {},
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Missing keyId or createKey',
        },
      })
    })

    it('should store the did document', async () => {
      const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
      const { privateJwk } = transformPrivateKeyToPrivateJwk({
        type: {
          crv: 'P-256',
          kty: 'EC',
        },
        privateKey,
      })
      const did =
        'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InRlQTNYV1pQTXUyYVRtelB1aVM1eVRkeUhUY3JGNWJJUG4yTlNYS0gwLVEiLCJ5IjoiX3QybE01dGNGOFV2dDZ0QlFZRTVlOHVweGtlbGtEZ3QtWFc0aXhyQUlKayJ9'

      const key = await kms.importKey({
        privateJwk,
      })
      await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',

        options: { keyId: key.keyId },
      })

      expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
      const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

      expect(didRecord).toMatchObject({
        did,
        role: DidDocumentRole.Created,
        didDocument: undefined,
      })
    })

    it('should return an error state when calling update', async () => {
      const result = await jwkDidRegistrar.update()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'notSupported: cannot update did:jwk did',
        },
      })
    })

    it('should return an error state when calling deactivate', async () => {
      const result = await jwkDidRegistrar.deactivate()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'notSupported: cannot deactivate did:jwk did',
        },
      })
    })
  })
})
