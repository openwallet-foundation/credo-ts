import type { IndyVdrDidCreateOptions } from '../src/dids/IndyVdrIndyDidRegistrar'

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
import { convertPublicKeyToX25519, generateKeyPairFromSeed } from '@stablelib/ed25519'

import { getAgentOptions, importExistingIndyDidFromPrivateKey } from '../../core/tests/helpers'
import { IndySdkModule } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { IndyVdrModule, IndyVdrSovDidResolver } from '../src'
import { IndyVdrIndyDidRegistrar } from '../src/dids/IndyVdrIndyDidRegistrar'
import { IndyVdrIndyDidResolver } from '../src/dids/IndyVdrIndyDidResolver'
import { indyDidFromNamespaceAndInitialKey } from '../src/dids/didIndyUtil'
import { DID_INDY_REGEX } from '../src/utils/did'

import { indyVdrModuleConfig } from './helpers'

const agent = new Agent(
  getAgentOptions(
    'Indy VDR Indy DID Registrar',
    {},
    {
      indyVdr: new IndyVdrModule({
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
  let submitterDid: string

  beforeAll(async () => {
    await agent.initialize()
    const unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      agent,
      TypedArrayEncoder.fromString('000000000000000000000000Trustee9')
    )
    submitterDid = `did:indy:pool:localtest:${unqualifiedSubmitterDid}`
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('can register a did:indy without services', async () => {
    const didRegistrationResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      method: 'indy',
      options: {
        submitterDid,
      },
    })

    expect(JsonTransformer.toJSON(didRegistrationResult)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: expect.stringMatching(DID_INDY_REGEX),
        didDocument: {
          '@context': ['https://w3id.org/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
          id: expect.stringMatching(DID_INDY_REGEX),
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              type: 'Ed25519VerificationKey2018',
              controller: expect.stringMatching(DID_INDY_REGEX),
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

    const didResolutionResult = await agent.dids.resolve(did)
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
    const didRegistrationResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        submitterDid,
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

    const didResult = await agent.dids.resolve(did)
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

    const key = await agent.wallet.createKey({ privateKey, keyType: KeyType.Ed25519 })
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(key.publicKey))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(key.publicKey)

    const { did, verkey } = indyDidFromNamespaceAndInitialKey(
      'pool:localtest',
      Key.fromPublicKey(key.publicKey, KeyType.Ed25519)
    )

    const didRegistrationResult = await agent.dids.create<IndyVdrDidCreateOptions>({
      did,
      options: {
        submitterDid,
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

    const didResult = await agent.dids.resolve(did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: expectedDidDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
