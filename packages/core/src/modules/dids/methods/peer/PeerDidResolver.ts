import type { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidDocumentRepository } from '../../repository'
import type { DidResolutionResult } from '../../types'

import { DidPeer, PeerDidNumAlgo } from './DidPeer'

export class PeerDidResolver implements DidResolver {
  public readonly supportedMethods = ['peer']

  private didDocumentRepository: DidDocumentRepository

  public constructor(didDocumentRepository: DidDocumentRepository) {
    this.didDocumentRepository = didDocumentRepository
  }

  public async resolve(did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didPeer = DidPeer.fromDid(did)

      let didDocument: DidDocument

      // For Method 1, retrieve from storage
      if (didPeer.numAlgo === PeerDidNumAlgo.GenesisDoc) {
        const didDocumentRecord = await this.didDocumentRepository.getById(did)
        didDocument = didDocumentRecord.didDocument
      } else {
        didDocument = didPeer.didDocument
      }

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
