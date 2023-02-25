import type { IndySdkIndyDidCreateOptions } from '../src'

import { Agent, AriesFrameworkError, JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'

import { getAgentOptions, importExistingIndyDidFromPrivateKey, publicDidSeed } from '../../core/tests/helpers'

import { getIndySdkModules } from './setupIndySdkModule'

const agent = new Agent(getAgentOptions('Indy SDK Indy DID resolver', {}, getIndySdkModules()))

describe('Indy SDK Indy DID resolver', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should resolve a did:indy did', async () => {
    // Add existing endorser did to the wallet
    const unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      agent,
      TypedArrayEncoder.fromString(publicDidSeed)
    )

    const createResult = await agent.dids.create<IndySdkIndyDidCreateOptions>({
      method: 'indy',
      options: {
        submitterDid: `did:indy:pool:localtest:${unqualifiedSubmitterDid}`,
        alias: 'Alias',
        role: 'TRUSTEE',
        endpoints: {
          endpoint: 'http://localhost:3000',
        },
      },
    })

    // Terrible, but the did can't be immediately resolved, so we need to wait a bit
    await new Promise((res) => setTimeout(res, 1000))

    if (!createResult.didState.did) throw new AriesFrameworkError('Unable to register did')

    const didResult = await agent.dids.resolve(createResult.didState.did)

    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: {
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: createResult.didState.did,
        alsoKnownAs: undefined,
        controller: undefined,
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: createResult.didState.did,
            id: `${createResult.didState.did}#verkey`,
            publicKeyBase58: expect.any(String),
          },
          {
            controller: createResult.didState.did,
            type: 'X25519KeyAgreementKey2019',
            id: `${createResult.didState.did}#key-agreement-1`,
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${createResult.didState.did}#verkey`],
        assertionMethod: undefined,
        keyAgreement: [`${createResult.didState.did}#key-agreement-1`],
        service: [
          {
            id: `${createResult.didState.did}#endpoint`,
            serviceEndpoint: 'http://localhost:3000',
            type: 'endpoint',
          },
          {
            id: `${createResult.didState.did}#did-communication`,
            accept: ['didcomm/aip2;env=rfc19'],
            priority: 0,
            recipientKeys: [`${createResult.didState.did}#key-agreement-1`],
            routingKeys: [],
            serviceEndpoint: 'http://localhost:3000',
            type: 'did-communication',
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
