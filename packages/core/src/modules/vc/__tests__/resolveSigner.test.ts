import { DidDocument, getJsonWebKey2020, VerificationMethod } from '../../dids'
import { tryParseDid } from '../../dids/domain/parse'
import { didDocumentToNumAlgo4Did, didToNumAlgo4DidDocument } from '../../dids/methods/peer/peerDidNumAlgo4'
import { KnownJwaSignatureAlgorithms, PublicJwk } from '../../kms'
import {
  resolveCredentialSubjectVerificationMethod,
  resolveJwtSigner,
  resolveSigner,
  validateSignerIsExpectedParty,
} from '../resolveSigner'
import { validateCredentialSubjectAuthentication } from '../util'

const publicJwk = PublicJwk.fromPublicJwk({
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'F6U3eXzNU3BnKulURQExKNRpcbE5o2Ke4eejv9oOaXU',
})

const issuerDid = 'did:web:issuer.example'
const signerDid = 'did:web:signer.example'

function createVerificationMethod(did: string, controller = did) {
  return new VerificationMethod({
    ...getJsonWebKey2020({ did, verificationMethodId: `${did}#key-1`, publicJwk }),
    controller,
  })
}

function createAgentContext(...didDocuments: DidDocument[]) {
  return {
    dependencyManager: {
      resolve: () => ({
        resolveDidDocument: async (didUrl: string) => {
          const didDocument = didDocuments.find(({ id }) => id === tryParseDid(didUrl)?.did)
          if (!didDocument) throw new Error(`Unable to resolve did document for did '${didUrl}'`)
          return didDocument
        },
      }),
    },
  } as never
}

const issuerVerificationMethod = createVerificationMethod(issuerDid)
const issuerDocument = new DidDocument({
  id: issuerDid,
  verificationMethod: [issuerVerificationMethod],
  assertionMethod: [issuerVerificationMethod.id],
})

// The signer's DID document names the issuer as the controller of its key
const signerVerificationMethod = createVerificationMethod(signerDid, issuerDid)
const signerDocument = new DidDocument({
  id: signerDid,
  verificationMethod: [signerVerificationMethod],
  assertionMethod: [signerVerificationMethod.id],
})

const agentContext = createAgentContext(issuerDocument, signerDocument)

describe('resolveSigner', () => {
  test('returns the DID of the document that lists and controls the verification method', async () => {
    await expect(resolveSigner(agentContext, issuerVerificationMethod.id, ['assertionMethod'])).resolves.toEqual({
      verificationMethod: issuerVerificationMethod,
      verificationMethodId: issuerVerificationMethod.id,
      signer: issuerDid,
    })
  })

  test('returns the absolute id of a verification method the DID document lists with a relative id', async () => {
    const { longFormDid } = didDocumentToNumAlgo4Did(
      new DidDocument({
        id: 'did:peer:4',
        verificationMethod: [
          new VerificationMethod(getJsonWebKey2020({ did: 'did:peer:4', verificationMethodId: '#key-1', publicJwk })),
        ],
        authentication: ['#key-1'],
      })
    )
    const peerDidDocument = didToNumAlgo4DidDocument(longFormDid)

    const resolved = await resolveSigner(createAgentContext(peerDidDocument), `${longFormDid}#key-1`, [
      'authentication',
    ])

    expect(resolved.verificationMethod.id).toBe('#key-1')
    expect(resolved.verificationMethodId).toBe(`${longFormDid}#key-1`)
  })

  test('rejects a verification method controlled by another DID', async () => {
    await expect(resolveSigner(agentContext, signerVerificationMethod.id, ['assertionMethod'])).rejects.toThrow(
      `Verification method '${signerVerificationMethod.id}' is controlled by '${issuerDid}', not by the DID document '${signerDid}' it is listed in`
    )
  })

  test('rejects a long-form did:peer:4 whose key names another DID as controller', async () => {
    // A long-form did:peer:4 resolves offline to the document it encodes, controller included
    const { longFormDid } = didDocumentToNumAlgo4Did(
      new DidDocument({
        id: 'did:peer:4',
        verificationMethod: [
          new VerificationMethod({
            ...getJsonWebKey2020({ did: 'did:peer:4', verificationMethodId: '#key-1', publicJwk }),
            controller: issuerDid,
          }),
        ],
        authentication: ['#key-1'],
      })
    )
    const peerDidDocument = didToNumAlgo4DidDocument(longFormDid)
    const verificationMethodId = `${longFormDid}#key-1`

    await expect(
      resolveSigner(createAgentContext(peerDidDocument), verificationMethodId, ['authentication'])
    ).rejects.toThrow(`is controlled by '${issuerDid}', not by the DID document '${longFormDid}' it is listed in`)
  })

  test('rejects a verification method that is not listed under the purpose', async () => {
    await expect(resolveSigner(agentContext, issuerVerificationMethod.id, ['authentication'])).rejects.toThrow(
      'Unable to locate verification method'
    )
  })
})

describe('resolveJwtSigner', () => {
  const alg = KnownJwaSignatureAlgorithms.EdDSA
  const purpose = ['assertionMethod' as const]

  test('resolves a relative kid against the iss', async () => {
    await expect(
      resolveJwtSigner(agentContext, { kid: '#key-1', iss: issuerDid, alg, purpose })
    ).resolves.toMatchObject({
      signer: issuerDid,
    })
  })

  test('resolves an absolute kid without iss', async () => {
    await expect(
      resolveJwtSigner(agentContext, { kid: issuerVerificationMethod.id, alg, purpose })
    ).resolves.toMatchObject({ signer: issuerDid })
  })

  test('resolves the only key for the alg of the iss when there is no kid', async () => {
    await expect(resolveJwtSigner(agentContext, { iss: issuerDid, alg, purpose })).resolves.toMatchObject({
      signer: issuerDid,
    })
  })

  test('rejects an absolute kid of another DID than the iss', async () => {
    const otherVerificationMethod = createVerificationMethod(signerDid)
    const otherAgentContext = createAgentContext(
      issuerDocument,
      new DidDocument({
        id: signerDid,
        verificationMethod: [otherVerificationMethod],
        assertionMethod: [otherVerificationMethod.id],
      })
    )

    await expect(
      resolveJwtSigner(otherAgentContext, { kid: otherVerificationMethod.id, iss: issuerDid, alg, purpose })
    ).rejects.toThrow(`JWT is signed by '${signerDid}', but its 'iss' is '${issuerDid}'`)
  })

  test('rejects an absolute kid without iss that is controlled by another DID', async () => {
    await expect(resolveJwtSigner(agentContext, { kid: signerVerificationMethod.id, alg, purpose })).rejects.toThrow(
      `is controlled by '${issuerDid}', not by the DID document '${signerDid}' it is listed in`
    )
  })

  test('rejects a JWT without kid and iss', async () => {
    await expect(resolveJwtSigner(agentContext, { alg, purpose })).rejects.toThrow(
      `JWT 'iss' MUST be present in payload when no 'kid' is specified`
    )
  })
})

describe('validateSignerIsExpectedParty', () => {
  const signer = {
    verificationMethod: issuerVerificationMethod,
    verificationMethodId: issuerVerificationMethod.id,
    signer: issuerDid,
  }

  test('passes when the expected party is the signer, or there is none', () => {
    expect(validateSignerIsExpectedParty(signer, issuerDid, 'issuer')).toEqual({ isValid: true })
    expect(validateSignerIsExpectedParty(signer, undefined, 'holder')).toEqual({ isValid: true })
  })

  test('fails when the expected party is not the signer', () => {
    expect(validateSignerIsExpectedParty(signer, signerDid, 'holder')).toMatchObject({
      isValid: false,
      error: {
        message: `Presentation is signed using verification method ${issuerVerificationMethod.id}, while the holder of the presentation is '${signerDid}'`,
      },
    })
  })
})

describe('resolveCredentialSubjectVerificationMethod', () => {
  const holderDid = 'did:web:holder.example'
  const [firstMethod, secondMethod] = ['key-1', 'key-2'].map(
    (keyId) =>
      new VerificationMethod(
        getJsonWebKey2020({ did: holderDid, verificationMethodId: `${holderDid}#${keyId}`, publicJwk })
      )
  )
  const holderContext = createAgentContext(
    new DidDocument({
      id: holderDid,
      verificationMethod: [firstMethod, secondMethod],
      authentication: [firstMethod.id, secondMethod.id],
      assertionMethod: [`${holderDid}#key-3`],
    })
  )

  test('returns the first authentication method for a DID', async () => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, holderDid)).resolves.toEqual({
      verificationMethod: firstMethod,
      verificationMethodId: firstMethod.id,
      signer: holderDid,
    })
  })

  test('returns the authentication method a DID URL names', async () => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, secondMethod.id)).resolves.toEqual({
      verificationMethod: secondMethod,
      verificationMethodId: secondMethod.id,
      signer: holderDid,
    })
  })

  test('returns the absolute id of a method the DID document lists with a relative id', async () => {
    const { longFormDid } = didDocumentToNumAlgo4Did(
      new DidDocument({
        id: 'did:peer:4',
        verificationMethod: [
          new VerificationMethod(getJsonWebKey2020({ did: 'did:peer:4', verificationMethodId: '#key-1', publicJwk })),
        ],
        authentication: ['#key-1'],
      })
    )

    const resolved = await resolveCredentialSubjectVerificationMethod(
      createAgentContext(didToNumAlgo4DidDocument(longFormDid)),
      longFormDid
    )

    expect(resolved.verificationMethodId).toBe(`${longFormDid}#key-1`)
  })

  test('rejects a DID URL that is not an authentication method', async () => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, `${holderDid}#key-3`)).rejects.toThrow(
      `credentialSubject.id '${holderDid}#key-3' names a verification method that is not an authentication method of ${holderDid}`
    )
  })

  test('rejects a DID URL that is not in the DID document', async () => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, `${holderDid}#key-4`)).rejects.toThrow(
      `credentialSubject.id '${holderDid}#key-4' names a verification method that is not in the DID document of ${holderDid}`
    )
  })

  test('rejects a credentialSubject.id that is not a DID', async () => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, 'urn:uuid:1234')).rejects.toThrow(
      'Only dids are supported as credentialSubject id'
    )
  })

  test.each([
    ['a query', `${holderDid}?versionId=1#key-2`],
    ['a query', `${holderDid}?versionId=1`],
    ['a path', `${holderDid}/path#key-2`],
    ['an empty fragment', `${holderDid}#`],
  ])('rejects a credentialSubject.id with %s: %s', async (problem, subjectId) => {
    await expect(resolveCredentialSubjectVerificationMethod(holderContext, subjectId)).rejects.toThrow(
      `credentialSubject.id '${subjectId}' must be a DID`
    )
  })

  test.each([holderDid, `${holderDid}#key-2`])(
    'resolves a key for %s that validateCredentialSubjectAuthentication accepts',
    async (subjectId) => {
      const resolved = await resolveCredentialSubjectVerificationMethod(holderContext, subjectId)
      expect(validateCredentialSubjectAuthentication([subjectId], resolved)).toEqual({ isValid: true })
    }
  )

  // DID Core allows any DID URL as a verification method id, not only one with a fragment
  const createContextWithAuthenticationMethod = (methodId: string) => {
    const method = new VerificationMethod({
      ...getJsonWebKey2020({ did: holderDid, verificationMethodId: `${holderDid}#key-1`, publicJwk }),
      id: methodId,
    })
    return createAgentContext(
      new DidDocument({ id: holderDid, verificationMethod: [method], authentication: [method.id] })
    )
  }

  test.each([
    ['a path', `${holderDid}/keys/1`],
    ['no #', 'key-1'],
  ])(
    'resolves a key for the DID that validateCredentialSubjectAuthentication accepts, when the authentication method id has %s',
    async (_, methodId) => {
      const resolved = await resolveCredentialSubjectVerificationMethod(
        createContextWithAuthenticationMethod(methodId),
        holderDid
      )

      expect(resolved.verificationMethodId).toBe(methodId)
      expect(validateCredentialSubjectAuthentication([holderDid], resolved)).toEqual({ isValid: true })
    }
  )

  test('rejects a credentialSubject.id that names an authentication method by a path, when signing and verifying', async () => {
    const methodId = `${holderDid}/keys/1`

    await expect(
      resolveCredentialSubjectVerificationMethod(createContextWithAuthenticationMethod(methodId), methodId)
    ).rejects.toThrow(`credentialSubject.id '${methodId}' must be a DID`)
    const result = validateCredentialSubjectAuthentication([methodId], {
      signer: holderDid,
      verificationMethodId: methodId,
    })
    expect(result.isValid).toBe(false)
    expect(result.error?.message).toContain(`credentialSubject.id '${methodId}' must be a DID`)
  })
})
