import { getAgentConfig, getAgentContext } from '../../../../tests/helpers'
import type { AgentContext } from '../../../agent/context'
import { TypedArrayEncoder } from '../../../utils'
import { MultiBaseEncoder } from '../../../utils/MultiBaseEncoder'
import { W3cDataIntegrityCryptosuiteRegistry } from '../W3cDataIntegrityCryptosuiteRegistry'
import { DataIntegrityProcessingError, DataIntegrityProcessingErrorCode } from '../DataIntegrityError'
import type {
  DataIntegrityCryptosuiteProof,
  DataIntegrityProofSetSecuredDocument,
  DataIntegritySingleProofSecuredDocument,
} from '../DataIntegrityProof'
import { W3cDataIntegrityProofService } from '../W3cDataIntegrityProofService'

const validProofValue = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value'), 'base58btc')
const validProofValue1 = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value-1'), 'base58btc')
const validProofValue2 = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value-2'), 'base58btc')

describe('W3cDataIntegrityProofService', () => {
  let agentContext: AgentContext
  let service: W3cDataIntegrityProofService
  const mockCreateByCryptosuite = vi.fn()
  const mockResolveDidDocument = vi.fn()

  test('contains an explicit ProblemDetails type mapping for every processing error code', () => {
    expect(Object.values(DataIntegrityProcessingErrorCode)).toEqual(
      expect.arrayContaining([
        'https://www.w3.org/ns/credentials#PARSING_ERROR',
        'https://w3id.org/security#PROOF_GENERATION_ERROR',
        'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
        'https://w3id.org/security#PROOF_TRANSFORMATION_ERROR',
        'https://w3id.org/security#INVALID_DOMAIN_ERROR',
        'https://w3id.org/security#INVALID_CHALLENGE_ERROR',
      ])
    )
  })

  test('maps processing error codes to their normative ProblemDetails URLs', () => {
    expect(DataIntegrityProcessingErrorCode.ProofVerificationError).toBe(
      'https://w3id.org/security#PROOF_VERIFICATION_ERROR'
    )
    expect(DataIntegrityProcessingErrorCode.ProofGenerationError).toBe(
      'https://w3id.org/security#PROOF_GENERATION_ERROR'
    )
    expect(DataIntegrityProcessingErrorCode.ProofTransformationError).toBe(
      'https://w3id.org/security#PROOF_TRANSFORMATION_ERROR'
    )
    expect(DataIntegrityProcessingErrorCode.InvalidDomainError).toBe('https://w3id.org/security#INVALID_DOMAIN_ERROR')
    expect(DataIntegrityProcessingErrorCode.InvalidChallengeError).toBe(
      'https://w3id.org/security#INVALID_CHALLENGE_ERROR'
    )
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    mockCreateByCryptosuite.mockReset()
    mockResolveDidDocument.mockReset()

    mockResolveDidDocument.mockResolvedValue({
      dereferenceKey: vi.fn().mockReturnValue({ id: 'did:example:123#key-1' }),
    })

    agentContext = getAgentContext({
      agentConfig: getAgentConfig('DataIntegrityProofServiceTest'),
      registerInstances: [
        [
          W3cDataIntegrityCryptosuiteRegistry,
          {
            supportedCryptosuites: ['eddsa-jcs-2022'],
            createByCryptosuite: mockCreateByCryptosuite,
          },
        ],
      ],
    })

    service = new W3cDataIntegrityProofService(
      agentContext.dependencyManager.resolve(W3cDataIntegrityCryptosuiteRegistry)
    )
  })

  test('createProof rejects when cryptosuite is omitted', async () => {
    mockCreateByCryptosuite.mockImplementation(() => {
      throw new Error('No Data Integrity cryptosuite registered for cryptosuite: undefined')
    })

    // §3.3.5/3.3.6 SHOULD convey PROOF_GENERATION_ERROR — registry failure returns structured failure
    // @ts-expect-error runtime guard for explicit cryptosuite requirement
    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
      },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
    })

    expect(result.created).toBe(false)
    expect(result.proof).toBeNull()
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
          detail: expect.stringContaining('cryptosuite'),
        },
      ],
    })

    expect(mockCreateByCryptosuite).toHaveBeenCalledWith(agentContext, undefined)
  })

  test('createProof rejects cryptosuite output with mismatched verificationMethod', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      cryptosuite: 'eddsa-jcs-2022',
      createProof: vi.fn().mockResolvedValue({
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#wrong-key',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      } satisfies DataIntegrityCryptosuiteProof),
    })

    // §3.3.5/3.3.6 SHOULD convey PROOF_GENERATION_ERROR — postcondition failure returns structured failure
    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
      },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(result.created).toBe(false)
    expect(result.proof).toBeNull()
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
          detail: expect.stringContaining('verificationMethod'),
        },
      ],
    })
  })

  test('createProof rejects cryptosuite output with mismatched proofPurpose using structured generation error', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      cryptosuite: 'eddsa-jcs-2022',
      createProof: vi.fn().mockResolvedValue({
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'authentication',
        proofValue: validProofValue,
      } satisfies DataIntegrityCryptosuiteProof),
    })

    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
      },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(result.created).toBe(false)
    expect(result.proof).toBeNull()
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
          title: 'Error creating Data Integrity proof',
          detail: expect.stringContaining('proofPurpose'),
        },
      ],
    })
  })

  test('createProof rejects cryptosuite output with invalid proof shape', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      cryptosuite: 'eddsa-jcs-2022',
      createProof: vi.fn().mockResolvedValue({
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        // missing proofValue on purpose
      } as unknown as DataIntegrityCryptosuiteProof),
    })

    // §3.3.5/3.3.6 SHOULD convey PROOF_GENERATION_ERROR — postcondition failure returns structured failure
    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
      },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(result.created).toBe(false)
    expect(result.proof).toBeNull()
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
          detail: expect.stringContaining('proofValue is required'),
        },
      ],
    })
  })

  test('createProof omits undefined object fields at the service boundary before calling cryptosuite', async () => {
    const createProof = vi.fn().mockResolvedValue({
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      domain: ['example.org'],
      proofValue: validProofValue,
    } satisfies DataIntegrityCryptosuiteProof)

    mockCreateByCryptosuite.mockReturnValue({
      cryptosuite: 'eddsa-jcs-2022',
      createProof,
    })

    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
        created: undefined,
        nested: {
          keep: 'value',
          remove: undefined,
        },
      },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
      created: undefined,
      domain: ['example.org'],
      previousProof: undefined,
    })

    expect(result.created).toBe(true)
    expect(createProof).toHaveBeenCalledWith(
      {
        id: 'urn:example:test',
        type: ['Example'],
        nested: {
          keep: 'value',
        },
      },
      {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        domain: ['example.org'],
      }
    )
  })

  test('createProof returns structured generation error when required verificationMethod is undefined and stripped', async () => {
    const createProof = vi.fn().mockRejectedValue(new Error('Missing required proof option: verificationMethod'))

    mockCreateByCryptosuite.mockReturnValue({
      cryptosuite: 'eddsa-jcs-2022',
      createProof,
    })

    // Runtime guard: undefined is stripped from proof options at the DI boundary
    const result = await service.createProof(agentContext, {
      unsecuredDocument: {
        id: 'urn:example:test',
        type: ['Example'],
      },
      // @ts-expect-error targeted runtime-path test for required field omitted via undefined
      verificationMethod: undefined,
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(result.created).toBe(false)
    expect(result.proof).toBeNull()
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
          title: 'Error creating Data Integrity proof',
          detail: expect.stringContaining('verificationMethod'),
        },
      ],
    })

    expect(createProof).toHaveBeenCalledTimes(1)
    const passedProofOptions = createProof.mock.calls[0]?.[1] as Record<string, unknown>
    expect(passedProofOptions).toBeDefined()
    expect('verificationMethod' in passedProofOptions).toBe(false)
  })

  test('verifyProof returns verified for a valid single proof', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const securedDocument: DataIntegritySingleProofSecuredDocument = {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    }

    const result = await service.verifyProof(agentContext, securedDocument)

    expect(result).toEqual({
      verified: true,
      verifiedDocument: { id: 'urn:example:test' },
      mediaType: null,
    })
    expect(mockCreateByCryptosuite).toHaveBeenCalledWith(agentContext, 'eddsa-jcs-2022')
    expect(mockCreateByCryptosuite.mock.results[0]?.value.verifyProof).toHaveBeenCalledWith({
      unsecuredDocument: { id: 'urn:example:test' },
      proof: securedDocument.proof,
    })
  })

  test('verifyProof accepts DID URLs as verificationMethod values', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(true)
    expect(mockCreateByCryptosuite).toHaveBeenCalledTimes(1)
  })

  test('verifyProof rejects malformed verificationMethod values before cryptosuite verification', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'not a url',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof preserves PROOF_TRANSFORMATION_ERROR raised by cryptosuite verification', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi
        .fn()
        .mockRejectedValue(
          new DataIntegrityProcessingError(
            DataIntegrityProcessingErrorCode.ProofTransformationError,
            'JCS canonicalization input is invalid'
          )
        ),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#PROOF_TRANSFORMATION_ERROR',
          title: 'JCS canonicalization input is invalid',
        },
      ],
    })
  })

  // Spec: VC DI EdDSA v1.0 §3.3.2 step 9 requires callers to preserve the cryptosuite-produced verifiedDocument.
  test('verifyProof returns the cryptosuite-provided verifiedDocument without replacing it with inputDocument', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
          '@context': ['https://www.w3.org/ns/credentials/v2'],
        },
      }),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result).toEqual({
      verified: true,
      verifiedDocument: {
        id: 'urn:example:test',
        '@context': ['https://www.w3.org/ns/credentials/v2'],
      },
      mediaType: null,
    })
  })

  test('verifyProofDocument verifies a single-proof JSON document', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const documentBytes = TypedArrayEncoder.fromUtf8String(
      JSON.stringify({
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      })
    )

    const result = await service.verifyProofDocument(agentContext, {
      mediaType: 'application/vc+ld+json',
      documentBytes,
    })

    expect(result.verified).toBe(true)
    expect(result.mediaType).toBe('application/vc+ld+json')
    expect(mockCreateByCryptosuite).toHaveBeenCalledTimes(1)
  })

  test('verifyProofDocument rejects unsupported media type', async () => {
    const result = await service.verifyProofDocument(agentContext, {
      mediaType: 'application/jwt',
      documentBytes: TypedArrayEncoder.fromUtf8String('{}'),
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://www.w3.org/ns/credentials#PARSING_ERROR',
        },
      ],
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofDocument rejects invalid JSON bytes', async () => {
    const result = await service.verifyProofDocument(agentContext, {
      mediaType: 'application/json',
      documentBytes: TypedArrayEncoder.fromUtf8String('{not-json'),
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://www.w3.org/ns/credentials#PARSING_ERROR',
        },
      ],
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofDocument rejects non-object JSON payloads', async () => {
    const result = await service.verifyProofDocument(agentContext, {
      mediaType: 'application/json',
      documentBytes: TypedArrayEncoder.fromUtf8String('[]'),
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://www.w3.org/ns/credentials#PARSING_ERROR',
        },
      ],
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects proof sets and requires verifyProofSetAndChain', async () => {
    const result = await service.verifyProof(
      agentContext,
      {
        id: 'urn:example:test',
        // @ts-expect-error runtime guard for hard-breaking boundary
        proof: [
          {
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
            verificationMethod: 'did:example:123#key-1',
            proofPurpose: 'assertionMethod',
            proofValue: validProofValue,
          },
        ],
      },
      {}
    )

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
  })

  test('verifyProof returns invalid result when expected proof purpose does not match', async () => {
    const result = await service.verifyProof(
      agentContext,
      {
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      },
      {
        expectedProofPurpose: 'authentication',
      }
    )

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
  })

  test('verifyProof allows unsupported proof purpose values when no proof-purpose validator is registered', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'unsupportedPurpose',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(true)
    expect(mockCreateByCryptosuite).toHaveBeenCalledTimes(1)
  })

  test('verifyProof rejects proofs without verificationMethod', async () => {
    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: { id: 'urn:example:test' },
      }),
    })

    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      // @ts-expect-error runtime guard for missing verificationMethod on proof
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockResolveDidDocument).not.toHaveBeenCalled()
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects proofs without proofPurpose', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofValue: validProofValue,
      } as unknown as DataIntegrityCryptosuiteProof,
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects proofs with invalid type', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'InvalidProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      } as unknown as DataIntegrityCryptosuiteProof,
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof returns invalid result when expected challenge does not match', async () => {
    const result = await service.verifyProof(
      agentContext,
      {
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          challenge: 'actual-challenge',
          proofValue: validProofValue,
        },
      },
      {
        challenge: 'expected-challenge',
      }
    )

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#INVALID_CHALLENGE_ERROR',
        },
      ],
    })
  })

  test('verifyProof returns invalid result when expected domain set does not match', async () => {
    const result = await service.verifyProof(
      agentContext,
      {
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          domain: ['issuer.example', 'wallet.example'],
          proofValue: validProofValue,
        },
      },
      {
        domain: ['issuer.example'],
      }
    )

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [
        {
          type: 'https://w3id.org/security#INVALID_DOMAIN_ERROR',
        },
      ],
    })
  })

  test('verifyProof rejects an invalid proof id URL', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        id: 'not-a-url',
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects an invalid proof created dateTimeStamp', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        created: '2026-05-09T12:00:00',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects an invalid proof expires dateTimeStamp', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        expires: 'not-a-date',
        proofValue: validProofValue,
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProof rejects malformed proofValue encoding before cryptosuite verification', async () => {
    const result = await service.verifyProof(agentContext, {
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z0OIl',
      },
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain verifies all proofs in a proof set', async () => {
    const mockVerifyProof = vi
      .fn()
      .mockResolvedValueOnce({ verified: true, verifiedDocument: { id: 'urn:example:test' } })
      .mockResolvedValueOnce({ verified: true, verifiedDocument: { id: 'urn:example:test' } })

    mockCreateByCryptosuite.mockReturnValue({
      verifyProof: mockVerifyProof,
    })

    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:1',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result).toEqual({
      verified: true,
      verifiedDocument: { id: 'urn:example:test' },
      mediaType: null,
    })
    expect(mockCreateByCryptosuite).toHaveBeenCalledTimes(2)
    expect(mockVerifyProof).toHaveBeenCalledTimes(2)
    expect(mockVerifyProof).toHaveBeenNthCalledWith(1, {
      unsecuredDocument: { id: 'urn:example:test' },
      proof: {
        id: 'urn:proof:1',
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue1,
      },
    })
    expect(mockVerifyProof).toHaveBeenNthCalledWith(2, {
      unsecuredDocument: {
        id: 'urn:example:test',
        proof: {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
      },
      proof: {
        id: 'urn:proof:2',
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-2',
        proofPurpose: 'assertionMethod',
        previousProof: 'urn:proof:1',
        proofValue: validProofValue2,
      },
    })
  })

  test('verifyProofSetAndChain returns invalid result when previousProof reference is missing', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:missing',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({
      errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }],
    })
  })

  test('verifyProofSetAndChain rejects proofs without verificationMethod', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        // @ts-expect-error runtime guard for missing verificationMethod on proof
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain rejects proofs without proofPurpose', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofValue: validProofValue1,
        } as unknown as DataIntegrityCryptosuiteProof,
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain rejects proofs with invalid type', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'InvalidProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        } as unknown as DataIntegrityCryptosuiteProof,
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain aggregates required-member errors across multiple invalid proofs', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          // missing verificationMethod
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        } as unknown as DataIntegrityCryptosuiteProof,
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          // missing proofPurpose
          proofValue: validProofValue2,
        } as unknown as DataIntegrityCryptosuiteProof,
      ],
    })

    expect(result.verified).toBe(false)
    if (result.verified) {
      throw new Error('Expected verification to fail')
    }
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 0 has invalid required members',
      detail: 'Proof verificationMethod is required',
    })
    expect(result.errors[1]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 1 has invalid required members',
      detail: 'Proof proofPurpose is required',
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain returns invalid result for forward previousProof references', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:2',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
  })

  test('verifyProofSetAndChain returns invalid result for cyclic proof references', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:2',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:1',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result.verified).toBe(false)
    if (result.verified) {
      throw new Error('Expected verification to fail')
    }

    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof chain contains a cycle',
    })
    expect(result.errors[1]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof previousProof reference must target an earlier proof',
    })
  })

  test('verifyProofSetAndChain returns invalid result for duplicate proof ids', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
  })

  test('verifyProofSetAndChain aggregates multiple chain-structure issues', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:1',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue2,
        },
        {
          id: 'urn:proof:3',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-3',
          proofPurpose: 'assertionMethod',
          previousProof: 'urn:proof:1',
          proofValue: validProofValue,
        },
      ],
    })

    expect(result.verified).toBe(false)
    if (result.verified) {
      throw new Error('Expected verification to fail')
    }

    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Duplicate proof id in proof set',
    })
    expect(result.errors[1]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof previousProof reference could not be resolved',
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain aggregates policy pre-check failures across proofs', async () => {
    const result = await service.verifyProofSetAndChain(
      agentContext,
      {
        id: 'urn:example:test',
        proof: [
          {
            id: 'urn:proof:1',
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
            verificationMethod: 'did:example:123#key-1',
            proofPurpose: 'assertionMethod',
            proofValue: validProofValue1,
          },
          {
            id: 'urn:proof:2',
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
            verificationMethod: 'did:example:123#key-2',
            proofPurpose: 'authentication',
            proofValue: validProofValue2,
          },
        ],
      },
      {
        expectedProofPurpose: 'capabilityInvocation',
      }
    )

    expect(result.verified).toBe(false)
    if (result.verified) {
      throw new Error('Expected verification to fail')
    }

    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 0 failed verification policy pre-check',
    })
    expect(result.errors[1]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 1 failed verification policy pre-check',
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain aggregates field-format pre-check failures across proofs', async () => {
    const result = await service.verifyProofSetAndChain(agentContext, {
      id: 'urn:example:test',
      proof: [
        {
          id: 'not-a-valid-url',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue1,
        },
        {
          id: 'urn:proof:2',
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-2',
          proofPurpose: 'assertionMethod',
          created: 'not-a-date',
          proofValue: validProofValue2,
        },
      ],
    })

    expect(result.verified).toBe(false)
    if (result.verified) {
      throw new Error('Expected verification to fail')
    }

    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 0 has invalid field formats',
    })
    expect(result.errors[1]).toMatchObject({
      type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
      title: 'Proof at index 1 has invalid field formats',
    })
    expect(mockCreateByCryptosuite).not.toHaveBeenCalled()
  })

  test('verifyProofSetAndChain rejects single proof inputs', async () => {
    const result = await service.verifyProofSetAndChain(
      agentContext,
      {
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      } as unknown as DataIntegrityProofSetSecuredDocument,
      {}
    )

    expect(result.verified).toBe(false)
    expect(result).toMatchObject({ errors: [{ type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR' }] })
  })
})
