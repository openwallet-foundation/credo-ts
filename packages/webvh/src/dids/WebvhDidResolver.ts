import type { AgentContext, DidResolutionResult, DidResolver } from '@credo-ts/core'

import { DidDocument } from '@credo-ts/core'
import { resolveDID } from 'didwebvh-ts'

import { DIDWebvhCrypto } from './didWebvhUtil'

export class WebvhDidResolver implements DidResolver {
  public readonly supportedMethods = ['webvh']
  public readonly allowsCaching = false
  public readonly allowsLocalDidRecord = false

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      return await this.resolveDidDoc(agentContext, did)
    } catch (error) {
      agentContext.config.logger.error(`Error resolving DID: ${error}`)
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

  public async resolveResource(agentContext: AgentContext, resourceUrl: string) {
    try {
      agentContext.config.logger.debug(`Attempting to resolve resource: ${resourceUrl}`)
      
      // Parse the did:webvh resource URL
      // Format: did:webvh:CID:domain.com/resources/hash.json
      const urlParts = resourceUrl.split(':')
      
      if (urlParts.length < 3 || urlParts[0] !== 'did' || urlParts[1] !== 'webvh') {
        throw new Error('Invalid did:webvh resource URL format')
      }
      
      // Extract the domain and resource path
      const cidAndDomain = urlParts.slice(2).join(':')
      const [cid, ...domainParts] = cidAndDomain.split(':')
      const domainAndPath = domainParts.join(':')
      
      // Construct the HTTPS URL
      const httpsUrl = `https://${domainAndPath}`
      
      agentContext.config.logger.debug(`Fetching resource from: ${httpsUrl}`)
      
      // Fetch the resource using native fetch
      const response = await fetch(httpsUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type') || 'application/json'
      let content: Record<string, unknown> | unknown[] | string
      
      if (contentType.includes('application/json')) {
        content = await response.json() as Record<string, unknown>
      } else {
        content = await response.text()
      }
      
      agentContext.config.logger.debug(`Successfully fetched resource, content type: ${contentType}`)
      
      const result = {
        content: content,
        contentMetadata: {
          contentType: contentType,
          retrieved: new Date().toISOString()
        },
        dereferencingMetadata: {
          contentType: contentType
        },
      }
      
      return result
    } catch (error) {
      agentContext.config.logger.error(`Error resolving resource ${resourceUrl}:`, error)
      const errorResult = {
        error: 'notFound',
        message: `resolver_error: Unable to resolve resource '${resourceUrl}': ${error instanceof Error ? error.message : String(error)}`,
      }
      return errorResult
    }
  }

  private async resolveDidDoc(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const crypto = new DIDWebvhCrypto(agentContext)
    const { doc } = await resolveDID(did, { verifier: crypto })
    return {
      didDocument: new DidDocument(doc),
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    }
  }
}
