import type { DidResolutionResult, DidResolver, AgentContext } from '@aries-framework/core'

import { DidsApi } from '@aries-framework/core'

export class LocalDidResolver implements DidResolver {
  public readonly supportedMethods = ['sov', 'indy']

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
