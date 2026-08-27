import type { AgentContext } from '../../../agent/context'
import { Hasher } from '../../../crypto'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { TypedArrayEncoder } from '../../../utils'
import { fetchWithTimeout } from '../../../utils/fetch'
import {
  createProofVerificationIssue,
  type W3cDataIntegrityProcessingIssue as DataIntegrityProcessingIssue,
  type W3cDataIntegrityUnsecuredDocument as DataIntegrityUnsecuredDocument,
} from '../../w3c-di/internal'
import { omitUndefinedFields } from '../../w3c-di/proof-processing/normalization'
import { CREDENTIALS_CONTEXT_V2_URL } from '../constants'
import { DEFAULT_CONTEXTS, DI_SPEC_CONTEXT_HASHES } from '../jsonld/contexts'
import type { DocumentLoader } from '../jsonld/jsonld'
import jsonld from '../jsonld/jsonld'
import { getNativeDocumentLoader } from '../jsonld/nativeDocumentLoader'

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
 */
@injectable()
export class W3cV2DataIntegrityContextValidator {
  private readonly recompactInvalidContexts: boolean

  public constructor(options?: W3cV2DataIntegrityContextValidatorOptions) {
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

      const hashIssue = await verifyContextUriHash(agentContext, contextEntry)
      if (hashIssue) {
        triggerErrors.push(hashIssue)
        break
      }
    }

    if (triggerErrors.length > 0) {
      if (this.recompactInvalidContexts) {
        try {
          result.validatedDocument = (await jsonld.compact(normalisedInputDocument, [CREDENTIALS_CONTEXT_V2_URL], {
            documentLoader: await getContextValidationDocumentLoader(),
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

async function verifyContextUriHash(
  agentContext: AgentContext,
  contextUri: string
): Promise<DataIntegrityProcessingIssue | undefined> {
  const expectedHash = DI_SPEC_CONTEXT_HASHES[contextUri]
  if (!expectedHash) {
    // Unknown URI does not match a known good value per §4.6 step 3c
    return createProofVerificationIssue(
      'Context URI does not match known good value (§4.6 step 3c)',
      `No known good value or cryptographic hash for context URI '${contextUri}'`
    )
  }

  // Use bundled local copy for spec-standard contexts (§2.4)
  if (hasBundledContext(contextUri)) {
    // Bundled copy is trusted as the canonical context for spec-pinned URIs
    return undefined
  }

  // Fetch remote and verify against spec hash
  let contextBytes: Uint8Array
  try {
    contextBytes = await getContextBytes(agentContext, contextUri)
  } catch (error) {
    return createProofVerificationIssue(
      'Unable to retrieve context for hash verification',
      error instanceof Error ? error.message : `Failed to resolve '${contextUri}'`
    )
  }

  const actualHash = computeContextHash(contextBytes)
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    return createProofVerificationIssue(
      'Context hash verification failed (§2.4)',
      `Context '${contextUri}' hash '${actualHash}' did not match expected '${expectedHash}'`
    )
  }

  return undefined
}

async function getContextBytes(agentContext: AgentContext, contextUrl: string): Promise<Uint8Array> {
  const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, contextUrl, {
    headers: {
      Accept: 'application/ld+json',
    },
  })

  if (!response.ok) {
    throw new CredoError(`Unable to fetch context '${contextUrl}': HTTP ${response.status}`)
  }

  const responseBytes = new Uint8Array(await response.arrayBuffer())
  if (responseBytes.length === 0) {
    throw new CredoError(`Unable to fetch context '${contextUrl}': empty response body`)
  }

  return responseBytes
}

function computeContextHash(contextBytes: Uint8Array): string {
  const hash = Hasher.hash(contextBytes, 'sha-256')
  return TypedArrayEncoder.toHex(hash)
}

function hasBundledContext(contextUrl: string): boolean {
  if (contextUrl in DEFAULT_CONTEXTS) return true
  const withoutFragment = contextUrl.split('#')[0]
  return withoutFragment in DEFAULT_CONTEXTS
}

let cachedContextValidationDocumentLoader: DocumentLoader | undefined

async function getContextValidationDocumentLoader(): Promise<DocumentLoader> {
  if (cachedContextValidationDocumentLoader) return cachedContextValidationDocumentLoader

  const nativeLoaderFactory = await getNativeDocumentLoader()
  const nativeLoader = nativeLoaderFactory.apply(jsonld, [])

  cachedContextValidationDocumentLoader = async (url: string) => {
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

    return nativeLoader(url)
  }

  return cachedContextValidationDocumentLoader
}
