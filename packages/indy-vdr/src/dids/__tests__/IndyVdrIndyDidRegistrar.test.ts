import { DidRecord, RecordSavedEvent } from '@credo-ts/core'

import {
  DidCommV1Service,
  DidDocument,
  DidDocumentRole,
  DidDocumentService,
  DidRepository,
  DidsApi,
  EventEmitter,
  JsonTransformer,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  RepositoryEventTypes,
  TypedArrayEncoder,
  VerificationMethod,
} from '@credo-ts/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { agentDependencies, getAgentConfig, getAgentContext, mockProperty } from '../../../../core/tests'
import { IndyVdrPool, IndyVdrPoolService } from '../../pool'
import { IndyVdrIndyDidRegistrar } from '../IndyVdrIndyDidRegistrar'

jest.mock('../../pool/IndyVdrPool')
const IndyVdrPoolMock = IndyVdrPool as jest.Mock<IndyVdrPool>
const poolMock = new IndyVdrPoolMock()
mockProperty(poolMock, 'indyNamespace', 'ns1')

const agentConfig = getAgentConfig('IndyVdrIndyDidRegistrar')

const storageService = new InMemoryStorageService<DidRecord>()
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const didRepository = new DidRepository(storageService, eventEmitter)

const agentContext = getAgentContext({
  registerInstances: [
    [DidRepository, didRepository],
    [IndyVdrPoolService, { getPoolForNamespace: jest.fn().mockReturnValue(poolMock) }],
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
                publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
              }),
            ],
          }),
        }),
        resolveCreatedDidDocumentWithKeys: jest.fn().mockResolvedValue({
          keys: [],
          didDocument: new DidDocument({
            id: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
            authentication: [
              new VerificationMethod({
                id: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg#verkey',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
                publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
              }),
            ],
          }),
        }),
      },
    ],
  ],
  agentConfig,
})

const indyVdrIndyDidRegistrar = new IndyVdrIndyDidRegistrar()
const kms = agentContext.resolve(Kms.KeyManagementApi)

const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')
const keyId = 'the-key-id'
const privateJwk = transformPrivateKeyToPrivateJwk({
  privateKey,
  type: { crv: 'Ed25519', kty: 'OKP' },
}).privateJwk
privateJwk.kid = keyId

describe('IndyVdrIndyDidRegistrar', () => {
  beforeAll(async () => {
    await kms.importKey({
      privateJwk,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('returns an error state if the provided key id is not an Ed25519 key', async () => {
    await kms.createKey({
      keyId: 'no-ed25519',
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        endorserMode: 'internal',
        keyId: 'no-ed25519',
        endorserDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
      },
    })

    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `keyId must point to an Ed25519 key, but found EC key with crv 'P-256'`,
      },
    })
  })

  test('returns an error state if the endorser did is not a valid did:indy did', async () => {
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        endorserMode: 'internal',
        endorserDid: 'BzCbsNYhMrjHiqZDTUASHg',
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

  test('creates a did:indy document without services', async () => {
    // @ts-ignore - method is private
    const createRegisterDidWriteRequest = jest.spyOn<undefined, undefined>(
      indyVdrIndyDidRegistrar,
      'createRegisterDidWriteRequest'
    )
    // @ts-ignore type check fails because method is private
    createRegisterDidWriteRequest.mockImplementationOnce(() => Promise.resolve())

    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    // @ts-ignore type check fails because method is private
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        endorserMode: 'internal',
        endorserDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        keyId,
      },
    })

    expect(createRegisterDidWriteRequest).toHaveBeenCalledWith({
      agentContext,
      pool: poolMock,
      signingKey: expect.any(Kms.PublicJwk),
      submitterNamespaceIdentifier: 'BzCbsNYhMrjHiqZDTUASHg',
      namespaceIdentifier: 'Q4HNw3AuzNBacei9KsAxno',
      verificationKey: expect.any(Kms.PublicJwk),
      alias: 'Hello',
      diddocContent: undefined,
      role: 'STEWARD',
    })

    expect(registerPublicDidSpy).toHaveBeenCalledWith(agentContext, poolMock, undefined)
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
          verificationMethod: [
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
              publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
            },
          ],
          authentication: ['did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#verkey'],
          assertionMethod: undefined,
          keyAgreement: undefined,
        },
      },
    })
  })

  test('creates a did:indy document with services using attrib', async () => {
    // @ts-ignore - method is private
    const createRegisterDidWriteRequestSpy = jest.spyOn<undefined, undefined>(
      indyVdrIndyDidRegistrar,
      'createRegisterDidWriteRequest'
    )
    // @ts-ignore type check fails because method is private
    createRegisterDidWriteRequestSpy.mockImplementationOnce(() => Promise.resolve())

    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    // @ts-ignore type check fails because method is private
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // @ts-ignore - method is private
    const createSetDidEndpointsRequestSpy = jest.spyOn<undefined, undefined>(
      indyVdrIndyDidRegistrar,
      'createSetDidEndpointsRequest'
    )
    // @ts-ignore type check fails because method is private
    createSetDidEndpointsRequestSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    // @ts-ignore - method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'setEndpointsForDid')
    // @ts-ignore type check fails because method is private
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        keyId,
        endorserMode: 'internal',
        endorserDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        useEndpointAttrib: true,
        services: [
          new DidDocumentService({
            id: '#endpoint',
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: '#did-communication',
            priority: 0,
            recipientKeys: ['#key-agreement-1'],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new NewDidCommV2Service({
            id: '#didcomm-messaging-1',
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              accept: ['didcomm/v2'],
              routingKeys: ['key-1'],
              uri: 'https://example.com/endpoint',
            }),
          }),
        ],
      },
    })
    expect(result.didState.state).toEqual('finished')

    expect(createRegisterDidWriteRequestSpy).toHaveBeenCalledWith({
      agentContext,
      pool: poolMock,
      signingKey: expect.any(Kms.PublicJwk),
      submitterNamespaceIdentifier: 'BzCbsNYhMrjHiqZDTUASHg',
      namespaceIdentifier: 'Q4HNw3AuzNBacei9KsAxno',
      verificationKey: expect.any(Kms.PublicJwk),
      alias: 'Hello',
      diddocContent: undefined,
      role: 'STEWARD',
    })

    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      poolMock,
      // writeRequest
      undefined
    )
    expect(createSetDidEndpointsRequestSpy).toHaveBeenCalledWith({
      agentContext,
      pool: poolMock,
      signingKey: expect.any(Kms.PublicJwk),
      endorserDid: undefined,
      // Unqualified created indy did
      unqualifiedDid: 'Q4HNw3AuzNBacei9KsAxno',
      endpoints: {
        endpoint: 'https://example.com/endpoint',
        routingKeys: ['key-1'],
        types: ['endpoint', 'did-communication', 'DIDCommMessaging'],
      },
    })
    expect(setEndpointsForDidSpy).not.toHaveBeenCalled()
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
          verificationMethod: [
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
              publicKeyBase58: 'DtPcLpky6Yi6zPecfW8VZH3xNoDkvQfiGWp8u5n9nAj6',
            },
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
              publicKeyBase58: '7H8ScGrunfcGBwMhhRakDMYguLAWiNWhQ2maYH84J8fE',
            },
          ],
          service: [
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#endpoint',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#did-communication',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#key-agreement-1'],
              routingKeys: ['key-1'],
              accept: ['didcomm/aip2;env=rfc19'],
            },
            {
              id: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#didcomm-messaging-1',
              type: 'DIDCommMessaging',
              serviceEndpoint: { uri: 'https://example.com/endpoint', routingKeys: ['key-1'], accept: ['didcomm/v2'] },
            },
          ],
          authentication: ['did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#verkey'],
          assertionMethod: undefined,
          keyAgreement: ['did:indy:pool1:Q4HNw3AuzNBacei9KsAxno#key-agreement-1'],
        },
      },
    })
  })

  test('stores the did document', async () => {
    // @ts-ignore - method is private
    const createRegisterDidWriteRequestSpy = jest.spyOn<undefined, undefined>(
      indyVdrIndyDidRegistrar,
      'createRegisterDidWriteRequest'
    )
    // @ts-ignore type check fails because method is private
    createRegisterDidWriteRequestSpy.mockImplementationOnce(() => Promise.resolve())

    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    // @ts-ignore type check fails because method is private
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // @ts-ignore - method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'setEndpointsForDid')
    // @ts-ignore type check fails because method is private
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const saveCalled = jest.fn()
    eventEmitter.on<RecordSavedEvent<DidRecord>>(RepositoryEventTypes.RecordSaved, saveCalled)

    await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        keyId,
        endorserMode: 'internal',
        endorserDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        services: [
          new DidDocumentService({
            id: '#endpoint',
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: '#did-communication',
            priority: 0,
            recipientKeys: ['#key-agreement-1'],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new NewDidCommV2Service({
            id: '#didcomm-messaging-1',
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              accept: ['didcomm/v2'],
              routingKeys: ['key-1'],
              uri: 'https://example.com/endpoint',
            }),
          }),
        ],
      },
    })

    expect(saveCalled).toHaveBeenCalledTimes(1)
    const [saveEvent] = saveCalled.mock.calls[0]

    expect(saveEvent.payload.record.getTags()).toMatchObject({
      recipientKeyFingerprints: ['z6LShxJc8afmt8L1HKjUE56hXwmAkUhdQygrH1VG2jmb1WRz'],
    })
    expect(saveEvent.payload.record).toMatchObject({
      did: 'did:indy:pool1:Q4HNw3AuzNBacei9KsAxno',
      role: DidDocumentRole.Created,
      didDocument: expect.any(DidDocument),
    })
  })

  test('returns an error state when calling update', async () => {
    const result = await indyVdrIndyDidRegistrar.update()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: updating did:indy not implemented yet',
      },
    })
  })

  test('returns an error state when calling deactivate', async () => {
    const result = await indyVdrIndyDidRegistrar.deactivate()

    expect(result).toEqual({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: deactivating did:indy not implemented yet',
      },
    })
  })
})
