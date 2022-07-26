import type { KeyDidCreateOptions } from '../methods/key/KeyDidRegistrar'
import type { PeerDidNumAlgo0CreateOptions } from '../methods/peer/PeerDidRegistrar'
import type { SovDidCreateOptions } from '../methods/sov/SovDidRegistrar'
import type { Wallet } from '@aries-framework/core'

import { convertPublicKeyToX25519, generateKeyPairFromSeed } from '@stablelib/ed25519'

import { genesisPath, getBaseConfig } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { KeyType } from '../../../crypto'
import { TypedArrayEncoder } from '../../../utils'
import { indyDidFromPublicKeyBase58 } from '../../../utils/did'
import { PeerDidNumAlgo } from '../methods/peer/didPeer'

import { InjectionSymbols, JsonTransformer } from '@aries-framework/core'

const { config, agentDependencies } = getBaseConfig('Faber Dids Registrar', {
  indyLedgers: [
    {
      id: `localhost`,
      isProduction: false,
      genesisPath,
      didIndyNamespace: 'localhost',
      transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
    },
  ],
})

describe('dids', () => {
  let agent: Agent

  beforeAll(async () => {
    agent = new Agent(config, agentDependencies)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a did:key did', async () => {
    const did = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: {
        keyType: KeyType.Ed25519,
      },
      secret: {
        seed: '96213c3d7fc8d4d6754c7a0fd969598e',
      },
    })

    // Same seed should resolve to same did:key
    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              id: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
              publicKeyBase58: 'ApA26cozGW5Maa62TNTwtgcxrb7bYjAmf9aQ5cYruCDE',
            },
          ],
          service: undefined,
          authentication: [
            'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
          ],
          assertionMethod: [
            'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
          ],
          keyAgreement: [
            {
              id: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6LSjDbRQQKm9HM4qPBErYyX93BCSzSk1XkwP5EgDrL6eNhh',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
              publicKeyBase58: '8YRFt6Wu3pdKjzoUKuTZpSxibqudJvanW6WzjPgZvzvw',
            },
          ],
          capabilityInvocation: [
            'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
          ],
          capabilityDelegation: [
            'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
          ],
          id: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
        },
        secret: { seed: '96213c3d7fc8d4d6754c7a0fd969598e' },
      },
    })
  })

  it('should create a did:peer did', async () => {
    const did = await agent.dids.create<PeerDidNumAlgo0CreateOptions>({
      method: 'peer',
      options: {
        keyType: KeyType.Ed25519,
        numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
      },
      secret: {
        seed: 'e008ef10b7c163114b3857542b3736eb',
      },
    })

    // Same seed should resolve to same did:peer
    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
        didDocument: {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          alsoKnownAs: undefined,
          controller: undefined,
          verificationMethod: [
            {
              id: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
              publicKeyBase58: 'GLsyPBT2AgMne8XUvmZKkqLUuFkSjLp3ibkcjc6gjhyK',
            },
          ],
          service: undefined,
          authentication: [
            'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
          ],
          assertionMethod: [
            'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
          ],
          keyAgreement: [
            {
              id: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6LSdqscQpQy12kNU1kYf7odtabo2Nhr3x3coUjsUZgwxwCj',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
              publicKeyBase58: '3AhStWc6ua2dNdNn8UHgZzPKBEAjMLsTvW2Bz73RFZRy',
            },
          ],
          capabilityInvocation: [
            'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
          ],
          capabilityDelegation: [
            'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh#z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
          ],
          id: 'did:peer:0z6Mkuo91yRhTWDrFkdNBcLXAbvtUiq2J9E4QQcfYZt4hevkh',
        },
        secret: { seed: 'e008ef10b7c163114b3857542b3736eb' },
      },
    })
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

    const wallet = agent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
    const submitterDid = `did:sov:${wallet.publicDid?.did!}`

    const did = await agent.dids.create<SovDidCreateOptions>({
      method: 'sov',
      options: {
        submitterDid,
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
        indyNamespace: 'localhost',
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
