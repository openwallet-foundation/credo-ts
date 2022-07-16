import type { Logger } from '../../../logger'
import type { ResolvedDidCommService } from '../types'

import { AgentConfig } from '../../../agent/AgentConfig'
import { KeyType } from '../../../crypto'
import { injectable } from '../../../plugins'
import { DidResolverService } from '../../dids'
import { DidCommV1Service, IndyAgentService, Key, keyReferenceToKey } from '../../dids/domain'
import { convertPublicKeyToX25519 } from '../../dids/domain/key-type/ed25519'
import { verkeyToInstanceOfKey } from '../../dids/helpers'

@injectable()
export class DidCommDocumentService {
  private logger: Logger
  private didResolverService: DidResolverService

  public constructor(agentConfig: AgentConfig, didResolverService: DidResolverService) {
    this.logger = agentConfig.logger
    this.didResolverService = didResolverService
  }

  public async resolveServicesFromDid(did: string): Promise<ResolvedDidCommService[]> {
    const didDocument = await this.didResolverService.resolveDidDocument(did)

    const didCommServices: ResolvedDidCommService[] = []

    // FIXME: we currently retrieve did documents for all didcomm services in the did document, and we don't have caching
    // yet so this will re-trigger ledger resolves for each one. Should we only resolve the first service, then the second service, etc...?
    for (const didCommService of didDocument.didCommServices) {
      if (didCommService instanceof IndyAgentService) {
        // IndyAgentService (DidComm v0) has keys encoded as raw publicKeyBase58 (verkeys)
        didCommServices.push({
          id: didCommService.id,
          recipientKeys: didCommService.recipientKeys.map(verkeyToInstanceOfKey),
          routingKeys: didCommService.routingKeys?.map(verkeyToInstanceOfKey) || [],
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      } else if (didCommService instanceof DidCommV1Service) {
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys = []
        for (const routingKey of didCommService.routingKeys ?? []) {
          const routingDidDocument = await this.didResolverService.resolveDidDocument(routingKey)
          routingKeys.push(keyReferenceToKey(routingDidDocument, routingKey))
        }

        // DidCommV1Service has keys encoded as key references

        // Dereference recipientKeys
        const recipientKeys = didCommService.recipientKeys.map((recipientKeyReference) => {
          const key = keyReferenceToKey(didDocument, recipientKeyReference)
          if (key.keyType === KeyType.X25519) {
            // try to find a matching Ed25519 key (https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html#did-document-notes)
            const matchingEd25519Key = didDocument.verificationMethod
              ?.map((method) =>
                recipientKeyReference !== method.id ? keyReferenceToKey(didDocument, method.id) : null
              )
              .find((matchingKey) => {
                if (matchingKey?.keyType !== KeyType.Ed25519) return false
                const keyX25519 = Key.fromPublicKey(convertPublicKeyToX25519(matchingKey.publicKey), KeyType.X25519)
                return keyX25519.publicKeyBase58 === key.publicKeyBase58
              })
            if (matchingEd25519Key) return matchingEd25519Key
          }
          return key
        })

        didCommServices.push({
          id: didCommService.id,
          recipientKeys,
          routingKeys,
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      }
    }

    return didCommServices
  }
}
