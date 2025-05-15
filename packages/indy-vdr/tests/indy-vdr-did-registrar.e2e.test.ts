import type { IndyVdrDidCreateOptions, IndyVdrDidCreateResult } from '../src/dids/IndyVdrIndyDidRegistrar'

import { didIndyRegex } from '@credo-ts/anoncreds'
import {
  Agent,
  DidCommV1Service,
  DidDocumentService,
  DidsModule,
  JsonTransformer,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { getAgentOptions, importExistingIndyDidFromPrivateKey, retryUntilResult } from '../../core/tests/helpers'
import { IndyVdrModule, IndyVdrSovDidResolver } from '../src'
import { IndyVdrIndyDidRegistrar } from '../src/dids/IndyVdrIndyDidRegistrar'
import { IndyVdrIndyDidResolver } from '../src/dids/IndyVdrIndyDidResolver'
import { indyDidFromNamespaceAndInitialKey } from '../src/dids/didIndyUtil'

import { transformPrivateKeyToPrivateJwk } from '../../askar/src'
import { indyVdrModuleConfig } from './helpers'

const endorser = new Agent(
  getAgentOptions(
    'Indy VDR Indy DID Registrar',
    {},
    {},
    {
      indyVdr: new IndyVdrModule({
        networks: indyVdrModuleConfig.networks,
        indyVdr,
      }),
      dids: new DidsModule({
        registrars: [new IndyVdrIndyDidRegistrar()],
        resolvers: [new IndyVdrIndyDidResolver(), new IndyVdrSovDidResolver()],
      }),
    }
  )
)
const agent = new Agent(
  getAgentOptions(
    'Indy VDR Indy DID Registrar',
    {},
    {},
    {
      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: indyVdrModuleConfig.networks,
      }),
      dids: new DidsModule({
        registrars: [new IndyVdrIndyDidRegistrar()],
        resolvers: [new IndyVdrIndyDidResolver(), new IndyVdrSovDidResolver()],
      }),
    }
  )
)

describe('Indy VDR Indy Did Registrar', () => {
  let endorserDid: string

  beforeAll(async () => {
    await endorser.initialize()
    const unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      endorser,
      TypedArrayEncoder.fromString('00000000000000000000000Endorser9')
    )
    endorserDid = `did:indy:pool:localtest:${unqualifiedSubmitterDid}`

    await agent.initialize()
  })

  afterAll(async () => {
    await endorser.shutdown()
    await agent.shutdown()
  })

  test('can register a did:indy without services', async () => {
    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserDid,
        endorserMode: 'internal',
      },
    })

    expect(JsonTransformer.toJSON(didRegistrationResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: expect.stringMatching(didIndyRegex),
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: expect.stringMatching(didIndyRegex),
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2018',
              controller: expect.stringMatching(didIndyRegex),
              id: expect.stringContaining('#verkey'),
              publicKeyBase58: expect.any(String),
            },
          ],
          capabilityDelegation: undefined,
          capabilityInvocation: undefined,
          authentication: [expect.stringContaining('#verkey')],
          service: undefined,
        },
      },
    })

    const did = didRegistrationResult.didState.did
    if (!did) throw Error('did not defined')

    // Tries to call it in an interval until it succeeds (with maxAttempts)
    // As the ledger write is not always consistent in how long it takes
    // to write the data, we need to retry until we get a result.
    const didDocument = await retryUntilResult(async () => {
      const result = await endorser.dids.resolve(did)
      return result.didDocument
    })

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject({
      '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
      id: did,
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          type: 'Ed25519VerificationKey2018',
          controller: did,
          id: `${did}#verkey`,
          publicKeyBase58: expect.any(String),
        },
      ],
      capabilityDelegation: undefined,
      capabilityInvocation: undefined,
      authentication: [`${did}#verkey`],
      service: undefined,
    })
  })

  test('cannot create a did with TRUSTEE role', async () => {
    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserDid,
        endorserMode: 'internal',
        role: 'TRUSTEE',
      },
    })

    expect(JsonTransformer.toJSON(didRegistrationResult.didState.state)).toBe('failed')
  })

  test('can register an endorsed did:indy without services - did and verkey specified', async () => {
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )

    const key = await agent.kms.importKey(
      transformPrivateKeyToPrivateJwk({
        type: { kty: 'OKP', crv: 'Ed25519' },
        privateKey,
      })
    )
    const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)

    const { did } = indyDidFromNamespaceAndInitialKey('pool:localtest', publicJwk)

    const didCreateTobeEndorsedResult = (await agent.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserDid,
        endorserMode: 'external',
        keyId: key.keyId,
      },
    })) as IndyVdrDidCreateResult

    const didState = didCreateTobeEndorsedResult.didState
    if (didState.state !== 'action' || didState.action !== 'endorseIndyTransaction') throw Error('unexpected did state')

    const signedNymRequest = await endorser.modules.indyVdr.endorseTransaction(
      didState.nymRequest,
      didState.endorserDid
    )
    const didCreateSubmitResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserMode: 'external',
        endorsedTransaction: {
          nymRequest: signedNymRequest,
        },
      },
    })

    if (didCreateSubmitResult.didState.state !== 'finished') {
      throw new Error(`Unexpected did state, ${JSON.stringify(didCreateSubmitResult.didState, null, 2)}`)
    }
    expect(JsonTransformer.toJSON(didCreateSubmitResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did,
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: did,
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2018',
              controller: did,
              id: `${did}#verkey`,
              publicKeyBase58: ed25519PublicKeyBase58,
            },
          ],
          capabilityDelegation: undefined,
          capabilityInvocation: undefined,
          authentication: [`${did}#verkey`],
          service: undefined,
        },
      },
    })

    // Tries to call it in an interval until it succeeds (with maxAttempts)
    // As the ledger write is not always consistent in how long it takes
    // to write the data, we need to retry until we get a result.
    const didDocument = await retryUntilResult(async () => {
      const result = await endorser.dids.resolve(did)
      return result.didDocument
    })

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject({
      '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
      id: did,
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          type: 'Ed25519VerificationKey2018',
          controller: did,
          id: `${did}#verkey`,
          publicKeyBase58: ed25519PublicKeyBase58,
        },
      ],
      capabilityDelegation: undefined,
      capabilityInvocation: undefined,
      authentication: [`${did}#verkey`],
      service: undefined,
    })
  })

  test('can register a did:indy without services - did and verkey specified', async () => {
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )

    const key = await endorser.kms.importKey(
      transformPrivateKeyToPrivateJwk({
        type: { kty: 'OKP', crv: 'Ed25519' },
        privateKey,
      })
    )
    const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)

    const { did } = indyDidFromNamespaceAndInitialKey('pool:localtest', publicJwk)
    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserDid,
        endorserMode: 'internal',
        keyId: key.keyId,
      },
    })

    expect(JsonTransformer.toJSON(didRegistrationResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did,
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: did,
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2018',
              controller: did,
              id: `${did}#verkey`,
              publicKeyBase58: ed25519PublicKeyBase58,
            },
          ],
          capabilityDelegation: undefined,
          capabilityInvocation: undefined,
          authentication: [`${did}#verkey`],
          service: undefined,
        },
      },
    })

    // Tries to call it in an interval until it succeeds (with maxAttempts)
    // As the ledger write is not always consistent in how long it takes
    // to write the data, we need to retry until we get a result.
    const didDocument = await retryUntilResult(async () => {
      const result = await endorser.dids.resolve(did)
      return result.didDocument
    })

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject({
      '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
      id: did,
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          type: 'Ed25519VerificationKey2018',
          controller: did,
          id: `${did}#verkey`,
          publicKeyBase58: ed25519PublicKeyBase58,
        },
      ],
      capabilityDelegation: undefined,
      capabilityInvocation: undefined,
      authentication: [`${did}#verkey`],
      service: undefined,
    })
  })

  test('can register a did:indy with services - did and verkey specified - using attrib endpoint', async () => {
    // Generate a private key and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )

    const key = await endorser.kms.importKey(
      transformPrivateKeyToPrivateJwk({ type: { kty: 'OKP', crv: 'Ed25519' }, privateKey })
    )
    const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(publicJwk.publicKey.publicKey))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)

    const { did } = indyDidFromNamespaceAndInitialKey('pool:localtest', publicJwk)

    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserDid,
        endorserMode: 'internal',
        useEndpointAttrib: true,
        keyId: key.keyId,
        services: [
          new DidDocumentService({
            id: `${did}#endpoint`,
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: `${did}#did-communication`,
            priority: 0,
            recipientKeys: [`${did}#key-agreement-1`],
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new NewDidCommV2Service({
            id: `${did}#didcomm-messaging-1`,
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              accept: ['didcomm/v2'],
              routingKeys: ['a-routing-key'],
              uri: 'https://example.com/endpoint',
            }),
          }),
        ],
      },
    })

    const expectedDidDocument = {
      '@context': [
        'https://w3id.org/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://w3id.org/security/suites/x25519-2019/v1',
        'https://didcomm.org/messaging/contexts/v2',
      ],
      id: did,
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          type: 'Ed25519VerificationKey2018',
          controller: did,
          id: `${did}#verkey`,
          publicKeyBase58: ed25519PublicKeyBase58,
        },
        {
          type: 'X25519KeyAgreementKey2019',
          controller: did,
          id: `${did}#key-agreement-1`,
          publicKeyBase58: x25519PublicKeyBase58,
        },
      ],
      capabilityDelegation: undefined,
      capabilityInvocation: undefined,
      authentication: [`${did}#verkey`],
      service: [
        {
          id: `${did}#endpoint`,
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'endpoint',
        },
        {
          accept: ['didcomm/aip2;env=rfc19'],
          id: `${did}#did-communication`,
          priority: 0,
          recipientKeys: [`${did}#key-agreement-1`],
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'did-communication',
        },
        {
          id: `${did}#didcomm-messaging-1`,
          serviceEndpoint: {
            uri: 'https://example.com/endpoint',
            accept: ['didcomm/v2'],
            routingKeys: ['a-routing-key'],
          },
          type: 'DIDCommMessaging',
        },
      ],
    }

    expect(JsonTransformer.toJSON(didRegistrationResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did,
        didDocument: expectedDidDocument,
      },
    })

    // Tries to call it in an interval until it succeeds (with maxAttempts)
    // As the ledger write is not always consistent in how long it takes
    // to write the data, we need to retry until we get a result.
    const didDocument = await retryUntilResult(async () => {
      const result = await endorser.dids.resolve(did)
      return result.didDocument
    })

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(expectedDidDocument)
  })

  test('can register an endorsed did:indy with services - did and verkey specified - using attrib endpoint', async () => {
    // Generate a private key and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join(`${Math.random().toString(36)}00000000000000000`.slice(2, 18))
        .slice(0, 32)
    )

    const key = await endorser.kms.importKey(
      transformPrivateKeyToPrivateJwk({ type: { kty: 'OKP', crv: 'Ed25519' }, privateKey })
    )
    const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk)
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(publicJwk.publicKey.publicKey))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)

    const { did } = indyDidFromNamespaceAndInitialKey('pool:localtest', publicJwk)

    const didCreateTobeEndorsedResult = (await endorser.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserMode: 'external',
        endorserDid: endorserDid,
        useEndpointAttrib: true,
        keyId: key.keyId,
        // keyId: key.keyId
        services: [
          new DidDocumentService({
            id: `${did}#endpoint`,
            serviceEndpoint: 'https://example.com/endpoint',
            type: 'endpoint',
          }),
          new DidCommV1Service({
            id: `${did}#did-communication`,
            priority: 0,
            recipientKeys: [`${did}#key-agreement-1`],
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'https://example.com/endpoint',
            accept: ['didcomm/aip2;env=rfc19'],
          }),
          new NewDidCommV2Service({
            id: `${did}#didcomm-messaging-1`,
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              accept: ['didcomm/v2'],
              routingKeys: ['a-routing-key'],
              uri: 'https://example.com/endpoint',
            }),
          }),
        ],
      },
    })) as IndyVdrDidCreateResult

    const didState = didCreateTobeEndorsedResult.didState
    if (didState.state !== 'action' || didState.action !== 'endorseIndyTransaction') throw Error('unexpected did state')

    const signedNymRequest = await endorser.modules.indyVdr.endorseTransaction(
      didState.nymRequest,
      didState.endorserDid
    )

    if (!didState.attribRequest) throw Error('attrib request not found')
    const endorsedAttribRequest = await endorser.modules.indyVdr.endorseTransaction(
      didState.attribRequest,
      didState.endorserDid
    )

    const didCreateSubmitResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserMode: 'external',
        endorsedTransaction: {
          nymRequest: signedNymRequest,
          attribRequest: endorsedAttribRequest,
        },
      },
    })

    const expectedDidDocument = {
      '@context': [
        'https://w3id.org/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://w3id.org/security/suites/x25519-2019/v1',
        'https://didcomm.org/messaging/contexts/v2',
      ],
      id: did,
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          type: 'Ed25519VerificationKey2018',
          controller: did,
          id: `${did}#verkey`,
          publicKeyBase58: ed25519PublicKeyBase58,
        },
        {
          type: 'X25519KeyAgreementKey2019',
          controller: did,
          id: `${did}#key-agreement-1`,
          publicKeyBase58: x25519PublicKeyBase58,
        },
      ],
      capabilityDelegation: undefined,
      capabilityInvocation: undefined,
      authentication: [`${did}#verkey`],
      service: [
        {
          id: `${did}#endpoint`,
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'endpoint',
        },
        {
          accept: ['didcomm/aip2;env=rfc19'],
          id: `${did}#did-communication`,
          priority: 0,
          recipientKeys: [`${did}#key-agreement-1`],
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'did-communication',
        },
        {
          id: `${did}#didcomm-messaging-1`,
          serviceEndpoint: {
            uri: 'https://example.com/endpoint',
            routingKeys: ['a-routing-key'],
            accept: ['didcomm/v2'],
          },
          type: 'DIDCommMessaging',
        },
      ],
    }

    if (didCreateSubmitResult.didState.state !== 'finished') {
      throw new Error(`Unexpected did state, ${JSON.stringify(didCreateSubmitResult.didState, null, 2)}`)
    }

    expect(JsonTransformer.toJSON(didCreateSubmitResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did,
        didDocument: expectedDidDocument,
      },
    })

    // Tries to call it in an interval until it succeeds (with maxAttempts)
    // As the ledger write is not always consistent in how long it takes
    // to write the data, we need to retry until we get a result.
    const didDocument = await retryUntilResult(async () => {
      const result = await endorser.dids.resolve(did)
      return result.didDocument
    })

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(expectedDidDocument)
  })
})
