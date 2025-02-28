import type { Wallet } from '../../../../../wallet'

import { getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { TypedArrayEncoder } from '../../../../../utils'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { WalletError } from '../../../../../wallet/error'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { KeyDidRegistrar } from '../KeyDidRegistrar'

import didKeyz6MksLeFixture from './__fixtures__/didKeyz6MksLe.json'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

const walletMock = {
  createKey: jest.fn(() => Key.fromFingerprint('z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU')),
} as unknown as Wallet

const didRepositoryMock = new DidRepositoryMock()
const keyDidRegistrar = new KeyDidRegistrar()

const agentContext = getAgentContext({
  wallet: walletMock,
  registerInstances: [[DidRepository, didRepositoryMock]],
})

describe('DidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('KeyDidRegistrar', () => {
    it('should correctly create a did:key document using Ed25519 key type', async () => {
      const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
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
          did: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
          didDocument: didKeyz6MksLeFixture,
          secret: {
            privateKey,
          },
        },
      })

      expect(walletMock.createKey).toHaveBeenCalledWith({ keyType: KeyType.Ed25519, privateKey })
    })

    it('should return an error state if a key instance and key type are both provided', async () => {
      const key = await agentContext.wallet.createKey({
        keyType: KeyType.P256,
      })

      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
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
      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
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
      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
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
      const did = 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU'

      await keyDidRegistrar.create(agentContext, {
        method: 'key',

        options: {
          keyType: KeyType.Ed25519,
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
      const result = await keyDidRegistrar.update()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'notSupported: cannot update did:key did',
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
          reason: 'notSupported: cannot deactivate did:key did',
        },
      })
    })
  })
})
