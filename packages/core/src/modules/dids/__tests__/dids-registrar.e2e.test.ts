import type { KeyDidCreateOptions } from '../methods/key/KeyDidRegistrar'
import type { PeerDidNumAlgo0CreateOptions } from '../methods/peer/PeerDidRegistrar'

import { IndySdkModule } from '../../../../../indy-sdk/src'
import { indySdk } from '../../../../tests'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { KeyType } from '../../../crypto'
import { PeerDidNumAlgo } from '../methods/peer/didPeer'

import { JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'

const agentOptions = getAgentOptions(
  'Faber Dids Registrar',
  {},
  {
    indySdk: new IndySdkModule({
      indySdk,
    }),
  }
)

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

  it('should create a did:key did', async () => {
    const did = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: {
        keyType: KeyType.Ed25519,
      },
      secret: {
        privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
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
        secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
      },
    })
  })

  it('should create a did:peer did', async () => {
    const privateKey = TypedArrayEncoder.fromString('e008ef10b7c163114b3857542b3736eb')

    const did = await agent.dids.create<PeerDidNumAlgo0CreateOptions>({
      method: 'peer',
      options: {
        keyType: KeyType.Ed25519,
        numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc,
      },
      secret: {
        privateKey,
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
        secret: { privateKey },
      },
    })
  })
})
