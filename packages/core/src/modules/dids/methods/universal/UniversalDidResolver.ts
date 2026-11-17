import type { AgentContext } from '../../../../agent'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../../types'

export interface UniversalDidResolverOptions {
  /**
   * The DID methods to resolve through the Universal Resolver, for example `['ethr', 'ion']`. A resolver is chosen by
   * method, so the list is what decides which DIDs are sent to the service. Methods that Credo resolves itself
   * (`key`, `jwk`, `peer`, `web`, `cheqd`) should not be listed.
   */
  methods: string[]
  /**
   * The identifiers endpoint of a Universal Resolver, ending in `/identifiers/`.
   *
   * @default 'https://dev.uniresolver.io/1.0/identifiers/', a public instance for development. Run your own, or use one
   * you trust, for production: it can return any document for any DID it is asked about.
   */
  url?: string
  /**
   * Maximum size in bytes of a response.
   *
   * @default the `maxResponseBytes` of the agent's `fetchLimits`
   */
  maxResponseBytes?: number
}

export const defaultUniversalResolverUrl = 'https://dev.uniresolver.io/1.0/identifiers/'

/**
 * Resolves DIDs of the listed methods through a Universal Resolver (https://github.com/decentralized-identity/universal-resolver).
 *
 * Only a document for the DID that was asked about is accepted, so a resolver that answers with another DID's document
 * does not get it trusted. Which resolver to trust is still up to you.
 */
export class UniversalDidResolver implements DidResolver {
  public readonly supportedMethods: string[]
  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = false

  private readonly url: string
  private readonly maxResponseBytes?: number

  public constructor(options: UniversalDidResolverOptions) {
    this.supportedMethods = options.methods
    this.url = (options.url ?? defaultUniversalResolverUrl).replace(/\/?$/, '/')
    this.maxResponseBytes = options.maxResponseBytes
  }

  public async resolve(
    agentContext: AgentContext,
    did: string,
    _parsed: ParsedDid,
    _didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    const failure = (error: string, message: string): DidResolutionResult => ({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error, message },
    })

    try {
      const response = await agentContext.config.fetch(`${this.url}${encodeURI(did)}`, {
        headers: { Accept: 'application/did+ld+json, application/did+json, application/json' },
        maxResponseBytes: this.maxResponseBytes,
      })

      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
      if (!response.ok) {
        const metadataError = (body?.didResolutionMetadata as { error?: string } | undefined)?.error
        return failure(
          metadataError ?? (response.status === 404 || response.status === 410 ? 'notFound' : 'internalError'),
          `The Universal Resolver answered ${response.status} for ${did}`
        )
      }
      if (!body || typeof body !== 'object') return failure('invalidDidDocument', 'The response is not JSON')

      // The service answers with a resolution result, or with the document itself
      const isResult = 'didDocument' in body || 'didResolutionMetadata' in body
      const document = (isResult ? body.didDocument : body) as { id?: string } | null | undefined
      if (!document) {
        const metadata = (body.didResolutionMetadata ?? {}) as DidResolutionResult['didResolutionMetadata']
        return {
          didDocument: null,
          didDocumentMetadata: (body.didDocumentMetadata ?? {}) as DidResolutionResult['didDocumentMetadata'],
          didResolutionMetadata: metadata.error ? metadata : { ...metadata, error: 'notFound' },
        }
      }
      if (document.id !== did) {
        return failure('invalidDidDocument', `The document is for ${document.id}, not for ${did}`)
      }

      return {
        didDocument: JsonTransformer.fromJSON(document, DidDocument),
        didDocumentMetadata: (isResult
          ? (body.didDocumentMetadata ?? {})
          : {}) as DidResolutionResult['didDocumentMetadata'],
        didResolutionMetadata: (isResult
          ? (body.didResolutionMetadata ?? {})
          : {}) as DidResolutionResult['didResolutionMetadata'],
      }
    } catch (error) {
      return failure('internalError', `Unable to resolve ${did} through the Universal Resolver: ${error}`)
    }
  }
}
