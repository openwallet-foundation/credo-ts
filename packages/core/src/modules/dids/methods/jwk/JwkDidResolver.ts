import type { AgentContext } from '../../../../agent'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult } from '../../types'

import { DidJwk } from './DidJwk'

export class JwkDidResolver implements DidResolver {
  public readonly supportedMethods = ['jwk']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didDocument = DidJwk.fromDid(did).didDocument

      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      }
    } catch (error) {
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
}
