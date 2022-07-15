import type { Wallet } from '../../../../../wallet'

import { getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { DidCommV1Service, DidDocumentBuilder } from '../../../domain'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { getEd25519VerificationMethod } from '../../../domain/key-type/ed25519'
import { DidRepository } from '../../../repository/DidRepository'
import { PeerDidRegistrar } from '../PeerDidRegistrar'
import { PeerDidNumAlgo } from '../didPeer'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const WalletMock = jest.fn(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createKey: (_) => Promise.resolve(Key.fromFingerprint('z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU')),
})) as jest.Mock<Wallet>

const walletMock = new WalletMock()
const agentContext = getAgentContext({ wallet: walletMock })

describe('DidRegistrar', () => {
  describe('PeerDidRegistrar', () => {
    let peerDidRegistrar: PeerDidRegistrar
    let didRepositoryMock: DidRepository

    beforeEach(() => {
      didRepositoryMock = new DidRepositoryMock()
      peerDidRegistrar = new PeerDidRegistrar(didRepositoryMock)
    })

    describe('did:peer:0', () => {
      it('should correctly create a did:peer:0 document using Ed25519 keytype', async () => {
        const seed = '96213c3d7fc8d4d6754c712fd969598e'

        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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
            did: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
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
                  id: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                  type: 'Ed25519VerificationKey2018',
                  controller: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                  publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
                },
              ],
              service: undefined,
              authentication: [
                'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
              ],
              assertionMethod: [
                'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
              ],
              keyAgreement: [
                {
                  id: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz',
                  type: 'X25519KeyAgreementKey2019',
                  controller: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
                  publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
                },
              ],
              capabilityInvocation: [
                'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
              ],
              capabilityDelegation: [
                'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU#z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
              ],
              id: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            },
            secret: {
              seed: '96213c3d7fc8d4d6754c712fd969598e',
            },
          },
        })
      })

      it('should return an error state if no key type is provided', async () => {
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          // @ts-expect-error - key type is required in interface
          options: {
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
          },
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
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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

      it('should store the did without the did document', async () => {
        const seed = '96213c3d7fc8d4d6754c712fd969598e'
        const did = 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU'

        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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
          _tags: {
            recipientKeys: [],
          },
          didDocument: undefined,
        })
      })
    })

    describe('did:peer:1', () => {
      const verificationMethod = getEd25519VerificationMethod({
        key: Key.fromFingerprint('z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz'),
        // controller in method 1 did should be #id
        controller: '#id',
        id: '#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16',
      })

      const didDocument = new DidDocumentBuilder('')
        .addVerificationMethod(verificationMethod)
        .addAuthentication(verificationMethod.id)
        .addService(
          new DidCommV1Service({
            id: '#service-0',
            recipientKeys: [verificationMethod.id],
            serviceEndpoint: 'https://example.com',
            accept: ['didcomm/aip2;env=rfc19'],
          })
        )
        .build()

      it('should correctly create a did:peer:1 document from a did document', async () => {
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument: didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.GenesisDoc,
          },
        })

        expect(JsonTransformer.toJSON(result)).toMatchObject({
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'finished',
            did: 'did:peer:1zQmUTNcSy2J2sAmX6Ad2bdPvhVnHPUaod8Skpt8DWPpZaiL',
            didDocument: {
              '@context': ['https://w3id.org/did/v1'],
              alsoKnownAs: undefined,
              controller: undefined,
              verificationMethod: [
                {
                  id: '#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16',
                  type: 'Ed25519VerificationKey2018',
                  controller: '#id',
                  publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
                },
              ],
              service: [
                {
                  id: '#service-0',
                  serviceEndpoint: 'https://example.com',
                  type: 'did-communication',
                  priority: 0,
                  recipientKeys: ['#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16'],
                  accept: ['didcomm/aip2;env=rfc19'],
                },
              ],
              authentication: ['#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16'],
              assertionMethod: undefined,
              keyAgreement: undefined,
              capabilityInvocation: undefined,
              capabilityDelegation: undefined,
              id: 'did:peer:1zQmUTNcSy2J2sAmX6Ad2bdPvhVnHPUaod8Skpt8DWPpZaiL',
            },
          },
        })
      })

      it('should store the did with the did document', async () => {
        const did = 'did:peer:1zQmUTNcSy2J2sAmX6Ad2bdPvhVnHPUaod8Skpt8DWPpZaiL'

        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.GenesisDoc,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          id: did,
          // FIXME: this should actually be the stored variant, not the variant with the id defined
          didDocument: { ...didDocument.toJSON(), id: did },
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeys: didDocument.recipientKeys,
          },
        })
      })
    })

    describe('did:peer:2', () => {
      const key = Key.fromFingerprint('z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz')
      const verificationMethod = getEd25519VerificationMethod({
        key,
        // controller in method 1 did should be #id
        controller: '#id',
        // Placeholder, will be defined when generating the did document from the did
        id: '',
      })

      const didDocument = new DidDocumentBuilder('')
        .addVerificationMethod(verificationMethod)
        .addAuthentication(verificationMethod.id)
        .addService(
          new DidCommV1Service({
            id: '#service-0',
            recipientKeys: [verificationMethod.id],
            serviceEndpoint: 'https://example.com',
            accept: ['didcomm/aip2;env=rfc19'],
          })
        )
        .build()

      it('should correctly create a did:peer:2 document from a did document', async () => {
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument: didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
          },
        })

        expect(JsonTransformer.toJSON(result)).toMatchObject({
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'finished',
            did: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0',
            didDocument: {
              '@context': ['https://w3id.org/did/v1'],
              id: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0',
              service: [
                {
                  serviceEndpoint: 'https://example.com',
                  type: 'did-communication',
                  priority: 0,
                  recipientKeys: [''],
                  accept: ['didcomm/aip2;env=rfc19'],
                  id: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0#did-communication-0',
                },
              ],
              authentication: [
                {
                  id: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0#6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc',
                  type: 'Ed25519VerificationKey2018',
                  controller:
                    'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0',
                  publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
                },
              ],
            },
            secret: {},
          },
        })
      })

      it('should store the did without the did document', async () => {
        const seed = '96213c3d7fc8d4d6754c712fd969598e'
        const did =
          'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0'

        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          id: did,
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeys: didDocument.recipientKeys,
          },
          didDocument: undefined,
        })
      })
    })

    it('should return an error state if an unsupported numAlgo is provided', async () => {
      // @ts-expect-error - this is not a valid numAlgo
      const result = await peerDidRegistrar.create({
        method: 'peer',
        options: {
          numAlgo: 4,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Missing or incorrect numAlgo provided',
        },
      })
    })
    it('should return an error state when calling update', async () => {
      const result = await peerDidRegistrar.update()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notSupported: cannot update did:peer did`,
        },
      })
    })

    it('should return an error state when calling deactivate', async () => {
      const result = await peerDidRegistrar.deactivate()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notSupported: cannot deactivate did:peer did`,
        },
      })
    })
  })
})
