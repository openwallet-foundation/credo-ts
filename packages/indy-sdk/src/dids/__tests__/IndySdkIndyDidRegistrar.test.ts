import type { IndySdkPool } from '../../ledger/IndySdkPool'
import type { DidRecord, RecordSavedEvent } from '@aries-framework/core'

import {
  SigningProviderRegistry,
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
import { mockFunction, getAgentConfig, getAgentContext, agentDependencies, indySdk } from '../../../../core/tests'
import { IndySdkPoolService } from '../../ledger/IndySdkPoolService'
import { IndySdkWallet } from '../../wallet'
import { IndySdkIndyDidRegistrar } from '../IndySdkIndyDidRegistrar'

jest.mock('../../ledger/IndySdkPoolService')
const IndySdkPoolServiceMock = IndySdkPoolService as jest.Mock<IndySdkPoolService>
const indySdkPoolServiceMock = new IndySdkPoolServiceMock()

const pool = {
  config: { indyNamespace: 'pool1' },
} as IndySdkPool
mockFunction(indySdkPoolServiceMock.getPoolForNamespace).mockReturnValue(pool)

const agentConfig = getAgentConfig('IndySdkIndyDidRegistrar')
const wallet = new IndySdkWallet(indySdk, agentConfig.logger, new SigningProviderRegistry([]))

jest
  .spyOn(wallet, 'createKey')
  .mockResolvedValue(Key.fromPublicKeyBase58('E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu', KeyType.Ed25519))
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
            id: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
            authentication: [
              new VerificationMethod({
                id: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg#verkey',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
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

const indySdkIndyDidRegistrar = new IndySdkIndyDidRegistrar()

describe('IndySdkIndyDidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('returns an error state if both did and privateKey are provided', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool1:did-value',
      options: {
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        alias: 'Hello',
      },
      secret: {
        privateKey: TypedArrayEncoder.fromString('key'),
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `Only one of 'privateKey' or 'did' must be provided`,
      },
    })
  })

  test('returns an error state if the submitter did is not a valid did:indy did', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        submitterDid: 'BzCbsNYhMrjHiqZDTUASHg',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'unknownError: BzCbsNYhMrjHiqZDTUASHg is not a valid did:indy did',
      },
    })
  })

  test('returns an error state if did is provided, but it is not a valid did:indy did', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'BzCbsNYhMrjHiqZDTUASHg',
      options: {
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        verkey: 'verkey',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'unknownError: BzCbsNYhMrjHiqZDTUASHg is not a valid did:indy did',
      },
    })
  })

  test('returns an error state if did is provided, but no verkey', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'BzCbsNYhMrjHiqZDTUASHg',
      options: {
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'If a did is defined, a matching verkey must be provided',
      },
    })
  })

  test('returns an error state if did and verkey are provided, but the did is not self certifying', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
      options: {
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        verkey: 'verkey',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'Did must be first 16 bytes of the the verkey base58 encoded.',
      },
    })
  })

  test('returns an error state if did is provided, but does not match with the namespace from the submitterDid', async () => {
    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool2:R1xKJw17sUoXhejEpugMYJ',
      options: {
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
        alias: 'Hello',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason:
          'The submitter did uses namespace pool1 and the did to register uses namespace pool2. Namespaces must match.',
      },
    })
  })

  test('creates a did:indy document without services', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
      },
      secret: {
        privateKey,
      },
    })
    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      pool,
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
      // Role
      'STEWARD'
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
          ],
          authentication: ['did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey'],
          assertionMethod: undefined,
          keyAgreement: undefined,
        },
        secret: {
          privateKey,
        },
      },
    })
  })

  test('creates a did:indy document by passing did', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
      options: {
        verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
      },
      secret: {},
    })
    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      pool,
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
      // Role
      'STEWARD'
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
          ],
          authentication: ['did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey'],
          assertionMethod: undefined,
          keyAgreement: undefined,
        },
        secret: {},
      },
    })
  })

  test('creates a did:indy document with services', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const result = await indySdkIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
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
      pool,
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
      // Role
      'STEWARD'
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
              publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            },
          ],
          service: [
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#endpoint',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#did-communication',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
              routingKeys: ['key-1'],
              accept: ['didcomm/aip2;env=rfc19'],
            },
            {
              id: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#didcomm-1',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
              routingKeys: ['key-1'],
              accept: ['didcomm/v2'],
            },
          ],
          authentication: ['did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#verkey'],
          assertionMethod: undefined,
          keyAgreement: ['did:indy:pool1:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
        },
        secret: {
          privateKey,
        },
      },
    })
  })

  test('stores the did document', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indySdkIndyDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const saveCalled = jest.fn()
    eventEmitter.on<RecordSavedEvent<DidRecord>>(RepositoryEventTypes.RecordSaved, saveCalled)

    await indySdkIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
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
      did: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
      role: DidDocumentRole.Created,
      _tags: {
        recipientKeyFingerprints: ['z6LSrH6AdsQeZuKKmG6Ehx7abEQZsVg2psR2VU536gigUoAe'],
      },
      didDocument: undefined,
    })
  })

  test('returns an error state when calling update', async () => {
    const result = await indySdkIndyDidRegistrar.update()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: updating did:indy not implemented yet`,
      },
    })
  })

  test('returns an error state when calling deactivate', async () => {
    const result = await indySdkIndyDidRegistrar.deactivate()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:indy not implemented yet`,
      },
    })
  })
})
