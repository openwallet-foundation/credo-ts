import { DidsModule, Agent, TypedArrayEncoder, JsonTransformer } from '@aries-framework/core'

import { getAgentOptions, importExistingIndyDidFromPrivateKey } from '../../core/tests/helpers'
import { IndySdkModule } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { IndyVdrModule } from '../src'
import { IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrSovDidResolver } from '../src/dids'
import { parseIndyDid } from '../src/dids/didIndyUtil'

import { createDidOnLedger, indyVdrModuleConfig } from './helpers'

const agent = new Agent(
  getAgentOptions(
    'Indy VDR Sov DID resolver',
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

describe('Indy VDR Sov DID Resolver', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('resolve a did:sov did', async () => {
    const did = 'did:sov:TL1EaPFCZ8Si5aUrqScBDt'
    const didResult = await agent.dids.resolve(did)

    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: {
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: did,
        alsoKnownAs: undefined,
        controller: undefined,
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: did,
            id: `${did}#key-1`,
            publicKeyBase58: expect.any(String),
          },
          {
            controller: did,
            type: 'X25519KeyAgreementKey2019',
            id: `${did}#key-agreement-1`,
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${did}#key-1`],
        assertionMethod: [`${did}#key-1`],
        keyAgreement: [`${did}#key-agreement-1`],
        service: undefined,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  test('resolve a did with endpoints', async () => {
    const unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      agent,
      TypedArrayEncoder.fromString('000000000000000000000000Trustee9')
    )

    // First we need to create a new DID and add ATTRIB endpoint to it
    const { did } = await createDidOnLedger(agent, `did:indy:pool:localtest:${unqualifiedSubmitterDid}`)
    const { namespaceIdentifier } = parseIndyDid(did)
    const sovDid = `did:sov:${namespaceIdentifier}`

    // DID created. Now resolve it
    const didResult = await agent.dids.resolve(sovDid)

    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: {
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
          'https://didcomm.org/messaging/contexts/v2',
        ],
        id: sovDid,
        alsoKnownAs: undefined,
        controller: undefined,
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: sovDid,
            id: `${sovDid}#key-1`,
            publicKeyBase58: expect.any(String),
          },
          {
            controller: sovDid,
            type: 'X25519KeyAgreementKey2019',
            id: `${sovDid}#key-agreement-1`,
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${sovDid}#key-1`],
        assertionMethod: [`${sovDid}#key-1`],
        keyAgreement: [`${sovDid}#key-agreement-1`],
        service: [
          {
            id: `${sovDid}#endpoint`,
            serviceEndpoint: 'http://localhost:3000',
            type: 'endpoint',
          },
          {
            id: `${sovDid}#did-communication`,
            accept: ['didcomm/aip2;env=rfc19'],
            priority: 0,
            recipientKeys: [`${sovDid}#key-agreement-1`],
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'http://localhost:3000',
            type: 'did-communication',
          },
          {
            id: `${sovDid}#didcomm-1`,
            accept: ['didcomm/v2'],
            routingKeys: ['a-routing-key'],
            serviceEndpoint: 'http://localhost:3000',
            type: 'DIDComm',
          },
        ],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
