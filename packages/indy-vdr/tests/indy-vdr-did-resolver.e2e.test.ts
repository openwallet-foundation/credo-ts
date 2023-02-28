import { DidsModule, Agent, TypedArrayEncoder, JsonTransformer } from '@aries-framework/core'

import { parseDid } from '../../core/src/modules/dids/domain/parse'
import { getAgentOptions, importExistingIndyDidFromPrivateKey } from '../../core/tests/helpers'
import { IndySdkModule } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { IndyVdrModule } from '../src'
import { IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrSovDidResolver } from '../src/dids'
import { indyDidFromPublicKeyBase58 } from '../src/utils/did'

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

describe('indy-vdr DID Resolver E2E', () => {
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
    await importExistingIndyDidFromPrivateKey(agent, TypedArrayEncoder.fromString('000000000000000000000000Trustee9'))

    // First we need to create a new DID and add ATTRIB endpoint to it
    const { did } = await createDidOnLedger(
      indyVdrPoolService,
      agentContext,
      indyDidFromPublicKeyBase58(signerKey.publicKeyBase58),
      signerKey
    )

    // DID created. Now resolve it

    const fullyQualifiedDid = `did:sov:${did}`
    const didResult = await indyVdrSovDidResolver.resolve(agentContext, fullyQualifiedDid, parseDid(fullyQualifiedDid))
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: {
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
          'https://didcomm.org/messaging/contexts/v2',
        ],
        id: fullyQualifiedDid,
        alsoKnownAs: undefined,
        controller: undefined,
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: fullyQualifiedDid,
            id: `${fullyQualifiedDid}#key-1`,
            publicKeyBase58: expect.any(String),
          },
          {
            controller: fullyQualifiedDid,
            type: 'X25519KeyAgreementKey2019',
            id: `${fullyQualifiedDid}#key-agreement-1`,
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${fullyQualifiedDid}#key-1`],
        assertionMethod: [`${fullyQualifiedDid}#key-1`],
        keyAgreement: [`${fullyQualifiedDid}#key-agreement-1`],
        service: [
          {
            id: `${fullyQualifiedDid}#endpoint`,
            type: 'endpoint',
            serviceEndpoint: 'https://agent.com',
          },
          {
            id: `${fullyQualifiedDid}#did-communication`,
            type: 'did-communication',
            priority: 0,
            recipientKeys: [`${fullyQualifiedDid}#key-agreement-1`],
            routingKeys: ['routingKey1', 'routingKey2'],
            accept: ['didcomm/aip2;env=rfc19'],
            serviceEndpoint: 'https://agent.com',
          },
          {
            id: `${fullyQualifiedDid}#didcomm-1`,
            type: 'DIDComm',
            serviceEndpoint: 'https://agent.com',
            accept: ['didcomm/v2'],
            routingKeys: ['routingKey1', 'routingKey2'],
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
