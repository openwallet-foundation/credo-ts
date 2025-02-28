import type { Wallet } from '../../../../../wallet'

import { getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { KeyType } from '../../../../../crypto'
import { getJwkFromJson } from '../../../../../crypto/jose/jwk'
import { TypedArrayEncoder } from '../../../../../utils'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { WalletError } from '../../../../../wallet/error'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { JwkDidRegistrar } from '../JwkDidRegistrar'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const jwk = getJwkFromJson({
  crv: 'P-256',
  kty: 'EC',
  x: 'acbIQiuMs3i8_uszEjJ2tpTtRM4EU3yz91PH6CdH2V0',
  y: '_KcyLj9vWMptnmKtm46GqDz8wf74I5LKgrl2GzH3nSE',
})
const walletMock = {
  createKey: jest.fn(() => jwk.key),
} as unknown as Wallet

const didRepositoryMock = new DidRepositoryMock()
const jwkDidRegistrar = new JwkDidRegistrar()

const agentContext = getAgentContext({
  wallet: walletMock,
  registerInstances: [[DidRepository, didRepositoryMock]],
})

describe('DidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('JwkDidRegistrar', () => {
    it('should correctly create a did:jwk document using P256 key type', async () => {
      const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        options: {
          keyType: KeyType.P256,
        },
        secret: {
          privateKey,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9',
          didDocument: {
            '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
            id: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9',
            verificationMethod: [
              {
                id: 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
                type: 'JsonWebKey2020',
                controller:
                  'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9',
                publicKeyJwk: {
                  crv: 'P-256',
                  kty: 'EC',
                  x: 'acbIQiuMs3i8_uszEjJ2tpTtRM4EU3yz91PH6CdH2V0',
                  y: '_KcyLj9vWMptnmKtm46GqDz8wf74I5LKgrl2GzH3nSE',
                },
              },
            ],
            assertionMethod: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
            ],
            authentication: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
            ],
            capabilityInvocation: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
            ],
            capabilityDelegation: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
            ],
            keyAgreement: [
              'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9#0',
            ],
          },
          secret: {
            privateKey,
          },
        },
      })

      expect(walletMock.createKey).toHaveBeenCalledWith({ keyType: KeyType.P256, privateKey })
    })

    it('should return an error state if a key instance and key type are both provided', async () => {
      const key = await agentContext.wallet.createKey({
        keyType: KeyType.P256,
      })

      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        options: {
          key,
          keyType: KeyType.P256,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Key instance cannot be combined with key type, seed or private key',
        },
      })
    })

    it('should return an error state if no key or key type is provided', async () => {
      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        options: {},
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Missing key type or key instance',
        },
      })
    })

    it('should return an error state if a key creation error is thrown', async () => {
      mockFunction(walletMock.createKey).mockRejectedValueOnce(new WalletError('Invalid private key provided'))
      const result = await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',
        options: {
          keyType: KeyType.P256,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('invalid'),
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: expect.stringContaining('Invalid private key provided'),
        },
      })
    })

    it('should store the did document', async () => {
      const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
      const did =
        'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6ImFjYklRaXVNczNpOF91c3pFakoydHBUdFJNNEVVM3l6OTFQSDZDZEgyVjAiLCJ5IjoiX0tjeUxqOXZXTXB0bm1LdG00NkdxRHo4d2Y3NEk1TEtncmwyR3pIM25TRSJ9'

      await jwkDidRegistrar.create(agentContext, {
        method: 'jwk',

        options: {
          keyType: KeyType.P256,
        },
        secret: {
          privateKey,
        },
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
