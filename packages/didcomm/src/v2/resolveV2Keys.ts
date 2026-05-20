import {
  AgentContext,
  DidKey,
  DidResolverService,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  injectable,
  JsonEncoder,
  Kms,
  parseDid,
  RecordNotFoundError,
} from '@credo-ts/core'
import { getResolvedDidcommServiceWithSigningKeyId } from '../modules/connections/services/helpers'
import { DidCommOutOfBandRole } from '../modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandRepository } from '../modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommOutOfBandRecordMetadataKeys } from '../modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommMediatorRoutingRepository } from '../modules/routing/repository'
import { DidCommDocumentService } from '../services/DidCommDocumentService'
import type { DidCommV2EncryptedMessage } from './types'

@injectable()
export class DidCommV2KeyResolver {
  public constructor(private didResolverService: DidResolverService) {}

  /**
   * Resolve our recipient key from a DIDComm v2 encrypted message.
   *
   * Per DIDComm v2 spec, the JWE recipient `kid` MUST be a DID URL pointing to a
   * `keyAgreement` verification method in the recipient's DID document. This resolver
   * only accepts that format. Non-conforming `kid` values (raw keys, did:key, bare
   * multibase) are skipped.
   */
  public async resolveRecipientKey(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage
  ): Promise<{ recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }; matchedKid: string } | null> {
    const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected) as {
      recipients?: Array<{ header?: { kid?: string } }>
    }

    const recipients = protectedJson.recipients ?? []
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    for (const recipient of recipients) {
      const kid = recipient.header?.kid
      if (!kid) continue

      // Path 1: kid is a DID URL
      if (kid.startsWith('did:')) {
        const didOnly = kid.includes('#') ? kid.split('#')[0] : kid
        const keyRef = kid.includes('#') ? kid : `${kid}#${parseDid(kid).id}`

        try {
          const dids = agentContext.resolve(DidsApi)
          const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(didOnly)
          const verificationMethod = didDocument.dereferenceKey(keyRef, ['keyAgreement'])
          const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

          let kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
            verificationMethod.id.endsWith(didDocumentRelativeKeyId)
          )?.kmsKeyId

          // When no direct kmsKeyId mapping exists for the keyAgreement VM (common for
          // did:webvh and other DIDs where the X25519 key is derived from Ed25519),
          // find the corresponding Ed25519 authentication key and use its kmsKeyId.
          // Askar supports X25519 key agreement using Ed25519 keys via birational map.
          if (!kmsKeyId && publicJwk.is(Kms.X25519PublicJwk) && keys) {
            const x25519Target = publicJwk
            for (const authRef of didDocument.authentication ?? []) {
              try {
                const authVm =
                  typeof authRef === 'string' ? didDocument.dereferenceVerificationMethod(authRef) : authRef
                const authJwk = getPublicJwkFromVerificationMethod(authVm)
                if (!authJwk.is(Kms.Ed25519PublicJwk)) continue
                const derivedX25519 = authJwk.convertTo(Kms.X25519PublicJwk)
                if (derivedX25519.fingerprint === x25519Target.fingerprint) {
                  kmsKeyId = keys.find(({ didDocumentRelativeKeyId }) =>
                    authVm.id.endsWith(didDocumentRelativeKeyId)
                  )?.kmsKeyId
                  if (kmsKeyId) break
                }
              } catch {}
            }
          }

          const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
          const x25519 = publicJwk.is(Kms.X25519PublicJwk)
            ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
            : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
          x25519.keyId = keyId
          return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
        } catch {
          // Fall through: not a Created DID. Below we check mediator routing record
          // for did:key kids (v2 Forward to mediator routing key).
        }

        const kidPublicJwk = kid.startsWith('did:key:') ? DidKey.fromDid(kid).publicJwk : null

        // Path 2: did:key kid for a mediator routing key (v2 Forward
        // arrives addressed to a key our mediator manages). Routing keys aren't
        // Created DIDs, so we look them up in the mediator routing repository.
        if (kidPublicJwk) {
          try {
            const mediatorRoutingRepository = agentContext.dependencyManager.resolve(DidCommMediatorRoutingRepository)

            // Ed25519 kid: direct fingerprint lookup
            if (kidPublicJwk.is(Kms.Ed25519PublicJwk)) {
              const record = await mediatorRoutingRepository.findSingleByQuery(agentContext, {
                routingKeyFingerprints: [kidPublicJwk.fingerprint],
              })
              if (record) {
                const routingKey = record.routingKeysWithKeyId.find((rk) => kidPublicJwk.equals(rk))
                if (routingKey) {
                  // Askar handles Ed25519 <=> X25519 birationally via the same kmsKeyId,
                  // so we can convert and reuse the Ed25519 key id for X25519 decryption.
                  const x25519 = (routingKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
                  x25519.keyId = routingKey.keyId
                  return {
                    recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
                    matchedKid: kid,
                  }
                }
              }
            }

            // X25519 kid: tag stores Ed25519 fingerprint so we can't query by X25519.
            // Load the single well-known routing record and scan its keys.
            if (kidPublicJwk.is(Kms.X25519PublicJwk)) {
              const record = await mediatorRoutingRepository.findById(
                agentContext,
                mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
              )
              if (record) {
                for (const routingKey of record.routingKeysWithKeyId) {
                  try {
                    const derivedX25519 = (routingKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(
                      Kms.X25519PublicJwk
                    )
                    if (derivedX25519.fingerprint === kidPublicJwk.fingerprint) {
                      derivedX25519.keyId = routingKey.keyId
                      return {
                        recipientKey: derivedX25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
                        matchedKid: kid,
                      }
                    }
                  } catch {
                    // Skip keys that can't be converted
                  }
                }
              }
            }
          } catch {
            // Ignore failures and try the next path.
          }
        }

        // Path 3: did:key kid whose underlying public key is actually
        // a verification method on one of our Created DIDs (e.g. the master Ed25519
        // of did:webvh, referenced as `did:key:z6Mk...`). Path 1 missed it
        // because the did:key form itself isn't registered. We reverse-lookup by
        // public key and pull the kmsKeyId from the parent DID record.
        if (kidPublicJwk) {
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
                vmJwk.is(Kms.Ed25519PublicJwk) &&
                (vmJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk).fingerprint ===
                  kidPublicJwk.fingerprint
              if (!directMatch && !derivedMatch) continue

              const x25519 = vmJwk.is(Kms.X25519PublicJwk)
                ? (vmJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
                : (vmJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              const kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
                vm.id.endsWith(didDocumentRelativeKeyId)
              )?.kmsKeyId
              x25519.keyId = kmsKeyId ?? (vmJwk.hasKeyId ? vmJwk.keyId : vmJwk.legacyKeyId)
              return {
                recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
                matchedKid: kid,
              }
            }
          } catch (error) {
            if (!(error instanceof RecordNotFoundError)) throw error
          }
        }

        // Path 4: did:key kid for an ephemeral routing key from a
        // connection-less OOB exchange. The wallet generates a fresh routing key
        // per exchange and stores its kmsKeyId only on the OOB record's metadata.
        // Look up the OOB record by fingerprint and pull the kmsKeyId from there.
        // Sender role: the kid matches one of our invitation's inline service keys.
        // Receiver role: the kid matches our recipientRouting key for that exchange.
        if (kidPublicJwk) {
          const fingerprint = kidPublicJwk.fingerprint
          const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)

          const outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
            $or: [
              {
                role: DidCommOutOfBandRole.Sender,
                recipientKeyFingerprints: [fingerprint],
              },
              {
                role: DidCommOutOfBandRole.Receiver,
                recipientRoutingKeyFingerprint: fingerprint,
              },
            ],
          })

          if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
            agentContext.config.logger.debug(
              `Found out of band record with id '${outOfBandRecord.id}' and role '${outOfBandRecord.role}' for recipient key '${fingerprint}' for incoming didcomm v2 message`
            )

            for (const service of outOfBandRecord.outOfBandInvitation.getInlineServices()) {
              const resolvedService = getResolvedDidcommServiceWithSigningKeyId(
                service,
                outOfBandRecord.invitationInlineServiceKeys
              )
              const recipientKey = resolvedService.recipientKeys.find((rk) => rk.fingerprint === fingerprint)
              if (!recipientKey) continue
              const matchedKeyId = recipientKey.hasKeyId ? recipientKey.keyId : recipientKey.legacyKeyId
              const x25519 = recipientKey.is(Kms.X25519PublicJwk)
                ? (recipientKey as Kms.PublicJwk<Kms.X25519PublicJwk>)
                : (recipientKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              x25519.keyId = matchedKeyId
              return {
                recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
                matchedKid: kid,
              }
            }
          } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
            agentContext.config.logger.debug(
              `Found out of band record with id '${outOfBandRecord.id}' and role '${outOfBandRecord.role}' for recipient key '${fingerprint}' for incoming didcomm v2 message`
            )

            const recipientRouting = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
            if (recipientRouting?.recipientKeyFingerprint === fingerprint) {
              const x25519 = kidPublicJwk.is(Kms.X25519PublicJwk)
                ? (kidPublicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
                : (kidPublicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
              x25519.keyId = recipientRouting.recipientKeyId ?? x25519.legacyKeyId
              return {
                recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string },
                matchedKid: kid,
              }
            }
          }
        }

        continue
      }

      // Path 5: kid stored directly in KMS (e.g. internal key id)
      const kmsPublic = await kms.getPublicKey({ keyId: kid }).catch((err) => {
        if (err instanceof Kms.KeyManagementKeyNotFoundError) return null
        throw err
      })
      if (kmsPublic) {
        const publicJwk = Kms.PublicJwk.fromPublicJwk(kmsPublic as Kms.KmsJwkPublicOkp)
        const x25519 = publicJwk.is(Kms.X25519PublicJwk)
          ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
          : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
        x25519.keyId = kid
        return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
      }
    }

    return null
  }

  /**
   * Resolve sender key from skid (DID URL).
   *
   * Per DIDComm v2 spec, `skid` is a DID URL into the sender's `keyAgreement`.
   * Used for ECDH-1PU authcrypt verification.
   */
  public async resolveSenderKey(
    agentContext: AgentContext,
    skid: string
  ): Promise<Kms.PublicJwk<Kms.X25519PublicJwk> | null> {
    if (!skid.startsWith('did:')) return null

    try {
      const didOnly = skid.includes('#') ? skid.split('#')[0] : skid
      const didDocument = await this.didResolverService.resolveDidDocument(agentContext, didOnly)

      let senderJwk: Kms.PublicJwk | undefined
      let vmId: string | undefined

      if (skid.includes('#')) {
        // Explicit VM reference — must be keyAgreement per DIDComm v2 spec (skid is a DID URL
        // into the sender's keyAgreement, not authentication)
        const vm = didDocument.dereferenceKey(skid, ['keyAgreement'])
        senderJwk = getPublicJwkFromVerificationMethod(vm)
        vmId = typeof vm === 'object' && vm !== null && 'id' in vm ? (vm as { id: string }).id : undefined
      } else {
        // No fragment (e.g. did:key:z6Mk…) — pick first keyAgreement VM
        const kaVms = didDocument.keyAgreement
        if (kaVms && kaVms.length > 0) {
          const ka = typeof kaVms[0] === 'string' ? didDocument.dereferenceKey(kaVms[0], ['keyAgreement']) : kaVms[0]
          senderJwk = getPublicJwkFromVerificationMethod(ka)
          vmId = typeof ka === 'object' && ka !== null && 'id' in ka ? (ka as { id: string }).id : undefined
        }
      }

      if (!senderJwk) return null

      const x25519 = senderJwk.is(Kms.X25519PublicJwk)
        ? senderJwk
        : (senderJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
      if (vmId && !x25519.hasKeyId) {
        // Ensure keyId is always a full DID URL, not a relative fragment like "#key-2".
        // Relative fragments can't be resolved by the recipient without knowing the DID.
        x25519.keyId = vmId.startsWith('did:')
          ? vmId
          : vmId.startsWith('#')
            ? `${didOnly}${vmId}`
            : `${didOnly}#${vmId}`
      }
      return x25519 as Kms.PublicJwk<Kms.X25519PublicJwk>
    } catch {
      return null
    }
  }
}
