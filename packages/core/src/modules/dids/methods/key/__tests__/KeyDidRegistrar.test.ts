import type { MockedClassConstructor } from '../../../../../../../../tests/types'
import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../../tests/helpers'
import { TypedArrayEncoder } from '../../../../../utils'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { KeyManagementApi } from '../../../../kms'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { KeyDidRegistrar } from '../KeyDidRegistrar'

import didKeyz6MksLeFixture from './__fixtures__/didKeyz6MksLe.json'

vi.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as MockedClassConstructor<typeof DidRepository>

const didRepositoryMock = new DidRepositoryMock()
const keyDidRegistrar = new KeyDidRegistrar()

const agentContext = getAgentContext({
  registerInstances: [[DidRepository, didRepositoryMock]],
  agentConfig: getAgentConfig('KeyDidRegistrar'),
})
const kms = agentContext.resolve(KeyManagementApi)

describe('DidRegistrar', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('KeyDidRegistrar', () => {
    it('should correctly create a did:key document using Ed25519 key type', async () => {
      const privateJwk = transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e'),
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      }).privateJwk

      const { keyId } = await kms.importKey({
        privateJwk,
      })

      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        options: {
          keyId,
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU',
          didDocument: didKeyz6MksLeFixture,
        },
      })
    })

    it('should return an error state if no key or key type is provided', async () => {
      const result = await keyDidRegistrar.create(agentContext, {
        method: 'key',
        // @ts-expect-error
        options: {},
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason:
            'unknownError: Invalid options provided to getPublicKey method\n✖ Invalid input: expected string, received undefined\n  → at keyId',
        },
      })
    })

    it('should store the did document', async () => {
      const _privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
      const did = 'did:key:z6MksLeew51QS6Ca6tVKM56LQNbxCNVcLHv4xXj4jMkAhPWU'

      const privateJwk = transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e'),
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      }).privateJwk

      const { keyId } = await kms.importKey({
        privateJwk,
      })

      await keyDidRegistrar.create(agentContext, {
        method: 'key',

        options: {
          keyId,
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
