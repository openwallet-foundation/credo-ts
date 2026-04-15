import {
  AgentContext,
  CredoError,
  DidCommV1Service,
  DidCommV2Service,
  DidRecord,
  DidRepository,
  DidResolverService,
  didToNumAlgo2DidDocument,
  didToNumAlgo4DidDocument,
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
import type { DidCommVersion } from '../util/didcommVersion'

export interface GetSupportedDidCommVersionsFromDidDocResult {
  /** All DIDComm versions advertised by the DID document (v1, v2, or both). */
  versions: DidCommVersion[]
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
   * Returns all DIDComm envelope versions advertised by the DID document for the given DID.
   * Uses the same service filtering and fragment logic as {@link resolveServicesFromDid}.
   *
   * - **v1 family**: IndyAgent, did-communication (DidCommV1Service)
   * - **v2 family**: DIDComm, DIDCommMessaging (legacy + W3C)
   *
   * Callers should intersect this with their agent's supported versions and pick the most
   * suitable one (e.g. prefer v2 when both are supported).
   *
   * @throws CredoError when no DIDComm services are in scope, or when the DID fragment
   *   references a service id that does not exist.
   */
  public async getSupportedDidCommVersionsFromDidDoc(
    agentContext: AgentContext,
    did: string
  ): Promise<GetSupportedDidCommVersionsFromDidDocResult> {
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

    const hasV1 = didCommServices.some(
      (s) => s.type === IndyAgentService.type || s.type === DidCommV1Service.type
    )
    const hasV2 = didCommServices.some(
      (s) => s.type === DidCommV2Service.type || s.type === NewDidCommV2Service.type
    )

    const versions: DidCommVersion[] = []
    if (hasV1) versions.push('v1')
    if (hasV2) versions.push('v2')

    return { versions }
  }

  /**
   * Resolve DIDComm v1-style routing key references (VM ids / did#fragment) to Ed25519 JWKS for Forward / packV2WithForward.
   */
  private async resolveRoutingKeyReferences(
    agentContext: AgentContext,
    routingKeyRefs: string[]
  ): Promise<Kms.PublicJwk<Kms.Ed25519PublicJwk>[]> {
    const routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] = []
    for (const routingKey of routingKeyRefs) {
      const routingDidDocument = await this.didResolverService.resolveDidDocument(agentContext, routingKey)
      const publicJwk = getPublicJwkFromVerificationMethod(
        routingDidDocument.dereferenceKey(routingKey, ['authentication', 'keyAgreement'])
      )
      if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
        throw new CredoError(`Expected Ed25519PublicJwk but found ${publicJwk.JwkClass.name}`)
      }
      routingKeys.push(publicJwk)
    }
    return routingKeys
  }

  /**
   * When a v2 service endpoint is a nested `did:` (common for did:peer mediation), expand to the transport URI and
   * mediator keys — same idea as {@link DidCommMessageSender.retrieveServicesByConnection} peer fallback.
   *
   * For mediator routing DIDs (did:peer:2 E<X25519>.V<Ed25519>), the Ed25519 authentication
   * key and X25519 keyAgreement key represent the same physical key (related by the
   * birational map). They MUST NOT be treated as two sequential routing hops — otherwise
   * the sender would wrap the Forward twice, and the innermost wrap (addressed to the
   * mediator) would be delivered to the recipient who cannot decrypt it.
   *
   * This function extracts ONE key per physical routing key, preferring the X25519
   * keyAgreement form so the Forward envelope kid matches the mediator's decryption key.
   */
  private expandV2EndpointIfRoutingDid(
    endpoint: string,
    routingKeysFromRefs: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  ): { endpoint: string; routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] } {
    if (!endpoint.startsWith('did:')) {
      return { endpoint, routingKeys: routingKeysFromRefs }
    }
    try {
      const routingDoc = endpoint.startsWith('did:peer:4')
        ? didToNumAlgo4DidDocument(endpoint)
        : didToNumAlgo2DidDocument(endpoint)

      // Dedupe by X25519 fingerprint so Ed25519 auth + X25519 keyAgreement of the
      // same physical key collapse to one hop. Prefer keyAgreement entries so the
      // kept key is X25519 when available.
      const byX25519Fingerprint = new Map<string, Kms.PublicJwk<Kms.Ed25519PublicJwk>>()
      const addKey = (publicJwk: Kms.PublicJwk) => {
        let fingerprint: string
        try {
          if (publicJwk.is(Kms.X25519PublicJwk)) {
            fingerprint = publicJwk.fingerprint
          } else if (publicJwk.is(Kms.Ed25519PublicJwk)) {
            fingerprint = (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>)
              .convertTo(Kms.X25519PublicJwk)
              .fingerprint
          } else {
            return
          }
        } catch {
          return
        }
        const existing = byX25519Fingerprint.get(fingerprint)
        // Prefer X25519 over Ed25519 for the same physical key
        if (!existing || (publicJwk.is(Kms.X25519PublicJwk) && !existing.is(Kms.X25519PublicJwk))) {
          byX25519Fingerprint.set(fingerprint, publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>)
        }
      }

      // keyAgreement first so X25519 wins the dedupe tie-breaker when both are present
      const keyRefs = [...(routingDoc.keyAgreement ?? []), ...(routingDoc.authentication ?? [])]
      const seenVmIds = new Set<string>()
      for (const keyRef of keyRefs) {
        const vm = typeof keyRef === 'string' ? routingDoc.dereferenceVerificationMethod(keyRef) : keyRef
        if (seenVmIds.has(vm.id)) continue
        seenVmIds.add(vm.id)
        addKey(getPublicJwkFromVerificationMethod(vm))
      }

      const nestedRoutingKeys = Array.from(byX25519Fingerprint.values())

      let resolvedEndpoint = endpoint
      const firstSvc = routingDoc.service?.[0]
      if (firstSvc) {
        const resolved =
          typeof firstSvc.serviceEndpoint === 'string'
            ? firstSvc.serviceEndpoint
            : (firstSvc.serviceEndpoint as { uri?: string; s?: string })?.uri ??
              (firstSvc.serviceEndpoint as { uri?: string; s?: string })?.s
        if (resolved) resolvedEndpoint = resolved
      }
      return {
        endpoint: resolvedEndpoint,
        routingKeys: [...nestedRoutingKeys, ...routingKeysFromRefs],
      }
    } catch {
      return { endpoint, routingKeys: routingKeysFromRefs }
    }
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

        // Expand DID-as-endpoint (e.g. when v2 mediation grant embeds a routing DID
        // into a v1 peer DID service). Without this, the raw did:peer:2 would be passed
        // as serviceEndpoint and no transport can handle the "did:" scheme.
        let serviceEndpoint = v1Service.serviceEndpoint
        let expandedRoutingKeys = routingKeys
        if (typeof serviceEndpoint === 'string' && serviceEndpoint.startsWith('did:')) {
          const expanded = this.expandV2EndpointIfRoutingDid(serviceEndpoint, routingKeys)
          serviceEndpoint = expanded.endpoint
          // For v1 Forward, only use Ed25519 routing keys. The v1 envelope packing
          // sets kid = base58(raw_public_key) and the mediator looks up keys assuming
          // Ed25519. Using X25519 keys here would produce a kid the mediator can't match.
          expandedRoutingKeys = expanded.routingKeys.filter((k) => k.is(Kms.Ed25519PublicJwk))
          // If no Ed25519 keys found, fall back to all keys (v2-only mediator routing DID)
          if (expandedRoutingKeys.length === 0) {
            expandedRoutingKeys = expanded.routingKeys
          }
        }

        resolvedServices.push({
          id: v1Service.id,
          recipientKeys,
          routingKeys: expandedRoutingKeys,
          serviceEndpoint,
        })
      } else if (
        didCommService.type === DidCommV2Service.type ||
        didCommService.type === NewDidCommV2Service.type
      ) {
        // DIDComm v2: recipient keys come exclusively from keyAgreement VMs (X25519).
        // We must NOT use getRecipientKeysWithVerificationMethod() here because it
        // accumulates keys from ALL services (v1 + v2), which would mix Ed25519
        // authentication keys from v1 services into v2 encryption — causing the
        // recipient kid to point to an authentication VM instead of keyAgreement.
        // Cast is safe: downstream toX25519() in DidCommMessageSender handles both
        // Ed25519 and X25519 inputs correctly at runtime.
        const recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] = []
        for (const keyRef of didDocument.keyAgreement ?? []) {
          const verificationMethod =
            typeof keyRef === 'string' ? didDocument.dereferenceVerificationMethod(keyRef) : keyRef
          const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
          if (!publicJwk.is(Kms.X25519PublicJwk) && !publicJwk.is(Kms.Ed25519PublicJwk)) {
            continue
          }
          if (!publicJwk.hasKeyId) {
            const vmId = verificationMethod.id
            publicJwk.keyId =
              typeof vmId === 'string' && vmId.startsWith('#') ? `${didDocument.id}${vmId}` : vmId
          }
          recipientKeys.push(publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>)
        }

        let routingKeyRefs: string[] = []
        if (didCommService.type === NewDidCommV2Service.type) {
          const v2 = didCommService as NewDidCommV2Service
          const se = v2.serviceEndpoint
          const first = Array.isArray(se) ? se[0] : se
          routingKeyRefs = first?.routingKeys ?? []
        } else {
          routingKeyRefs = (didCommService as DidCommV2Service).routingKeys ?? []
        }
        const endpoint =
          'firstServiceEndpointUri' in didCommService
            ? (didCommService as NewDidCommV2Service).firstServiceEndpointUri
            : typeof didCommService.serviceEndpoint === 'string'
              ? didCommService.serviceEndpoint
              : (didCommService.serviceEndpoint as { uri?: string })?.uri
        if (endpoint) {
          let routingKeys = await this.resolveRoutingKeyReferences(agentContext, routingKeyRefs)
          const expanded = this.expandV2EndpointIfRoutingDid(endpoint, routingKeys)
          resolvedServices.push({
            id: didCommService.id,
            recipientKeys,
            routingKeys: expanded.routingKeys,
            serviceEndpoint: expanded.endpoint,
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
