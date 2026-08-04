import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import type { AgentContext } from '../../../../agent/context'
import { CredoError } from '../../../../error'
import { DidsApi } from '../../../dids'
import { KeyManagementApi } from '../../../kms'
import { Ed25519PublicJwk } from '../../../kms/jwk'
import {
  type W3cDataIntegrityCryptosuiteProof as DataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteRegistry as DataIntegrityCryptosuiteRegistry,
  W3cDataIntegrityProcessingErrorCode as DataIntegrityProcessingErrorCode,
  W3cDataIntegrityProofService as DataIntegrityProofService,
  type W3cDataIntegrityVerifyFailure as DataIntegrityVerifyFailure,
  EddsaJcs2022Cryptosuite,
} from '../../../w3c-di/internal'
import { ClaimFormat } from '../../models'
import type {
  W3cV2DiVerifyCredentialOptions,
  W3cV2DiVerifyPresentationOptions,
} from '../../W3cV2CredentialServiceOptions'
import type { W3cV2DataIntegrityContextValidationResult } from '../W3cV2DataIntegrityContextValidator'
import { W3cV2DataIntegrityContextValidator } from '../W3cV2DataIntegrityContextValidator'
import { W3cV2DataIntegrityCredentialService } from '../W3cV2DataIntegrityCredentialService'
import { CredoDidKeyDiExampleCredentialToSign } from './fixtures/credo-di-vc'

describe('W3cV2DataIntegrityCredentialService', () => {
  type SignedCredential = {
    securedCredential: Record<string, unknown> & {
      proof: DataIntegrityCryptosuiteProof
    }
  }

  test('verifyCredential falls back to default error message when no DI issues are present', async () => {
    const verificationFailure = {
      verified: false,
      verifiedDocument: null,
      mediaType: null,
      errors: [],
    } as unknown as DataIntegrityVerifyFailure

    const proofService = {
      verifyProof: vi.fn().mockResolvedValue(verificationFailure),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(false)
    const error = result.validations.signature?.error
    expect(error).toBeInstanceOf(CredoError)
    expect(error?.message).toBe('Data Integrity proof verification failed')
    expect((error as CredoError).cause).toBeUndefined()
  })

  test('verifyCredential returns CredoError with DI context in message and cause for proof verification failures', async () => {
    const verificationFailure: DataIntegrityVerifyFailure = {
      verified: false,
      verifiedDocument: null,
      mediaType: null,
      errors: [
        {
          type: DataIntegrityProcessingErrorCode.ParsingError,
          title: 'Document bytes could not be parsed as JSON',
          detail: 'Unexpected token',
        },
      ],
    }

    const proofService = {
      verifyProof: vi.fn().mockResolvedValue(verificationFailure),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(false)
    const error = result.validations.signature?.error
    expect(error).toBeInstanceOf(CredoError)
    expect(error?.message).toContain('https://www.w3.org/ns/credentials#PARSING_ERROR')
    expect(error?.message).toContain('Document bytes could not be parsed as JSON')
    expect(error?.message).toContain('Unexpected token')
    expect((error as CredoError).cause).toBeInstanceOf(CredoError)
    expect((error as CredoError).cause?.message).toContain('Data Integrity processing issues')
  })

  test('verifyCredential returns CredoError with DI context for context policy failures', async () => {
    const contextFailure: DataIntegrityVerifyFailure = {
      verified: false,
      verifiedDocument: null,
      mediaType: null,
      errors: [
        {
          type: DataIntegrityProcessingErrorCode.ProofVerificationError,
          title: 'Unknown top-level @context URL',
          detail: "Context 'https://unknown.example/context' is not in the known context allowlist",
        },
      ],
    }

    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: false,
        validatedDocument: null,
        warnings: [],
        errors: contextFailure.errors,
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(false)
    const error = result.validations.signature?.error
    expect(error).toBeInstanceOf(CredoError)
    expect(error?.message).toContain('https://w3id.org/security#PROOF_VERIFICATION_ERROR')
    expect(error?.message).toContain('Unknown top-level @context URL')
  })

  test('verifyCredential runs proof verification before context validation', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: false,
        verifiedDocument: null,
        mediaType: null,
        errors: [
          {
            type: DataIntegrityProcessingErrorCode.ProofVerificationError,
            title: 'Proof verification failed',
          },
        ],
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(false)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toMatchObject({
      expectedProofPurpose: 'assertionMethod',
    })
    expect((contextPolicyValidator.validate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  test('verifyCredential treats missing credentialStatus as valid in DI path', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(true)
    expect(result.validations.credentialStatus?.isValid).toBe(true)
  })

  test('verifyCredential allows DI credentialStatus by default when status verification is disabled', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        credential: {
          securedCredential: {
            credentialStatus: {
              id: 'https://example.org/status/1#1',
              type: 'StatusList2021Entry',
              statusListCredential: 'https://example.org/status/1',
              statusListIndex: '1',
            },
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(true)
    expect(result.validations.credentialStatus?.isValid).toBe(true)
  })

  test('verifyCredential marks DI credentialStatus as unsupported when status verification is enabled', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyCredential(
      {} as never,
      {
        verifyCredentialStatus: true,
        credential: {
          securedCredential: {
            credentialStatus: {
              id: 'https://example.org/status/1#1',
              type: 'StatusList2021Entry',
              statusListCredential: 'https://example.org/status/1',
              statusListIndex: '1',
            },
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyCredentialOptions
    )

    expect(result.isValid).toBe(false)
    expect(result.validations.credentialStatus?.isValid).toBe(false)
    expect(result.validations.credentialStatus?.error?.message).toContain('not supported')
    expect(result.validations.credentialStatus?.error?.message).toContain('DI')
  })

  test('signCredential rejects invalid VC2 @context before invoking proof service', async () => {
    const proofService = {
      verifyProof: vi.fn(),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    await expect(
      service.signCredential({} as never, {
        credential: {
          '@context': ['https://example.org/custom/v1'],
          type: ['VerifiableCredential', 'ExampleCredential'],
          issuer: 'did:example:issuer',
          credentialSubject: { id: 'did:example:subject' },
        } as never,
        format: ClaimFormat.DiVc,
        verificationMethod: 'did:example:issuer#key-1',
        cryptosuite: 'eddsa-jcs-2022',
      })
    ).rejects.toThrow(/context has failed the following constraints/)

    expect((proofService.createProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  test('signCredential injects VC2 @context when missing before invoking proof service', async () => {
    const proofService = {
      verifyProof: vi.fn(),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn().mockResolvedValue({
        created: true,
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          verificationMethod: 'did:example:issuer#key-1',
          proofValue: 'zMockProofValue',
        },
      }),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    await service.signCredential({} as never, {
      credential: {
        type: ['VerifiableCredential', 'ExampleCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: { id: 'did:example:subject' },
      } as never,
      format: ClaimFormat.DiVc,
      verificationMethod: 'did:example:issuer#key-1',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect((proofService.createProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    const createProofOptions = (proofService.createProof as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      unsecuredDocument: Record<string, unknown>
    }
    expect(createProofOptions.unsecuredDocument['@context']).toEqual(['https://www.w3.org/ns/credentials/v2'])
  })

  test('verifyPresentation returns CredoError with DI context for proof verification failures', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: false,
        verifiedDocument: null,
        mediaType: null,
        errors: [
          {
            type: DataIntegrityProcessingErrorCode.ProofVerificationError,
            title: 'Unsupported proof purpose for verification relationship validation',
            detail: "Proof purpose 'unsupported' is not one of assertionMethod, authentication",
          },
        ],
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: { id: 'urn:example:test' },
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyPresentation(
      {} as never,
      {
        challenge: 'challenge',
        presentation: {
          securedPresentation: {
            proof: {
              type: 'DataIntegrityProof',
              verificationMethod: 'did:example:123#key-1',
              proofPurpose: 'unsupported',
            },
          },
        },
      } as unknown as W3cV2DiVerifyPresentationOptions
    )

    expect(result.isValid).toBe(false)
    const error = result.presentation.validations.presentationSignature?.error
    expect(error).toBeInstanceOf(CredoError)
    expect(error?.message).toContain('https://w3id.org/security#PROOF_VERIFICATION_ERROR')
    expect(error?.message).toContain('Unsupported proof purpose for verification relationship validation')
  })

  test('verifyPresentation runs proof verification before context validation', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: false,
        verifiedDocument: null,
        mediaType: null,
        errors: [
          {
            type: DataIntegrityProcessingErrorCode.ProofVerificationError,
            title: 'Presentation proof verification failed',
          },
        ],
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyPresentation(
      {} as never,
      {
        challenge: 'challenge',
        domain: 'example.com',
        presentation: {
          securedPresentation: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
        },
      } as unknown as W3cV2DiVerifyPresentationOptions
    )

    expect(result.isValid).toBe(false)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toMatchObject({
      expectedProofPurpose: 'authentication',
      challenge: 'challenge',
      domain: 'example.com',
    })
    expect((contextPolicyValidator.validate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  test('verifyPresentation does not reject JWT credential entries by shape in DI VP path', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyPresentation(
      {} as never,
      {
        challenge: 'challenge',
        presentation: {
          securedPresentation: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
          resolvedPresentation: {
            verifiableCredential: [{ claimFormat: ClaimFormat.JwtW3cVc }],
          },
        },
      } as unknown as W3cV2DiVerifyPresentationOptions
    )

    expect(result.isValid).toBe(true)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect((proofService.verifyProofSetAndChain as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    expect((contextPolicyValidator.validate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  test('verifyPresentation does not reject unknown credential entry shapes by shape in DI VP path', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {
          id: 'urn:example:test',
        },
        mediaType: null,
      }),
      verifyProofSetAndChain: vi.fn(),
      createProof: vi.fn(),
    } as unknown as DataIntegrityProofService

    const contextPolicyValidator = {
      validate: vi.fn().mockResolvedValue({
        validated: true,
        validatedDocument: null,
        warnings: [],
        errors: [],
      } satisfies W3cV2DataIntegrityContextValidationResult),
    }

    const service = new W3cV2DataIntegrityCredentialService(proofService, contextPolicyValidator as never)

    const result = await service.verifyPresentation(
      {} as never,
      {
        challenge: 'challenge',
        presentation: {
          securedPresentation: {
            proof: {
              type: 'DataIntegrityProof',
            },
          },
          resolvedPresentation: {
            verifiableCredential: [{}],
          },
        },
      } as unknown as W3cV2DiVerifyPresentationOptions
    )

    expect(result.isValid).toBe(true)
    expect((proofService.verifyProof as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect((proofService.verifyProofSetAndChain as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    expect((contextPolicyValidator.validate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  describe('Integration tests against core Data Integrity module', () => {
    let agentContext: AgentContext
    let diProofService: DataIntegrityProofService
    let diContextValidator: W3cV2DataIntegrityContextValidator
    let diCredentialService: W3cV2DataIntegrityCredentialService
    const verificationMethod =
      'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1#z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1'
    const publicJwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    } as const

    beforeAll(() => {
      const agentConfig = getAgentConfig('W3cV2DataIntegrityCredentialServiceIntegration')
      agentContext = getAgentContext({
        agentConfig,
      })

      const mockDidsApi = {
        getCreatedDids: vi.fn().mockResolvedValue([]),
        resolveDidDocument: vi.fn().mockResolvedValue({
          dereferenceKey: vi.fn().mockReturnValue({
            id: verificationMethod,
            controller: verificationMethod.split('#')[0],
            type: 'JsonWebKey2020',
            publicKeyJwk: publicJwk,
          }),
          dereferenceVerificationMethod: vi.fn().mockReturnValue({
            id: verificationMethod,
            controller: verificationMethod.split('#')[0],
            type: 'JsonWebKey2020',
            publicKeyJwk: publicJwk,
          }),
        }),
      }

      const mockKeyManagementApi = {
        sign: vi.fn().mockResolvedValue({
          signature: new Uint8Array(64).fill(7),
        }),
        verify: vi.fn().mockResolvedValue({
          verified: true,
        }),
      }

      agentContext.dependencyManager.registerInstance(DidsApi, mockDidsApi as unknown as DidsApi)
      agentContext.dependencyManager.registerInstance(
        KeyManagementApi,
        mockKeyManagementApi as unknown as KeyManagementApi
      )

      // Set up Data Integrity services with real cryptosuite registry
      const cryptosuiteRegistry = new DataIntegrityCryptosuiteRegistry([
        {
          cryptosuiteClass: EddsaJcs2022Cryptosuite,
          cryptosuite: 'eddsa-jcs-2022',
          supportedPublicJwkTypes: [Ed25519PublicJwk],
        },
      ])

      diProofService = new DataIntegrityProofService(cryptosuiteRegistry)
      diContextValidator = new W3cV2DataIntegrityContextValidator().configure({
        knownContext: ['https://www.w3.org/ns/credentials/v2'],
      })
      diCredentialService = new W3cV2DataIntegrityCredentialService(diProofService, diContextValidator)
    })

    test('signs and verifies a credential through the VC and data integrity layers', async () => {
      const unsecuredCredential = CredoDidKeyDiExampleCredentialToSign

      const signedCredential = (await diCredentialService.signCredential(agentContext, {
        credential: unsecuredCredential as never,
        format: ClaimFormat.DiVc,
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod,
      })) as unknown as SignedCredential

      expect(signedCredential.securedCredential.proof.type).toBe('DataIntegrityProof')
      expect(signedCredential.securedCredential.proof.cryptosuite).toBe('eddsa-jcs-2022')
      expect(signedCredential.securedCredential.proof.proofPurpose).toBe('assertionMethod')
      expect(signedCredential.securedCredential.proof.verificationMethod).toBe(verificationMethod)

      const verifyResult = await diCredentialService.verifyCredential(agentContext, {
        credential: { securedCredential: signedCredential.securedCredential } as never,
      })

      expect(verifyResult.isValid).toBe(true)
      expect(verifyResult.validations.signature?.isValid).toBe(true)
    })

    test('verify fails when the secured credential loses its top-level context', async () => {
      const unsecuredCredential = CredoDidKeyDiExampleCredentialToSign

      const signedCredential = await diCredentialService.signCredential(agentContext, {
        credential: unsecuredCredential as never,
        format: ClaimFormat.DiVc,
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod,
      })

      const { '@context': removedContext, ...tamperedCredential } =
        signedCredential.securedCredential as unknown as Record<string, unknown>
      expect(removedContext).toBeDefined()

      const verifyResult = await diCredentialService.verifyCredential(agentContext, {
        credential: { securedCredential: tamperedCredential } as never,
      })

      expect(verifyResult.isValid).toBe(false)
      expect(verifyResult.validations.signature?.error).toBeDefined()
      expect(verifyResult.validations.signature?.error?.message).toContain('PROOF_VERIFICATION_ERROR')
    })

    test('verify fails when an unknown top-level context is present after signing', async () => {
      const unsecuredCredential = CredoDidKeyDiExampleCredentialToSign

      const signedCredential = await diCredentialService.signCredential(agentContext, {
        credential: unsecuredCredential as never,
        format: ClaimFormat.DiVc,
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod,
      })

      const tamperedCredential = {
        ...signedCredential.securedCredential,
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://unknown.attack.example/context'],
      }

      const verifyResult = await diCredentialService.verifyCredential(agentContext, {
        credential: { securedCredential: tamperedCredential } as never,
      })

      expect(verifyResult.isValid).toBe(false)
      expect(verifyResult.validations.signature?.error).toBeDefined()
      expect(verifyResult.validations.signature?.error?.message).toContain('PROOF_VERIFICATION_ERROR')
    })
  })
})
