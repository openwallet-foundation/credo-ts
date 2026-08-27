import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getAgentConfig, getAgentContext } from '../../../../../tests/helpers'
import type { AgentContext } from '../../../../agent/context'
import { W3cDataIntegrityProcessingErrorCode as DataIntegrityProcessingErrorCode } from '../../../w3c-di/internal'
import { W3cV2DataIntegrityContextValidator } from '../W3cV2DataIntegrityContextValidator'

const VC_V2_KNOWN_CONTEXT = ['https://www.w3.org/ns/credentials/v2']
const DI_PINNED_CONTEXTS = [
  'https://w3id.org/security/data-integrity/v2',
  'https://w3id.org/security/multikey/v1',
  'https://w3id.org/security/jwk/v1',
]

describe('W3cV2DataIntegrityContextValidator (§4.6 Context Validation)', () => {
  let agentContext: AgentContext
  let validator: W3cV2DataIntegrityContextValidator

  beforeEach(() => {
    vi.restoreAllMocks()

    agentContext = getAgentContext({
      agentConfig: getAgentConfig('W3cV2DataIntegrityContextValidatorTest'),
    })

    validator = new W3cV2DataIntegrityContextValidator({ recompactInvalidContexts: false })
  })

  // ── §4.6 step 3a ──────────────────────────────────────────────────────────

  describe('step 3a: mandatory VC 2.0 context', () => {
    test('passes when document starts with the mandatory VC 2.0 context', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validatedDocument).toBeDefined()
    })

    test('triggers when document @context is missing', async () => {
      const result = await validator.validate(agentContext, {
        id: 'urn:example:test',
        // No @context
      })

      expect(result.validated).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.type).toBe(DataIntegrityProcessingErrorCode.ProofVerificationError)
      expect(result.validatedDocument).toBeNull()
    })

    test('permits additional context entries', async () => {
      const result = await validator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://example.org/context/v1'],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('triggers when the mandatory VC 2.0 context is not first', async () => {
      const result = await validator.validate(agentContext, {
        '@context': 'https://w3id.org/security/data-integrity/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.validated).toBe(false)
      expect(result.errors[0]?.title).toBe('@context does not start with the required VC 2.0 context')
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
      const recompactingValidator = new W3cV2DataIntegrityContextValidator({
        recompactInvalidContexts: true,
      })

      const result = await recompactingValidator.validate(agentContext, {
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.validatedDocument).toBeNull()
    })

    test('configured validator with recompact=true permits additional context URIs', async () => {
      const recompactingValidator = new W3cV2DataIntegrityContextValidator({
        recompactInvalidContexts: true,
      })

      const result = await recompactingValidator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'http://injection.attack.org/'],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('recompaction can validate by removing nested proof context content', async () => {
      const recompactingValidator = new W3cV2DataIntegrityContextValidator()

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
      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
      expect(result.warnings.some((warning) => warning.title === 'Nested @context detected in document')).toBe(true)
      expect(result.validatedDocument).not.toBeNull()
    })

    test('recompaction tolerates id set to undefined on DI documents and does not raise JSON-LD @id errors', async () => {
      const recompactingValidator = new W3cV2DataIntegrityContextValidator()

      const result = await recompactingValidator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: undefined,
        proof: {
          type: 'DataIntegrityProof',
          '@context': 'https://example.org/evil/v1',
          cryptosuite: 'eddsa-rdfc-2022',
        },
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings.some((warning) => warning.title === 'Nested @context detected in document')).toBe(true)
      expect(result.validatedDocument).not.toBeNull()
    })

    test('with recompact=false, trigger conditions are errors and warnings remain empty', async () => {
      const strictValidator = new W3cV2DataIntegrityContextValidator({ recompactInvalidContexts: false })

      const result = await strictValidator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
        credentialSubject: {
          '@context': 'https://example.org/custom/v1',
          id: 'did:example:subject',
        },
      })

      expect(result.validated).toBe(false)
      expect(result.errors.some((error) => error.title === 'Nested @context detected in document')).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.validatedDocument).toBeNull()
    })
  })

  // ── §4.6 step 3c ──────────────────────────────────────────────────────────

  describe('step 3c: URI hash verification (§2.4 normative hashes)', () => {
    test('passes for each encountered spec-pinned DI URI with bundled local context (no fetch required)', async () => {
      const diOnlyValidator = new W3cV2DataIntegrityContextValidator()

      const fetchSpy = vi
        .spyOn(agentContext.config.agentDependencies, 'fetch')
        .mockRejectedValue(new Error('network unavailable'))

      const result = await diOnlyValidator.validate(agentContext, {
        '@context': [VC_V2_KNOWN_CONTEXT[0], ...DI_PINNED_CONTEXTS],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('does not perform DI hash verification when only credentials/v2 is encountered', async () => {
      const vcOnlyValidator = new W3cV2DataIntegrityContextValidator()

      const fetchSpy = vi.spyOn(agentContext.config.agentDependencies, 'fetch')

      const result = await vcOnlyValidator.validate(agentContext, {
        '@context': 'https://www.w3.org/ns/credentials/v2',
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
      // No DI hash checks/fetches for non-pinned URI
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('passes with an additional JSON-LD context object', async () => {
      const customValidator = new W3cV2DataIntegrityContextValidator({ recompactInvalidContexts: false })

      const result = await customValidator.validate(agentContext, {
        '@context': [VC_V2_KNOWN_CONTEXT[0], { Example: 'https://example.org/' }],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('accepts the VC 2.0 context followed by a bundled DI context', async () => {
      const vcOnlyValidator = new W3cV2DataIntegrityContextValidator({ recompactInvalidContexts: false })

      const result = await vcOnlyValidator.validate(agentContext, {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://w3id.org/security/data-integrity/v2'],
        id: 'urn:example:test',
      })

      expect(result.validated).toBe(true)
      expect(result.errors).toHaveLength(0)
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
