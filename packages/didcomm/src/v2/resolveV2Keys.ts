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

          const kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
            verificationMethod.id.endsWith(didDocumentRelativeKeyId)
          )?.kmsKeyId

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
        // Explicit VM reference — dereference it (accept keyAgreement or authentication
        // since Ed25519 auth keys are convertible to X25519 for ECDH-1PU)
        const vm = didDocument.dereferenceKey(skid, ['keyAgreement', 'authentication'])
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
      if (vmId && !x25519.hasKeyId) x25519.keyId = vmId
      return x25519 as Kms.PublicJwk<Kms.X25519PublicJwk>
    } catch {
      return null
    }
  }
}
