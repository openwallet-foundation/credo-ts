import {
  AgentContext,
  type DidDocument,
  type DidDocumentKey,
  DidKey,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  injectable,
  Kms,
  parseDid,
  RecordNotFoundError,
} from '@credo-ts/core'
import { getResolvedDidcommServiceWithSigningKeyId, toKeyAgreement } from '../modules/connections/services/helpers'
import { DidCommOutOfBandRole } from '../modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandRepository } from '../modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommOutOfBandRecordMetadataKeys } from '../modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommMediatorRoutingRepository } from '../modules/routing/repository'
import { DidCommDocumentService } from '../services/DidCommDocumentService'
import type { DidCommV2EncryptedMessage, DidCommV2KeyAgreementJwk } from './types'

type ResolvedRecipientKey = {
  recipientKey: DidCommV2KeyAgreementJwk & { keyId: string }
  matchedKid: string
}

function toKeyAgreementWithKeyId(jwk: Kms.PublicJwk, keyId: string): DidCommV2KeyAgreementJwk & { keyId: string } {
  const ka = toKeyAgreement(jwk)
  ka.keyId = keyId
  return ka as DidCommV2KeyAgreementJwk & { keyId: string }
}

/**
 * Legacy fallback: scan authentication VMs for an Ed25519 key whose derived X25519
 * matches the target X25519 fingerprint. Returns the Ed25519 VM's kmsKeyId.
 * Only needed for DIDs created before independent X25519 keys were stored.
 */
function findLegacyEd25519KmsKeyId(
  didDocument: DidDocument,
  keys: DidDocumentKey[] | undefined,
  x25519Fingerprint: string
): string | undefined {
  if (!keys) return undefined
  for (const authRef of didDocument.authentication ?? []) {
    try {
      const authVm = typeof authRef === 'string' ? didDocument.dereferenceVerificationMethod(authRef) : authRef
      const authJwk = getPublicJwkFromVerificationMethod(authVm)
      if (!authJwk.is(Kms.Ed25519PublicJwk)) continue
      const derivedX25519 = authJwk.convertTo(Kms.X25519PublicJwk)
      if (derivedX25519.fingerprint === x25519Fingerprint) {
        const kmsKeyId = keys.find(({ didDocumentRelativeKeyId }) =>
          authVm.id.endsWith(didDocumentRelativeKeyId)
        )?.kmsKeyId
        if (kmsKeyId) return kmsKeyId
      }
    } catch {}
  }
  return undefined
}

@injectable()
export class DidCommV2KeyResolver {
  public constructor(private didResolverService: DidResolverService) {}

  /**
   * Resolve our recipient key from a DIDComm v2 encrypted message.
   *
   * Resolution strategy (in order):
   * 1. **Created DID lookup** — kid is a DID URL; look up our DID record and find the
   *    keyAgreement VM's kmsKeyId directly. For new DIDs with independent X25519 keys
   *    this succeeds immediately. Legacy fallback scans Ed25519 auth keys.
   * 2. **Mediator routing key** — kid is a did:key for a mediator routing key.
   * 3. **Reverse did:key lookup** — did:key kid that maps to a VM on a Created DID.
   * 4. **OOB ephemeral key** — did:key kid stored on an out-of-band record.
   * 5. **Direct KMS lookup** — kid is a raw KMS key id.
   */
  public async resolveRecipientKey(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage
  ): Promise<ResolvedRecipientKey | null> {
    const recipients = encrypted.recipients ?? []
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    for (const recipient of recipients) {
      const kid = recipient.header?.kid
      if (!kid) continue

      if (kid.startsWith('did:')) {
        const result =
          (await this.resolveFromCreatedDid(agentContext, kid)) ??
          (await this.resolveFromMediatorRouting(agentContext, kid)) ??
          (await this.resolveFromReverseLookup(agentContext, kid)) ??
          (await this.resolveFromOutOfBand(agentContext, kid))
        if (result) return result
        continue
      }

      // kid stored directly in KMS (e.g. internal key id)
      const result = await this.resolveFromKms(kms, kid)
      if (result) return result
    }

    return null
  }

  /**
   * Resolve sender key from skid (DID URL).
   *
   * Per DIDComm v2 spec, `skid` is a DID URL into the sender's `keyAgreement`.
   * Used for ECDH-1PU authcrypt verification.
   */
  public async resolveSenderKey(agentContext: AgentContext, skid: string): Promise<DidCommV2KeyAgreementJwk | null> {
    if (!skid.startsWith('did:')) return null

    try {
      const didOnly = skid.includes('#') ? skid.split('#')[0] : skid
      const didDocument = await this.didResolverService.resolveDidDocument(agentContext, didOnly)

      let senderJwk: Kms.PublicJwk | undefined
      let vmId: string | undefined

      if (skid.includes('#')) {
        const vm = didDocument.dereferenceKey(skid, ['keyAgreement'])
        senderJwk = getPublicJwkFromVerificationMethod(vm)
        vmId = typeof vm === 'object' && vm !== null && 'id' in vm ? (vm as { id: string }).id : undefined
      } else {
        const kaVms = didDocument.keyAgreement
        if (kaVms && kaVms.length > 0) {
          const ka = typeof kaVms[0] === 'string' ? didDocument.dereferenceKey(kaVms[0], ['keyAgreement']) : kaVms[0]
          senderJwk = getPublicJwkFromVerificationMethod(ka)
          vmId = typeof ka === 'object' && ka !== null && 'id' in ka ? (ka as { id: string }).id : undefined
        }
      }

      if (!senderJwk) return null

      const ka = toKeyAgreement(senderJwk)
      if (vmId && !ka.hasKeyId) {
        ka.keyId = vmId.startsWith('did:') ? vmId : vmId.startsWith('#') ? `${didOnly}${vmId}` : `${didOnly}#${vmId}`
      }
      return ka
    } catch {
      return null
    }
  }

  // ── Private resolution paths ──────────────────────────────────────────

  /**
   * Path 1: kid is a DID URL pointing to a keyAgreement VM on one of our Created DIDs.
   * With independent X25519 keys, the direct kmsKeyId lookup succeeds immediately.
   */
  private async resolveFromCreatedDid(agentContext: AgentContext, kid: string): Promise<ResolvedRecipientKey | null> {
    const didOnly = kid.includes('#') ? kid.split('#')[0] : kid
    const keyRef = kid.includes('#') ? kid : `${kid}#${parseDid(kid).id}`

    try {
      const dids = agentContext.resolve(DidsApi)
      const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(didOnly)
      const verificationMethod = didDocument.dereferenceKey(keyRef, ['keyAgreement'])
      const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

      // Direct lookup — succeeds for new DIDs with independent X25519 keys
      let kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
        verificationMethod.id.endsWith(didDocumentRelativeKeyId)
      )?.kmsKeyId

      // Legacy fallback: X25519 VM mapped to an Ed25519 KMS key (birational map)
      if (!kmsKeyId && publicJwk.is(Kms.X25519PublicJwk)) {
        kmsKeyId = findLegacyEd25519KmsKeyId(didDocument, keys, publicJwk.fingerprint)
      }

      const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
      return { recipientKey: toKeyAgreementWithKeyId(publicJwk, keyId), matchedKid: kid }
    } catch {
      return null
    }
  }

  /**
   * Path 2: did:key kid for a mediator routing key. Routing keys aren't Created DIDs,
   * so we look them up in the mediator routing repository.
   */
  private async resolveFromMediatorRouting(
    agentContext: AgentContext,
    kid: string
  ): Promise<ResolvedRecipientKey | null> {
    if (!kid.startsWith('did:key:')) return null
    const kidPublicJwk = DidKey.fromDid(kid).publicJwk

    try {
      const mediatorRoutingRepository = agentContext.dependencyManager.resolve(DidCommMediatorRoutingRepository)

      if (kidPublicJwk.is(Kms.Ed25519PublicJwk)) {
        const record = await mediatorRoutingRepository.findSingleByQuery(agentContext, {
          routingKeyFingerprints: [kidPublicJwk.fingerprint],
        })
        const routingKey = record?.routingKeysWithKeyId.find((rk) => kidPublicJwk.equals(rk))
        if (routingKey?.keyId) {
          return { recipientKey: toKeyAgreementWithKeyId(routingKey, routingKey.keyId), matchedKid: kid }
        }
      }

      if (kidPublicJwk.is(Kms.X25519PublicJwk)) {
        const record = await mediatorRoutingRepository.findById(
          agentContext,
          mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
        )
        if (record) {
          for (const routingKey of record.routingKeysWithKeyId) {
            try {
              const derivedX25519 = (routingKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              if (derivedX25519.fingerprint === kidPublicJwk.fingerprint && routingKey.keyId) {
                return { recipientKey: toKeyAgreementWithKeyId(derivedX25519, routingKey.keyId), matchedKid: kid }
              }
            } catch {}
          }
        }
      }
    } catch {}

    return null
  }

  /**
   * Path 3: did:key kid whose public key is a VM on one of our Created DIDs
   * (e.g. did:webvh referenced as did:key). Reverse-lookup by public key.
   */
  private async resolveFromReverseLookup(
    agentContext: AgentContext,
    kid: string
  ): Promise<ResolvedRecipientKey | null> {
    if (!kid.startsWith('did:key:')) return null
    const kidPublicJwk = DidKey.fromDid(kid).publicJwk

    try {
      const documentService = agentContext.dependencyManager.resolve(DidCommDocumentService)
      const { didDocument, keys } = await documentService.resolveCreatedDidDocumentWithKeysByRecipientKey(
        agentContext,
        kidPublicJwk
      )

      for (const vm of didDocument.verificationMethod ?? []) {
        let vmJwk: Kms.PublicJwk
        try {
          vmJwk = getPublicJwkFromVerificationMethod(vm)
        } catch {
          continue
        }

        const directMatch = vmJwk.fingerprint === kidPublicJwk.fingerprint
        const derivedMatch =
          !directMatch &&
          vmJwk.is(Kms.Ed25519PublicJwk) &&
          (vmJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk).fingerprint ===
            kidPublicJwk.fingerprint
        if (!directMatch && !derivedMatch) continue

        const kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
          vm.id.endsWith(didDocumentRelativeKeyId)
        )?.kmsKeyId
        const keyId = kmsKeyId ?? (vmJwk.hasKeyId ? vmJwk.keyId : vmJwk.legacyKeyId)
        return { recipientKey: toKeyAgreementWithKeyId(vmJwk, keyId), matchedKid: kid }
      }
    } catch (error) {
      if (!(error instanceof RecordNotFoundError)) throw error
    }

    return null
  }

  /**
   * Path 4: did:key kid for an ephemeral key from a connection-less OOB exchange.
   * Looks up by fingerprint on the OOB record metadata.
   */
  private async resolveFromOutOfBand(agentContext: AgentContext, kid: string): Promise<ResolvedRecipientKey | null> {
    if (!kid.startsWith('did:key:')) return null
    const kidPublicJwk = DidKey.fromDid(kid).publicJwk
    const fingerprint = kidPublicJwk.fingerprint

    const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
    const outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
      $or: [
        { role: DidCommOutOfBandRole.Sender, recipientKeyFingerprints: [fingerprint] },
        { role: DidCommOutOfBandRole.Receiver, recipientRoutingKeyFingerprint: fingerprint },
      ],
    })

    if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
      for (const service of outOfBandRecord.outOfBandInvitation.getInlineServices()) {
        const resolvedService = getResolvedDidcommServiceWithSigningKeyId(
          service,
          outOfBandRecord.invitationInlineServiceKeys
        )
        const recipientKey = resolvedService.recipientKeys.find((rk) => rk.fingerprint === fingerprint)
        if (!recipientKey) continue
        const keyId = recipientKey.hasKeyId ? recipientKey.keyId : recipientKey.legacyKeyId
        return { recipientKey: toKeyAgreementWithKeyId(recipientKey, keyId), matchedKid: kid }
      }
    }

    if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
      const recipientRouting = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
      if (!recipientRouting) return null

      // Independent X25519 key — direct match
      if (recipientRouting.keyAgreementKeyFingerprint === fingerprint) {
        const keyId = recipientRouting.keyAgreementKeyId ?? kidPublicJwk.legacyKeyId
        return { recipientKey: toKeyAgreementWithKeyId(kidPublicJwk, keyId), matchedKid: kid }
      }
      // Legacy Ed25519 fallback
      if (recipientRouting.recipientKeyFingerprint === fingerprint) {
        const keyId = recipientRouting.recipientKeyId ?? kidPublicJwk.legacyKeyId
        return { recipientKey: toKeyAgreementWithKeyId(kidPublicJwk, keyId), matchedKid: kid }
      }
    }

    return null
  }

  /**
   * Path 5: kid is a raw KMS key id (not a DID URL).
   */
  private async resolveFromKms(kms: Kms.KeyManagementApi, kid: string): Promise<ResolvedRecipientKey | null> {
    const kmsPublic = await kms.getPublicKey({ keyId: kid }).catch((err) => {
      if (err instanceof Kms.KeyManagementKeyNotFoundError) return null
      throw err
    })
    if (!kmsPublic) return null

    const publicJwk = Kms.PublicJwk.fromPublicJwk(kmsPublic as Kms.KmsJwkPublicAsymmetric)
    return { recipientKey: toKeyAgreementWithKeyId(publicJwk, kid), matchedKid: kid }
  }
}
