import type { IndyVdrDidCreateOptions, IndyVdrDidCreateResult } from '../src/dids/IndyVdrIndyDidRegistrar'

import { didIndyRegex } from '@aries-framework/anoncreds'
import {
  Key,
  JsonTransformer,
  KeyType,
  TypedArrayEncoder,
  DidCommV1Service,
  DidCommV2Service,
  DidDocumentService,
  Agent,
  DidsModule,
} from '@aries-framework/core'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { convertPublicKeyToX25519, generateKeyPairFromSeed } from '@stablelib/ed25519'

import { sleep } from '../../core/src/utils/sleep'
import { getAgentOptions, importExistingIndyDidFromPrivateKey } from '../../core/tests/helpers'
import { IndySdkModule } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { IndyVdrModule, IndyVdrSovDidResolver } from '../src'
import { IndyVdrIndyDidRegistrar } from '../src/dids/IndyVdrIndyDidRegistrar'
import { IndyVdrIndyDidResolver } from '../src/dids/IndyVdrIndyDidResolver'
import { indyDidFromNamespaceAndInitialKey } from '../src/dids/didIndyUtil'

import { indyVdrModuleConfig } from './helpers'

const endorser = new Agent(
  getAgentOptions(
    'Indy VDR Indy DID Registrar',
    {},
    {
      indyVdr: new IndyVdrModule({
        networks: indyVdrModuleConfig.networks,
        indyVdr,
      }),
      indySdk: new IndySdkModule({
        indySdk,
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
    {
      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: indyVdrModuleConfig.networks,
      }),
      indySdk: new IndySdkModule({
        indySdk,
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
    await endorser.wallet.delete()
    await agent.shutdown()
    await agent.wallet.delete()
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

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResolutionResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResolutionResult)).toMatchObject({
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
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${did}#verkey`],
        service: undefined,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('can register a did:indy without services with endorser', async () => {
    const didCreateTobeEndorsedResult = (await agent.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        endorserMode: 'external',
        endorserDid,
      },
    })) as IndyVdrDidCreateResult

    const didState = didCreateTobeEndorsedResult.didState
    if (didState.state !== 'action' || didState.action !== 'endorseIndyTransaction') throw Error('unexpected did state')

    const signedNymRequest = await endorser.modules.indyVdr.endorseTransaction(
      didState.nymRequest,
      didState.endorserDid
    )
    const didCreateSubmitResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did: didState.did,
      options: {
        endorserMode: 'external',
        endorsedTransaction: {
          nymRequest: signedNymRequest,
        },
      },
      secret: didState.secret,
    })

    expect(JsonTransformer.toJSON(didCreateSubmitResult)).toMatchObject({
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

    const did = didCreateSubmitResult.didState.did
    if (!did) throw Error('did not defined')

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResolutionResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResolutionResult)).toMatchObject({
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
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${did}#verkey`],
        service: undefined,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('can register an endorsed did:indy without services - did and verkey specified', async () => {
    // Generate a seed and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const seed = Array(32 + 1)
      .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
      .slice(0, 32)

    const keyPair = generateKeyPairFromSeed(TypedArrayEncoder.fromString(seed))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(keyPair.publicKey)

    const { did, verkey } = indyDidFromNamespaceAndInitialKey(
      'pool:localtest',
      Key.fromPublicKey(keyPair.publicKey, KeyType.Ed25519)
    )

    const didCreateTobeEndorsedResult = (await agent.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserDid,
        endorserMode: 'external',
        verkey,
      },
    })) as IndyVdrDidCreateResult

    const didState = didCreateTobeEndorsedResult.didState
    if (didState.state !== 'action' || didState.action !== 'endorseIndyTransaction') throw Error('unexpected did state')

    const signedNymRequest = await endorser.modules.indyVdr.endorseTransaction(
      didState.nymRequest,
      didState.endorserDid
    )
    const didCreateSubmitResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did: didState.did,
      options: {
        endorserMode: 'external',
        endorsedTransaction: {
          nymRequest: signedNymRequest,
        },
      },
      secret: didState.secret,
    })

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

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
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
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('can register a did:indy without services - did and verkey specified', async () => {
    // Generate a seed and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const seed = Array(32 + 1)
      .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
      .slice(0, 32)

    const keyPair = generateKeyPairFromSeed(TypedArrayEncoder.fromString(seed))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(keyPair.publicKey)

    const { did, verkey } = indyDidFromNamespaceAndInitialKey(
      'pool:localtest',
      Key.fromPublicKey(keyPair.publicKey, KeyType.Ed25519)
    )
    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserDid,
        endorserMode: 'internal',
        verkey,
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

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
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
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('can register a did:indy with services - did and verkey specified - using attrib endpoint', async () => {
    // Generate a private key and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
        .slice(0, 32)
    )

    const key = await endorser.wallet.createKey({ privateKey, keyType: KeyType.Ed25519 })
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(key.publicKey))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(key.publicKey)

    const { did, verkey } = indyDidFromNamespaceAndInitialKey(
      'pool:localtest',
      Key.fromPublicKey(key.publicKey, KeyType.Ed25519)
    )

    const didRegistrationResult = await endorser.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserDid,
        endorserMode: 'internal',
        useEndpointAttrib: true,
        verkey,
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
          new DidCommV2Service({
            accept: ['didcomm/v2'],
            id: `${did}#didcomm-1`,
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'https://example.com/endpoint',
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
          accept: ['didcomm/v2'],
          id: `${did}#didcomm-1`,
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'DIDComm',
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

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: expectedDidDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('can register an endorsed did:indy with services - did and verkey specified - using attrib endpoint', async () => {
    // Generate a private key and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
        .slice(0, 32)
    )

    const key = await endorser.wallet.createKey({ privateKey, keyType: KeyType.Ed25519 })
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(key.publicKey))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(key.publicKey)

    const { did, verkey } = indyDidFromNamespaceAndInitialKey(
      'pool:localtest',
      Key.fromPublicKey(key.publicKey, KeyType.Ed25519)
    )

    const didCreateTobeEndorsedResult = (await endorser.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        endorserMode: 'external',
        endorserDid: endorserDid,
        useEndpointAttrib: true,
        verkey,
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
          new DidCommV2Service({
            accept: ['didcomm/v2'],
            id: `${did}#didcomm-1`,
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'https://example.com/endpoint',
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
      did: didState.did,
      options: {
        endorserMode: 'external',
        endorsedTransaction: {
          nymRequest: signedNymRequest,
          attribRequest: endorsedAttribRequest,
        },
      },
      secret: didState.secret,
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
          accept: ['didcomm/v2'],
          id: `${did}#didcomm-1`,
          routingKeys: ['a-routing-key'],
          serviceEndpoint: 'https://example.com/endpoint',
          type: 'DIDComm',
        },
      ],
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
    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    const didResult = await endorser.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: expectedDidDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
