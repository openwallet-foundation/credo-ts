import { describe, expect, test, vi } from 'vitest'

import type { AgentContext } from '../../../agent'
import { DidsApi } from '../../dids'
import { ClaimFormat, SignatureSuiteRegistry } from '../../vc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import type { DifPresentationExchangeDefinitionV2 } from '../models'
import { createDifPresentationExchangeTestContext } from './fixtures'

type SigningService = {
  getAuthenticationVerificationMethodsForSubjectId: (
    agentContext: unknown,
    subjectId: string | undefined
  ) => Promise<unknown[]>
  getHolderDid: (agentContext: unknown) => Promise<string>
  getProofTypeForLdpVc: (...args: unknown[]) => string
  getVerificationMethodForLdpVp: (...args: unknown[]) => Promise<unknown>
  getSigningAlgorithmsForPresentationDefinitionAndInputDescriptors: (
    definitionAlgorithms: string[],
    descriptorAlgorithms: string[][]
  ) => string[] | undefined
}

const getSigningService = () => {
  const context = createDifPresentationExchangeTestContext()
  return {
    ...context,
    service: context.pexService as unknown as SigningService,
  }
}

const definition = (format?: DifPresentationExchangeDefinitionV2['format']): DifPresentationExchangeDefinitionV2 => ({
  id: 'signing-test',
  format,
  input_descriptors: [{ id: 'descriptor', constraints: { fields: [] } }],
})

const key = (id: string) => ({ id, controller: 'did:example:holder', type: 'JsonWebKey2020' })

const verificationMethod = {
  id: 'did:example:holder#key-1',
  controller: 'did:example:holder',
  type: 'JsonWebKey2020',
  publicKeyJwk: {
    kty: 'OKP',
    crv: 'Ed25519',
    x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
  },
}

const stubDidsApi = (agentContext: AgentContext, didsApi: unknown) => {
  const resolve = agentContext.dependencyManager.resolve.bind(agentContext.dependencyManager)
  return vi
    .spyOn(agentContext.dependencyManager, 'resolve')
    .mockImplementation((token) => (token === DidsApi ? didsApi : resolve(token)))
}

const stubDependency = (agentContext: AgentContext, tokenToStub: unknown, dependency: unknown) => {
  const resolve = agentContext.dependencyManager.resolve.bind(agentContext.dependencyManager)
  return vi
    .spyOn(agentContext.dependencyManager, 'resolve')
    .mockImplementation((token) => (token === tokenToStub ? dependency : resolve(token)))
}

describe('DifPresentationExchangeService presentation signing', () => {
  describe('holder-controlled DID fallback for unresolvable subject identifiers', () => {
    test('missing subject ID resolves authentication methods from the holder DID', async () => {
      const { agentContext, service } = getSigningService()
      const getHolderDid = vi.spyOn(service, 'getHolderDid').mockResolvedValue('did:example:holder')
      const resolveDidDocument = vi.fn().mockResolvedValue({
        authentication: [key('holder-key')],
        dereferenceKey: () => key('holder-key'),
      })
      stubDidsApi(agentContext, {
        getCreatedDids: vi.fn().mockResolvedValue([{ did: 'did:example:holder' }]),
        resolveDidDocument,
      })

      const methods = await service.getAuthenticationVerificationMethodsForSubjectId(agentContext, undefined)

      expect(getHolderDid).toHaveBeenCalledWith(agentContext)
      expect(resolveDidDocument).toHaveBeenCalledWith('did:example:holder')
      expect(methods).toEqual([key('holder-key')])
    })

    test('non-DID subject ID warns and resolves authentication methods from the holder DID', async () => {
      const { agentContext, service } = getSigningService()
      const getHolderDid = vi.spyOn(service, 'getHolderDid').mockResolvedValue('did:example:holder')
      const resolveDidDocument = vi.fn().mockResolvedValue({
        authentication: [key('holder-key')],
        dereferenceKey: () => key('holder-key'),
      })
      stubDidsApi(agentContext, {
        getCreatedDids: vi.fn().mockResolvedValue([{ did: 'did:example:holder' }]),
        resolveDidDocument,
      })
      const warn = vi.spyOn(agentContext.config.logger, 'warn')

      const methods = await service.getAuthenticationVerificationMethodsForSubjectId(
        agentContext,
        'https://example.com/subject'
      )

      expect(getHolderDid).toHaveBeenCalledWith(agentContext)
      expect(warn).toHaveBeenCalled()
      expect(resolveDidDocument).toHaveBeenCalledWith('did:example:holder')
      expect(resolveDidDocument).not.toHaveBeenCalledWith('https://example.com/subject')
      expect(methods).toEqual([key('holder-key')])
    })

    test('holder DID fallback fails when the wallet contains no created DIDs', async () => {
      const { agentContext, service } = getSigningService()
      stubDidsApi(agentContext, { getCreatedDids: vi.fn().mockResolvedValue([]) })

      await expect(service.getHolderDid(agentContext)).rejects.toThrow('no created DIDs found')
    })
  })

  describe('DID subject binding during presentation signing', () => {
    test('preserves subject-to-holder binding by resolving authentication methods from the subject DID', async () => {
      const { agentContext, service } = getSigningService()
      const getHolderDid = vi.spyOn(service, 'getHolderDid')
      const resolveDidDocument = vi.fn().mockResolvedValue({
        authentication: [key('subject-key')],
        dereferenceKey: () => key('subject-key'),
      })
      stubDidsApi(agentContext, { resolveDidDocument })

      const methods = await service.getAuthenticationVerificationMethodsForSubjectId(
        agentContext,
        'did:example:subject'
      )

      expect(getHolderDid).not.toHaveBeenCalled()
      expect(resolveDidDocument).toHaveBeenCalledWith('did:example:subject')
      expect(methods).toEqual([key('subject-key')])
    })
  })

  describe('LDP-VP proof type and verification method selection', () => {
    const getProofType = (format: DifPresentationExchangeDefinitionV2['format']) => {
      const { agentContext, service } = getSigningService()
      stubDependency(agentContext, SignatureSuiteRegistry, {
        getAllByPublicJwkType: vi
          .fn()
          .mockReturnValue([{ proofType: 'Ed25519Signature2018' }, { proofType: 'JsonWebSignature2020' }]),
      })

      return service.getProofTypeForLdpVc(agentContext, definition(format), verificationMethod)
    }

    test('uses ldp_vp.proof_type from presentation definition level for LDP-VP signing', () => {
      expect(getProofType({ ldp_vp: { proof_type: ['JsonWebSignature2020'] } })).toBe('JsonWebSignature2020')
    })

    test('intersects ldp_vp.proof_type constraints from presentation definition and input descriptors', () => {
      const { agentContext, service } = getSigningService()
      stubDependency(agentContext, SignatureSuiteRegistry, {
        getAllByPublicJwkType: vi.fn().mockReturnValue([{ proofType: 'JsonWebSignature2020' }]),
      })
      const pd = definition({ ldp_vp: { proof_type: ['Ed25519Signature2018', 'JsonWebSignature2020'] } })
      pd.input_descriptors[0].format = { ldp_vp: { proof_type: ['JsonWebSignature2020'] } }

      expect(service.getProofTypeForLdpVc(agentContext, pd, verificationMethod)).toBe('JsonWebSignature2020')
    })

    test('selects a non-first authentication key when the first key is incompatible with requested VP suite', async () => {
      const { agentContext, service } = getSigningService()
      const firstKey = key('first-key')
      const secondKey = key('second-key')
      vi.spyOn(service, 'getAuthenticationVerificationMethodsForSubjectId').mockResolvedValue([firstKey, secondKey])
      vi.spyOn(service, 'getProofTypeForLdpVc')
        .mockImplementationOnce(() => {
          throw new DifPresentationExchangeError('incompatible')
        })
        .mockReturnValueOnce('Ed25519Signature2018')

      await expect(
        service.getVerificationMethodForLdpVp(agentContext, 'did:example:holder', definition())
      ).resolves.toBe(secondKey)
    })

    test('deterministically picks a compatible key and suite when multiple options are available', async () => {
      const { agentContext, service } = getSigningService()
      const firstKey = key('first-key')
      const secondKey = key('second-key')
      vi.spyOn(service, 'getAuthenticationVerificationMethodsForSubjectId').mockResolvedValue([firstKey, secondKey])
      vi.spyOn(service, 'getProofTypeForLdpVc').mockReturnValue('Ed25519Signature2018')

      await expect(
        service.getVerificationMethodForLdpVp(agentContext, 'did:example:holder', definition())
      ).resolves.toBe(firstKey)
    })

    test('throws actionable error when no compatible key and ldp_vp.proof_type tuple exists', async () => {
      const { agentContext, service } = getSigningService()
      vi.spyOn(service, 'getAuthenticationVerificationMethodsForSubjectId').mockResolvedValue([key('first-key')])
      vi.spyOn(service, 'getProofTypeForLdpVc').mockImplementation(() => {
        throw new DifPresentationExchangeError('incompatible')
      })

      await expect(
        service.getVerificationMethodForLdpVp(
          agentContext,
          'did:example:holder',
          definition({ ldp_vp: { proof_type: ['Ed25519Signature2018'] } })
        )
      ).rejects.toThrow('No possible verification method')
    })

    test('falls back to key default signature suite when no ldp_vp format constraint is present', () => {
      expect(getProofType(undefined)).toBe('Ed25519Signature2018')
    })

    test('never uses ldp_vc.proof_type for VP signing when both ldp_vc and ldp_vp are present', () => {
      expect(
        getProofType({
          ldp_vc: { proof_type: ['Ed25519Signature2018'] },
          ldp_vp: { proof_type: ['JsonWebSignature2020'] },
        })
      ).toBe('JsonWebSignature2020')
      expect(ClaimFormat.LdpVp).toBe('ldp_vp')
    })
  })
})
