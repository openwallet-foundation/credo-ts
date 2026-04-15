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
} from '@credo-ts/core'
import { DidCommMediatorRoutingRepository } from '../modules/routing/repository'
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

        // Path 3: mediator routing record lookup for did:key kids.
        // When a v2 Forward arrives addressed to the mediator's routing key, the kid
        // is `did:key:z6...` which is NOT a Created DID in the DID store. We fall back
        // to the mediator routing repository (same fallback pattern as v1's
        // DidCommEnvelopeService.extractOurRecipientKeyWithKeyId).
        //
        // The kid may be Ed25519 (z6Mk) or X25519 (z6LS). The routing record stores
        // Ed25519 keys, so we look up by Ed25519 fingerprint directly, and for X25519
        // kids we derive the Ed25519=>X25519 mapping and compare.
        if (kid.startsWith('did:key:')) {
          try {
            const kidPublicJwk = DidKey.fromDid(kid).publicJwk
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
            // Ignore failures in Path 3 and continue to next recipient
          }
        }

        continue
      }

      // Path 2: kid stored directly in KMS (e.g. internal key id)
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
