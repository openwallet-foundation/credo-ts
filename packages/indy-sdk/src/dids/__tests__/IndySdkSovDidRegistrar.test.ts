import type { IndySdkPool } from '../../ledger/IndySdkPool'
import type { Wallet, DidRecord, RecordSavedEvent } from '@aries-framework/core'

import {
  DidsApi,
  DidDocument,
  VerificationMethod,
  KeyType,
  Key,
  TypedArrayEncoder,
  DidRepository,
  JsonTransformer,
  DidDocumentRole,
  EventEmitter,
  RepositoryEventTypes,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { mockFunction, getAgentConfig, getAgentContext, agentDependencies } from '../../../../core/tests'
import { IndySdkPoolService } from '../../ledger/IndySdkPoolService'
import { IndySdkSovDidRegistrar } from '../IndySdkSovDidRegistrar'

jest.mock('../../ledger/IndySdkPoolService')
const IndySdkPoolServiceMock = IndySdkPoolService as jest.Mock<IndySdkPoolService>
const indySdkPoolServiceMock = new IndySdkPoolServiceMock()

mockFunction(indySdkPoolServiceMock.getPoolForNamespace).mockReturnValue({
  config: { indyNamespace: 'pool1' },
} as IndySdkPool)

const agentConfig = getAgentConfig('IndySdkSovDidRegistrar')

const wallet = {
  createKey: jest
    .fn()
    .mockResolvedValue(Key.fromPublicKeyBase58('E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu', KeyType.Ed25519)),
} as unknown as Wallet
const storageService = new InMemoryStorageService<DidRecord>()
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const didRepository = new DidRepository(storageService, eventEmitter)

const agentContext = getAgentContext({
  wallet,
  registerInstances: [
    [DidRepository, didRepository],
    [IndySdkPoolService, indySdkPoolServiceMock],
    [
      DidsApi,
      {
        resolve: jest.fn().mockResolvedValue({
          didDocument: new DidDocument({
            id: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
            authentication: [
              new VerificationMethod({
                id: 'did:sov:BzCbsNYhMrjHiqZDTUASHg#key-1',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
                publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
              }),
            ],
          }),
        }),
      },
    ],
  ],
  agentConfig,
})

const indySdkSovDidRegistrar = new IndySdkSovDidRegistrar()

describe('IndySdkSovDidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return an error state if an invalid private key is provided', async () => {
    const result = await indySdkSovDidRegistrar.create(agentContext, {
      method: 'sov',

      options: {
        submitterVerificationMethod: 'did:sov:BzCbsNYhMrjHiqZDTUASHg#key-1',
        alias: 'Hello',
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
        reason: 'Invalid private key provided',
      },
    })
  })

  it('should return an error state if the submitter did is not qualified with did:sov', async () => {
    const result = await indySdkSovDidRegistrar.create(agentContext, {
      method: 'sov',
      options: {
        submitterVerificationMethod: 'BzCbsNYhMrjHiqZDTUASHg',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'Submitter did must be a valid did:sov did',
      },
    })
  })

  it('should correctly create a did:sov document without services', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    const registerPublicDidSpy = jest.spyOn(indySdkSovDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve('R1xKJw17sUoXhejEpugMYJ'))

    const result = await indySdkSovDidRegistrar.create(agentContext, {
      method: 'sov',
      options: {
        alias: 'Hello',
        submitterVerificationMethod: 'did:sov:BzCbsNYhMrjHiqZDTUASHg#key-1',
        role: 'STEWARD',
      },
      secret: {
        privateKey,
      },
    })
    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'R1xKJw17sUoXhejEpugMYJ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Pool
      { config: { indyNamespace: 'pool1' } },
      // Role
      'STEWARD'
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {
        qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
      },
      didRegistrationMetadata: {
        didIndyNamespace: 'pool1',
      },
      didState: {
        state: 'finished',
        did: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          id: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
          verificationMethod: [
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-1',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            },
          ],
          authentication: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
          assertionMethod: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
          keyAgreement: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
        },
        secret: {
          privateKey,
        },
      },
    })
  })

  it('should correctly create a did:sov document with services', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    const registerPublicDidSpy = jest.spyOn(indySdkSovDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve('R1xKJw17sUoXhejEpugMYJ'))

    const setEndpointsForDidSpy = jest.spyOn(indySdkSovDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const result = await indySdkSovDidRegistrar.create(agentContext, {
      method: 'sov',
      options: {
        alias: 'Hello',
        submitterVerificationMethod: 'did:sov:BzCbsNYhMrjHiqZDTUASHg#key-1',
        role: 'STEWARD',
        endpoints: {
          endpoint: 'https://example.com/endpoint',
          routingKeys: ['key-1'],
          types: ['DIDComm', 'did-communication', 'endpoint'],
        },
      },
      secret: {
        privateKey,
      },
    })

    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'R1xKJw17sUoXhejEpugMYJ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Pool
      { config: { indyNamespace: 'pool1' } },
      // Role
      'STEWARD'
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {
        qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
      },
      didRegistrationMetadata: {
        didIndyNamespace: 'pool1',
      },
      didState: {
        state: 'finished',
        did: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          id: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
          verificationMethod: [
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-1',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            },
          ],
          service: [
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#endpoint',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#did-communication',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
              routingKeys: ['key-1'],
              accept: ['didcomm/aip2;env=rfc19'],
            },
            {
              id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#didcomm-1',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
              routingKeys: ['key-1'],
              accept: ['didcomm/v2'],
            },
          ],
          authentication: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
          assertionMethod: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
          keyAgreement: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
        },
        secret: {
          privateKey,
        },
      },
    })
  })

  it('should store the did document', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    const registerPublicDidSpy = jest.spyOn(indySdkSovDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve('did'))

    const setEndpointsForDidSpy = jest.spyOn(indySdkSovDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const saveCalled = jest.fn()
    eventEmitter.on<RecordSavedEvent<DidRecord>>(RepositoryEventTypes.RecordSaved, saveCalled)

    await indySdkSovDidRegistrar.create(agentContext, {
      method: 'sov',
      options: {
        alias: 'Hello',
        submitterVerificationMethod: 'did:sov:BzCbsNYhMrjHiqZDTUASHg#key-1',
        role: 'STEWARD',
        endpoints: {
          endpoint: 'https://example.com/endpoint',
          routingKeys: ['key-1'],
          types: ['DIDComm', 'did-communication', 'endpoint'],
        },
      },
      secret: {
        privateKey,
      },
    })

    expect(saveCalled).toHaveBeenCalledTimes(1)
    const [saveEvent] = saveCalled.mock.calls[0]

    expect(saveEvent.payload.record).toMatchObject({
      did: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
      role: DidDocumentRole.Created,
      _tags: {
        recipientKeyFingerprints: ['z6LSrH6AdsQeZuKKmG6Ehx7abEQZsVg2psR2VU536gigUoAe'],
        qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
      },
      didDocument: undefined,
    })
  })

  it('should return an error state when calling update', async () => {
    const result = await indySdkSovDidRegistrar.update()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: updating did:sov not implemented yet`,
      },
    })
  })

  it('should return an error state when calling deactivate', async () => {
    const result = await indySdkSovDidRegistrar.deactivate()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:sov not implemented yet`,
      },
    })
  })
})
