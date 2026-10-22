import {
  AgentContext,
  DidKey,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  injectable,
  Kms,
  parseDid,
  RecordNotFoundError,
} from '@credo-ts/core'
import {
  getResolvedDidcommServiceWithSigningKeyId,
  toAbsoluteDidUrl,
  toKeyAgreement,
} from '../modules/connections/services/helpers'
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

@injectable()
export class DidCommV2KeyResolver {
  public constructor(private didResolverService: DidResolverService) {}

  /**
   * Resolve our recipient key from a DIDComm v2 encrypted message.
   *
   * Resolution strategy (in order):
   * 1. **Created DID lookup** — kid is a DID URL; look up our DID record and find the
   *    keyAgreement VM's kmsKeyId.
   * 2. **Mediator routing key** — kid is a did:key or did:peer key for an X25519 mediator routing key.
   * 3. **Reverse did:key lookup** — did:key kid that maps to a VM on a Created DID.
   * 4. **OOB ephemeral key** — did:key kid stored on an out-of-band record.
   */
  public async resolveRecipientKey(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage
  ): Promise<ResolvedRecipientKey | null> {
    const recipients = encrypted.recipients ?? []

    for (const recipient of recipients) {
      const kid = recipient.header?.kid
      if (!kid?.startsWith('did:')) continue

      const result =
        (await this.resolveFromCreatedDid(agentContext, kid)) ??
        (await this.resolveFromMediatorRouting(agentContext, kid)) ??
        (await this.resolveFromReverseLookup(agentContext, kid)) ??
        (await this.resolveFromOutOfBand(agentContext, kid))
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
  public async resolveSenderKey(agentContext: AgentContext, skid: string): Promise<Kms.PublicJwk | null> {
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
        if (kaVms?.length === 1) {
          const ka = typeof kaVms[0] === 'string' ? didDocument.dereferenceKey(kaVms[0], ['keyAgreement']) : kaVms[0]
          senderJwk = getPublicJwkFromVerificationMethod(ka)
          vmId = typeof ka === 'object' && ka !== null && 'id' in ka ? (ka as { id: string }).id : undefined
        }
      }

      if (!senderJwk) return null

      if (vmId) senderJwk.keyId = toAbsoluteDidUrl(didOnly, vmId)
      return senderJwk
    } catch {
      return null
    }
  }

  // ── Private resolution paths ──────────────────────────────────────────

  /**
   * Path 1: kid is a DID URL pointing to a keyAgreement VM on one of our Created DIDs.
   */
  private async resolveFromCreatedDid(agentContext: AgentContext, kid: string): Promise<ResolvedRecipientKey | null> {
    const didOnly = kid.includes('#') ? kid.split('#')[0] : kid
    const keyRef = kid.includes('#') ? kid : `${kid}#${parseDid(kid).id}`

    try {
      const dids = agentContext.resolve(DidsApi)
      const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(didOnly)
      const verificationMethod = didDocument.dereferenceKey(keyRef, ['keyAgreement'])
      const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

      const kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
        verificationMethod.id.endsWith(didDocumentRelativeKeyId)
      )?.kmsKeyId

      const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
      return { recipientKey: toKeyAgreementWithKeyId(publicJwk, keyId), matchedKid: kid }
    } catch {
      return null
    }
  }

  /**
   * Path 2: kid for a mediator routing key, as a did:key or a did:peer keyAgreement DID URL.
   * Routing keys aren't Created DIDs, so we look them up in the mediator routing repository.
   */
  private async resolveFromMediatorRouting(
    agentContext: AgentContext,
    kid: string
  ): Promise<ResolvedRecipientKey | null> {
    // did:key and did:peer resolve locally, so a kid that is not ours never triggers network resolution
    if (!kid.startsWith('did:key:') && !kid.startsWith('did:peer:')) return null

    try {
      const kidPublicJwk = kid.startsWith('did:key:')
        ? DidKey.fromDid(kid).publicJwk
        : getPublicJwkFromVerificationMethod(
            (await this.didResolverService.resolveDidDocument(agentContext, kid)).dereferenceKey(kid, ['keyAgreement'])
          )
      const mediatorRoutingRepository = agentContext.dependencyManager.resolve(DidCommMediatorRoutingRepository)

      const record = await mediatorRoutingRepository.findSingleByQuery(agentContext, {
        routingKeyFingerprints: [kidPublicJwk.fingerprint],
      })
      const routingKey = record?.routingKeysWithKeyId.find((rk) => kidPublicJwk.equals(rk))
      // The KMS agrees on keys with an ECDH curve only, so the Ed25519 routing key of DIDComm v1 cannot open a v2 forward
      if (routingKey?.keyId && routingKey.is(Kms.X25519PublicJwk)) {
        return { recipientKey: toKeyAgreementWithKeyId(routingKey, routingKey.keyId), matchedKid: kid }
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

      // keyAgreement methods can be embedded instead of listed in verificationMethod (did:peer:4)
      const candidates = [
        ...(didDocument.verificationMethod ?? []),
        ...didDocument.findVerificationMethodsByPurpose(['keyAgreement']),
      ]
      for (const vm of candidates) {
        let vmJwk: Kms.PublicJwk
        try {
          vmJwk = getPublicJwkFromVerificationMethod(vm)
        } catch {
          continue
        }

        if (vmJwk.fingerprint !== kidPublicJwk.fingerprint) continue

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

      if (recipientRouting.keyAgreementKeyFingerprint === fingerprint) {
        const keyId = recipientRouting.keyAgreementKeyId ?? kidPublicJwk.legacyKeyId
        return { recipientKey: toKeyAgreementWithKeyId(kidPublicJwk, keyId), matchedKid: kid }
      }
    }

    return null
  }
}
