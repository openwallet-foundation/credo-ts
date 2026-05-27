import { CredoError } from '../../../error'
import { W3cV2JwtVerifiablePresentation } from '../jwt-vc'
import { ClaimFormat } from '../models'
import { W3cV2CredentialService } from '../W3cV2CredentialService'

describe('W3cV2CredentialService Data Integrity stubs', () => {
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

  const agentContext = {} as never

  const service = new W3cV2CredentialService(repository as never, sdJwtService as never, jwtService as never)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('signCredential rejects di_vc via stub hook', async () => {
    await expect(
      service.signCredential(agentContext, {
        format: ClaimFormat.DiVc,
        credential: {} as never,
        verificationMethod: 'did:example:issuer#key-1',
      })
    ).rejects.toThrow(CredoError)

    await expect(
      service.signCredential(agentContext, {
        format: ClaimFormat.DiVc,
        credential: {} as never,
        verificationMethod: 'did:example:issuer#key-1',
      })
    ).rejects.toThrow("Data Integrity format 'di_vc' is not supported")
  })

  test('verifyCredential rejects di_vc via stub hook', async () => {
    await expect(
      service.verifyCredential(agentContext, {
        credential: { claimFormat: ClaimFormat.DiVc },
      } as never)
    ).rejects.toThrow("Data Integrity format 'di_vc' is not supported")
  })

  test('signPresentation rejects di_vp via stub hook', async () => {
    await expect(
      service.signPresentation(agentContext, {
        format: ClaimFormat.DiVp,
        presentation: {} as never,
        challenge: 'challenge-123',
      })
    ).rejects.toThrow("Data Integrity format 'di_vp' is not supported")
  })

  test('verifyPresentation rejects di_vp via stub hook', async () => {
    await expect(
      service.verifyPresentation(agentContext, {
        presentation: { claimFormat: ClaimFormat.DiVp },
        challenge: 'challenge-123',
      } as never)
    ).rejects.toThrow("Data Integrity format 'di_vp' is not supported")
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

  test('non-DI verifyPresentation routes to jwt service unchanged', async () => {
    const jwtPresentation = Object.assign(Object.create(W3cV2JwtVerifiablePresentation.prototype), {
      resolvedPresentation: {
        verifiableCredential: [{ claimFormat: ClaimFormat.JwtW3cVc }, { claimFormat: ClaimFormat.DiVc }],
      },
    }) as W3cV2JwtVerifiablePresentation

    jwtService.verifyPresentation.mockResolvedValue({ isValid: true, validations: {} })

    const result = await service.verifyPresentation(agentContext, {
      presentation: jwtPresentation,
      challenge: 'challenge-123',
    } as never)

    expect(jwtService.verifyPresentation).toHaveBeenCalledTimes(1)
    expect(sdJwtService.verifyPresentation).not.toHaveBeenCalled()
    expect(result).toEqual({ isValid: true, validations: {} })
  })
})
