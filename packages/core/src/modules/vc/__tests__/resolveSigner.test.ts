import { DidDocument, getJsonWebKey2020, VerificationMethod } from '../../dids'
import { KnownJwaSignatureAlgorithms, PublicJwk } from '../../kms'
import { resolveJwtSigner, resolveSigner, validateSignerIsExpectedParty } from '../resolveSigner'

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
          const didDocument = didDocuments.find(({ id }) => id === didUrl.split('#')[0])
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
      signer: issuerDid,
    })
  })

  test('rejects a verification method controlled by another DID', async () => {
    await expect(resolveSigner(agentContext, signerVerificationMethod.id, ['assertionMethod'])).rejects.toThrow(
      `Verification method '${signerVerificationMethod.id}' is controlled by '${issuerDid}', not by the DID document '${signerDid}' it is listed in`
    )
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
  const signer = { verificationMethod: issuerVerificationMethod, signer: issuerDid }

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
