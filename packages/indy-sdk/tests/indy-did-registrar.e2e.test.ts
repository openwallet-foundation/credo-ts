import type { IndySdkIndyDidCreateOptions } from '../src'

import { Agent, TypedArrayEncoder, convertPublicKeyToX25519, JsonTransformer } from '@aries-framework/core'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'

import { getAgentOptions, importExistingIndyDidFromPrivateKey, publicDidSeed } from '../../core/tests'
import { legacyIndyDidFromPublicKeyBase58 } from '../src/utils/did'

import { getIndySdkModules } from './setupIndySdkModule'

const agentOptions = getAgentOptions('Indy Sdk Indy Did Registrar', {}, getIndySdkModules())
const agent = new Agent(agentOptions)

describe('Indy SDK Indy Did Registrar', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a did:indy did', async () => {
    // Add existing endorser did to the wallet
    const unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      agent,
      TypedArrayEncoder.fromString(publicDidSeed)
    )

    // Generate a seed and the indy did. This allows us to create a new did every time
    // but still check if the created output document is as expected.
    const privateKey = TypedArrayEncoder.fromString(
      Array(32 + 1)
        .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
        .slice(0, 32)
    )

    const publicKeyEd25519 = generateKeyPairFromSeed(privateKey).publicKey
    const x25519PublicKeyBase58 = TypedArrayEncoder.toBase58(convertPublicKeyToX25519(publicKeyEd25519))
    const ed25519PublicKeyBase58 = TypedArrayEncoder.toBase58(publicKeyEd25519)
    const unqualifiedDid = legacyIndyDidFromPublicKeyBase58(ed25519PublicKeyBase58)

    const did = await agent.dids.create<IndySdkIndyDidCreateOptions>({
      method: 'indy',
      options: {
        submitterDid: `did:indy:pool:localtest:${unqualifiedSubmitterDid}`,
        alias: 'Alias',
        endpoints: {
          endpoint: 'https://example.com/endpoint',
          types: ['DIDComm', 'did-communication', 'endpoint'],
          routingKeys: ['a-routing-key'],
        },
      },
      secret: {
        privateKey,
      },
    })

    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: `did:indy:pool:localtest:${unqualifiedDid}`,
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
              id: `did:indy:pool:localtest:${unqualifiedDid}#verkey`,
              type: 'Ed25519VerificationKey2018',
              controller: `did:indy:pool:localtest:${unqualifiedDid}`,
              publicKeyBase58: ed25519PublicKeyBase58,
            },
            {
              id: `did:indy:pool:localtest:${unqualifiedDid}#key-agreement-1`,
              type: 'X25519KeyAgreementKey2019',
              controller: `did:indy:pool:localtest:${unqualifiedDid}`,
              publicKeyBase58: x25519PublicKeyBase58,
            },
          ],
          service: [
            {
              id: `did:indy:pool:localtest:${unqualifiedDid}#endpoint`,
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'endpoint',
            },
            {
              accept: ['didcomm/aip2;env=rfc19'],
              id: `did:indy:pool:localtest:${unqualifiedDid}#did-communication`,
              priority: 0,
              recipientKeys: [`did:indy:pool:localtest:${unqualifiedDid}#key-agreement-1`],
              routingKeys: ['a-routing-key'],
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'did-communication',
            },
            {
              accept: ['didcomm/v2'],
              id: `did:indy:pool:localtest:${unqualifiedDid}#didcomm-1`,
              routingKeys: ['a-routing-key'],
              serviceEndpoint: 'https://example.com/endpoint',
              type: 'DIDComm',
            },
          ],
          authentication: [`did:indy:pool:localtest:${unqualifiedDid}#verkey`],
          assertionMethod: undefined,
          keyAgreement: [`did:indy:pool:localtest:${unqualifiedDid}#key-agreement-1`],
          capabilityInvocation: undefined,
          capabilityDelegation: undefined,
          id: `did:indy:pool:localtest:${unqualifiedDid}`,
        },
        secret: {
          privateKey,
        },
      },
    })
  })
})
