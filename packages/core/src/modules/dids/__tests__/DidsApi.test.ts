import { IndySdkModule } from '../../../../../indy-sdk/src'
import { indySdk } from '../../../../tests'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'

import { DidDocument, DidDocumentService, KeyType, TypedArrayEncoder } from '@aries-framework/core'

const agentOptions = getAgentOptions(
  'DidsApi',
  {},
  {
    indySdk: new IndySdkModule({
      indySdk,
    }),
  }
)

const agent = new Agent(agentOptions)

describe('DidsApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  test('import an existing did without providing a did document', async () => {
    const createKeySpy = jest.spyOn(agent.context.wallet, 'createKey')

    // Private key is for public key associated with did:key did
    const privateKey = TypedArrayEncoder.fromString('a-sample-seed-of-32-bytes-in-tot')
    const did = 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty'

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(0)

    await agent.dids.import({
      did,
      privateKeys: [
        {
          privateKey,
          keyType: KeyType.Ed25519,
        },
      ],
    })

    expect(createKeySpy).toHaveBeenCalledWith({
      privateKey,
      keyType: KeyType.Ed25519,
    })

    const createdDids = await agent.dids.getCreatedDids({
      did,
    })
    expect(createdDids).toHaveLength(1)

    expect(createdDids[0].getTags()).toEqual({
      did,
      legacyUnqualifiedDid: undefined,
      method: 'key',
      methodSpecificIdentifier: 'z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
      role: 'created',
    })

    expect(createdDids[0].toJSON()).toMatchObject({
      did,
      didDocument: {
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',

        verificationMethod: [
          {
            id: 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
            type: 'Ed25519VerificationKey2018',
            controller: 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
            publicKeyBase58: '5nKwL9aJ9kpnEE1pSsqvLMqDnE1ubeBr4TjzC56roC7b',
          },
        ],

        authentication: [
          'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
        ],
        assertionMethod: [
          'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
        ],
        keyAgreement: [
          {
            id: 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6LSd6ed6s6HGsVsDL9vyx3s1Vi2jQYsX9TqjqVFam2oz776',
            type: 'X25519KeyAgreementKey2019',
            controller: 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
            publicKeyBase58: '2RUTaZHRBQn87wnATJXuguVYtG1kpYHgrrma6JPHGjLL',
          },
        ],
        capabilityInvocation: [
          'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
        ],
        capabilityDelegation: [
          'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
        ],
      },
    })
  })

  test('import an existing did with providing a did document', async () => {
    const createKeySpy = jest.spyOn(agent.context.wallet, 'createKey')

    // Private key is for public key associated with did:key did
    const privateKey = TypedArrayEncoder.fromString('a-new-sample-seed-of-32-bytes-in')
    const did = 'did:peer:0z6Mkhu3G8viiebsWmCiSgWiQoCZrTeuX76oLDow81YNYvJQM'

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(0)

    await agent.dids.import({
      did,
      didDocument: new DidDocument({
        id: did,
      }),
      privateKeys: [
        {
          privateKey,
          keyType: KeyType.Ed25519,
        },
      ],
    })

    expect(createKeySpy).toHaveBeenCalledWith({
      privateKey,
      keyType: KeyType.Ed25519,
    })

    const createdDids = await agent.dids.getCreatedDids({
      did,
    })
    expect(createdDids).toHaveLength(1)

    expect(createdDids[0].getTags()).toEqual({
      did,
      legacyUnqualifiedDid: undefined,
      method: 'peer',
      methodSpecificIdentifier: '0z6Mkhu3G8viiebsWmCiSgWiQoCZrTeuX76oLDow81YNYvJQM',
      role: 'created',
    })

    expect(createdDids[0].toJSON()).toMatchObject({
      did,
      didDocument: {
        id: did,
      },
    })
  })

  test('can only overwrite if overwrite option is set', async () => {
    const did = 'did:example:123'
    const didDocument = new DidDocument({ id: did })
    const didDocument2 = new DidDocument({
      id: did,
      service: [new DidDocumentService({ id: 'did:example:123#service', type: 'test', serviceEndpoint: 'test' })],
    })

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(0)

    // First import, should work
    await agent.dids.import({
      did,
      didDocument,
    })

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(1)
    expect(
      agent.dids.import({
        did,
        didDocument: didDocument2,
      })
    ).rejects.toThrowError(
      "A created did did:example:123 already exists. If you want to override the existing did, set the 'overwrite' option to update the did."
    )

    // Should not have stored the updated record
    const createdDids = await agent.dids.getCreatedDids({ did })
    expect(createdDids[0].didDocument?.service).toBeUndefined()

    // Should work, overwrite is set
    await agent.dids.import({
      did,
      didDocument: didDocument2,
      overwrite: true,
    })

    // Should not have stored the updated record
    const createdDidsOverwrite = await agent.dids.getCreatedDids({ did })
    expect(createdDidsOverwrite[0].didDocument?.service).toHaveLength(1)
  })

  test('providing privateKeys that already exist is allowd', async () => {
    const privateKey = TypedArrayEncoder.fromString('another-samples-seed-of-32-bytes')

    const did = 'did:example:456'
    const didDocument = new DidDocument({ id: did })

    await agent.dids.import({
      did,
      didDocument,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey,
        },
      ],
    })

    // Provide the same key again, should work
    await agent.dids.import({
      did,
      didDocument,
      overwrite: true,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey,
        },
      ],
    })
  })
})
