import { AgentContext, ResolvedDidCommService, findMatchingEd25519Key } from '@credo-ts/core'

import {
  CredoError,
  DidCommV1Service,
  DidRecord,
  DidRepository,
  DidResolverService,
  IndyAgentService,
  Kms,
  RecordNotFoundError,
  getPublicJwkFromVerificationMethod,
  injectable,
  parseDid,
  verkeyToPublicJwk,
} from '@credo-ts/core'

@injectable()
export class DidCommDocumentService {
  private didResolverService: DidResolverService
  private didRepository: DidRepository

  public constructor(didResolverService: DidResolverService, didRepository: DidRepository) {
    this.didResolverService = didResolverService
    this.didRepository = didRepository
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
          recipientKeys: didCommService.recipientKeys.map(verkeyToPublicJwk),
          routingKeys: didCommService.routingKeys?.map(verkeyToPublicJwk) || [],
          serviceEndpoint: didCommService.serviceEndpoint,
        })
      } else if (didCommService.type === DidCommV1Service.type) {
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] = []
        for (const routingKey of didCommService.routingKeys ?? []) {
          const routingDidDocument = await this.didResolverService.resolveDidDocument(agentContext, routingKey)
          const publicJwk = getPublicJwkFromVerificationMethod(
            routingDidDocument.dereferenceKey(routingKey, ['authentication', 'keyAgreement'])
          )

          // FIXME: we should handle X25519 here as well
          if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
            throw new CredoError(`Expected Ed25519PublicJwk but found ${publicJwk.JwkClass.name}`)
          }

          routingKeys.push(publicJwk)
        }

        // DidCommV1Service has keys encoded as key references

        // Dereference recipientKeys
        const recipientKeys = didCommService.recipientKeys.map((recipientKeyReference) => {
          // FIXME: we allow authentication keys as historically ed25519 keys have been used in did documents
          // for didcomm. In the future we should update this to only be allowed for IndyAgent and DidCommV1 services
          // as didcomm v2 doesn't have this issue anymore
          const publicJwk = getPublicJwkFromVerificationMethod(
            didDocument.dereferenceKey(recipientKeyReference, ['authentication', 'keyAgreement'])
          )

          // try to find a matching Ed25519 key (https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html#did-document-notes)
          // FIXME: Now that indy-sdk is deprecated, we should look into the possiblty of using the X25519 key directly
          // removing the need to also include the Ed25519 key in the did document.
          if (publicJwk.is(Kms.X25519PublicJwk)) {
            const matchingEd25519Key = findMatchingEd25519Key(publicJwk, didDocument)
            if (matchingEd25519Key) return matchingEd25519Key.publicJwk
          }

          if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
            throw new CredoError(`Expected Ed25519PublicJwk but found ${publicJwk.JwkClass.name}`)
          }

          return publicJwk
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

  public async resolveCreatedDidDocumentWithKeysByRecipientKey(agentContext: AgentContext, publicJwk: Kms.PublicJwk) {
    const didRecord = await this.didRepository.findCreatedDidByRecipientKey(agentContext, publicJwk)

    if (!didRecord) {
      throw new RecordNotFoundError(`Created did for public jwk ${publicJwk.jwkTypehumanDescription} not found`, {
        recordType: DidRecord.type,
      })
    }

    if (didRecord.didDocument) {
      return {
        keys: didRecord.keys,
        didDocument: didRecord.didDocument,
      }
    }

    // TODO: we should somehow store the did document on the record if the did method allows it
    // E.g. for did:key we don't want to store it, but if we still have a did:indy record we do want to store it
    // If the did document is not stored on the did record, we resolve it
    const didDocument = await this.didResolverService.resolveDidDocument(agentContext, didRecord.did)

    return {
      keys: didRecord.keys,
      didDocument,
    }
  }
}
