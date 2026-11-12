import type { AgentContext, DidResolutionResult, DidResolver, ParsedDid } from '@credo-ts/core'

import { DidDocument, parseDid } from '@credo-ts/core'
import { Resolver } from 'did-resolver'
import { getResolver } from 'didwebvh-ts'

import { WebVhDidCrypto } from './WebVhDidCrypto'

export class WebVhDidResolver implements DidResolver {
  public readonly supportedMethods = ['webvh']
  // Core caches/local documents bypass log validation and do not distinguish version selectors.
  public readonly allowsCaching = false
  public readonly allowsLocalDidRecord = false

  /**
   * Resolves published logs through upstream's dispatcher, parser hook, and version-selector handling.
   *
   * @param agentContext Agent context providing storage, KMS, and configured fetch.
   * @param did Bare WebVH DID supplied by Credo.
   * @param parsed Credo-parsed original DID URL, including any version query.
   * @returns DID document and upstream metadata, or resolution error metadata.
   */
  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    try {
      const resolver = new Resolver(
        getResolver({
          verifier: new WebVhDidCrypto(agentContext),
          fetch: agentContext.config.fetch.bind(agentContext.config),
        }),
        { cache: false }
      )
      const result = await resolver.resolve(parsed.didUrl)
      return {
        didDocument: result.didDocument ? DidDocument.fromJSON(result.didDocument) : null,
        didDocumentMetadata: result.didDocumentMetadata,
        didResolutionMetadata: result.didResolutionMetadata,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error resolving DID ${did}`, error)
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'internalError',
          message: `Unable to resolve DID '${did}': ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }

  /**
   * Converts a WebVH DID resource URL to HTTPS, decoding its authority and preserving encoded path segments and query.
   *
   * @param id WebVH DID URL identifying a resource.
   * @returns Corresponding HTTPS resource URL.
   */
  public getBaseUrl = (id: string) => {
    const parsed = parseDid(id)
    const [scid, domain, ...paths] = parsed.id.split(':')
    if (parsed.method !== 'webvh' || !scid || !domain) {
      throw new Error(`${id} is not a valid did:webvh identifier`)
    }
    const authority = new URL(`https://${decodeURIComponent(domain)}`)
    if (authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) {
      throw new Error(`${id} has an invalid resource host`)
    }
    const path = paths.map((segment) => encodeURIComponent(decodeURIComponent(segment))).join('/')
    return `https://${authority.host}${path ? `/${path}` : ''}${parsed.path ?? ''}${parsed.query ? `?${parsed.query}` : ''}`
  }

  /**
   * Fetches a WebVH resource with the agent's fetch limits, returning dereferencing metadata or an explicit error.
   *
   * @param agentContext Agent context providing configured fetch and logging.
   * @param resourceUrl WebVH DID URL identifying the resource.
   * @returns Resource content and retrieval metadata, or a resolution error and message.
   */
  public async resolveResource(agentContext: AgentContext, resourceUrl: string) {
    try {
      agentContext.config.logger.debug(`Attempting to resolve resource: ${resourceUrl}`)

      const httpsUrl = this.getBaseUrl(resourceUrl)

      agentContext.config.logger.debug(`Fetching resource from: ${httpsUrl}`)

      const response = await agentContext.config.fetch(httpsUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || 'application/json'
      let content: Record<string, unknown> | unknown[] | string

      if (contentType.includes('application/json')) {
        content = (await response.json()) as Record<string, unknown>
      } else {
        content = await response.text()
      }

      agentContext.config.logger.debug(`Successfully fetched resource, content type: ${contentType}`)

      return {
        content,
        contentMetadata: {
          contentType,
          retrieved: new Date().toISOString(),
        },
        dereferencingMetadata: {
          contentType,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error resolving resource ${resourceUrl}:`, error)
      return {
        error: 'notFound',
        message: `resolver_error: Unable to resolve resource '${resourceUrl}': ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}
