import type { AgentContext, DidResolutionResult, DidResolver } from '@credo-ts/core'

import { DidsApi } from '@credo-ts/core'

export class LocalDidResolver implements DidResolver {
  public readonly supportedMethods = ['sov', 'indy']
  public readonly allowsCaching = false

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    const didRecord = (await didsApi.getCreatedDids()).find((record) => record.did === did)
    if (!didRecord) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}'`,
        },
      }
    }
    return {
      didDocument: didRecord.didDocument ?? null,
      didDocumentMetadata,
      didResolutionMetadata: { contentType: 'application/did+ld+json' },
    }
  }
}
