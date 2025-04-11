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
      process.stdout.write(`DIRECT LOG: Error resolving DID: ${error}\n`)
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
      // Implement resource resolution logic here using didwebvh-ts
      // This is a placeholder for the actual implementation
      const result = { data: 'Resource data would be here' }
      const metadata = { created: new Date().toISOString() }

      return {
        content: result,
        contentMetadata: metadata,
        dereferencingMetadata: {},
      }
    } catch (error) {
      return {
        error: 'notFound',
        message: `resolver_error: Unable to resolve resource '${resourceUrl}': ${error}`,
      }
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
