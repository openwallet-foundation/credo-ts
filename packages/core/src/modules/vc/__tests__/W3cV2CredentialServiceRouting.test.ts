import { CredoError } from '../../../error'
import { W3cV2DataIntegrityVerifiableCredential, W3cV2DataIntegrityVerifiablePresentation } from '../data-integrity-v1'
import { W3cV2JwtVerifiablePresentation } from '../jwt-vc'
import { CredoEs256DidJwkJwtVc, CredoEs256DidKeyJwtVp } from '../jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { W3cV2JwtVerifiableCredential } from '../jwt-vc/W3cV2JwtVerifiableCredential'
import { ClaimFormat } from '../models'
import * as W3cV2VerifiablePresentationModule from '../models/presentation/W3cV2VerifiablePresentation'
import { W3cV2SdJwtVerifiableCredential } from '../sd-jwt-vc'
import {
  CredoEs256DidJwkJwtVc as CredoEs256DidJwkSdJwtVc,
  CredoEs256DidKeyJwtVp as CredoEs256DidKeySdJwtVp,
} from '../sd-jwt-vc/__tests__/fixtures/credo-sd-jwt-vc'
import { W3cV2SdJwtVerifiablePresentation } from '../sd-jwt-vc/W3cV2SdJwtVerifiablePresentation'
import { W3cV2CredentialService } from '../W3cV2CredentialService'
import {
  mixedJwtVp,
  mixedNestedDecodedJwtVp,
  mixedNestedOuterJwtVp,
  mixedSdJwtVp,
  mixedVpBaseResolvedPresentation,
} from './mixedVpFixture'

describe('W3cV2CredentialService routing', () => {
  const repository = {
    save: vi.fn(),
    deleteById: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    findByQuery: vi.fn(),
    findSingleByQuery: vi.fn(),
  }

  const sdJwtService = {
    signCredential: vi.fn(),
    verifyCredential: vi.fn(),
    signPresentation: vi.fn(),
    verifyPresentation: vi.fn(),
  }

  const jwtService = {
    signCredential: vi.fn(),
    verifyCredential: vi.fn(),
    signPresentation: vi.fn(),
    verifyPresentation: vi.fn(),
  }

  const diService = {
    signCredential: vi.fn(),
    verifyCredential: vi.fn(),
    signPresentation: vi.fn(),
    verifyPresentation: vi.fn(),
  }

  const agentContext = {} as never

  const service = new W3cV2CredentialService(
    repository as never,
    sdJwtService as never,
    jwtService as never,
    diService as never
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('signCredential routes di_vc to DI service', async () => {
    diService.signCredential.mockResolvedValue({ claimFormat: ClaimFormat.DiVc })

    const result = await service.signCredential(agentContext, {
      format: ClaimFormat.DiVc,
      credential: {} as never,
      verificationMethod: 'did:example:issuer#key-1',
      cryptosuite: 'eddsa-jcs-2022',
    } as never)

    expect(diService.signCredential).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ claimFormat: ClaimFormat.DiVc })
  })

  test('verifyCredential routes di_vc to DI service', async () => {
    diService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyCredential(agentContext, {
      credential: { __proto__: W3cV2DataIntegrityVerifiableCredential.prototype },
    } as never)

    expect(diService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(result.isValid).toBe(true)
  })

  test('verifyCredential normalizes compact JWT VC strings before routing', async () => {
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    await service.verifyCredential(agentContext, {
      credential: CredoEs256DidJwkJwtVc,
    } as never)

    expect(jwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyCredential).not.toHaveBeenCalled()
    expect(jwtService.verifyCredential.mock.calls[0]?.[1].credential).toBeInstanceOf(W3cV2JwtVerifiableCredential)
  })

  test('verifyCredential normalizes compact SD-JWT VC strings before routing', async () => {
    sdJwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    await service.verifyCredential(agentContext, {
      credential: CredoEs256DidJwkSdJwtVc,
    } as never)

    expect(sdJwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyCredential).not.toHaveBeenCalled()
    expect(sdJwtService.verifyCredential.mock.calls[0]?.[1].credential).toBeInstanceOf(W3cV2SdJwtVerifiableCredential)
  })

  test('signPresentation routes di_vp to DI service', async () => {
    diService.signPresentation.mockResolvedValue({ claimFormat: ClaimFormat.DiVp })

    const result = await service.signPresentation(agentContext, {
      format: ClaimFormat.DiVp,
      presentation: {} as never,
      challenge: 'challenge-123',
      verificationMethod: 'did:example:holder#key-1',
      cryptosuite: 'eddsa-jcs-2022',
    } as never)

    expect(diService.signPresentation).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ claimFormat: ClaimFormat.DiVp })
  })

  test('verifyPresentation routes di_vp to DI service', async () => {
    diService.verifyPresentation.mockResolvedValue({
      isValid: false,
      presentation: {
        isValid: false,
        error: new CredoError('DI VP invalid'),
        validations: {},
      },
      credentialEntries: [],
    })

    const result = await service.verifyPresentation(agentContext, {
      presentation: { __proto__: W3cV2DataIntegrityVerifiablePresentation.prototype },
      challenge: 'challenge-123',
    } as never)

    expect(diService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(result.isValid).toBe(false)
    expect(result.presentation.isValid).toBe(false)
    expect(result.presentation.error?.message).toContain('DI VP invalid')
    expect(result.credentialEntries).toEqual([])
  })

  test('verifyPresentation routes DI outer VP through DI service and verifies enclosed entries', async () => {
    const nonDiCredentialEntries = [
      mixedVpBaseResolvedPresentation.verifiableCredential[0],
      mixedVpBaseResolvedPresentation.verifiableCredential[1],
    ]

    const diOuterVp = W3cV2DataIntegrityVerifiablePresentation.fromObject({
      ...mixedVpBaseResolvedPresentation,
      verifiableCredential: nonDiCredentialEntries,
      proof: {
        type: 'DataIntegrityProof',
      },
    })

    diService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })
    sdJwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: diOuterVp,
      challenge: 'challenge-123',
    } as never)

    expect(diService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(result.presentation.isValid).toBe(true)
    expect(result.credentialEntries).toHaveLength(2)
    expect(result.credentialEntries[0]?.isValid).toBe(true)
    expect(result.credentialEntries[1]?.isValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  test('non-DI signCredential routes to jwt service unchanged', async () => {
    jwtService.signCredential.mockResolvedValue({ claimFormat: ClaimFormat.JwtW3cVc })

    const result = await service.signCredential(agentContext, {
      format: ClaimFormat.JwtW3cVc,
      credential: {} as never,
      verificationMethod: 'did:example:issuer#key-1',
      alg: 'EdDSA',
    } as never)

    expect(jwtService.signCredential).toHaveBeenCalledTimes(1)
    expect(sdJwtService.signCredential).not.toHaveBeenCalled()
    expect(result).toEqual({ claimFormat: ClaimFormat.JwtW3cVc })
  })

  test('verifyPresentation routes enclosed credentials by entry format for JWT outer VP', async () => {
    jwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })
    sdJwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })
    diService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: mixedJwtVp,
      challenge: 'challenge-123',
    } as never)

    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyPresentation).not.toHaveBeenCalled()
    expect(jwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(diService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(result.presentation.isValid).toBe(true)
    expect(result.credentialEntries).toHaveLength(3)
    expect(result.credentialEntries[0]?.isValid).toBe(true)
    expect(result.credentialEntries[1]?.isValid).toBe(true)
    expect(result.credentialEntries[2]?.isValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  test('verifyPresentation routes enclosed credentials by entry format for SD-JWT outer VP', async () => {
    sdJwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })
    sdJwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })
    diService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: mixedSdJwtVp,
      challenge: 'challenge-123',
    } as never)

    expect(sdJwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyPresentation).not.toHaveBeenCalled()
    expect(sdJwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(diService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(result.presentation.isValid).toBe(true)
    expect(result.credentialEntries).toHaveLength(3)
    expect(result.credentialEntries[0]?.isValid).toBe(true)
    expect(result.credentialEntries[1]?.isValid).toBe(true)
    expect(result.credentialEntries[2]?.isValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  test('verifyPresentation normalizes compact JWT VP strings before routing', async () => {
    jwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    await service.verifyPresentation(agentContext, {
      presentation: CredoEs256DidKeyJwtVp,
      challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
      domain: 'example.com',
    } as never)

    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyPresentation.mock.calls[0]?.[1].presentation).toBeInstanceOf(W3cV2JwtVerifiablePresentation)
  })

  test('verifyPresentation normalizes compact SD-JWT VP strings before routing', async () => {
    sdJwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    sdJwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    await service.verifyPresentation(agentContext, {
      presentation: CredoEs256DidKeySdJwtVp,
      challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
      domain: 'example.com',
    } as never)

    expect(sdJwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyPresentation.mock.calls[0]?.[1].presentation).toBeInstanceOf(
      W3cV2SdJwtVerifiablePresentation
    )
  })

  test('verifyPresentation short-circuits when outer presentation verification fails', async () => {
    jwtService.verifyPresentation.mockResolvedValue({
      isValid: false,
      presentation: { isValid: false, validations: {} },
      credentialEntries: [],
    })

    const result = await service.verifyPresentation(agentContext, {
      presentation: mixedJwtVp,
      challenge: 'challenge-123',
    } as never)

    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(jwtService.verifyCredential).not.toHaveBeenCalled()
    expect(sdJwtService.verifyCredential).not.toHaveBeenCalled()
    expect(result.isValid).toBe(false)
    expect(result.presentation.isValid).toBe(false)
    expect(result.credentialEntries).toEqual([])
  })

  test('verifyPresentation marks credential invalid when presenter does not authenticate credential subject', async () => {
    const jwtOnlyResolvedPresentation = {
      ...mixedVpBaseResolvedPresentation,
      holder: 'did:example:presenter',
      verifiableCredential: [mixedVpBaseResolvedPresentation.verifiableCredential[0]],
    }
    Object.setPrototypeOf(jwtOnlyResolvedPresentation, Object.getPrototypeOf(mixedVpBaseResolvedPresentation))

    const jwtOnlyVp = {
      __proto__: W3cV2JwtVerifiablePresentation.prototype,
      resolvedPresentation: jwtOnlyResolvedPresentation,
    }

    jwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: jwtOnlyVp,
      challenge: 'challenge-123',
    } as never)

    expect(result.credentialEntries).toHaveLength(1)
    expect(result.credentialEntries[0]?.isValid).toBe(false)
    expect(result.credentialEntries[0]?.validations.credentialSubjectAuthentication?.isValid).toBe(false)
    expect(result.credentialEntries[0]?.validations.credentialSubjectAuthentication?.error?.message).toContain(
      'presentation does not authenticate credential subject'
    )
    expect(result.isValid).toBe(false)
  })

  test('verifyPresentation returns valid when outer presentation and enclosed credentials are valid', async () => {
    const jwtOnlyResolvedPresentation = {
      ...mixedVpBaseResolvedPresentation,
      verifiableCredential: [mixedVpBaseResolvedPresentation.verifiableCredential[0]],
    }
    Object.setPrototypeOf(jwtOnlyResolvedPresentation, Object.getPrototypeOf(mixedVpBaseResolvedPresentation))

    const jwtOnlyVp = {
      __proto__: W3cV2JwtVerifiablePresentation.prototype,
      resolvedPresentation: jwtOnlyResolvedPresentation,
    }

    jwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: jwtOnlyVp,
      challenge: 'challenge-123',
    } as never)

    expect(result.presentation.isValid).toBe(true)
    expect(result.credentialEntries).toHaveLength(1)
    expect(result.credentialEntries[0]?.isValid).toBe(true)
    expect(result.credentialEntries[0]?.validations.credentialSubjectAuthentication?.isValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  test('verifyPresentation recursively traverses nested EnvelopedVerifiablePresentation entries', async () => {
    vi.spyOn(W3cV2VerifiablePresentationModule, 'decodeW3cV2EnvelopedVerifiablePresentation').mockReturnValueOnce(
      mixedNestedDecodedJwtVp as never
    )

    jwtService.verifyPresentation.mockResolvedValue({
      isValid: true,
      presentation: { isValid: true, validations: {} },
      credentialEntries: [],
    })
    jwtService.verifyCredential.mockResolvedValue({ isValid: true, validations: {}, error: undefined })

    const result = await service.verifyPresentation(agentContext, {
      presentation: mixedNestedOuterJwtVp,
      challenge: 'challenge-123',
    } as never)

    expect(jwtService.verifyPresentation.mock.calls[0]?.[1].presentation).toBe(mixedNestedOuterJwtVp)
    expect(jwtService.verifyPresentation.mock.calls[1]?.[1].presentation).toBe(mixedNestedDecodedJwtVp)
    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(2)
    expect(jwtService.verifyCredential).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyCredential).not.toHaveBeenCalled()
    expect(result.credentialEntries).toHaveLength(1)
    expect(result.credentialEntries[0]?.isValid).toBe(true)
    expect(result.isValid).toBe(true)
  })

  test('verifyPresentation marks entry invalid when nested presentation verification fails', async () => {
    vi.spyOn(W3cV2VerifiablePresentationModule, 'decodeW3cV2EnvelopedVerifiablePresentation').mockReturnValueOnce(
      mixedNestedDecodedJwtVp as never
    )

    jwtService.verifyPresentation
      .mockResolvedValueOnce({
        isValid: true,
        presentation: { isValid: true, validations: {} },
        credentialEntries: [],
      })
      .mockResolvedValueOnce({
        isValid: false,
        presentation: { isValid: false, validations: {} },
        credentialEntries: [],
      })

    const result = await service.verifyPresentation(agentContext, {
      presentation: mixedNestedOuterJwtVp,
      challenge: 'challenge-123',
    } as never)

    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(2)
    expect(jwtService.verifyCredential).not.toHaveBeenCalled()
    expect(result.credentialEntries).toHaveLength(1)
    expect(result.credentialEntries[0]?.isValid).toBe(false)
    expect(result.credentialEntries[0]?.error?.message).toContain('Nested presentation verification failed')
    expect(result.isValid).toBe(false)
  })
})
