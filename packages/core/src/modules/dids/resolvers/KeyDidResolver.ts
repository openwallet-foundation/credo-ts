import type { DidResolutionResult } from '../types'
import type { DidResolver } from './DidResolver'

import { errorMessageOr } from '../../../error'
import { DidKey } from '../domain/DidKey'

export class KeyDidResolver implements DidResolver {
  public readonly supportedMethods = ['key']

  public resolve(did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didDocument = DidKey.fromDid(did).didDocument

      return Promise.resolve({
        didDocument: didDocument,
        didDocumentMetadata: {},
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      })
    } catch (error) {
      return Promise.resolve({
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${errorMessageOr(error, 'unknown error')}`,
        },
      })
    }
  }
}
