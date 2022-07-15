import type { Wallet } from '../../../../../wallet'

import { getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { KeyDidRegistrar } from '../KeyDidRegistrar'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const WalletMock = jest.fn(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createKey: (_) => Promise.resolve(Key.fromFingerprint('z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU')),
})) as jest.Mock<Wallet>

const walletMock = new WalletMock()
const agentContext = getAgentContext({
  wallet: walletMock,
})

describe('DidRegistrar', () => {
  describe('KeyDidRegistrar', () => {
    let keyDidRegistrar: KeyDidRegistrar
    let didRepositoryMock: DidRepository

    beforeEach(() => {
      didRepositoryMock = new DidRepositoryMock()
      keyDidRegistrar = new KeyDidRegistrar(didRepositoryMock)
    })

    it('should correctly create a did:key document using Ed25519 keytype', async () => {
      const seed = '96213c3d7fc8d4d6754c712fd969598e'

      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          seed,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
          didDocument: {
            '@context': [
              'https://w3id.org/did/v1',
              'https://w3id.org/security/suites/ed25519-2018/v1',
              'https://w3id.org/security/suites/x25519-2019/v1',
            ],
            alsoKnownAs: undefined,
            controller: undefined,
            verificationMethod: [
              {
                id: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
              },
            ],
            service: undefined,
            authentication: [
              'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            ],
            assertionMethod: [
              'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            ],
            keyAgreement: [
              {
                id: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz',
                type: 'X25519KeyAgreementKey2019',
                controller: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
              },
            ],
            capabilityInvocation: [
              'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            ],
            capabilityDelegation: [
              'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            ],
            id: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
          },
          secret: {
            seed: '96213c3d7fc8d4d6754c712fd969598e',
          },
        },
      })
    })

    it('should return an error state if no key type is provided', async () => {
      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        // @ts-expect-error - key type is required in interface
        options: {},
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Missing key type',
        },
      })
    })

    it('should return an error state if an invalid seed is provided', async () => {
      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',

        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          seed: 'invalid',
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Invalid seed provided',
        },
      })
    })

    it('should store the did document', async () => {
      const seed = '96213c3d7fc8d4d6754c712fd969598e'
      const did = 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU'

      await keyDidRegistrar.create(agentContext, {
        method: 'key',

        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          seed,
        },
      })

      expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
      const [didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

      expect(didRecord).toMatchObject({
        id: did,
        role: DidDocumentRole.Created,
        didDocument: undefined,
      })
    })

    it('should return an error state when calling update', async () => {
      const result = await keyDidRegistrar.update()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notSupported: cannot update did:key did`,
        },
      })
    })

    it('should return an error state when calling deactivate', async () => {
      const result = await keyDidRegistrar.deactivate()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notSupported: cannot deactivate did:key did`,
        },
      })
    })
  })
})
