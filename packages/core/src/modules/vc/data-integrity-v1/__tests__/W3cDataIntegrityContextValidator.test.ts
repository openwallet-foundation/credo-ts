import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import type { AgentContext } from '../../../../agent/context'
import { W3cDataIntegrityProcessingErrorCode as DataIntegrityProcessingErrorCode } from '../../../w3c-di/internal'
import { W3cDataIntegrityContextValidator } from '../W3cDataIntegrityContextValidator'

const VC_V2_KNOWN_CONTEXT = ['https://www.w3.org/ns/credentials/v2']
const DI_PINNED_CONTEXTS = [
  'https://w3id.org/security/data-integrity/v2',
  'https://w3id.org/security/multikey/v1',
  'https://w3id.org/security/jwk/v1',
]

describe('W3cDataIntegrityContextValidator (§4.6 Context Validation)', () => {
  let agentContext: AgentContext
  let validator: W3cDataIntegrityContextValidator

  beforeEach(() => {
    vi.restoreAllMocks()

    agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cDataIntegrityContextValidatorTest'),
    })

    // VC processing baseline: credentials/v2 knownContext (configured by caller/module)
    validator = new W3cDataIntegrityContextValidator().configure({
      knownContext: VC_V2_KNOWN_CONTEXT,
      recompactInvalidContexts: false,
    })
  })

  // ── §4.6 step 3a ──────────────────────────────────────────────────────────

  describe('step 3a: contextValue does not deeply equal knownContext', () => {
    test('passes when document @context deeply equals configured knownContext', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validatedDocument).toBeDefined()
    })

    test('triggers when document @context is missing (empty vs non-empty knownContext)', async () => {
      const result = await validator.validate(agentContext, {
        id: 'urn:example:test',
        // No @context
      })

      expect(result.validated).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
      expect(result.validatedDocument).toBeNull()
    })

    test('triggers when document has extra context URL beyond knownContext', async () => {
      const result = await validator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://schema.org/'],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
      expect(result.errors[0]?.title).toBe('@context does not match the expected known context')
    })

    test('triggers when document @context does not match configured knownContext', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://w3id.org/security/data-integrity/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.errors[0]?.title).toBe('@context does not match the expected known context')
    })

    test('triggers when order differs for a multi-element configured knownContext', async () => {
      const orderedValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: ['https://www.w3.org/ns/credentials/v2', 'https://example.org/custom/v1'],
        recompactInvalidContexts: false,
      })

      const result = await orderedValidator.validate(agentContext, {
        '@context': ['https://example.org/custom/v1', 'https://www.w3.org/ns/credentials/v2'],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.errors[0]?.title).toBe('@context does not match the expected known context')
    })
  })

  // ── §4.6 step 3b ──────────────────────────────────────────────────────────

  describe('step 3b: any subtree contains @context', () => {
    test('triggers when nested @context exists in a non-root object', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        credentialSubject: {
          '@context': 'https://example.org/custom/v1',
          id: 'did:example:subject',
        },
      })

      expect(result.validated).toBe(false)
      expect(result.errors.some((e) => e.title === 'Nested @context detected in document')).toBe(true)
    })

    test('triggers when nested @context exists inside the proof branch (no proof exemption in §4.6)', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          '@context': 'https://example.org/evil/v1',
          cryptosuite: 'eddsa-rdfc-2022',
        },
      })

      expect(result.validated).toBe(false)
      expect(result.errors.some((e) => e.title === 'Nested @context detected in document')).toBe(true)
    })

    test('triggers when nested @context is deeply nested', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        credentialSubject: {
          id: 'did:example:subject',
          address: {
            '@context': 'https://schema.org/',
            city: 'London',
          },
        },
      })

      expect(result.validated).toBe(false)
      expect(result.errors.some((e) => e.title === 'Nested @context detected in document')).toBe(true)
    })
  })

  describe('step 3.1: recompaction', () => {
    test('configured validator with recompact=true must not silently accept missing @context', async () => {
      const recompactingValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: VC_V2_KNOWN_CONTEXT,
        recompactInvalidContexts: true,
      })

      const result = await recompactingValidator.validate(agentContext, {
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.validatedDocument).toBeNull()
    })

    test('configured validator with recompact=true rejects extra URIs that cannot be resolved', async () => {
      const recompactingValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: VC_V2_KNOWN_CONTEXT,
        recompactInvalidContexts: true,
      })

      const result = await recompactingValidator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'http://injection.attack.org/'],
        id: 'urn:example:test',
      })

      // Step 3a triggers (not deeply equal), step 3c triggers (unknown URI does not match known good value).
      // Step 3.1 recompaction is attempted but fails because injection.attack.org cannot be resolved.
      expect(result.validated).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.validatedDocument).toBeNull()
    })

    test('recompaction can validate by removing nested proof context content not in knownContext', async () => {
      const recompactingValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: VC_V2_KNOWN_CONTEXT,
      })

      const result = await recompactingValidator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          '@context': 'https://example.org/evil/v1',
          cryptosuite: 'eddsa-rdfc-2022',
        },
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validatedDocument).not.toBeNull()
    })
  })

  // ── §4.6 step 3c ──────────────────────────────────────────────────────────

  describe('step 3c: URI hash verification (§2.4 normative hashes)', () => {
    test('passes for each encountered spec-pinned DI URI with bundled local context (no fetch required)', async () => {
      const diOnlyValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: DI_PINNED_CONTEXTS,
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))

      const result = await diOnlyValidator.validate(agentContext, {
        '@context': DI_PINNED_CONTEXTS,
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('does not perform DI hash verification when only credentials/v2 is encountered', async () => {
      const vcOnlyValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: VC_V2_KNOWN_CONTEXT,
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const result = await vcOnlyValidator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      // No DI hash checks/fetches for non-pinned URI
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('passes with custom knownContext URI not in DI_SPEC_CONTEXT_HASHES (no hash verification required)', async () => {
      const customContext = ['https://example.org/custom/context/v1']
      const customValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: customContext,
      })

      const result = await customValidator.validate(agentContext, {
        '@context': 'https://example.org/custom/context/v1',
        id: 'urn:example:test',
      })

      // URI is in knownContext, so it passes without requiring hash verification or network fetch
      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('DI hash-pinned context checks are independent from VC baseline knownContext', async () => {
      const vcOnlyValidator = new W3cDataIntegrityContextValidator().configure({
        knownContext: VC_V2_KNOWN_CONTEXT,
        recompactInvalidContexts: false,
      })

      const result = await vcOnlyValidator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://w3id.org/security/data-integrity/v2'],
        id: 'urn:example:test',
      })

      // Fails due to 3a knownContext mismatch, not hash pinning issues.
      expect(result.validated).toBe(false)
      expect(result.errors.some((e) => e.title === '@context does not match the expected known context')).toBe(true)
      expect(result.errors.some((e) => e.title === 'Context hash verification failed (§2.4)')).toBe(false)
    })
  })

  // ── §4.6 steps 4 & 5: result finalisation ─────────────────────────────────

  describe('steps 4 & 5: result finalisation', () => {
    test('sets validated=true and returns validatedDocument when all checks pass', async () => {
      const inputDocument = {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        type: ['VerifiableCredential'],
      }

      const result = await validator.validate(agentContext, inputDocument)

      expect(result.validated).toBe(true)
      expect(result.validatedDocument).toEqual(inputDocument)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    test('sets validated=false and validatedDocument=null when any check fails', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://unknown.example/context',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.validatedDocument).toBeNull()
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })

    test('collects errors from multiple triggered conditions (3a and 3b both fire)', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://wrong.example/context',
        id: 'urn:example:test',
        credentialSubject: {
          '@context': 'https://extra.example/context',
        },
      })

      expect(result.validated).toBe(false)
      // Both step 3a (wrong context) and step 3b (nested context) should fire
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })
})
