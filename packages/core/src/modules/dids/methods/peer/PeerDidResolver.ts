import type { AgentContext } from '../../../../agent'
import type { DidDocument } from '../../domain'
import type { DidResolver } from '../../domain/DidResolver'
import type { DidResolutionResult } from '../../types'

import { AriesFrameworkError } from '../../../../error'
import { DidRepository } from '../../repository'

import { getNumAlgoFromPeerDid, isValidPeerDid, PeerDidNumAlgo } from './didPeer'
import { didToNumAlgo0DidDocument } from './peerDidNumAlgo0'
import { didToNumAlgo2DidDocument } from './peerDidNumAlgo2'

export class PeerDidResolver implements DidResolver {
  public readonly supportedMethods = ['peer']

  public async resolve(agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const didDocumentMetadata = {}

    try {
      let didDocument: DidDocument

      if (!isValidPeerDid(did)) {
        throw new AriesFrameworkError(`did ${did} is not a valid peer did`)
      }

      const numAlgo = getNumAlgoFromPeerDid(did)

      // For method 0, generate from did
      if (numAlgo === PeerDidNumAlgo.InceptionKeyWithoutDoc) {
        didDocument = didToNumAlgo0DidDocument(did)
      }
      // For Method 1, retrieve from storage
      else if (numAlgo === PeerDidNumAlgo.GenesisDoc) {
        // We can have multiple did document records stored for a single did (one created and one received). In this case it
        // doesn't matter which one we use, and they should be identical. So we just take the first one.
        const [didDocumentRecord] = await didRepository.findAllByDid(agentContext, did)

        if (!didDocumentRecord) {
          throw new AriesFrameworkError(`No did record found for peer did ${did}.`)
        }

        if (!didDocumentRecord.didDocument) {
          throw new AriesFrameworkError(`Found did record for method 1 peer did (${did}), but no did document.`)
        }

        didDocument = didDocumentRecord.didDocument
      }
      // For Method 2, generate from did
      else {
        didDocument = didToNumAlgo2DidDocument(did)
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
