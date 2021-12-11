import { Agent } from '../src/agent/Agent'

import { getBaseConfig } from './helpers'

const { config, agentDependencies } = getBaseConfig('Faber Dids', {})

describe('dids', () => {
  let agent: Agent

  beforeAll(async () => {
    agent = new Agent(config, agentDependencies)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown({
      deleteWallet: true,
    })
  })

  it('should resolve a did:sov did', async () => {
    const did = await agent.dids.resolve(`did:sov:TL1EaPFCZ8Si5aUrqScBDt`)

    expect(did).toEqual({
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
            id: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt#key-1',
            publicKeyBase58: 'FMGcFuU3QwAQLywxvmEnSorQT3NwU9wgDMMTaDFtvswm',
          },
          {
            controller: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
            type: 'X25519KeyAgreementKey2019',
            id: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt#key-agreement-1',
            publicKeyBase58: '6oKfyWDYRpbutQWDUu8ots6GoqAZJ9HYRzPuuEiqfyM',
          },
        ],
        capabilityDelegation: [],
        capabilityInvocation: [],
        authentication: ['did:sov:TL1EaPFCZ8Si5aUrqScBDt#key-1'],
        assertionMethod: ['did:sov:TL1EaPFCZ8Si5aUrqScBDt#key-1'],
        keyAgreement: ['did:sov:TL1EaPFCZ8Si5aUrqScBDt#key-agreement-1'],
        service: [],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })

  it('should resolve a did:key did', async () => {
    const did = await agent.dids.resolve('did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')

    expect(did).toEqual({
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        verificationMethod: [
          {
            id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            type: 'Ed25519VerificationKey2018',
            controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            publicKeyBase58: '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx',
          },
          {
            id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6LSrdqo4M24WRDJj1h2hXxgtDTyzjjKCiyapYVgrhwZAySn',
            type: 'X25519KeyAgreementKey2019',
            controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            publicKeyBase58: 'FxfdY3DCQxVZddKGAtSjZdFW9bCCW7oRwZn1NFJ2Tbg2',
          },
        ],
        authentication: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        assertionMethod: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        capabilityInvocation: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        capabilityDelegation: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        keyAgreement: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6LSrdqo4M24WRDJj1h2hXxgtDTyzjjKCiyapYVgrhwZAySn',
        ],
        service: [],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
