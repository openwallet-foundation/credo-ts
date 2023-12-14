import type { AgentContext } from '../../../agent'
import type { ResolvedDidCommService } from '../types'

import { KeyType } from '../../../crypto'
import { injectable } from '../../../plugins'
import { DidResolverService } from '../../dids'
import { DidCommV1Service, IndyAgentService, keyReferenceToKey, parseDid } from '../../dids/domain'
import { verkeyToInstanceOfKey } from '../../dids/helpers'
import { findMatchingEd25519Key } from '../util/matchingEd25519Key'

@injectable()
export class DidCommDocumentService {
  private didResolverService: DidResolverService

  public constructor(didResolverService: DidResolverService) {
    this.didResolverService = didResolverService
  }

  public async resolveServicesFromDid(agentContext: AgentContext, did: string): Promise<ResolvedDidCommService[]> {
    const didDocument = await this.didResolverService.resolveDidDocument(agentContext, did)

    const resolvedServices: ResolvedDidCommService[] = []

    // If did specifies a particular service, filter by its id
    const didCommServices = parseDid(did).fragment
      ? didDocument.didCommServices.filter((service) => service.id === did)
      : didDocument.didCommServices

    // FIXME: we currently retrieve did documents for all didcomm services in the did document, and we don't have caching
    // yet so this will re-trigger ledger resolves for each one. Should we only resolve the first service, then the second service, etc...?
    for (const didCommService of didCommServices) {
      if (didCommService.type === IndyAgentService.type) {
        // IndyAgentService (DidComm v0) has keys encoded as raw publicKeyBase58 (verkeys)
        resolvedServices.push({
          id: didCommService.id,
          recipientKeys: didCommService.recipientKeys.map(verkeyToInstanceOfKey),
          routingKeys: didCommService.routingKeys?.map(verkeyToInstanceOfKey) || [],
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      } else if (didCommService.type === DidCommV1Service.type) {
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys = []
        for (const routingKey of didCommService.routingKeys ?? []) {
          const routingDidDocument = await this.didResolverService.resolveDidDocument(agentContext, routingKey)
          routingKeys.push(keyReferenceToKey(routingDidDocument, routingKey))
        }

        // DidCommV1Service has keys encoded as key references

        // Dereference recipientKeys
        const recipientKeys = didCommService.recipientKeys.map((recipientKeyReference) => {
          const key = keyReferenceToKey(didDocument, recipientKeyReference)

          // try to find a matching Ed25519 key (https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html#did-document-notes)
          if (key.keyType === KeyType.X25519) {
            const matchingEd25519Key = findMatchingEd25519Key(key, didDocument)
            if (matchingEd25519Key) return matchingEd25519Key
          }
          return key
        })

        resolvedServices.push({
          id: didCommService.id,
          recipientKeys,
          routingKeys,
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      }
    }

    return resolvedServices
  }
}
