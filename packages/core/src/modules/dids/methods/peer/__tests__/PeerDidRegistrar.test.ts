import type { Wallet } from '../../../../../wallet'

import { getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { TypedArrayEncoder } from '../../../../../utils'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { WalletError } from '../../../../../wallet/error'
import { DidCommV1Service, DidDocumentBuilder, getEd25519VerificationKey2018 } from '../../../domain'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { PeerDidRegistrar } from '../PeerDidRegistrar'
import { PeerDidNumAlgo } from '../didPeer'

import didPeer0z6MksLeFixture from './__fixtures__/didPeer0z6MksLe.json'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const walletMock = {
  createKey: jest.fn(() => Key.fromFingerprint('z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU')),
} as unknown as Wallet
const didRepositoryMock = new DidRepositoryMock()

const agentContext = getAgentContext({ wallet: walletMock, registerInstances: [[DidRepository, didRepositoryMock]] })
const peerDidRegistrar = new PeerDidRegistrar()

describe('DidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('PeerDidRegistrar', () => {
    describe('did:peer:0', () => {
      it('should correctly create a did:peer:0 document using Ed25519 key type', async () => {
        const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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
            did: 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
            didDocument: didPeer0z6MksLeFixture,
            secret: {
              privateKey,
            },
          },
        })
      })

      it('should return an error state if a key instance and key type are both provided', async () => {
        const key = await agentContext.wallet.createKey({
          keyType: KeyType.P256,
        })

        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
          },
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

        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
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

      it('should store the did without the did document', async () => {
        const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
        const did = 'did:peer:0z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU'

        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          options: {
            keyType: KeyType.Ed25519,
            numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
          },
          secret: {
            privateKey,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          did: did,
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeyFingerprints: [],
          },
          didDocument: undefined,
        })
      })
    })

    describe('did:peer:1', () => {
      const verificationMethod = getEd25519VerificationKey2018({
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
            did: 'did:peer:1zQmbvrBNuBynkbtTDT61wg346fFAZFbpLGshKihF2YkMsK3',
            didDocument: {
              '@context': ['https://www.w3.org/ns/did/v1'],
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
              id: 'did:peer:1zQmbvrBNuBynkbtTDT61wg346fFAZFbpLGshKihF2YkMsK3',
            },
          },
        })
      })

      it('should store the did with the did document', async () => {
        const did = 'did:peer:1zQmbvrBNuBynkbtTDT61wg346fFAZFbpLGshKihF2YkMsK3'

        const { didState } = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.GenesisDoc,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          did: did,
          didDocument: didState.didDocument,
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
          },
        })
      })
    })

    describe('did:peer:2', () => {
      const key = Key.fromFingerprint('z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz')
      const verificationMethod = getEd25519VerificationKey2018({
        key,
        // controller in method 1 did should be #id
        controller: '#id',
        // Use relative id for peer dids with pattern 'key-N'
        id: '#key-1',
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
            did: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiNrZXktMSJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0',
            didDocument: {
              '@context': ['https://www.w3.org/ns/did/v1'],
              id: 'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiNrZXktMSJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0',
              service: [
                {
                  serviceEndpoint: 'https://example.com',
                  type: 'did-communication',
                  priority: 0,
                  recipientKeys: ['#key-1'],
                  accept: ['didcomm/aip2;env=rfc19'],
                  id: '#service-0',
                },
              ],
              verificationMethod: [
                {
                  id: '#key-1',
                  type: 'Ed25519VerificationKey2018',
                  controller: '#id',
                  publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
                },
              ],
              authentication: ['#key-1'],
            },
            secret: {},
          },
        })
      })

      it('should store the did without the did document', async () => {
        const did =
          'did:peer:2.Vz6MkkjPVCX7M8D6jJSCQNzYb4T6giuSN8Fm463gWNZ65DMSc.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiIsInByaW9yaXR5IjowLCJyZWNpcGllbnRLZXlzIjpbIiNrZXktMSJdLCJhIjpbImRpZGNvbW0vYWlwMjtlbnY9cmZjMTkiXX0'

        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          did: did,
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
          },
          didDocument: undefined,
        })
      })
    })

    describe('did:peer:4', () => {
      const key = Key.fromFingerprint('z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz')
      const verificationMethod = getEd25519VerificationKey2018({
        key,
        controller: '#id',
        // Use relative id for peer dids
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

      it('should correctly create a did:peer:4 document from a did document', async () => {
        const result = await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument: didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.ShortFormAndLongForm,
          },
        })

        const longFormDid =
          'did:peer:4zQmZJVsg5xdo5gVX3HCEvwp29MxrCMvnBnPM2TTYqXjLseo:z72PjTR6nroWmhFJuXs5WUQ8NxVGvXQSLQKxsztQRxqcbNMndPt2GXVKX3fjbRX9h9qfjZWUBvvnmceMz1hyvdfdBnADMJQNeCcdivUypvyiFWkgq8DCTkjcQkjZqc7dubX5E8cd2npbrXbfmkw9sRPGi7vFxfdLCKiskUW2mpksEXwXvxZ8VFd56ZPqfStaajERmqiSU9vSxWfXC8SrwbcaHWm9KAWE5yYHKvUCtNqDB7VxNw5ApwkqpLajn58UANRHgCz2yf5bTvfRCWuUtdFe3n8aroc6chpMtS6j3RwxsL12kSjnWm24vEdsqq3KbGVanLeEFQ1HjKBFxwRsJrxGfT7wVPUbKu7hWemuf6cz2tZ5kPhAHVxWjahHNTATZXKzM8oDEn3PYC34pjkgZP6BeLeeAyK1hzcjCghaN6bdpTbYhSUqWKi6oaccX11gS6JLAt1ryUzG3sCeurVTUVrf1GntJpGkiPWRQhU66MpT4K7L7kZgrmcF8eL95pSbtZqhkQCyrsurKaVmNfwrCfNRr9JzxnXprbmjs4tikDVfSBk4TkDKcXck1YkZ6CjA8S1yHWKo7pGGfw3425SGAfXXLrYA29tAaQyxDKGjsFWorwKMUGdRA8psZgnFptcrwi1moAdn7cTExBFPr9PSk'
        const shortFormDid = 'did:peer:4zQmZJVsg5xdo5gVX3HCEvwp29MxrCMvnBnPM2TTYqXjLseo'
        expect(JsonTransformer.toJSON(result)).toMatchObject({
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'finished',
            did: longFormDid,
            didDocument: {
              '@context': ['https://www.w3.org/ns/did/v1'],
              id: longFormDid,
              alsoKnownAs: [shortFormDid],
              service: [
                {
                  serviceEndpoint: 'https://example.com',
                  type: 'did-communication',
                  priority: 0,
                  recipientKeys: ['#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16'],
                  accept: ['didcomm/aip2;env=rfc19'],
                  id: '#service-0',
                },
              ],
              verificationMethod: [
                {
                  id: '#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16',
                  type: 'Ed25519VerificationKey2018',
                  controller: '#id',
                  publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
                },
              ],
              authentication: ['#41fb2ec7-1f8b-42bf-91a2-4ef9092ddc16'],
            },
            secret: {},
          },
        })
      })

      it('should store the did without the did document', async () => {
        const longFormDid =
          'did:peer:4zQmZJVsg5xdo5gVX3HCEvwp29MxrCMvnBnPM2TTYqXjLseo:z72PjTR6nroWmhFJuXs5WUQ8NxVGvXQSLQKxsztQRxqcbNMndPt2GXVKX3fjbRX9h9qfjZWUBvvnmceMz1hyvdfdBnADMJQNeCcdivUypvyiFWkgq8DCTkjcQkjZqc7dubX5E8cd2npbrXbfmkw9sRPGi7vFxfdLCKiskUW2mpksEXwXvxZ8VFd56ZPqfStaajERmqiSU9vSxWfXC8SrwbcaHWm9KAWE5yYHKvUCtNqDB7VxNw5ApwkqpLajn58UANRHgCz2yf5bTvfRCWuUtdFe3n8aroc6chpMtS6j3RwxsL12kSjnWm24vEdsqq3KbGVanLeEFQ1HjKBFxwRsJrxGfT7wVPUbKu7hWemuf6cz2tZ5kPhAHVxWjahHNTATZXKzM8oDEn3PYC34pjkgZP6BeLeeAyK1hzcjCghaN6bdpTbYhSUqWKi6oaccX11gS6JLAt1ryUzG3sCeurVTUVrf1GntJpGkiPWRQhU66MpT4K7L7kZgrmcF8eL95pSbtZqhkQCyrsurKaVmNfwrCfNRr9JzxnXprbmjs4tikDVfSBk4TkDKcXck1YkZ6CjA8S1yHWKo7pGGfw3425SGAfXXLrYA29tAaQyxDKGjsFWorwKMUGdRA8psZgnFptcrwi1moAdn7cTExBFPr9PSk'
        const shortFormDid = 'did:peer:4zQmZJVsg5xdo5gVX3HCEvwp29MxrCMvnBnPM2TTYqXjLseo'
        await peerDidRegistrar.create(agentContext, {
          method: 'peer',
          didDocument,
          options: {
            numAlgo: PeerDidNumAlgo.ShortFormAndLongForm,
          },
        })

        expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
        const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

        expect(didRecord).toMatchObject({
          did: longFormDid,
          role: DidDocumentRole.Created,
          _tags: {
            recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
            alternativeDids: [shortFormDid],
          },
          didDocument: undefined,
        })
      })
    })

    it('should return an error state if an unsupported numAlgo is provided', async () => {
      const result = await peerDidRegistrar.create(agentContext, {
        method: 'peer',
        options: {
          // @ts-expect-error - this is not a valid numAlgo
          numAlgo: 5,
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
          reason: `notImplemented: updating did:peer not implemented yet`,
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
          reason: `notImplemented: deactivating did:peer not implemented yet`,
        },
      })
    })
  })
})
