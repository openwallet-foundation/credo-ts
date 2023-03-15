import type { DidRecord, RecordSavedEvent } from '@aries-framework/core'

import {
  DidCommV1Service,
  DidCommV2Service,
  DidDocumentService,
  DidDocument,
  DidDocumentRole,
  DidRepository,
  DidsApi,
  EventEmitter,
  JsonTransformer,
  Key,
  KeyType,
  RepositoryEventTypes,
  SigningProviderRegistry,
  TypedArrayEncoder,
  VerificationMethod,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext, indySdk, mockProperty } from '../../../../core/tests'
import { IndySdkWallet } from '../../../../indy-sdk/src'
import { IndyVdrPool, IndyVdrPoolService } from '../../pool'
import { IndyVdrIndyDidRegistrar } from '../IndyVdrIndyDidRegistrar'

jest.mock('../../pool/IndyVdrPool')
const IndyVdrPoolMock = IndyVdrPool as jest.Mock<IndyVdrPool>
const poolMock = new IndyVdrPoolMock()
mockProperty(poolMock, 'indyNamespace', 'ns1')

const agentConfig = getAgentConfig('IndyVdrIndyDidRegistrar')

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

const indyVdrIndyDidRegistrar = new IndyVdrIndyDidRegistrar()

describe('IndyVdrIndyDidRegistrar', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('returns an error state if both did and privateKey are provided', async () => {
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
        reason: `Only one of 'seed', 'privateKey' and 'did' must be provided`,
      },
    })
  })

  test('returns an error state if the submitter did is not a valid did:indy did', async () => {
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
        reason: 'Initial verkey verkey does not match did did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
      },
    })
  })

  test('returns an error state if did is provided, but does not match with the namespace from the submitterDid', async () => {
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool2:B6xaJg1c2xU3D9ppCtt1CZ',
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
    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
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
      poolMock,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'B6xaJg1c2xU3D9ppCtt1CZ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Role
      'STEWARD',
      undefined
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
          ],
          authentication: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey'],
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
    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
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
      poolMock,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'B6xaJg1c2xU3D9ppCtt1CZ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Role
      'STEWARD',
      undefined
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
          ],
          authentication: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey'],
          assertionMethod: undefined,
          keyAgreement: undefined,
        },
        secret: {},
      },
    })
  })

  test('creates a did:indy document with services using diddocContent', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'setEndpointsForDid')

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        services: [
          new DidDocumentService({
            id: `#endpoint`,
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: `#did-communication`,
            priority: 0,
            recipientKeys: [`#key-agreement-1`],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new DidCommV2Service({
            accept: ['didcomm/v2'],
            id: `#didcomm-1`,
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
          }),
        ],
      },
      secret: {
        privateKey,
      },
    })

    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      poolMock,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'B6xaJg1c2xU3D9ppCtt1CZ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Role
      'STEWARD',
      {
        '@context': [],
        authentication: [],
        id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
        keyAgreement: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
        service: [
          {
            id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#endpoint',
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          },
          {
            accept: ['didcomm/aip2;env=rfc19'],
            id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#did-communication',
            priority: 0,
            recipientKeys: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'did-communication',
          },
          {
            accept: ['didcomm/v2'],
            id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#didcomm-1',
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'DIDComm',
          },
        ],
        verificationMethod: [
          {
            controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
            id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1',
            publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            type: 'X25519KeyAgreementKey2019',
          },
        ],
      }
    )
    expect(setEndpointsForDidSpy).not.toHaveBeenCalled()
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            },
          ],
          service: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#endpoint',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#did-communication',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
              routingKeys: ['key-1'],
              accept: ['didcomm/aip2;env=rfc19'],
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#didcomm-1',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
              routingKeys: ['key-1'],
              accept: ['didcomm/v2'],
            },
          ],
          authentication: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey'],
          assertionMethod: undefined,
          keyAgreement: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
        },
        secret: {
          privateKey,
        },
      },
    })
  })

  test('creates a did:indy document with services using attrib', async () => {
    const privateKey = TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c712fd969598e')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        useEndpointAttrib: true,
        services: [
          new DidDocumentService({
            id: `#endpoint`,
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: `#did-communication`,
            priority: 0,
            recipientKeys: [`#key-agreement-1`],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new DidCommV2Service({
            accept: ['didcomm/v2'],
            id: `#didcomm-1`,
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
          }),
        ],
      },
      secret: {
        privateKey,
      },
    })

    expect(registerPublicDidSpy).toHaveBeenCalledWith(
      agentContext,
      poolMock,
      // Unqualified submitter did
      'BzCbsNYhMrjHiqZDTUASHg',
      // submitter signing key,
      expect.any(Key),
      // Unqualified created indy did
      'B6xaJg1c2xU3D9ppCtt1CZ',
      // Verkey
      expect.any(Key),
      // Alias
      'Hello',
      // Role
      'STEWARD'
    )
    expect(setEndpointsForDidSpy).toHaveBeenCalledWith(
      agentContext,
      poolMock,
      'B6xaJg1c2xU3D9ppCtt1CZ',
      expect.any(Key),
      {
        endpoint: 'https://example.com/endpoint',
        routingKeys: ['key-1'],
        types: ['endpoint', 'did-communication', 'DIDComm'],
      }
    )
    expect(JsonTransformer.toJSON(result)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
          verificationMethod: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
              publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
            },
          ],
          service: [
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#endpoint',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#did-communication',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
              routingKeys: ['key-1'],
              accept: ['didcomm/aip2;env=rfc19'],
            },
            {
              id: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#didcomm-1',
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
              routingKeys: ['key-1'],
              accept: ['didcomm/v2'],
            },
          ],
          authentication: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#verkey'],
          assertionMethod: undefined,
          keyAgreement: ['did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ#key-agreement-1'],
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
    // @ts-ignore - method is private
    const registerPublicDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'registerPublicDid')
    registerPublicDidSpy.mockImplementationOnce(() => Promise.resolve())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - method is private
    const setEndpointsForDidSpy = jest.spyOn<undefined, undefined>(indyVdrIndyDidRegistrar, 'setEndpointsForDid')
    setEndpointsForDidSpy.mockImplementationOnce(() => Promise.resolve(undefined))

    const saveCalled = jest.fn()
    eventEmitter.on<RecordSavedEvent<DidRecord>>(RepositoryEventTypes.RecordSaved, saveCalled)

    await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        alias: 'Hello',
        submitterDid: 'did:indy:pool1:BzCbsNYhMrjHiqZDTUASHg',
        role: 'STEWARD',
        services: [
          new DidDocumentService({
            id: `#endpoint`,
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: `#did-communication`,
            priority: 0,
            recipientKeys: [`#key-agreement-1`],
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new DidCommV2Service({
            accept: ['didcomm/v2'],
            id: `#didcomm-1`,
            routingKeys: ['key-1'],
            serviceEndpoint: 'https://example.com/endpoint',
          }),
        ],
      },
      secret: {
        privateKey,
      },
    })

    expect(saveCalled).toHaveBeenCalledTimes(1)
    const [saveEvent] = saveCalled.mock.calls[0]

    expect(saveEvent.payload.record).toMatchObject({
      did: 'did:indy:pool1:B6xaJg1c2xU3D9ppCtt1CZ',
      role: DidDocumentRole.Created,
      _tags: {
        recipientKeyFingerprints: ['z6LSrH6AdsQeZuKKmG6Ehx7abEQZsVg2psR2VU536gigUoAe'],
      },
      didDocument: undefined,
    })
  })

  test('returns an error state when calling update', async () => {
    const result = await indyVdrIndyDidRegistrar.update()

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
    const result = await indyVdrIndyDidRegistrar.deactivate()

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
