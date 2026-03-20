import {
  AgentContext,
  CredoError,
  DidCommV1Service,
  DidCommV2Service,
  DidRecord,
  DidRepository,
  DidResolverService,
  findMatchingEd25519Key,
  getPublicJwkFromVerificationMethod,
  IndyAgentService,
  injectable,
  Kms,
  NewDidCommV2Service,
  parseDid,
  RecordNotFoundError,
  type ResolvedDidCommService,
  verkeyToPublicJwk,
} from '@credo-ts/core'

export interface GetDidCommVersionFromDidDocResult {
  version: 'v1' | 'v2'
  matchedServiceIds: string[]
  /** Set when both v1 and v2 families appeared in scope (dual-stack). */
  bothFamiliesPresent?: { v1ServiceIds: string[]; v2ServiceIds: string[] }
}

export interface GetDidCommVersionFromDidDocOptions {
  /** Default 'preferV2': if both families in scope, return v2. */
  whenBothFamilies?: 'preferV2' | 'preferV1'
}

@injectable()
export class DidCommDocumentService {
  private didResolverService: DidResolverService
  private didRepository: DidRepository

  public constructor(didResolverService: DidResolverService, didRepository: DidRepository) {
    this.didResolverService = didResolverService
    this.didRepository = didRepository
  }

  /**
   * Determines the DIDComm envelope version advertised by the DID document for the given DID.
   * Uses the same service filtering and fragment logic as {@link resolveServicesFromDid}.
   *
   * - **v1 family**: IndyAgent, did-communication (DidCommV1Service)
   * - **v2 family**: DIDComm, DIDCommMessaging (legacy + W3C)
   *
   * When both families are in scope (dual-stack), returns v2 by default unless
   * `whenBothFamilies: 'preferV1'` is passed.
   *
   * @throws CredoError when no DIDComm services are in scope, or when the DID fragment
   *   references a service id that does not exist.
   */
  public async getDidCommVersionFromDidDoc(
    agentContext: AgentContext,
    did: string,
    options: GetDidCommVersionFromDidDocOptions = {}
  ): Promise<GetDidCommVersionFromDidDocResult> {
    const whenBothFamilies = options.whenBothFamilies ?? 'preferV2'

    const didDocument = await this.didResolverService.resolveDidDocument(agentContext, did)

    const allDidCommServices = (didDocument.service?.filter(
      (s) =>
        s.type === IndyAgentService.type ||
        s.type === DidCommV1Service.type ||
        s.type === DidCommV2Service.type ||
        s.type === NewDidCommV2Service.type
    ) ?? []) as Array<IndyAgentService | DidCommV1Service | DidCommV2Service | NewDidCommV2Service>

    const didCommServices = parseDid(did).fragment
      ? allDidCommServices.filter((service) => service.id === did)
      : allDidCommServices

    if (parseDid(did).fragment && didCommServices.length === 0) {
      throw new CredoError(
        `No DIDComm service found for DID URL ${did}. The fragment may reference a non-existent or non-DIDComm service.`
      )
    }

    if (didCommServices.length === 0) {
      throw new CredoError(
        `No DIDComm-compatible services found for ${did}. Add a DIDCommMessaging or did-communication service to the DID document.`
      )
    }

    const v1ServiceIds: string[] = []
    const v2ServiceIds: string[] = []

    for (const service of didCommServices) {
      if (service.type === IndyAgentService.type || service.type === DidCommV1Service.type) {
        v1ServiceIds.push(service.id)
      } else if (service.type === DidCommV2Service.type || service.type === NewDidCommV2Service.type) {
        v2ServiceIds.push(service.id)
      }
    }

    const hasV1 = v1ServiceIds.length > 0
    const hasV2 = v2ServiceIds.length > 0

    if (hasV1 && hasV2) {
      const version = whenBothFamilies === 'preferV1' ? 'v1' : 'v2'
      const matchedServiceIds = version === 'v1' ? v1ServiceIds : v2ServiceIds
      return {
        version,
        matchedServiceIds,
        bothFamiliesPresent: { v1ServiceIds, v2ServiceIds },
      }
    }

    if (hasV2) {
      return { version: 'v2', matchedServiceIds: v2ServiceIds }
    }

    return { version: 'v1', matchedServiceIds: v1ServiceIds }
  }

  public async resolveServicesFromDid(agentContext: AgentContext, did: string): Promise<ResolvedDidCommService[]> {
    const didDocument = await this.didResolverService.resolveDidDocument(agentContext, did)

    const resolvedServices: ResolvedDidCommService[] = []

    // If did specifies a particular service, filter by its id
    const allDidCommServices = (didDocument.service?.filter(
      (s) =>
        s.type === IndyAgentService.type ||
        s.type === DidCommV1Service.type ||
        s.type === DidCommV2Service.type ||
        s.type === NewDidCommV2Service.type
    ) ?? []) as Array<IndyAgentService | DidCommV1Service | DidCommV2Service | NewDidCommV2Service>
    const didCommServices = parseDid(did).fragment
      ? allDidCommServices.filter((service) => service.id === did)
      : allDidCommServices

    // FIXME: we currently retrieve did documents for all didcomm services in the did document, and we don't have caching
    // yet so this will re-trigger ledger resolves for each one. Should we only resolve the first service, then the second service, etc...?
    for (const didCommService of didCommServices) {
      if (didCommService.type === IndyAgentService.type) {
        const indyService = didCommService as IndyAgentService
        // IndyAgentService (DidComm v0) has keys encoded as raw publicKeyBase58 (verkeys)
        resolvedServices.push({
          id: indyService.id,
          recipientKeys: indyService.recipientKeys.map(verkeyToPublicJwk),
          routingKeys: indyService.routingKeys?.map(verkeyToPublicJwk) || [],
          serviceEndpoint: indyService.serviceEndpoint,
        })
      } else if (didCommService.type === DidCommV1Service.type) {
        const v1Service = didCommService as DidCommV1Service
        // Resolve dids to DIDDocs to retrieve routingKeys
        const routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] = []
        for (const routingKey of v1Service.routingKeys ?? []) {
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
        const recipientKeys = v1Service.recipientKeys.map((recipientKeyReference: string) => {
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
          id: v1Service.id,
          recipientKeys,
          routingKeys,
          serviceEndpoint: v1Service.serviceEndpoint,
        })
      } else if (
        didCommService.type === DidCommV2Service.type ||
        didCommService.type === NewDidCommV2Service.type
      ) {
        // DidCommV2Service (DIDCommMessaging): firstServiceEndpointUri; Legacy (DIDComm): serviceEndpoint
        const recipientKeysFromDoc = didDocument.getRecipientKeysWithVerificationMethod({
          mapX25519ToEd25519: false,
        })
        const endpoint =
          'firstServiceEndpointUri' in didCommService
            ? (didCommService as NewDidCommV2Service).firstServiceEndpointUri
            : typeof didCommService.serviceEndpoint === 'string'
              ? didCommService.serviceEndpoint
              : (didCommService.serviceEndpoint as { uri?: string })?.uri
        if (endpoint) {
          const recipientKeys = recipientKeysFromDoc.map(({ publicJwk, verificationMethod }) => {
            const jwk = publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>
            if (verificationMethod?.id && !jwk.hasKeyId) {
              const vmId = verificationMethod.id
              jwk.keyId = typeof vmId === 'string' && vmId.startsWith('#')
                ? `${didDocument.id}${vmId}`
                : vmId
            }
            return jwk
          }) as Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
          resolvedServices.push({
            id: didCommService.id,
            recipientKeys,
            routingKeys: [],
            serviceEndpoint: endpoint,
          })
        }
      }
    }

    return resolvedServices
  }

  public async resolveCreatedDidDocumentWithKeysByRecipientKey(agentContext: AgentContext, publicJwk: Kms.PublicJwk) {
    let didRecord = await this.didRepository.findCreatedDidByRecipientKey(agentContext, publicJwk)

    // DIDComm v1 messages are sent with the Ed25519 key. However a did document may contain the X25519 key
    // In that case we transform it to an X25519 key.
    // Conversion can fail if key bytes are invalid (e.g. X25519 bytes in legacy ~service wrongly treated as Ed25519).
    if (!didRecord && publicJwk.is(Kms.Ed25519PublicJwk)) {
      try {
        const x25519PublicJwk = publicJwk.convertTo(Kms.X25519PublicJwk)
        didRecord = await this.didRepository.findCreatedDidByRecipientKey(agentContext, x25519PublicJwk)
      } catch {
        // Fall through so caller can try OOB/mediator resolution
      }
    }

    if (!didRecord) {
      throw new RecordNotFoundError(`Created did for public jwk ${publicJwk.jwkTypeHumanDescription} not found`, {
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

  /**
   * Get DIDs we created (peer method) for resolving relative kid (e.g. #key-1).
   */
  public async getCreatedPeerDidStrings(agentContext: AgentContext): Promise<string[]> {
    const created = await this.didRepository.getCreatedDids(agentContext, { method: 'peer' })
    const dids = new Set<string>()
    for (const rec of created) {
      dids.add(rec.did)
      for (const alt of rec.getTags().alternativeDids ?? []) {
        dids.add(alt)
      }
    }
    return [...dids]
  }

  /**
   * Resolve our created DID by did string (e.g. from v2 OOB recipientDid).
   * Used when findCreatedDidByRecipientKey fails (e.g. storage tag matching) but we know the did.
   */
  public async resolveCreatedDidDocumentWithKeysByDid(
    agentContext: AgentContext,
    did: string,
    publicJwk: Kms.PublicJwk
  ): Promise<{ didDocument: import('@credo-ts/core').DidDocument; keys?: import('@credo-ts/core').DidDocumentKey[] }> {
    const didRecord = await this.didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) {
      throw new RecordNotFoundError(`Created did for ${did} not found`, { recordType: DidRecord.type })
    }
    const didDocument = didRecord.didDocument ?? (await this.didResolverService.resolveDidDocument(agentContext, did))
    didDocument.findVerificationMethodByPublicKey(publicJwk)
    return { didDocument, keys: didRecord.keys }
  }
}
