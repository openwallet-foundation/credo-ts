import type { AgentContext } from '../../../agent/context'
import { injectable } from '../../../plugins'
import {
  createProofVerificationIssue,
  type W3cDataIntegrityProcessingIssue as DataIntegrityProcessingIssue,
  type W3cDataIntegrityUnsecuredDocument as DataIntegrityUnsecuredDocument,
} from '../../w3c-di/internal'
import { omitUndefinedFields } from '../../w3c-di/proof-processing/normalization'
import { CREDENTIALS_CONTEXT_V2_URL } from '../constants'
import { DEFAULT_CONTEXTS, DI_SPEC_CONTEXT_HASHES } from '../jsonld/contexts'
import { JsonLdModuleConfig } from '../jsonld/JsonLdModuleConfig'
import jsonld from '../jsonld/jsonld'

/**
 * Output of the VC Data Integrity §4.6 Context Validation algorithm.
 */
export interface W3cV2DataIntegrityContextValidationResult {
  validated: boolean
  validatedDocument: DataIntegrityUnsecuredDocument | null
  warnings: DataIntegrityProcessingIssue[]
  errors: DataIntegrityProcessingIssue[]
}

export interface W3cV2DataIntegrityContextValidatorOptions {
  recompactInvalidContexts?: boolean
}

/**
 * Implements the VC Data Integrity §4.6 Context Validation algorithm.
 *
 * Algorithm inputs:
 *   - inputDocument: the secured document (after proof verification)
 *   - recompactInvalidContexts: whether to run JSON-LD compaction when §4.6 step 3 trigger conditions are detected
 *
 * Recompaction delegates resolution of non-bundled contexts to the shared
 * {@link JsonLdModuleConfig}, so a custom `documentLoader` configured on
 * `JsonLdModule`/`W3cCredentialsModule` is honoured consistently with VC 1.1
 * JSON-LD processing. Context hash verification (§2.4) only trusts Credo's
 * bundled context copies; it does not fetch remote content over the network.
 */
@injectable()
export class W3cV2DataIntegrityContextValidator {
  private readonly recompactInvalidContexts: boolean
  private readonly jsonLdModuleConfig: JsonLdModuleConfig

  public constructor(jsonLdModuleConfig: JsonLdModuleConfig, options?: W3cV2DataIntegrityContextValidatorOptions) {
    this.jsonLdModuleConfig = jsonLdModuleConfig
    this.recompactInvalidContexts = options?.recompactInvalidContexts ?? true
  }

  public async validate(
    agentContext: AgentContext,
    inputDocument: DataIntegrityUnsecuredDocument
  ): Promise<W3cV2DataIntegrityContextValidationResult> {
    const normalisedInputDocument = omitUndefinedFields(inputDocument)
    const validatedDocument = { ...normalisedInputDocument }

    // §4.6, step 1: initialise result
    const result: W3cV2DataIntegrityContextValidationResult = {
      validated: false,
      validatedDocument,
      warnings: [],
      errors: [],
    }

    // §4.6, step 2: get contextValue
    const contextValue = normaliseContext(validatedDocument['@context'])

    // §2.4.2 Context Injection: context injection is only for securing, not verification.
    // A conforming verifier MUST NOT accept a document without top-level @context.
    if (validatedDocument['@context'] === undefined || validatedDocument['@context'] === null) {
      result.errors.push(
        createProofVerificationIssue(
          'Missing top-level @context in secured document',
          'Verification must not perform context injection (§2.4.2). Document must have explicit @context.'
        )
      )
      result.validated = false
      result.validatedDocument = null
      return result
    }

    // §4.6, step 3: detect trigger conditions
    const triggerErrors: DataIntegrityProcessingIssue[] = []

    // 3a: the mandatory VC 2.0 context must be first; additional contexts are permitted.
    if (contextValue[0] !== CREDENTIALS_CONTEXT_V2_URL) {
      triggerErrors.push(
        createProofVerificationIssue(
          '@context does not start with the required VC 2.0 context',
          `Document @context must start with '${CREDENTIALS_CONTEXT_V2_URL}'`
        )
      )
    }

    // 3b: any subtree contains @context (no exemptions per spec §4.6)
    const nestedContextPaths = collectAllNestedContextPaths(validatedDocument)
    if (nestedContextPaths.length > 0) {
      triggerErrors.push(
        createProofVerificationIssue(
          'Nested @context detected in document',
          `Nested @context found at path(s): ${nestedContextPaths.join(', ')}`
        )
      )
    }

    // 3c: URI dereferences to content not matching known hash (§2.4 normative hashes)
    for (const contextEntry of contextValue) {
      if (typeof contextEntry !== 'string') continue

      if (contextEntry === CREDENTIALS_CONTEXT_V2_URL) continue
      if (!(contextEntry in DI_SPEC_CONTEXT_HASHES)) continue

      const bundledContextIssue = this.verifyContextIsBundled(contextEntry)
      if (bundledContextIssue) {
        triggerErrors.push(bundledContextIssue)
        break
      }
    }

    if (triggerErrors.length > 0) {
      if (this.recompactInvalidContexts) {
        try {
          result.validatedDocument = (await jsonld.compact(normalisedInputDocument, [CREDENTIALS_CONTEXT_V2_URL], {
            documentLoader: getContextValidationDocumentLoader(this.jsonLdModuleConfig, agentContext),
            compactToRelative: false,
          })) as DataIntegrityUnsecuredDocument

          // Preserve trigger-condition visibility when recompaction succeeds.
          result.warnings.push(...triggerErrors)
        } catch (error) {
          result.errors.push(
            createProofVerificationIssue(
              'Context recompaction failed (§4.6 step 3.1)',
              error instanceof Error ? error.message : 'JSON-LD compaction failed'
            )
          )
        }
      } else {
        result.errors.push(...triggerErrors)
      }
    }

    // §4.6, step 4: finalise
    if (result.errors.length === 0) {
      result.validated = true
    } else {
      result.validated = false
      result.validatedDocument = null
    }

    // §4.6, step 5: return
    return result
  }

  /**
   * Verifies a spec-pinned context URI (§2.4). The §2.4 hash-pinning mechanism exists for
   * processors that don't vendor the canonical contexts and must instead fetch and hash-verify
   * them over the network; Credo vendors all spec-required contexts, so a bundled copy is
   * trusted as canonical and no network fetch or hash comparison is performed.
   */
  private verifyContextIsBundled(contextUri: string): DataIntegrityProcessingIssue | undefined {
    if (hasBundledContext(contextUri)) {
      return undefined
    }

    return createProofVerificationIssue(
      'Unable to verify context hash (§2.4)',
      `Context '${contextUri}' is not available as a bundled context and cannot be hash-verified`
    )
  }
}

function normaliseContext(context: unknown): unknown[] {
  if (context === undefined || context === null) return []
  return Array.isArray(context) ? context : [context]
}

function collectAllNestedContextPaths(value: unknown, path: string[] = []): string[] {
  if (value === null || typeof value !== 'object') return []

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectAllNestedContextPaths(item, [...path, String(i)]))
  }

  const obj = value as Record<string, unknown>
  const paths: string[] = []

  for (const [key, entry] of Object.entries(obj)) {
    const nextPath = [...path, key]
    const isTopLevelContext = path.length === 0 && key === '@context'

    if (key === '@context' && !isTopLevelContext) {
      paths.push(nextPath.join('.'))
    }

    paths.push(...collectAllNestedContextPaths(entry, nextPath))
  }

  return paths
}

function hasBundledContext(contextUrl: string): boolean {
  if (contextUrl in DEFAULT_CONTEXTS) return true
  const withoutFragment = contextUrl.split('#')[0]
  return withoutFragment in DEFAULT_CONTEXTS
}

/**
 * Document loader used for §4.6 context recompaction. Resolves bundled VC/Data Integrity
 * contexts locally without network access, and delegates everything else to the shared
 * {@link JsonLdModuleConfig} document loader so custom-context configuration is honoured
 * consistently with other JSON-LD consumers. Not cached across calls or validator
 * instances: the loader is cheap to construct and must always reflect the current
 * `AgentContext`.
 */
function getContextValidationDocumentLoader(jsonLdModuleConfig: JsonLdModuleConfig, agentContext: AgentContext) {
  // Constructed lazily (only when a non-bundled URL is actually encountered) so that
  // recompactions which only touch bundled contexts never need to resolve the
  // configured loader's own dependencies (e.g. DID resolution).
  let configuredLoader: ReturnType<JsonLdModuleConfig['documentLoader']> | undefined

  return async (url: string) => {
    if (url in DEFAULT_CONTEXTS) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: DEFAULT_CONTEXTS[url as keyof typeof DEFAULT_CONTEXTS],
      }
    }

    const withoutFragment = url.split('#')[0]
    if (withoutFragment in DEFAULT_CONTEXTS) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: DEFAULT_CONTEXTS[withoutFragment as keyof typeof DEFAULT_CONTEXTS],
      }
    }

    if (!configuredLoader) {
      configuredLoader = jsonLdModuleConfig.documentLoader(agentContext)
    }

    return configuredLoader(url)
  }
}
