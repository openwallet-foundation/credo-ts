import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { AskarKeyManagementService, AskarModuleConfig } from '../../../../../askar/src'
import { AskarStoreManager } from '../../../../../askar/src/AskarStoreManager'
import { NodeFileSystem } from '../../../../../node/src/NodeFileSystem'
import { getAgentConfig, getAgentContext, getAskarStoreConfig } from '../../../../tests/helpers'
import type { AgentContext } from '../../../agent/context'
import { MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { DidKey, DidsApi, parseDid } from '../../dids'
import { KeyManagementApi, PublicJwk } from '../../kms'
import { EcdsaJcs2019Cryptosuite } from '../cryptosuites/ecdsa-jcs-2019/EcdsaJcs2019Cryptosuite'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityUnsecuredDocument,
} from '../W3cDataIntegrityProof'

// W3C VC DI ECDSA v1.0, Appendix A.5 (P-256) and A.6 (P-384). Both use the same credential.
const specCredential: W3cDataIntegrityUnsecuredDocument = {
  '@context': ['https://www.w3.org/ns/credentials/v2', 'https://www.w3.org/ns/credentials/examples/v2'],
  id: 'urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33',
  type: ['VerifiableCredential', 'AlumniCredential'],
  name: 'Alumni Credential',
  description: 'A minimum viable example of an Alumni Credential.',
  issuer: 'https://vc.example/issuers/5678',
  validFrom: '2023-01-01T00:00:00Z',
  credentialSubject: {
    id: 'did:example:abcdefgh',
    alumniOf: 'The School of Examples',
  },
}

const specCanonicalCredential =
  '{"@context":["https://www.w3.org/ns/credentials/v2","https://www.w3.org/ns/credentials/examples/v2"],' +
  '"credentialSubject":{"alumniOf":"The School of Examples","id":"did:example:abcdefgh"},' +
  '"description":"A minimum viable example of an Alumni Credential.",' +
  '"id":"urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",' +
  '"issuer":"https://vc.example/issuers/5678",' +
  '"name":"Alumni Credential",' +
  '"type":["VerifiableCredential","AlumniCredential"],' +
  '"validFrom":"2023-01-01T00:00:00Z"}'

const specVectors = [
  {
    appendix: 'A.5',
    curve: 'P-256',
    signatureLength: 64,
    publicKeyMultibase: 'zDnaepBuvsQ8cpsWrVKw8fbpGpvPeNSjVPTWoq6cRqaYzBKVP',
    secretKeyMultibase: 'z42twTcNeSYcnqg1FLuSFs2bsGH3ZqbRHFmvS9XMsYhjxvHN',
    // Example 52
    credentialHashHex: '59b7cb6251b8991add1ce0bc83107e3db9dbbab5bd2c28f687db1a03abc92f19',
    // Example 55
    proofConfigHashHex: 'fe5799489119c7fe3c528715e72bd39d2ec6b4ab345978df32e9a9312648ec25',
    // Example 57
    signatureHex:
      'f15c3b599eb9b3cad05df9d8e8b39a70a86375833b53743c764ac0a88c4457d6' +
      '0707fd7d073e03d906130631d87803f80a9824dc9939632ba92d418181be9d16',
    // Examples 58 and 59
    proofValue: 'z5ptCet75SaEgzG4v4zJhbJtfNi74Wv7Fq15hhKouJQQjEPQvPZKaYxcMXAMLPQS2FXrkCWokNJkFVkwxNzZfD5oT',
  },
  {
    appendix: 'A.6',
    curve: 'P-384',
    signatureLength: 96,
    publicKeyMultibase: 'z82LkuBieyGShVBhvtE2zoiD6Kma4tJGFtkAhxR5pfkp5QPw4LutoYWhvQCnGjdVn14kujQ',
    secretKeyMultibase: 'z2fanyY7zgwNpZGxX5fXXibvScNaUWNprHU9dKx7qpVj7mws9J8LLt4mDB5TyH2GLHWkUc',
    // Example 63
    credentialHashHex:
      '3e0be671cc1881035d463158c80921973dab3534d4f8dfacf4ff2725a4115eb718e49d66de0e90e7365cd6062abf2259',
    // Example 66
    proofConfigHashHex:
      '83e5057817abb0c6872eafeaba1a9e53893c58eeb7414fb6d8aa3fa8c7917f7ad4792890b257c598baa17f4fbe6d183c',
    // Example 68
    signatureHex:
      '8b7462ce62db0c8ff19878c4b3561c49eb71b4a743086b6d5b0eda70ecf0afc5a03fd88eb207d66b262ed87fd200a4e8' +
      'e62716e0b329c032b67726b4b0fc737a44c1cefdba2fdccb3ece74cc5845aaa93374455a726f6ee4f5f30da9427f608a',
    // Examples 69 and 70
    proofValue:
      'zq3EuTeLiGurmB2JR5oL8oWEsT7u2tba4HT1oZbiMYWc5qzsoW2kLYcBcF4HM5vCpJyTkceULKrVXuJQkXeN5seL4uXrFNFRMm53GWy1Yrto8rTWxZi9DkNeWP7yUPs7ELAm',
  },
].map((vector) => {
  const did = `did:key:${vector.publicKeyMultibase}`
  const verificationMethod = `${did}#${vector.publicKeyMultibase}`
  const proofOptions: W3cDataIntegrityCryptosuiteProofOptions = {
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-jcs-2019',
    created: '2023-02-24T23:36:38Z',
    verificationMethod,
    proofPurpose: 'assertionMethod',
  }

  return {
    ...vector,
    did,
    verificationMethod,
    proofOptions,
    // Examples 54 and 65
    canonicalProofConfig:
      '{"@context":["https://www.w3.org/ns/credentials/v2","https://www.w3.org/ns/credentials/examples/v2"],' +
      `"created":"2023-02-24T23:36:38Z","cryptosuite":"ecdsa-jcs-2019","proofPurpose":"assertionMethod",` +
      `"type":"DataIntegrityProof","verificationMethod":"${verificationMethod}"}`,
  }
})

const [p256Vector, p384Vector] = specVectors

// Ed25519 did:key from the VC DI EdDSA test vectors, used to check that other key types are rejected
const ed25519VerificationMethod =
  'did:key:z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2#z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2'

function expectProcessingError(fn: () => unknown, errorCode: W3cDataIntegrityProcessingErrorCode) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
    expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(errorCode)
    return
  }

  throw new Error('Expected a W3cDataIntegrityProcessingError to be thrown')
}

async function expectProcessingErrorAsync(
  promise: Promise<unknown>,
  errorCode: W3cDataIntegrityProcessingErrorCode,
  message?: string
) {
  const error = await promise.then(
    () => undefined,
    (error: unknown) => error
  )
  expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
  expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(errorCode)
  if (message) expect((error as W3cDataIntegrityProcessingError).message).toContain(message)
}

const unsupportedKeyMessage =
  "The 'ecdsa-jcs-2019' cryptosuite only supports P-256 and P-384 keys, found OKP key with crv 'Ed25519'"

// did:key documents are derived from the identifier, the KMS key ids come from the imported spec keys
function mockDidsApi(kmsKeyIdsByDid: Record<string, string>) {
  return {
    resolveDidDocument: vi.fn(async (didUrl: string) => DidKey.fromDid(parseDid(didUrl).did).didDocument),
    getCreatedDids: vi.fn(async ({ did }: { did: string }) => {
      const kmsKeyId = kmsKeyIdsByDid[did]
      if (!kmsKeyId) return []
      return [{ keys: [{ didDocumentRelativeKeyId: `#${did.replace('did:key:', '')}`, kmsKeyId }] }]
    }),
  }
}

async function importSpecKeys(kms: KeyManagementApi, kmsKeyIdsByDid: Record<string, string>) {
  for (const vector of specVectors) {
    const publicJwk = PublicJwk.fromFingerprint(vector.publicKeyMultibase).toJson() as {
      x: string
      y: string
    }
    // Strip the two byte multicodec prefix (p256-priv 0x1306, p384-priv 0x1307) from the secret key
    const privateKeyBytes = MultiBaseEncoder.decode(vector.secretKeyMultibase).data.slice(2)
    expect(privateKeyBytes).toHaveLength(vector.signatureLength / 2)

    const { keyId } = await kms.importKey({
      privateJwk: {
        kty: 'EC',
        crv: vector.curve as 'P-256' | 'P-384',
        x: publicJwk.x,
        y: publicJwk.y,
        d: TypedArrayEncoder.toBase64Url(privateKeyBytes),
      },
    })
    kmsKeyIdsByDid[vector.did] = keyId
  }
}

describe('EcdsaJcs2019Cryptosuite', () => {
  let agentContext: AgentContext
  let kms: KeyManagementApi
  let cryptosuite: EcdsaJcs2019Cryptosuite
  const kmsKeyIdsByDid: Record<string, string> = {}
  const didsApi = mockDidsApi(kmsKeyIdsByDid)

  beforeAll(async () => {
    agentContext = getAgentContext({
      agentConfig: getAgentConfig('EcdsaJcs2019CryptosuiteTest'),
      registerInstances: [[DidsApi, didsApi]],
    })
    kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    await importSpecKeys(kms, kmsKeyIdsByDid)
  })

  beforeEach(() => {
    cryptosuite = new EcdsaJcs2019Cryptosuite(agentContext)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe.each(specVectors)('Appendix $appendix: ecdsa-jcs-2019 with curve $curve', (vector) => {
    const proofOptionsWithContext = { ...vector.proofOptions, '@context': specCredential['@context'] }
    const publicJwk = PublicJwk.fromFingerprint(vector.publicKeyMultibase)

    // Spec: section 3.3.3 and Examples 51 and 62
    it('transformation() produces the canonical credential', () => {
      expect(cryptosuite.transformation(specCredential, vector.proofOptions)).toBe(specCanonicalCredential)
    })

    // Spec: section 3.3.5 and Examples 54 and 65
    it('proofConfiguration() produces the canonical proof configuration', () => {
      expect(cryptosuite.proofConfiguration(proofOptionsWithContext)).toBe(vector.canonicalProofConfig)
    })

    // Spec: section 3.3.4 and Examples 52, 55, 56, 63, 66 and 67
    it('hashing() uses the hash of the curve and puts the proof configuration hash first', () => {
      const hashData = cryptosuite.hashing(
        cryptosuite.transformation(specCredential, vector.proofOptions),
        cryptosuite.proofConfiguration(proofOptionsWithContext),
        publicJwk
      )

      expect(TypedArrayEncoder.toHex(hashData)).toBe(vector.proofConfigHashHex + vector.credentialHashHex)
    })

    // Spec: Examples 57, 58, 68 and 69
    it('the spec proofValue is the base58btc encoding of the spec signature', () => {
      const { baseName, data } = MultiBaseEncoder.decode(vector.proofValue)

      expect(baseName).toBe('base58btc')
      expect(data).toHaveLength(vector.signatureLength)
      expect(TypedArrayEncoder.toHex(data)).toBe(vector.signatureHex)
    })

    // Spec: section 3.3.7 with Examples 56, 57, 67 and 68
    it('proofVerification() accepts the spec signature over the spec hash data', async () => {
      const hashData = TypedArrayEncoder.fromHex(vector.proofConfigHashHex + vector.credentialHashHex)
      const signature = TypedArrayEncoder.fromHex(vector.signatureHex)

      await expect(cryptosuite.proofVerification(hashData, signature, vector.proofOptions, publicJwk)).resolves.toBe(
        true
      )
    })

    // Spec: section 3.3.2 with the signed credential of Examples 59 and 70
    it('verifyProof() accepts the spec signed credential', async () => {
      const proof: W3cDataIntegrityCryptosuiteProof = { ...proofOptionsWithContext, proofValue: vector.proofValue }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: specCredential, proof })

      expect(result).toEqual({ verified: true, verifiedDocument: specCredential })
    })

    it('verifyProof() rejects the spec proof when the credential is changed', async () => {
      const proof: W3cDataIntegrityCryptosuiteProof = { ...proofOptionsWithContext, proofValue: vector.proofValue }

      const result = await cryptosuite.verifyProof({
        unsecuredDocument: { ...specCredential, name: 'Tampered Credential' },
        proof,
      })

      expect(result).toEqual({ verified: false, verifiedDocument: null })
    })

    // Spec: sections 3.3.1 and 3.3.2. Node signs with a random nonce, so the proof is not compared to the spec bytes.
    it('creates a proof that verifyProof() accepts', async () => {
      const signSpy = vi.spyOn(kms, 'sign')
      const proof = await cryptosuite.createProof(specCredential, vector.proofOptions)

      expect(proof).toMatchObject(proofOptionsWithContext)
      expect(signSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          keyId: kmsKeyIdsByDid[vector.did],
          expectedPublicJwk: expect.objectContaining({ kty: 'EC', crv: vector.curve }),
          algorithm: vector.curve === 'P-256' ? 'ES256' : 'ES384',
          data: TypedArrayEncoder.fromHex(vector.proofConfigHashHex + vector.credentialHashHex),
        })
      )

      const { baseName, data } = MultiBaseEncoder.decode(proof.proofValue)
      expect(baseName).toBe('base58btc')
      expect(data).toHaveLength(vector.signatureLength)

      await expect(cryptosuite.verifyProof({ unsecuredDocument: specCredential, proof })).resolves.toEqual({
        verified: true,
        verifiedDocument: specCredential,
      })
    })
  })

  describe('3.3.1 Create Proof (ecdsa-jcs-2019)', () => {
    // Spec: section 3.3.1 step 2 only adds @context when the unsecured document has one.
    it('does not add @context to the proof when the document has none', async () => {
      const proof = await cryptosuite.createProof({ id: 'urn:example:no-context' }, p256Vector.proofOptions)

      expect(proof['@context']).toBeUndefined()
      await expect(
        cryptosuite.verifyProof({ unsecuredDocument: { id: 'urn:example:no-context' }, proof })
      ).resolves.toMatchObject({ verified: true })
    })

    // Spec: section 3.3.1 step 1 clones the options.
    it('does not mutate the proof options', async () => {
      const options = { ...p256Vector.proofOptions }

      await cryptosuite.createProof(specCredential, options)

      expect(options).toEqual(p256Vector.proofOptions)
    })

    it('resolves the DID document of the verification method once', async () => {
      didsApi.resolveDidDocument.mockClear()

      await cryptosuite.createProof(specCredential, p256Vector.proofOptions)

      expect(didsApi.resolveDidDocument).toHaveBeenCalledOnce()
    })

    it('throws PROOF_GENERATION_ERROR for another cryptosuite', async () => {
      await expectProcessingErrorAsync(
        cryptosuite.createProof(specCredential, { ...p256Vector.proofOptions, cryptosuite: 'eddsa-jcs-2022' }),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError
      )
    })

    it('throws PROOF_GENERATION_ERROR for a verification method that is not a P-256 or P-384 key', async () => {
      const signSpy = vi.spyOn(kms, 'sign')

      await expectProcessingErrorAsync(
        cryptosuite.createProof(specCredential, {
          ...p256Vector.proofOptions,
          verificationMethod: ed25519VerificationMethod,
        }),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
        unsupportedKeyMessage
      )
      expect(signSpy).not.toHaveBeenCalled()
    })
  })

  describe('3.3.2 Verify Proof (ecdsa-jcs-2019)', () => {
    const specProof = (vector = p256Vector): W3cDataIntegrityCryptosuiteProof => ({
      ...vector.proofOptions,
      '@context': specCredential['@context'],
      proofValue: vector.proofValue,
    })

    it('throws PROOF_VERIFICATION_ERROR for another cryptosuite', async () => {
      await expectProcessingErrorAsync(
        cryptosuite.verifyProof({
          unsecuredDocument: specCredential,
          proof: { ...specProof(), cryptosuite: 'eddsa-jcs-2022' },
        }),
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError
      )
    })

    it('throws PROOF_VERIFICATION_ERROR for a verification method that is not a P-256 or P-384 key', async () => {
      await expectProcessingErrorAsync(
        cryptosuite.verifyProof({
          unsecuredDocument: specCredential,
          proof: { ...specProof(), verificationMethod: ed25519VerificationMethod },
        }),
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        unsupportedKeyMessage
      )
    })

    // Spec: section 3.3.2 step 4.1
    it('returns false when the document @context does not start with the proof @context', async () => {
      const verifySpy = vi.spyOn(kms, 'verify')

      const result = await cryptosuite.verifyProof({
        unsecuredDocument: { ...specCredential, '@context': ['https://www.w3.org/ns/credentials/v2'] },
        proof: specProof(),
      })

      expect(result).toEqual({ verified: false, verifiedDocument: null })
      expect(verifySpy).not.toHaveBeenCalled()
    })

    // Spec: section 3.3.2 step 4.2 verifies the document with the proof @context, which the document @context may extend.
    it('accepts a document whose @context extends the proof @context and returns it with the proof @context', async () => {
      const result = await cryptosuite.verifyProof({
        unsecuredDocument: {
          ...specCredential,
          '@context': [...(specCredential['@context'] as string[]), 'https://example.org/extra-context'],
        },
        proof: specProof(),
      })

      expect(result).toEqual({ verified: true, verifiedDocument: specCredential })
    })

    // Spec: section 3.3.2 step 4.1 compares values, and an inline context object is a new object after parsing.
    it('compares inline @context objects by value', async () => {
      const document = {
        ...specCredential,
        '@context': ['https://www.w3.org/ns/credentials/v2', { myWebsite: 'https://vocabulary.example/myWebsite' }],
      }
      const proof = await cryptosuite.createProof(document, p256Vector.proofOptions)
      const parsed = JSON.parse(JSON.stringify({ document, proof }))

      await expect(
        cryptosuite.verifyProof({ unsecuredDocument: parsed.document, proof: parsed.proof })
      ).resolves.toMatchObject({ verified: true })

      const otherInlineContext = {
        ...parsed.document,
        '@context': ['https://www.w3.org/ns/credentials/v2', { myWebsite: 'https://other.example/myWebsite' }],
      }
      await expect(
        cryptosuite.verifyProof({ unsecuredDocument: otherInlineContext, proof: parsed.proof })
      ).resolves.toEqual({ verified: false, verifiedDocument: null })
    })

    it('returns false without calling the KMS when the proofValue has the signature length of the other curve', async () => {
      const verifySpy = vi.spyOn(kms, 'verify')

      // A 64 byte P-256 signature presented with a P-384 verification method, which expects 96 bytes
      const result = await cryptosuite.verifyProof({
        unsecuredDocument: specCredential,
        proof: { ...specProof(p384Vector), proofValue: p256Vector.proofValue },
      })

      expect(result).toEqual({ verified: false, verifiedDocument: null })
      expect(verifySpy).not.toHaveBeenCalled()
    })
  })

  describe('3.3.3 Transformation (ecdsa-jcs-2019)', () => {
    it('throws PROOF_TRANSFORMATION_ERROR when the type or cryptosuite is wrong', () => {
      expectProcessingError(
        () => cryptosuite.transformation(specCredential, { ...p256Vector.proofOptions, type: 'Other' as never }),
        W3cDataIntegrityProcessingErrorCode.ProofTransformationError
      )
      expectProcessingError(
        () =>
          cryptosuite.transformation(specCredential, { ...p256Vector.proofOptions, cryptosuite: 'ecdsa-rdfc-2019' }),
        W3cDataIntegrityProcessingErrorCode.ProofTransformationError
      )
    })
  })

  describe('3.3.4 Hashing (ecdsa-jcs-2019)', () => {
    it('throws for a key that is not P-256 or P-384', () => {
      const ed25519PublicJwk = PublicJwk.fromFingerprint('z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2')

      expectProcessingError(
        () => cryptosuite.hashing('{}', '{}', ed25519PublicJwk),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError
      )
    })
  })

  describe('3.3.5 Proof Configuration (ecdsa-jcs-2019)', () => {
    it('throws PROOF_GENERATION_ERROR when the type or cryptosuite is wrong', () => {
      expectProcessingError(
        () => cryptosuite.proofConfiguration({ ...p256Vector.proofOptions, type: 'Other' as never }),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError
      )
      expectProcessingError(
        () => cryptosuite.proofConfiguration({ ...p256Vector.proofOptions, cryptosuite: 'eddsa-jcs-2022' }),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError
      )
    })

    // Spec: section 3.3.5 step 3
    it('throws PROOF_GENERATION_ERROR when created is not a valid dateTimeStamp', () => {
      expectProcessingError(
        () => cryptosuite.proofConfiguration({ ...p256Vector.proofOptions, created: '2023-02-24T23:36:38' }),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError
      )
    })
  })

  describe('3.3.6 Proof Serialization (ecdsa-jcs-2019)', () => {
    // Spec: section 3.3.6 step 2 requires 64 bytes for P-256 and 96 bytes for P-384.
    it('throws PROOF_GENERATION_ERROR when the KMS returns a signature of the wrong length', async () => {
      vi.spyOn(kms, 'sign').mockResolvedValueOnce({ signature: new Uint8Array(70), backend: 'node' })
      const publicJwk = PublicJwk.fromFingerprint(p256Vector.publicKeyMultibase)
      publicJwk.keyId = kmsKeyIdsByDid[p256Vector.did]

      await expectProcessingErrorAsync(
        cryptosuite.proofSerialization(new Uint8Array(64), p256Vector.proofOptions, publicJwk),
        W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
        'ES256 signature must be exactly 64 bytes, got 70'
      )
    })
  })

  describe('3.3.7 Proof Verification (ecdsa-jcs-2019)', () => {
    it('returns false without calling the KMS for a signature of the wrong length', async () => {
      const verifySpy = vi.spyOn(kms, 'verify')
      const hashData = TypedArrayEncoder.fromHex(p256Vector.proofConfigHashHex + p256Vector.credentialHashHex)
      const derEncodedLength = new Uint8Array(71)

      await expect(
        cryptosuite.proofVerification(
          hashData,
          derEncodedLength,
          p256Vector.proofOptions,
          PublicJwk.fromFingerprint(p256Vector.publicKeyMultibase)
        )
      ).resolves.toBe(false)
      expect(verifySpy).not.toHaveBeenCalled()
    })

    it('returns false for a signature over other data', async () => {
      const signature = TypedArrayEncoder.fromHex(p256Vector.signatureHex)

      await expect(
        cryptosuite.proofVerification(
          new Uint8Array(64),
          signature,
          p256Vector.proofOptions,
          PublicJwk.fromFingerprint(p256Vector.publicKeyMultibase)
        )
      ).resolves.toBe(false)
    })
  })
})

// Askar signs with deterministic ECDSA (RFC 6979), which the spec recommends, so created proofs match the spec exactly.
describe('EcdsaJcs2019Cryptosuite with the Askar KMS', () => {
  let cryptosuite: EcdsaJcs2019Cryptosuite
  const kmsKeyIdsByDid: Record<string, string> = {}

  beforeAll(async () => {
    const askarModuleConfig = new AskarModuleConfig({
      askar: NativeAskar,
      store: getAskarStoreConfig('EcdsaJcs2019CryptosuiteAskar'),
    })
    const agentContext = getAgentContext({
      agentConfig: getAgentConfig('EcdsaJcs2019CryptosuiteAskar'),
      registerInstances: [
        [DidsApi, mockDidsApi(kmsKeyIdsByDid)],
        [AskarModuleConfig, askarModuleConfig],
        [AskarStoreManager, new AskarStoreManager(new NodeFileSystem(), askarModuleConfig)],
      ],
      kmsBackends: [new AskarKeyManagementService()],
    })
    await importSpecKeys(agentContext.resolve(KeyManagementApi), kmsKeyIdsByDid)
    cryptosuite = new EcdsaJcs2019Cryptosuite(agentContext)
  })

  // Spec: Examples 59 and 70
  it.each(specVectors)('createProof() produces the proof of appendix $appendix', async (vector) => {
    const proof = await cryptosuite.createProof(specCredential, vector.proofOptions)

    expect(proof).toEqual({
      ...vector.proofOptions,
      '@context': specCredential['@context'],
      proofValue: vector.proofValue,
    })
    await expect(cryptosuite.verifyProof({ unsecuredDocument: specCredential, proof })).resolves.toMatchObject({
      verified: true,
    })
  })
})
