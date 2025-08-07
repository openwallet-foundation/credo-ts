import type { AgentContext, DidResolutionResult, DidResolver } from '@credo-ts/core'

import { DidDocument } from '@credo-ts/core'
import { resolveDID } from 'didwebvh-ts'

import { WebvhDidCrypto } from './WebvhDidCrypto'

export class WebvhDidResolver implements DidResolver {
  public readonly supportedMethods = ['webvh']
  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      return await this.resolveDidDoc(agentContext, did)
    } catch (error) {
      agentContext.config.logger.error(`Error resolving DID ${did}: ${error}`)
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }

  public getBaseUrl = (id: string) => {
    // Handle DID URL paths - split on first slash to separate DID from URL path
    const slashIndex = id.indexOf('/')
    let didPart = id
    let urlPath = ''

    if (slashIndex !== -1) {
      didPart = id.substring(0, slashIndex)
      urlPath = id.substring(slashIndex)
    }

    const parts = didPart.split(':')
    if (!didPart.startsWith('did:webvh:') || parts.length < 4) {
      throw new Error(`${id} is not a valid did:webvh identifier`)
    }

    // Extract domain and path parts from the DID (after did:webvh:CID)
    const domainAndPathParts = parts.slice(3)
    const protocol = domainAndPathParts.join(':').includes('localhost') ? 'http' : 'https'

    // First part is domain, rest are path components
    const domain = domainAndPathParts[0]
    const pathComponents = domainAndPathParts.slice(1)

    // Check if domain has port
    const [host, port] = domain.split(':')
    const normalizedHost = port ? `${host}:${port}` : host

    // Build the base URL
    let baseUrl = `${protocol}://${normalizedHost}`
    if (pathComponents.length > 0) {
      baseUrl += '/' + pathComponents.join('/')
    }

    // Append the URL path if present
    if (urlPath) {
      baseUrl += urlPath
    }

    return baseUrl
  }

  public async resolveResource(agentContext: AgentContext, resourceUrl: string) {
    try {
      agentContext.config.logger.debug(`Attempting to resolve resource: ${resourceUrl}`)

      // Use the getBaseUrl method to parse the did:webvh resource URL
      const httpsUrl = this.getBaseUrl(resourceUrl)

      agentContext.config.logger.debug(`Fetching resource from: ${httpsUrl}`)

      // Fetch the resource using agent dependencies fetch
      const response = await agentContext.config.agentDependencies.fetch(httpsUrl)

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
        content: content,
        contentMetadata: {
          contentType: contentType,
          retrieved: new Date().toISOString(),
        },
        dereferencingMetadata: {
          contentType: contentType,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error resolving resource ${resourceUrl}:`, error)
      return {
        error: 'notFound',
        message: `resolver_error: Unable to resolve resource '${resourceUrl}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      }
    }
  }

  private async resolveDidDoc(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const crypto = new WebvhDidCrypto(agentContext)
    const { doc } = await resolveDID(did, { verifier: crypto })
    return {
      didDocument: new DidDocument(doc),
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    }
  }
}
