import type { IndySdkSovDidCreateOptions } from '../src/dids/IndySdkSovDidRegistrar'

import { Agent, TypedArrayEncoder, convertPublicKeyToX25519, JsonTransformer } from '@aries-framework/core'
import { getAgentOptions, genesisPath } from '@aries-framework/core/tests/helpers'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'

import { indyDidFromPublicKeyBase58 } from '../src/utils/did'

const agentOptions = getAgentOptions('Faber Dids Registrar', {
  indyLedgers: [
    {
      id: `localhost`,
      isProduction: false,
      genesisPath,
      indyNamespace: 'localhost',
      transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
    },
  ],
})

describe('dids', () => {
  let agent: Agent

  beforeAll(async () => {
    agent = new Agent(agentOptions)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a did:sov did', async () => {
    // Generate a seed and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const seed = Array(32 + 1)
      .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
      .slice(0, 32)

    const publicKeyEd25519 = generateKeyPairFromSeed(TypedArrayEncoder.fromString(seed)).publicKey
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(publicKeyEd25519))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicKeyEd25519)
    const indyDid = indyDidFromPublicKeyBase58(ed25519PublicKeyBase58)

    const did = await agent.dids.create<IndySdkSovDidCreateOptions>({
      method: 'sov',
      options: {
        submitterDid: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
        alias: 'Alias',
        endpoints: {
          endpoint: 'https://example.com/endpoint',
          types: ['DIDComm', 'did-communication', 'endpoint'],
          routingKeys: ['a-routing-key'],
        },
      },
      secret: {
        seed,
      },
    })

    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocumentMetadata: {
        qualifiedIndyDid: `did:indy:localhost:${indyDid}`,
      },
      didRegistrationMetadata: {
        didIndyNamespace: 'localhost',
      },
      didState: {
        state: 'finished',
        did: `did:sov:${indyDid}`,
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
            'https://didcomm.org/messaging/contexts/v2',
          ],
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              id: `did:sov:${indyDid}#key-1`,
              type: 'Ed25519VerificationKey2018',
              controller: `did:sov:${indyDid}`,
              publicKeyBase58: ed25519PublicKeyBase58,
            },
            {
              id: `did:sov:${indyDid}#key-agreement-1`,
              type: 'X25519KeyAgreementKey2019',
              controller: `did:sov:${indyDid}`,
              publicKeyBase58: x25519PublicKeyBase58,
            },
          ],
          service: [
            {
              id: `did:sov:${indyDid}#endpoint`,
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              accept: ['didcomm/aip2;env=rfc19'],
              id: `did:sov:${indyDid}#did-communication`,
              priority: 0,
              recipientKeys: [`did:sov:${indyDid}#key-agreement-1`],
              routingKeys: ['a-routing-key'],
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
            },
            {
              accept: ['didcomm/v2'],
              id: `did:sov:${indyDid}#didcomm-1`,
              routingKeys: ['a-routing-key'],
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
            },
          ],
          authentication: [`did:sov:${indyDid}#key-1`],
          assertionMethod: [`did:sov:${indyDid}#key-1`],
          keyAgreement: [`did:sov:${indyDid}#key-agreement-1`],
          capabilityInvocation: undefined,
          capabilityDelegation: undefined,
          id: `did:sov:${indyDid}`,
        },
        secret: {
          seed,
        },
      },
    })
  })
})
