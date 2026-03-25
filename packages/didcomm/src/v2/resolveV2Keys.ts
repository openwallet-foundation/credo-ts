import {
  AgentContext,
  DidKey,
  DidResolverService,
  getPublicJwkFromVerificationMethod,
  injectable,
  JsonEncoder,
  Kms,
  parseDid,
  RecordNotFoundError,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { DidCommMediatorRoutingRepository } from '../modules/routing/repository/DidCommMediatorRoutingRepository'
import type { DidCommOutOfBandRecord } from '../modules/oob/repository'
import { DidCommOutOfBandRepository } from '../modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommOutOfBandRole } from '../modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandRecordMetadataKeys } from '../modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommOutOfBandState } from '../modules/oob/domain/DidCommOutOfBandState'
import { getResolvedDidcommServiceWithSigningKeyId } from '../modules/connections/services/helpers'
import { DidCommDocumentService } from '../services/DidCommDocumentService'
import type { DidCommV2EncryptedMessage } from './types'

function tryParseKidAsPublicJwk(kid: string): Kms.PublicJwk | null {
  try {
    if (kid.startsWith('did:key:')) {
      const parsed = parseDid(kid)
      return Kms.PublicJwk.fromFingerprint(parsed.id)
    }
    if (kid.startsWith('z')) {
      return Kms.PublicJwk.fromFingerprint(kid)
    }
    if (kid.length === 43 || kid.length === 44) {
      const publicKey = TypedArrayEncoder.fromBase58(kid)
      if (publicKey.length === 32) {
        return Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey,
        })
      }
    }
  } catch {
    // Fall through
  }
  return null
}

@injectable()
export class DidCommV2KeyResolver {
  public constructor(
    private didcommDocumentService: DidCommDocumentService,
    private didResolverService: DidResolverService
  ) {}

  /**
   * Resolve our recipient key from a DIDComm v2 encrypted message.
   * Iterates recipients, finds the first that matches our keys (DID records, mediator, OOB, KMS).
   * Returns X25519 key required for ECDH-1PU decryption.
   */
  public async resolveRecipientKey(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage
  ): Promise<{ recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }; matchedKid: string } | null> {
    const protectedJson = JsonEncoder.fromBase64(encrypted.protected) as {
      recipients?: Array<{ header?: { kid?: string } }>
    }

    const recipients = protectedJson.recipients ?? []
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    for (const recipient of recipients) {
      const kid = recipient.header?.kid
      if (!kid) continue

      let publicJwk = tryParseKidAsPublicJwk(kid)
      let resolvedViaKmsKid = false
      if (!publicJwk) {
        const kmsPublic = await kms.getPublicKey({ keyId: kid }).catch((err) => {
          if (err instanceof Kms.KeyManagementKeyNotFoundError) return null
          throw err
        })
        if (kmsPublic) {
          publicJwk = Kms.PublicJwk.fromPublicJwk(kmsPublic as Kms.KmsJwkPublicOkp)
          resolvedViaKmsKid = true
        }
      }
      if (!publicJwk && (kid.includes('#') || kid.startsWith('did:'))) {
        const didOnly = kid.includes('#') ? kid.split('#')[0] : kid
        const keyRef = kid.includes('#') ? kid : `${kid}#${parseDid(kid).id}`
        if (didOnly) {
          try {
            const didDocument = await this.didResolverService.resolveDidDocument(agentContext, didOnly)
            const verificationMethod = didDocument.dereferenceKey(keyRef, ['authentication', 'keyAgreement'])
            publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
          } catch {
            // Fall through
          }
        } else if (kid.startsWith('#')) {
          // Relative kid (#key-1): try our created peer DIDs. Prefer OOB Sender recipientDids first
          // (invitation DIDs) so we match the DID the message was encrypted to when we have multiple.
          const oobRepo = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
          const oobSenderRecords = await oobRepo.findByQuery(agentContext, {
            role: DidCommOutOfBandRole.Sender,
          })
          const preferredDids = [
            ...new Set(
              oobSenderRecords
                .map((r) => r.getTags().recipientDid)
                .filter((d): d is string => typeof d === 'string')
            ),
          ]
          const ourDids = await this.didcommDocumentService.getCreatedPeerDidStrings(agentContext)
          const orderedDids = [
            ...preferredDids.filter((d) => ourDids.includes(d)),
            ...ourDids.filter((d) => !preferredDids.includes(d)),
          ]
          for (const ourDid of orderedDids) {
            try {
              const didUrl = `${ourDid}${kid}`
              const didDocument = await this.didResolverService.resolveDidDocument(agentContext, ourDid)
              const verificationMethod = didDocument.dereferenceKey(didUrl, ['authentication', 'keyAgreement'])
              publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
              break
            } catch {
              continue
            }
          }
        }
      }
      if (!publicJwk) continue

      // Key was resolved via KMS lookup by kid; use kid as keyId for decrypt (key exists in KMS under that id)
      if (resolvedViaKmsKid) {
        const x25519 = publicJwk.is(Kms.X25519PublicJwk)
          ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
          : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        x25519.keyId = kid
        return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
      }

      try {
        const { didDocument, keys } = await this.didcommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey(
          agentContext,
          publicJwk
        )
        const verificationMethod = didDocument.findVerificationMethodByPublicKey(publicJwk)
        const kmsKeyId =
          keys?.find(({ didDocumentRelativeKeyId }) =>
            verificationMethod?.id.endsWith(didDocumentRelativeKeyId ?? '')
          )?.kmsKeyId ?? publicJwk.legacyKeyId

        const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
        const x25519 = publicJwk.is(Kms.X25519PublicJwk)
          ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
          : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        x25519.keyId = keyId
        return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
      } catch (err) {
        if (!(err instanceof RecordNotFoundError)) throw err
      }

      // Raw base58 kid is ambiguous: could be X25519 bytes misidentified as Ed25519 above.
      // Retry with X25519 interpretation before falling through to mediator/OOB lookups.
      if (publicJwk.is(Kms.Ed25519PublicJwk) && !kid.startsWith('did:') && !kid.startsWith('z')) {
        try {
          const x25519Jwk = Kms.PublicJwk.fromPublicKey({
            kty: 'OKP',
            crv: 'X25519',
            publicKey: publicJwk.publicKey.publicKey,
          })
          const { didDocument, keys } =
            await this.didcommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey(agentContext, x25519Jwk)
          const verificationMethod = didDocument.findVerificationMethodByPublicKey(x25519Jwk)
          const kmsKeyId =
            keys?.find(({ didDocumentRelativeKeyId }) =>
              verificationMethod?.id.endsWith(didDocumentRelativeKeyId ?? '')
            )?.kmsKeyId
          const keyId = kmsKeyId ?? x25519Jwk.legacyKeyId
          x25519Jwk.keyId = keyId
          return { recipientKey: x25519Jwk as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
        } catch (err) {
          if (!(err instanceof RecordNotFoundError)) throw err
        }
      }

      const mediatorRoutingRepository = agentContext.dependencyManager.resolve(DidCommMediatorRoutingRepository)
      let mediatorRoutingRecord
      try {
        mediatorRoutingRecord = await mediatorRoutingRepository.findSingleByQuery(agentContext, {
          routingKeyFingerprints: [publicJwk.fingerprint],
        })
      } catch {
        mediatorRoutingRecord = null
      }

      if (mediatorRoutingRecord) {
        const routingKey = mediatorRoutingRecord.routingKeysWithKeyId.find((rk) => publicJwk!.equals(rk))
        if (routingKey) {
          const x25519: Kms.PublicJwk<Kms.X25519PublicJwk> = routingKey.is(Kms.X25519PublicJwk)
            ? (routingKey as Kms.PublicJwk<Kms.X25519PublicJwk>)
            : (routingKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
          x25519.keyId = routingKey.hasKeyId ? routingKey.keyId : routingKey.legacyKeyId
          return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
        }
      }

      const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
      let outOfBandRecord: DidCommOutOfBandRecord | null = null
      try {
        outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
          role: DidCommOutOfBandRole.Sender,
          recipientKeyFingerprints: [publicJwk.fingerprint],
        })
      } catch {
        // Continue to Receiver check
      }
      if (!outOfBandRecord) {
        const receiverRecords = await outOfBandRepository.findByQuery(agentContext, {
          role: DidCommOutOfBandRole.Receiver,
        })
        for (const rec of receiverRecords) {
          const recipientRouting = rec.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
          if (recipientRouting?.recipientKeyFingerprint) {
            try {
              const storedKey = Kms.PublicJwk.fromFingerprint(recipientRouting.recipientKeyFingerprint)
              const storedX25519 = storedKey.is(Kms.X25519PublicJwk)
                ? storedKey
                : (storedKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              const parsedX25519 = publicJwk.is(Kms.X25519PublicJwk)
                ? publicJwk
                : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              if (storedX25519.equals(parsedX25519)) {
                outOfBandRecord = rec
                break
              }
            } catch {
              // Conversion can fail (invalid key); skip
            }
          }
        }
      }

      if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
        for (const service of outOfBandRecord.outOfBandInvitation.getInlineServices()) {
          const resolvedService = getResolvedDidcommServiceWithSigningKeyId(
            service,
            outOfBandRecord.invitationInlineServiceKeys
          )
          const match = resolvedService.recipientKeys.find((rk) => rk.equals(publicJwk!))
          if (match) {
            const x25519: Kms.PublicJwk<Kms.X25519PublicJwk> = match.is(Kms.X25519PublicJwk)
              ? (match as Kms.PublicJwk<Kms.X25519PublicJwk>)
              : (match as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
            // Use match's keyId (kmsKeyId from invitationInlineServiceKeys); convertTo creates new JWK and may not preserve kid
            x25519.keyId = match.hasKeyId ? match.keyId : match.legacyKeyId
            return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
          }
        }
        // V2 OOB: services are [did], getInlineServices() is empty. Use recipientDid to get kmsKeyId from our DidRecord.
        const recipientDid = outOfBandRecord.getTags().recipientDid
        if (recipientDid) {
          try {
            const { didDocument, keys } = await this.didcommDocumentService.resolveCreatedDidDocumentWithKeysByDid(
              agentContext,
              recipientDid,
              publicJwk
            )
            const verificationMethod = didDocument.findVerificationMethodByPublicKey(publicJwk)
            const kmsKeyId =
              keys?.find(({ didDocumentRelativeKeyId }) =>
                verificationMethod?.id.endsWith(didDocumentRelativeKeyId ?? '')
              )?.kmsKeyId ?? publicJwk.legacyKeyId
            const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
            const x25519 = publicJwk.is(Kms.X25519PublicJwk)
              ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
              : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
            x25519.keyId = keyId
            return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
          } catch {
            // Fall through
          }
        }
      } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
        const recipientRouting = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
        if (recipientRouting?.recipientKeyFingerprint) {
          const keyIdToUse = recipientRouting.recipientKeyId ?? publicJwk.legacyKeyId
          const x25519: Kms.PublicJwk<Kms.X25519PublicJwk> = publicJwk.is(Kms.X25519PublicJwk)
            ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
            : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
          x25519.keyId = keyIdToUse
          return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
        }
      }

      const kmsJwkPublic = await kms.getPublicKey({ keyId: publicJwk.legacyKeyId }).catch((e) => {
        if (e instanceof Kms.KeyManagementKeyNotFoundError) return null
        throw e
      })
      if (kmsJwkPublic) {
        const x25519 = publicJwk.is(Kms.X25519PublicJwk)
          ? publicJwk
          : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        // Key was found by legacyKeyId; use it for decrypt
        x25519.keyId = publicJwk.legacyKeyId
        return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
      }
    }

    return null
  }

  /**
   * Resolve sender key from skid (DID URL or key id).
   * Used for ECDH-1PU authcrypt verification. Resolves the sender's public key via DID resolution.
   * When skid is did:peer:1 (not yet in storage), falls back to invitation creator's keys from OOB records.
   */
  public async resolveSenderKey(
    agentContext: AgentContext,
    skid: string
  ): Promise<Kms.PublicJwk<Kms.X25519PublicJwk> | null> {
    try {
      const publicJwk = tryParseKidAsPublicJwk(skid)
      if (publicJwk) {
        const x25519 = publicJwk.is(Kms.X25519PublicJwk)
          ? publicJwk
          : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        return x25519
      }

      if (skid.includes('#') || skid.startsWith('did:')) {
        let didUrl = skid
        if (skid.startsWith('did:') && !skid.includes('#')) {
          const parsed = parseDid(skid)
          didUrl = `${skid}#${parsed.id}`
        }
        const didDocument = await this.didResolverService.resolveDidDocument(agentContext, didUrl)
        const verificationMethod = didDocument.dereferenceKey(didUrl, ['authentication', 'keyAgreement'])
        const senderJwk = getPublicJwkFromVerificationMethod(verificationMethod)
        const x25519 = senderJwk.is(Kms.X25519PublicJwk)
          ? senderJwk
          : (senderJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        // Preserve skid as keyId so response is encrypted with same kid for recipient lookup
        const vmId =
          typeof verificationMethod === 'object' && verificationMethod !== null && 'id' in verificationMethod
            ? (verificationMethod as { id: string }).id
            : undefined
        if (vmId && !x25519.hasKeyId) x25519.keyId = vmId
        return x25519
      }
    } catch {
      // Fall through
    }

    // Fallback: did:peer:1 not yet stored (e.g. connection response); use invitation creator's keys from OOB
    if (skid.startsWith('did:peer:1')) {
      const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
      const records = await outOfBandRepository.findByQuery(agentContext, {
        role: DidCommOutOfBandRole.Receiver,
        $or: [
          { state: DidCommOutOfBandState.Initial },
          { state: DidCommOutOfBandState.PrepareResponse },
        ],
      })
      for (const rec of records) {
        for (const service of rec.outOfBandInvitation.getServices()) {
          let keys: Kms.PublicJwk<Kms.Ed25519PublicJwk | Kms.X25519PublicJwk>[] = []
          if (typeof service === 'string') {
            const resolved = await this.didcommDocumentService.resolveServicesFromDid(agentContext, service)
            keys = resolved.flatMap((s) => s.recipientKeys) as unknown as Kms.PublicJwk<
              Kms.Ed25519PublicJwk | Kms.X25519PublicJwk
            >[]
          } else {
            keys = service.recipientKeys.map((didKey) => DidKey.fromDid(didKey).publicJwk) as unknown as Kms.PublicJwk<
              Kms.Ed25519PublicJwk | Kms.X25519PublicJwk
            >[]
          }
          for (const key of keys) {
            const x25519 = key.is(Kms.X25519PublicJwk)
              ? key
              : (key as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
            return x25519
          }
        }
      }
    }
    return null
  }
}
