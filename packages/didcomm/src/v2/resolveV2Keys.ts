import {
  AgentContext,
  DidsApi,
  DidResolverService,
  getPublicJwkFromVerificationMethod,
  injectable,
  JsonEncoder,
  Kms,
  parseDid,
} from '@credo-ts/core'
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
    const protectedJson = JsonEncoder.fromBase64(encrypted.protected) as {
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
                const authVm = typeof authRef === 'string' ? didDocument.dereferenceVerificationMethod(authRef) : authRef
                const authJwk = getPublicJwkFromVerificationMethod(authVm)
                if (!authJwk.is(Kms.Ed25519PublicJwk)) continue
                const derivedX25519 = authJwk.convertTo(Kms.X25519PublicJwk)
                if (derivedX25519.fingerprint === x25519Target.fingerprint) {
                  kmsKeyId = keys.find(({ didDocumentRelativeKeyId }) =>
                    authVm.id.endsWith(didDocumentRelativeKeyId)
                  )?.kmsKeyId
                  if (kmsKeyId) break
                }
              } catch {
                continue
              }
            }
          }

          const keyId = kmsKeyId ?? (publicJwk.hasKeyId ? publicJwk.keyId : publicJwk.legacyKeyId)
          const x25519 = publicJwk.is(Kms.X25519PublicJwk)
            ? (publicJwk as Kms.PublicJwk<Kms.X25519PublicJwk>)
            : (publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
          x25519.keyId = keyId
          return { recipientKey: x25519 as Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }, matchedKid: kid }
        } catch {
          // Not our DID — try next recipient
          continue
        }
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
        x25519.keyId = vmId.startsWith('did:') ? vmId : vmId.startsWith('#') ? `${didOnly}${vmId}` : `${didOnly}#${vmId}`
      }
      return x25519 as Kms.PublicJwk<Kms.X25519PublicJwk>
    } catch {
      return null
    }
  }
}
