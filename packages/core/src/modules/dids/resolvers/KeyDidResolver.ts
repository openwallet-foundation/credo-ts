import type { DIDResolutionResult } from '../types'
import type { DidResolver } from './DidResolver'

import { DidKey } from '../DidKey'

export class KeyDidResolver implements DidResolver {
  public readonly supportedMethods = ['key']

  public async resolve(did: string): Promise<DIDResolutionResult> {
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
