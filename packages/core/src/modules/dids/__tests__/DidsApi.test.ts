import {
  createPeerDidDocumentFromServices,
  DidDocument,
  DidDocumentService,
  DidKey,
  type PeerDidCreateOptions,
  PeerDidNumAlgo,
  TypedArrayEncoder,
  VerificationMethod,
} from '@credo-ts/core'
import { transformPrivateKeyToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { PublicJwk } from '../../kms'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { isLongFormDidPeer4, isShortFormDidPeer4 } from '../methods/peer/peerDidNumAlgo4'
import { DidRepository } from '../repository'

const agentOptions = getAgentOptions('DidsApi', undefined, undefined, undefined, { requireDidcomm: true })

const agent = new Agent(agentOptions)

const createKmsKeyAndDidDocument = async () => {
  const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
  const didDocument = new DidKey(PublicJwk.fromUnknown(key.publicJwk)).didDocument
  const verificationMethod = didDocument.verificationMethod?.[0]
  if (!verificationMethod) throw new Error('Expected verification method for key')
  return { keyId: key.keyId, didDocument, verificationMethod }
}

describe('DidsApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('import an existing did without providing a did document', async () => {
    // Private key is for public key associated with did:key did
    const privateJwk = transformPrivateKeyToPrivateJwk({
      privateKey: TypedArrayEncoder.fromUtf8String('a-sample-seed-of-32-bytes-in-tot'),
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
    }).privateJwk
    const did = 'did:key:z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty'
    const importedKey = await agent.kms.importKey({
      privateJwk,
    })

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(0)

    await agent.dids.import({
      did,
      keys: [
        {
          didDocumentRelativeKeyId: '#z6MkjEayvPpjVJKFLirX8SomBTPDboHm1XSCkUev2M4siQty',
          kmsKeyId: importedKey.keyId,
        },
      ],
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
      alternativeDids: undefined,
      recipientKeyFingerprints: [],
    })

    expect(createdDids[0].toJSON()).toMatchObject({
      did,
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
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
    const did = 'did:peer:0z6Mkhu3G8viiebsWmCiSgWiQoCZrTeuX76oLDow81YNYvJQM'

    expect(await agent.dids.getCreatedDids({ did })).toHaveLength(0)

    await agent.dids.import({
      did,
      didDocument: new DidDocument({
        id: did,
      }),
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
      alternativeDids: undefined,
      recipientKeyFingerprints: [],
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
    await expect(
      agent.dids.import({
        did,
        didDocument: didDocument2,
      })
    ).rejects.toThrow(
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

  test('findAllByQuery can filter by custom tags', async () => {
    const did = 'did:example:tag-filter'
    const didRepository = agent.context.dependencyManager.resolve(DidRepository)

    await agent.dids.import({
      did,
      didDocument: new DidDocument({ id: did }),
    })

    const didRecord = await didRepository.findCreatedDid(agent.context, did)
    if (!didRecord) throw new Error(`Expected did record ${did} to exist`)

    didRecord.setTags({ domain: 'alice:foo' })
    await didRepository.update(agent.context, didRecord)

    const matching = await agent.dids.findAllByQuery({
      method: 'example',
      role: DidDocumentRole.Created,
      domain: 'alice:foo',
    })

    const nonMatching = await agent.dids.findAllByQuery({
      method: 'example',
      role: DidDocumentRole.Created,
      domain: 'alice:bar',
    })

    expect(matching.some((record) => record.did === did)).toBe(true)
    expect(nonMatching.some((record) => record.did === did)).toBe(false)
  })

  test('create and resolve did:peer:4 in short and long form', async () => {
    const routing = await agent.didcomm.mediationRecipient.getRouting({})
    const { didDocument, keys } = createPeerDidDocumentFromServices(
      [
        {
          id: 'didcomm',
          recipientKeys: [routing.recipientKey],
          routingKeys: routing.routingKeys,
          serviceEndpoint: routing.endpoints[0],
        },
      ],
      true
    )

    const result = await agent.dids.create<PeerDidCreateOptions>({
      method: 'peer',
      didDocument,
      options: {
        numAlgo: PeerDidNumAlgo.ShortFormAndLongForm,
        keys,
      },
    })

    const longFormDid = result.didState.did
    const shortFormDid = result.didState.didDocument?.alsoKnownAs
      ? result.didState.didDocument?.alsoKnownAs[0]
      : undefined

    if (!longFormDid) throw new Error('Long form did not defined')
    if (!shortFormDid) throw new Error('Short form did not defined')

    expect(isLongFormDidPeer4(longFormDid)).toBeTruthy()
    expect(isShortFormDidPeer4(shortFormDid)).toBeTruthy()

    const didDocumentFromLongFormDid = await agent.dids.resolveDidDocument(longFormDid)
    const didDocumentFromShortFormDid = await agent.dids.resolveDidDocument(shortFormDid)

    expect(didDocumentFromLongFormDid).toEqual(didDocumentFromShortFormDid)
  })

  test('getKeyIdFromCreatedDidRecord returns the explicitly mapped KMS key ID', async () => {
    const { keyId, didDocument, verificationMethod } = await createKmsKeyAndDidDocument()
    await agent.dids.import({
      did: didDocument.id,
      keys: [{ didDocumentRelativeKeyId: `#${verificationMethod.id.split('#')[1]}`, kmsKeyId: keyId }],
    })

    expect(await agent.dids.getKeyIdFromCreatedDidRecord(didDocument.id, verificationMethod)).toBe(keyId)
  })

  test('getKeyIdFromCreatedDidRecord rejects a DID without a created-DID record', async () => {
    const { didDocument, verificationMethod } = await createKmsKeyAndDidDocument()
    await expect(agent.dids.getKeyIdFromCreatedDidRecord(didDocument.id, verificationMethod)).rejects.toThrow(
      'not found'
    )
  })

  test('getKeyIdFromCreatedDidRecord rejects a verification method without a local key mapping', async () => {
    const { didDocument, verificationMethod } = await createKmsKeyAndDidDocument()
    await agent.dids.import({ did: didDocument.id })

    await expect(agent.dids.getKeyIdFromCreatedDidRecord(didDocument.id, verificationMethod)).rejects.toThrow(
      'No locally managed key'
    )
  })

  test('getKeyIdFromCreatedDidRecord rejects a mapped key that does not match the verification method', async () => {
    const { keyId, didDocument, verificationMethod } = await createKmsKeyAndDidDocument()
    await agent.dids.import({
      did: didDocument.id,
      keys: [{ didDocumentRelativeKeyId: `#${verificationMethod.id.split('#')[1]}`, kmsKeyId: keyId }],
    })
    const otherKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const otherMethod = new DidKey(PublicJwk.fromUnknown(otherKey.publicJwk)).didDocument.verificationMethod?.[0]
    if (!otherMethod) throw new Error('Expected verification method for other key')

    await expect(
      agent.dids.getKeyIdFromCreatedDidRecord(
        didDocument.id,
        new VerificationMethod({ ...otherMethod, id: verificationMethod.id, controller: didDocument.id })
      )
    ).rejects.toThrow('does not match verification method')
  })

  test('accepts an explicitly mapped legacy key ID', async () => {
    const privateJwk = transformPrivateKeyToPrivateJwk({
      privateKey: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000002'),
      type: { kty: 'OKP', crv: 'Ed25519' },
    }).privateJwk
    privateJwk.kid = PublicJwk.fromUnknown(privateJwk).legacyKeyId
    const importedKey = await agent.kms.importKey({ privateJwk })
    const didDocument = new DidKey(PublicJwk.fromUnknown(importedKey.publicJwk)).didDocument
    const verificationMethod = didDocument.verificationMethod?.[0]
    if (!verificationMethod) throw new Error('Expected verification method for legacy key')
    await agent.dids.import({
      did: didDocument.id,
      didDocument,
      keys: [{ didDocumentRelativeKeyId: `#${verificationMethod.id.split('#')[1]}`, kmsKeyId: importedKey.keyId }],
    })
    expect(await agent.dids.getKeyIdFromCreatedDidRecord(didDocument.id, verificationMethod)).toBe(
      PublicJwk.fromUnknown(importedKey.publicJwk).legacyKeyId
    )
  })
})
