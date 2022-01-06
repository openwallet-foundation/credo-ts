import type { DidResolutionResult } from '../types'
import type { DidResolver } from './DidResolver'

import { DidKey } from '../domain/DidKey'

export class KeyDidResolver implements DidResolver {
  public readonly supportedMethods = ['key']

  public async resolve(did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didDocument = DidKey.fromDid(did).didDocument

      return {
        didDocument: didDocument,
        didDocumentMetadata: {},
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
