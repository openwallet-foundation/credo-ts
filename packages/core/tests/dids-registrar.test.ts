import type { KeyDidCreateOptions } from '../src/modules/dids/methods/key/KeyDidRegistrar'
import type {
  PeerDidNumAlgo0CreateOptions,
  PeerDidNumAlgo1CreateOptions,
  PeerDidNumAlgo2CreateOptions,
} from '../src/modules/dids/methods/peer/PeerDidRegistrar'
import type { SovDidCreateOptions } from '../src/modules/dids/methods/sov/SovDidRegistrar'
import type { Wallet } from '@aries-framework/core'

import { Agent } from '../src/agent/Agent'
import { KeyType } from '../src/crypto'
import { DidCommService, DidDocumentBuilder } from '../src/modules/dids'
import { PeerDidNumAlgo } from '../src/modules/dids/methods/peer/DidPeer'

import { getBaseConfig } from './helpers'

import { InjectionSymbols, JsonTransformer } from '@aries-framework/core'

const { config, agentDependencies } = getBaseConfig('Faber Dids Registrar')

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
    const wallet = agent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)
    const did = await agent.dids.create<SovDidCreateOptions>({
      method: 'sov',
      options: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
        submitterDid: `did:sov:${wallet.publicDid?.did!}`,
        alias: 'Alias',
      },
      secret: {
        seed: '00000000000000000000000Trustee12',
      },
    })

    expect(JsonTransformer.toJSON(did)).toMatchObject({
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'finished',
        did: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn',
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
              id: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn#key-1',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn',
              publicKeyBase58: '8C1FUwFjnDcyv8BLYoLBiDf1aLQNcaVrNhDpKqPku9Hm',
            },
            {
              id: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn#key-agreement-1',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn',
              publicKeyBase58: '7c81W1wgTAGJWPkd44DSax8ZSxcLxwYhJDPixnSuzo64',
            },
          ],
          service: undefined,
          authentication: ['did:sov:EC6fzUPMjJ8cAA7XiUSrXn#key-1'],
          assertionMethod: ['did:sov:EC6fzUPMjJ8cAA7XiUSrXn#key-1'],
          keyAgreement: ['did:sov:EC6fzUPMjJ8cAA7XiUSrXn#key-agreement-1'],
          capabilityInvocation: undefined,
          capabilityDelegation: undefined,
          id: 'did:sov:EC6fzUPMjJ8cAA7XiUSrXn',
        },
        secret: {
          seed: '00000000000000000000000Trustee12',
        },
      },
    })
  })
})
