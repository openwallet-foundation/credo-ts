import type { IndySdkSovDidCreateOptions } from '../src/dids/IndySdkSovDidRegistrar'

import { Agent, AriesFrameworkError, JsonTransformer } from '@aries-framework/core'

import { getAgentOptions } from '../../core/tests/helpers'

import { getIndySdkModules } from './setupIndySdkModule'

const agent = new Agent(getAgentOptions('Indy SDK Sov DID resolver', {}, getIndySdkModules()))

describe('Indy SDK Sov DID resolver', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should resolve a did:sov did', async () => {
    const createResult = await agent.dids.create<IndySdkSovDidCreateOptions>({
      method: 'sov',
      options: {
        submitterDid: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
        alias: 'Alias',
        role: 'TRUSTEE',
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
            id: `${createResult.didState.did}#key-1`,
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
        authentication: [`${createResult.didState.did}#key-1`],
        assertionMethod: [`${createResult.didState.did}#key-1`],
        keyAgreement: [`${createResult.didState.did}#key-agreement-1`],
        service: undefined,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
