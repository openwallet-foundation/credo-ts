import type { AgentContext } from '../../../../agent'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult } from '../../types'

import { resolveDID } from 'didwebvh-ts'

import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { DidDocument } from '../../domain'

export class WebVHDidResolver implements DidResolver {
  public readonly supportedMethods = ['webvh']

  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  // FIXME: Would be nice if we don't have to provide a did resolver instance
  // private _resolverInstance = new Resolver()
  // private resolver = didWeb.getResolver()

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const result = await resolveDID(did)

    let didDocument = null

    if (result.doc) {
      didDocument = JsonTransformer.fromJSON(result.doc, DidDocument)
    }

    return {
      didDocument,
      didResolutionMetadata: {
        servedFromCache: false,
        servedFromDidRecord: false,
      },
      didDocumentMetadata: result.meta,
    }
  }
}