import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult } from '../../types'

import { DidType } from '../../domain/Did'

import { DidKey } from './DidKey'

export class KeyDidResolver implements DidResolver {
  public readonly supportedMethods = ['key']

  public async resolve(did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didDocument = DidKey.fromDid(did).didDocument

      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
        didType: DidType.KeyDid,
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
        didType: DidType.KeyDid,
      }
    }
  }
}
