import { createHash } from 'node:crypto'
import { getAgentConfig, getAgentContext } from '../../../../tests/helpers'
import type { AgentContext } from '../../../agent/context'
import { CredoError } from '../../../error'
import { MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { DidsApi } from '../../dids'
import { KeyManagementApi } from '../../kms'
import { EddsaJcs2022Cryptosuite } from '../cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'
import type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityUnsecuredDocument,
} from '../W3cDataIntegrityProof'

describe('EddsaJcs2022Cryptosuite', () => {
  let agentContext: AgentContext
  let cryptosuite: EddsaJcs2022Cryptosuite
  let mockDidsApi: {
    resolveDidDocument: ReturnType<typeof vi.fn>
    getCreatedDids: ReturnType<typeof vi.fn>
  }
  let mockKeyManagementApi: {
    sign: ReturnType<typeof vi.fn>
    verify: ReturnType<typeof vi.fn>
  }

  const mockVerificationMethod =
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
  const mockProofOptions: W3cDataIntegrityCryptosuiteProofOptions = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    proofPurpose: 'assertionMethod',
    verificationMethod: mockVerificationMethod,
  }

  const mockPublicJwkJson = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: 'IP071Y_MG-ovNPMJIWj75YyvgD8j0tC74EMAfvRIWoc',
  }

  const mockProofValue = MultiBaseEncoder.encode(new Uint8Array(64).fill(7), 'base58btc')

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

  const specProofOptions: W3cDataIntegrityCryptosuiteProofOptions = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    created: '2023-02-24T23:36:38Z',
    verificationMethod:
      'did:key:z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2#z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2',
    proofPurpose: 'assertionMethod',
  }

  const expectedCanonicalCredential =
    '{"@context":["https://www.w3.org/ns/credentials/v2","https://www.w3.org/ns/credentials/examples/v2"],' +
    '"credentialSubject":{"alumniOf":"The School of Examples","id":"did:example:abcdefgh"},' +
    '"description":"A minimum viable example of an Alumni Credential.",' +
    '"id":"urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",' +
    '"issuer":"https://vc.example/issuers/5678",' +
    '"name":"Alumni Credential",' +
    '"type":["VerifiableCredential","AlumniCredential"],' +
    '"validFrom":"2023-01-01T00:00:00Z"}'

  const expectedCanonicalProofConfig =
    '{"@context":["https://www.w3.org/ns/credentials/v2","https://www.w3.org/ns/credentials/examples/v2"],' +
    '"created":"2023-02-24T23:36:38Z",' +
    '"cryptosuite":"eddsa-jcs-2022",' +
    '"proofPurpose":"assertionMethod",' +
    '"type":"DataIntegrityProof",' +
    '"verificationMethod":"did:key:z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2#z6MkrJVnaZkeFzdQyMZu1cgjg7k1pZZ6pvBQ7XJPt4swbTQ2"}'

  const expectedCredentialHashHex = '59b7cb6251b8991add1ce0bc83107e3db9dbbab5bd2c28f687db1a03abc92f19'
  const expectedProofConfigHashHex = '66ab154f5c2890a140cb8388a22a160454f80575f6eae09e5a097cabe539a1db'
  const expectedHashDataHex =
    '66ab154f5c2890a140cb8388a22a160454f80575f6eae09e5a097cabe539a1db' +
    '59b7cb6251b8991add1ce0bc83107e3db9dbbab5bd2c28f687db1a03abc92f19'

  beforeEach(async () => {
    mockDidsApi = {
      resolveDidDocument: vi.fn().mockResolvedValue({
        dereferenceVerificationMethod: vi.fn().mockReturnValue({
          id: mockVerificationMethod,
          type: 'Ed25519VerificationKey2018',
          controller: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          publicKeyBase58: '3Dn1SJNPaCXcvvJvSbsFWP2xaCjMom3can8CQNhWrTRx',
        }),
      }),
      getCreatedDids: vi.fn().mockResolvedValue([
        {
          keys: [
            {
              didDocumentRelativeKeyId: '#key-1',
              kmsKeyId: 'mock-kms-key-id',
            },
          ],
        },
      ]),
    }

    mockKeyManagementApi = {
      sign: vi.fn().mockResolvedValue({
        signature: new Uint8Array(64).fill(0),
      }),
      verify: vi.fn().mockResolvedValue({
        verified: true,
      }),
    }

    const agentConfig = getAgentConfig('EddsaJcs2022CryptosuiteTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidsApi, mockDidsApi],
        [KeyManagementApi, mockKeyManagementApi],
      ],
    })

    cryptosuite = new EddsaJcs2022Cryptosuite(agentContext)
    ;(cryptosuite as unknown as { keyManagementApi: KeyManagementApi }).keyManagementApi =
      mockKeyManagementApi as unknown as KeyManagementApi
  })

  describe('3.3.1 Create Proof (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.1 steps 1, 2, 7, and 8 require cloning proof options, copying document @context into the proof, and returning a proof with proofValue.
    it('injects document @context into the returned proof and preserves other proof options', async () => {
      const documentContext = ['https://w3id.org/security/data-integrity/v2']
      const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': documentContext,
        type: 'VerifiableCredential',
        issuer: 'did:example:issuer',
        credentialSubject: { id: 'did:example:subject' },
      }

      const proof = await cryptosuite.createProof(unsecuredDocument, {
        ...mockProofOptions,
        created: '2026-05-13T12:00:00Z',
      })

      expect(proof['@context']).toEqual(documentContext)
      expect(proof.type).toBe('DataIntegrityProof')
      expect(proof.cryptosuite).toBe('eddsa-jcs-2022')
      expect(proof.verificationMethod).toBe(mockVerificationMethod)
      expect(proof.proofPurpose).toBe('assertionMethod')
      expect(proof.created).toBe('2026-05-13T12:00:00Z')

      const proofValueBytes = MultiBaseEncoder.decode(proof.proofValue)
      expect(proofValueBytes.baseName).toBe('base58btc')
      expect(proofValueBytes.data).toHaveLength(64)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.1 step 2 only injects @context when the unsecured document contains it.
    it('does not add @context to returned proof when document has no @context', async () => {
      const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = {
        type: 'AttestedResource',
        id: 'did:webvh:example/resources/zExample',
      }

      const proof = await cryptosuite.createProof(unsecuredDocument, mockProofOptions)
      expect(proof['@context']).toBeUndefined()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.1 step 1 requires proof to be a clone of options, so the original options object must not be mutated.
    it('does not mutate the original proof options', async () => {
      const options: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2026-05-14T12:00:00Z',
      }
      const optionsBefore = { ...options }

      await cryptosuite.createProof(
        { '@context': ['https://www.w3.org/ns/credentials/v2'], type: 'VerifiableCredential' },
        options
      )

      expect(options).toEqual(optionsBefore)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.1 step 6 passes the original caller-provided options to ProofSerialization.
    it('calls proofSerialization with the original options', async () => {
      const proofSerializationSpy = vi.spyOn(cryptosuite, 'proofSerialization')

      await cryptosuite.createProof(
        { '@context': ['https://www.w3.org/ns/credentials/v2'], type: 'VerifiableCredential' },
        { ...mockProofOptions, created: '2026-05-14T12:00:00Z' }
      )

      expect(proofSerializationSpy).toHaveBeenCalledOnce()
      const optionsArg = proofSerializationSpy.mock.calls[0][1]
      expect(optionsArg).toHaveProperty('verificationMethod', mockVerificationMethod)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.1 step 3 requires calling proofConfiguration with the modified proof (after @context injection).
    it('calls proofConfiguration with the @context-injected proof', async () => {
      const documentContext = ['https://www.w3.org/ns/credentials/v2']
      const proofConfigSpy = vi.spyOn(cryptosuite, 'proofConfiguration')

      await cryptosuite.createProof({ '@context': documentContext, type: 'VerifiableCredential' }, mockProofOptions)

      expect(proofConfigSpy).toHaveBeenCalled()
      const proofArg = proofConfigSpy.mock.calls[0][0]
      expect(proofArg['@context']).toEqual(documentContext)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.1 step 4 requires transformation to be called with the original options, not the modified proof.
    it('calls transformation with the original options (before @context injection into proof)', async () => {
      const documentContext = ['https://www.w3.org/ns/credentials/v2']
      const originalOptions = { ...mockProofOptions, created: '2026-05-14T13:00:00Z' }
      const transformationSpy = vi.spyOn(cryptosuite, 'transformation')

      await cryptosuite.createProof({ '@context': documentContext, type: 'VerifiableCredential' }, originalOptions)

      expect(transformationSpy).toHaveBeenCalled()
      const optionsArg = transformationSpy.mock.calls[0][1]
      // Verify it receives the original options, not the proof with injected @context
      expect(optionsArg).toEqual(originalOptions)
      expect(optionsArg['@context']).toBeUndefined()
    })
  })

  describe('3.3.2 Verify Proof (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4.1 requires the secured document @context to start with the proof @context in the same order before continuing.
    it('continues verification when the unsecured document context starts with the proof context in the same order', async () => {
      const proofContext = ['https://w3id.org/security/data-integrity/v2']
      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': proofContext,
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': [...proofContext, 'https://example.org/extra-context'],
        type: 'VerifiableCredential',
        issuer: 'did:example:issuer',
      }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })

      expect(result).toEqual({
        verified: true,
        verifiedDocument: {
          '@context': proofContext,
          type: 'VerifiableCredential',
          issuer: 'did:example:issuer',
        },
      })
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4.1 requires an immediate false result when the document context does not start with the proof context.
    it('returns false when the unsecured document context does not start with the proof context', async () => {
      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://different.context/v1'],
        type: 'VerifiableCredential',
      }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })

      expect(result).toEqual({
        verified: false,
        verifiedDocument: null,
      })
      expect(mockKeyManagementApi.verify).not.toHaveBeenCalled()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 3 decodes proofValue before step 4 context processing.
    // Even if context prefix would fail in step 4.1, an invalid proofValue MUST fail at decode first.
    it('throws on invalid proofValue before evaluating context prefix mismatch', async () => {
      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
        proofValue: 'not-a-valid-multibase',
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://different.context/v1'],
        type: 'VerifiableCredential',
      }

      await expect(
        cryptosuite.verifyProof({
          unsecuredDocument: inputDocument,
          proof: proofWithContext,
        })
      ).rejects.toThrow()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4.1 requires a false result when proof @context has more entries than document @context.
    it('returns false when the proof context has more entries than the unsecured document context', async () => {
      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': ['https://ctx1.example/v1', 'https://ctx2.example/v1'],
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://ctx1.example/v1'],
        type: 'VerifiableCredential',
      }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })

      expect(result).toEqual({
        verified: false,
        verifiedDocument: null,
      })
      expect(mockKeyManagementApi.verify).not.toHaveBeenCalled()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4.2 restores proof @context onto the unsecured document before transformation and hashing.
    it('restores proof @context onto the verified document before transformation', async () => {
      const proofContext = ['https://w3id.org/security/data-integrity/v2']

      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': proofContext,
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': [...proofContext, 'https://example.org/extra-context'],
        type: 'VerifiableCredential',
        issuer: 'did:example:issuer',
      }

      const transformationSpy = vi.spyOn(cryptosuite, 'transformation')

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })

      expect(result).toEqual({
        verified: true,
        verifiedDocument: {
          '@context': proofContext,
          type: 'VerifiableCredential',
          issuer: 'did:example:issuer',
        },
      })
      expect(transformationSpy).toHaveBeenCalledWith(
        expect.objectContaining({ '@context': proofContext }),
        expect.anything()
      )
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4 is skipped when proofOptions does not contain @context, even if the unsecured document contains @context.
    it('skips @context congruency when proof omits @context and preserves the unsecured document as verifiedDocument', async () => {
      const proofWithoutContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: 'AttestedResource',
        id: 'did:webvh:example/resources/zExample',
      }

      const transformationSpy = vi.spyOn(cryptosuite, 'transformation')

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithoutContext })

      expect(result).toEqual({
        verified: true,
        verifiedDocument: inputDocument,
      })
      expect(transformationSpy).toHaveBeenCalledWith(inputDocument, expect.anything())
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 2 requires proofOptions to be the proof copy with proofValue removed.
    it('does not include proofValue in the proof options passed to proofConfiguration', async () => {
      const proofConfigurationSpy = vi.spyOn(cryptosuite, 'proofConfiguration')

      await cryptosuite.verifyProof({
        unsecuredDocument: { id: 'urn:example:test' },
        proof: {
          ...mockProofOptions,
          proofValue: mockProofValue,
        },
      })

      expect(proofConfigurationSpy).toHaveBeenCalledOnce()
      const proofOptionsArg = proofConfigurationSpy.mock.calls[0][0]
      expect(proofOptionsArg).not.toHaveProperty('proofValue')
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 4.1 requires a false result when proofOptions contains @context but the unsecured document does not.
    it('returns false when proof options include @context but the unsecured document omits it', async () => {
      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        type: 'VerifiableCredential',
      }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })

      expect(result).toEqual({
        verified: false,
        verifiedDocument: null,
      })
      expect(mockKeyManagementApi.verify).not.toHaveBeenCalled()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 steps 4.1 and 4.2 apply equally when @context is a single string.
    it('handles @context as string in proof without error and preserves the restored context', async () => {
      const contextString = 'https://w3id.org/security/data-integrity/v2'

      const proofWithContext: W3cDataIntegrityCryptosuiteProof = {
        ...mockProofOptions,
        '@context': contextString,
        proofValue: mockProofValue,
      }
      const inputDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': contextString,
        type: 'VerifiableCredential',
      }

      const result = await cryptosuite.verifyProof({ unsecuredDocument: inputDocument, proof: proofWithContext })
      expect(result).toEqual({
        verified: true,
        verifiedDocument: inputDocument,
      })
    })

    // Spec: VC DI EdDSA v1.0 §3.3.2 step 9 returns verified false and verifiedDocument null when cryptographic verification fails.
    it('returns false and a null verifiedDocument when EdDSA verification fails', async () => {
      mockKeyManagementApi.verify.mockResolvedValueOnce({ verified: false })

      const result = await cryptosuite.verifyProof({
        unsecuredDocument: { id: 'urn:example:test' },
        proof: {
          ...mockProofOptions,
          proofValue: mockProofValue,
        },
      })

      expect(result).toEqual({
        verified: false,
        verifiedDocument: null,
      })
    })

    // Spec: VC DI EdDSA v1.0 §§3.3.1 + 3.3.2 round-trip: a proof produced by createProof verifies on the same unsecured document.
    it('creates a proof that verifyProof accepts for the same unsecured document', async () => {
      const unsecuredDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: 'urn:example:round-trip',
        type: 'VerifiableCredential',
      }

      const options: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2026-05-14T12:00:00Z',
      }

      const proof = await cryptosuite.createProof(unsecuredDocument, options)
      const result = await cryptosuite.verifyProof({ unsecuredDocument, proof })

      expect(result).toEqual({
        verified: true,
        verifiedDocument: unsecuredDocument,
      })

      const signCall = mockKeyManagementApi.sign.mock.calls[0][0]
      const verifyCall = mockKeyManagementApi.verify.mock.calls[0][0]
      expect(verifyCall.data).toEqual(signCall.data)
    })
  })

  describe('3.3.3 Transformation (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.3 steps 2-3 requires JCS canonicalization of the unsecured document.
    it('canonicalizes the unsecured document using JCS', () => {
      const canonical = cryptosuite.transformation(
        {
          b: 2,
          a: 1,
        },
        mockProofOptions
      )

      expect(canonical).toBe('{"a":1,"b":2}')
    })

    // Spec: VC DI EdDSA v1.0 §3.3.3 requires valid type and cryptosuite identifiers for transformation input.
    it('does not throw when proof type and cryptosuite are valid', () => {
      expect(() =>
        cryptosuite.transformation(
          { id: 'urn:example:test' },
          {
            ...mockProofOptions,
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
          }
        )
      ).not.toThrow()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.3 requires type and cryptosuite identifiers; an invalid required identifier must raise an error.
    it('throws when only proof type is invalid (cryptosuite is valid)', () => {
      const transformation = () =>
        cryptosuite.transformation(
          { id: 'urn:example:test' },
          {
            ...mockProofOptions,
            type: 'InvalidProof' as never,
          }
        )

      expect(transformation).toThrow(W3cDataIntegrityProcessingError)

      try {
        transformation()
      } catch (error) {
        expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
        expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(
          W3cDataIntegrityProcessingErrorCode.ProofTransformationError
        )
      }
    })

    // Spec: VC DI EdDSA v1.0 §3.3.3 requires type and cryptosuite identifiers; an invalid required identifier must raise an error.
    it('throws when only cryptosuite is invalid (type is valid)', () => {
      const transformation = () =>
        cryptosuite.transformation(
          { id: 'urn:example:test' },
          {
            ...mockProofOptions,
            cryptosuite: 'invalid-suite' as never,
          }
        )

      expect(transformation).toThrow(W3cDataIntegrityProcessingError)

      try {
        transformation()
      } catch (error) {
        expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
        expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(
          W3cDataIntegrityProcessingErrorCode.ProofTransformationError
        )
      }
    })

    // Spec: VC DI EdDSA v1.0 §3.3.3 requires type and cryptosuite identifiers; invalid combinations must raise an error.
    it('throws when BOTH proof type and cryptosuite are invalid', () => {
      const transformation = () =>
        cryptosuite.transformation(
          { id: 'urn:example:test' },
          {
            type: 'InvalidProof' as never,
            cryptosuite: 'invalid-suite' as never,
            proofPurpose: 'assertionMethod',
            verificationMethod: mockVerificationMethod,
          }
        )

      expect(transformation).toThrow(W3cDataIntegrityProcessingError)

      try {
        transformation()
      } catch (error) {
        expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
        expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(
          W3cDataIntegrityProcessingErrorCode.ProofTransformationError
        )
      }
    })

    // Spec: VC DI EdDSA v1.0 §3.3.3 relies on JCS; unsupported input values must fail transformation categorically.
    it('throws PROOF_TRANSFORMATION_ERROR for unsupported JCS input values', () => {
      const transformation = () =>
        cryptosuite.transformation(
          {
            id: 'urn:example:test',
            value: undefined,
          },
          mockProofOptions
        )

      expect(transformation).toThrow(W3cDataIntegrityProcessingError)

      try {
        transformation()
      } catch (error) {
        expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
        expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(
          W3cDataIntegrityProcessingErrorCode.ProofTransformationError
        )
      }
    })

    // Spec: VC DI EdDSA v1.0 Appendix B.3 Example 31 defines the canonical JCS credential representation.
    it('transformation() produces spec-conformant JCS canonical credential (Example 31)', () => {
      const canonical = cryptosuite.transformation(specCredential, specProofOptions)
      expect(canonical).toBe(expectedCanonicalCredential)
    })

    // Spec: VC DI EdDSA v1.0 Appendix B.3 Example 32 defines the SHA-256 hash of the canonical credential.
    it('transformation() SHA-256 hash matches spec Example 32', () => {
      const canonical = cryptosuite.transformation(specCredential, specProofOptions)
      const hex = TypedArrayEncoder.toHex(createHash('sha256').update(canonical).digest())
      expect(hex).toBe(expectedCredentialHashHex)
    })
  })

  describe('3.3.4 Hashing (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 Appendix B.3 Example 36 defines hashData as proofConfigHash concatenated with credentialHash.
    it('hashing() produces combined hashData matching spec Example 36 (proofConfigHash || credentialHash)', () => {
      const transformedDoc = cryptosuite.transformation(specCredential, specProofOptions)
      const proofOptionsWithContext = { ...specProofOptions, '@context': specCredential['@context'] }
      const proofConfig = cryptosuite.proofConfiguration(proofOptionsWithContext)
      const hashData = cryptosuite.hashing(transformedDoc, proofConfig)
      const hex = TypedArrayEncoder.toHex(hashData)
      expect(hex).toBe(expectedHashDataHex)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.4 step 3 orders proofConfigHash before transformedDocumentHash.
    it('hashing() places proofConfigHash first, credentialHash second', () => {
      const transformedDoc = cryptosuite.transformation(specCredential, specProofOptions)
      const proofOptionsWithContext = { ...specProofOptions, '@context': specCredential['@context'] }
      const proofConfig = cryptosuite.proofConfiguration(proofOptionsWithContext)
      const hashData = cryptosuite.hashing(transformedDoc, proofConfig)
      expect(hashData).toHaveLength(64)
      const firstHalf = TypedArrayEncoder.toHex(hashData.subarray(0, 32))
      const secondHalf = TypedArrayEncoder.toHex(hashData.subarray(32, 64))
      expect(firstHalf).toBe(expectedProofConfigHashHex)
      expect(secondHalf).toBe(expectedCredentialHashHex)
    })
  })

  describe('3.3.5 Proof Configuration (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.5 step 4 canonicalizes proof options that already include @context.
    it('canonicalizes proof options that already include @context as array', () => {
      const documentContext = ['https://w3id.org/security/data-integrity/v2']
      const proofOptions = { ...mockProofOptions, '@context': documentContext }
      const proofConfig = cryptosuite.proofConfiguration(proofOptions)

      const parsed = JSON.parse(proofConfig)
      expect(parsed['@context']).toEqual(documentContext)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 4 canonicalizes proof options when @context is a string value.
    it('canonicalizes proof options that already include @context as string', () => {
      const documentContext = 'https://w3id.org/security/data-integrity/v2'
      const proofOptions = { ...mockProofOptions, '@context': documentContext }
      const proofConfig = cryptosuite.proofConfiguration(proofOptions)

      const parsed = JSON.parse(proofConfig)
      expect(parsed['@context']).toEqual(documentContext)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 steps 1 and 4 permit proof options that omit @context.
    it('canonicalizes proof options without @context when none is present', () => {
      const proofOptions = { ...mockProofOptions }
      const proofConfig = cryptosuite.proofConfiguration(proofOptions)

      const parsed = JSON.parse(proofConfig)
      expect(parsed['@context']).toBeUndefined()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 — the algorithm takes only proofOptions as input.
    // @context must not be injected from any external source; the canonical output reflects
    // only what is present in proofOptions.
    it('does not inject @context from an external document — only proofOptions is an input', () => {
      const proofOptions = { ...mockProofOptions } // no @context
      const _unsecuredDocument: W3cDataIntegrityUnsecuredDocument = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: 'VerifiableCredential',
      }

      const proofConfig = cryptosuite.proofConfiguration(proofOptions)

      const parsed = JSON.parse(proofConfig)
      expect(parsed['@context']).toBeUndefined()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 3 requires an error for invalid created dateTime values.
    it('throws when created is not a valid RFC3339 dateTime', () => {
      const invalidOptions: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: 'not-a-datetime',
      }

      expect(() => cryptosuite.proofConfiguration(invalidOptions)).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 3 — created must be a valid [XMLSCHEMA11-2] dateTimeStamp.
    // dateTimeStamp is a derived type of dateTime where explicitTimezone is required.
    // A dateTime without timezone offset (e.g. '2023-02-24T23:36:38') is valid dateTime but not dateTimeStamp.
    it('throws when created is not valid dateTimeStamp with timezone offset', () => {
      const invalidOptions: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2023-02-24T23:36:38',
      }

      expect(() => cryptosuite.proofConfiguration(invalidOptions)).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 3 — calendar validation must reject impossible dates.
    it('throws when created is November 31st (non-existent day)', () => {
      const invalidOptions: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2025-11-31T12:00:00Z',
      }

      expect(() => cryptosuite.proofConfiguration(invalidOptions)).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 3 — calendar validation must reject Feb 29 in non-leap years.
    it('throws when created is February 29th of a non-leap year', () => {
      const invalidOptions: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2025-02-29T12:00:00Z',
      }

      expect(() => cryptosuite.proofConfiguration(invalidOptions)).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 3 — calendar validation must accept Feb 29 in leap years.
    it('does not throw when created is February 29th of a leap year', () => {
      const validOptions: W3cDataIntegrityCryptosuiteProofOptions = {
        ...mockProofOptions,
        created: '2024-02-29T12:00:00Z',
      }

      expect(() => cryptosuite.proofConfiguration(validOptions)).not.toThrow()
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 2 requires an error when either type OR cryptosuite is invalid.
    it('throws when only proof type is invalid (cryptosuite is valid)', () => {
      expect(() =>
        cryptosuite.proofConfiguration({
          ...mockProofOptions,
          type: 'InvalidProof' as never,
        })
      ).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 2 requires an error when either type OR cryptosuite is invalid.
    it('throws when only cryptosuite is invalid (type is valid)', () => {
      expect(() =>
        cryptosuite.proofConfiguration({
          ...mockProofOptions,
          cryptosuite: 'invalid-suite' as never,
        })
      ).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.5 step 2 uses OR logic, so it also requires an error when BOTH fields are invalid.
    it('also throws when BOTH proof type and cryptosuite are invalid', () => {
      expect(() =>
        cryptosuite.proofConfiguration({
          type: 'InvalidProof' as never,
          cryptosuite: 'invalid-suite' as never,
          proofPurpose: 'assertionMethod',
          verificationMethod: mockVerificationMethod,
        })
      ).toThrow(CredoError)
    })

    // Spec: VC DI EdDSA v1.0 Appendix B.3 Example 34 defines the canonical proof configuration after @context injection.
    it('proofConfiguration() produces spec-conformant JCS canonical proof config (Example 34)', () => {
      const proofOptionsWithContext = { ...specProofOptions, '@context': specCredential['@context'] }
      const canonical = cryptosuite.proofConfiguration(proofOptionsWithContext)
      expect(canonical).toBe(expectedCanonicalProofConfig)
    })

    // Spec: VC DI EdDSA v1.0 Appendix B.3 Example 35 defines the SHA-256 hash of the canonical proof configuration.
    it('proofConfiguration() SHA-256 hash matches spec Example 35', () => {
      const proofOptionsWithContext = { ...specProofOptions, '@context': specCredential['@context'] }
      const canonical = cryptosuite.proofConfiguration(proofOptionsWithContext)
      const hex = TypedArrayEncoder.toHex(createHash('sha256').update(canonical).digest())
      expect(hex).toBe(expectedProofConfigHashHex)
    })
  })

  describe('3.3.6 Proof Serialization (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.6 steps 1-3 requires resolving the signing key from verificationMethod and returning proof bytes.
    it('signs hashData with the private key associated with verificationMethod', async () => {
      const hashData = new Uint8Array([1, 2, 3, 4])

      const proofBytes = await cryptosuite.proofSerialization(hashData, mockProofOptions)

      expect(mockKeyManagementApi.sign).toHaveBeenCalledWith({
        keyId: '3Dn1SJNPaCXcvvJvSbsFWP2xaCjMom3can8CQNhWrTRx',
        algorithm: 'EdDSA',
        data: hashData,
      })
      expect(proofBytes).toHaveLength(64)
    })

    // Boundary contract: type/cryptosuite validation happens at createProof()/verifyProof().
    // proofSerialization() intentionally performs signing only.
    it('does not enforce type checks; signs when called directly with missing type', async () => {
      const hashData = new Uint8Array([1, 2, 3, 4])
      const { type: _type, ...optionsWithoutType } = mockProofOptions

      // @ts-expect-error testing lower-level signing behavior with missing `type`
      const proofBytes = await cryptosuite.proofSerialization(hashData, optionsWithoutType)
      expect(proofBytes).toHaveLength(64)
    })

    // Boundary contract: type/cryptosuite validation happens before proofSerialization().
    it('does not enforce type checks; signs when called directly with non-string type', async () => {
      const hashData = new Uint8Array([1, 2, 3, 4])
      // biome-ignore lint/suspicious/noExplicitAny: testing runtime type validation with invalid type
      const optionsWithInvalidType = { ...mockProofOptions, type: 123 } as any

      const proofBytes = await cryptosuite.proofSerialization(hashData, optionsWithInvalidType)
      expect(proofBytes).toHaveLength(64)
    })

    // Spec: VC DI EdDSA v1.0 §3.3.6 step 2 — proofBytes will be exactly 64 bytes in size (postcondition enforcement)
    it('throws when EdDSA signature is not exactly 64 bytes', async () => {
      mockKeyManagementApi.sign.mockResolvedValueOnce({ signature: new Uint8Array(32) })
      const hashData = new Uint8Array([1, 2, 3, 4])

      await expect(cryptosuite.proofSerialization(hashData, mockProofOptions)).rejects.toThrow(CredoError)
    })
  })

  describe('3.3.7 Proof Verification (eddsa-jcs-2022)', () => {
    // Spec: VC DI EdDSA v1.0 §3.3.7 steps 1-3 requires resolving the public key from verificationMethod and returning the EdDSA verification result.
    it('verifies proof bytes against hashData using the verificationMethod public key', async () => {
      const hashData = new Uint8Array([5, 6, 7, 8])
      const proofBytes = new Uint8Array(64).fill(9)

      const verified = await cryptosuite.proofVerification(hashData, proofBytes, mockProofOptions)

      expect(verified).toBe(true)
      expect(mockKeyManagementApi.verify).toHaveBeenCalledWith({
        key: { publicJwk: mockPublicJwkJson },
        algorithm: 'EdDSA',
        signature: proofBytes,
        data: hashData,
      })
    })

    // Spec: VC DI EdDSA v1.0 §3.3.7 step 3 returns the boolean cryptographic verification result without coercion.
    it('returns false when EdDSA signature verification fails', async () => {
      mockKeyManagementApi.verify.mockResolvedValueOnce({ verified: false })

      const verified = await cryptosuite.proofVerification(new Uint8Array([1]), new Uint8Array(64), mockProofOptions)

      expect(verified).toBe(false)
    })
  })
})
