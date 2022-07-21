import type { AgentContext } from '../../../../agent'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult } from '../../types'

import { injectable } from '../../../../plugins'

import { DidKey } from './DidKey'

@injectable()
export class KeyDidResolver implements DidResolver {
  public readonly supportedMethods = ['key']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didDocument = DidKey.fromDid(did).didDocument

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
