import type { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidRepository } from '../../repository'
import type { DidResolutionResult } from '../../types'

import { AriesFrameworkError } from '../../../../error'
import { DidType } from '../../domain'

import { DidPeer, PeerDidNumAlgo } from './DidPeer'

export class PeerDidResolver implements DidResolver {
  public readonly supportedMethods = ['peer']

  private didRepository: DidRepository

  public constructor(didRepository: DidRepository) {
    this.didRepository = didRepository
  }

  public async resolve(did: string): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const didPeer = DidPeer.fromDid(did)

      let didDocument: DidDocument

      // For Method 1, retrieve from storage
      if (didPeer.numAlgo === PeerDidNumAlgo.GenesisDoc) {
        const didDocumentRecord = await this.didRepository.getById(did)

        if (!didDocumentRecord.didDocument) {
          throw new AriesFrameworkError(`Found did record for method 1 peer did (${did}), but no did document.`)
        }

        didDocument = didDocumentRecord.didDocument
      } else {
        didDocument = didPeer.didDocument
      }

      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
        didType: DidType.PeerDid,
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
        didType: DidType.PeerDid,
      }
    }
  }
}
