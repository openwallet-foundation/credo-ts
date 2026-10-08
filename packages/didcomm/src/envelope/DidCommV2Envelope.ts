import type { AgentContext, DidDocument, Kms } from '@credo-ts/core'
import {
  areEquivalentDidPeer4Forms,
  CredoError,
  DidKey,
  DidsApi,
  getDidPeer4ShortFormForEquivalence,
  getPublicJwkFromVerificationMethod,
  injectable,
  utils,
} from '@credo-ts/core'
import type { DecryptedDidCommMessageContext, DidCommEnvelopeKey, EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { DidCommConnectionMetadataKeys } from '../modules/connections/repository/DidCommConnectionMetadataTypes'
import {
  findOwnKeyAgreementKey,
  toAbsoluteDidUrl,
  toKeyAgreement,
  toKeyAgreementDidUrl,
} from '../modules/connections/services/helpers'
import { DidCommForwardV2Message } from '../modules/routing/protocol/v2/messages'
import { DidCommDocumentService } from '../services/DidCommDocumentService'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from '../types'
import { isDidCommV2EncryptedMessage, isDidCommV2SignedMessage } from '../util/didcommVersion'
import type { DidCommV2KeyAgreementJwk, DidCommV2PlaintextMessage, DidCommV2SignedMessageWire } from '../v2'
import {
  buildV2PlaintextFromMessage,
  DidCommV2EnvelopeService,
  DidCommV2KeyResolver,
  normalizeV2PlaintextToV1,
} from '../v2'
import type { DidCommV2AnoncryptContentEncryptionAlgorithm } from '../v2/types'
import type { DidCommEnvelope, DidCommPackOptions, DidCommReturnRouteOptions } from './DidCommEnvelope'

/**
 * Key material for one DIDComm v2 envelope, in the curves the v2 specification allows.
 *
 * The framework carries {@link EnvelopeKeys} between the transport session, the service
 * parameters and the sender, because that type is part of the public transport interface. This
 * class converts that carrier into the honest v2 shape at the last moment, in one place.
 */
interface DidCommV2PackKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  recipientKid: string
  senderKey: DidCommV2KeyAgreementJwk
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  senderKeySkid: string
}

/**
 * DIDComm v2 envelope.
 *
 * All of the cryptography stays in {@link DidCommV2EnvelopeService}, which is unchanged. This class
 * owns everything around it that is specific to v2: the plaintext shape, the key-agreement curves,
 * the Forward wrapping for mediated routes, and the signed-message handling.
 */
@injectable()
export class DidCommV2Envelope implements DidCommEnvelope<'v2'> {
  public readonly version = 'v2' as const

  private envelopeService: DidCommV2EnvelopeService
  private keyResolver: DidCommV2KeyResolver
  private config: DidCommModuleConfig

  public constructor(
    envelopeService: DidCommV2EnvelopeService,
    keyResolver: DidCommV2KeyResolver,
    config: DidCommModuleConfig
  ) {
    this.envelopeService = envelopeService
    this.keyResolver = keyResolver
    this.config = config
  }

  /** Authcrypt needs a sender key and its skid. Without both, only the v1 envelope can be built. */
  public supportsPacking(keys: EnvelopeKeys): boolean {
    return (
      keys.recipientKeys.length >= 1 &&
      keys.senderKey !== null &&
      keys.senderKey !== undefined &&
      Boolean(keys.senderKeySkid)
    )
  }

  // Encrypted envelopes only: signed envelopes have their own receive path through unpackSigned.
  public supportsUnpacking(message: unknown): boolean {
    return isDidCommV2EncryptedMessage(message)
  }

  // ── Packing ───────────────────────────────────────────────────────────

  public async pack(
    agentContext: AgentContext,
    message: DidCommMessage,
    keys: EnvelopeKeys,
    options?: DidCommPackOptions
  ): Promise<DidCommEncryptedMessage> {
    const v2Keys = this.toV2EnvelopeKeys(keys)
    const plaintext = this.buildPlaintext(message, v2Keys, options?.connection)

    agentContext.config.logger.debug('Raw DIDComm v2 plaintext (on-wire format, before encrypt)', {
      id: plaintext.id,
      type: plaintext.type,
      from: plaintext.from,
      to: plaintext.to,
      thid: plaintext.thid,
      bodyKeys: plaintext.body ? Object.keys(plaintext.body) : undefined,
      hasFromPrior: plaintext.from_prior !== undefined,
    })

    const encryptedMessage = await this.envelopeService.pack(agentContext, plaintext, {
      recipients: [{ key: v2Keys.recipientKey, kid: v2Keys.recipientKid }],
      senderKey: v2Keys.senderKey,
      senderKeySkid: v2Keys.senderKeySkid,
      contentEncryptionAlgorithm: this.config.v2DefaultAuthcryptContentEncryption,
    })

    if (v2Keys.routingKeys.length === 0) return encryptedMessage

    return wrapInV2Forward(agentContext, this.envelopeService, encryptedMessage, {
      routingKeys: v2Keys.routingKeys,
      recipientKey: v2Keys.recipientKey,
      connection: options?.connection,
      contentEncryptionAlgorithm: this.config.v2DefaultAnoncryptContentEncryption,
    })
  }

  /**
   * Convert the transport-level key carrier into v2 key-agreement keys.
   *
   * The recipient `kid` is a `did:key` URL when the key carries no DID URL of its own.
   */
  private toV2EnvelopeKeys(keys: EnvelopeKeys): DidCommV2PackKeys {
    if (!keys.senderKey) {
      throw new CredoError('DIDComm v2 pack requires a sender key')
    }
    if (!keys.senderKeySkid) {
      throw new CredoError('DIDComm v2 pack requires a sender key skid')
    }

    const senderKey = toKeyAgreement(keys.senderKey)
    senderKey.keyId = keys.senderKey.hasKeyId ? keys.senderKey.keyId : keys.senderKey.legacyKeyId
    const recipientKey =
      keys.recipientKeys.find((key) => toKeyAgreement(key).JwkClass === senderKey.JwkClass) ?? keys.recipientKeys[0]

    return {
      recipientKey: toKeyAgreement(recipientKey),
      recipientKid: toKeyAgreementDidUrl(recipientKey),
      senderKey,
      routingKeys: keys.routingKeys,
      senderKeySkid: keys.senderKeySkid,
    }
  }

  private buildPlaintext(
    message: DidCommMessage,
    keys: DidCommV2PackKeys,
    connection?: DidCommPackOptions['connection']
  ): DidCommV2PlaintextMessage {
    // `theirDid` can be empty on the record but still present in the tags right after a rotation.
    const tagsTheirDid = connection?.getTags().theirDid
    const theirDid =
      (connection?.theirDid && connection.theirDid.length > 0 ? connection.theirDid : undefined) ??
      (typeof tagsTheirDid === 'string' && tagsTheirDid.length > 0 ? tagsTheirDid : undefined)
    const skidDid = keys.senderKeySkid.startsWith('did:') ? keys.senderKeySkid.split('#')[0] : undefined

    return buildV2PlaintextFromMessage(message, {
      useDidSovPrefixWhereAllowed: this.config.useDidSovPrefixWhereAllowed,
      from:
        connection?.did && skidDid && areEquivalentDidPeer4Forms(connection.did, skidDid) ? connection.did : skidDid,
      to: theirDid ? [theirDid] : undefined,
      fromPrior: connection?.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)?.fromPriorJwt,
    })
  }

  // ── Unpacking ─────────────────────────────────────────────────────────

  public async unpack(
    agentContext: AgentContext,
    encryptedMessage: DidCommEncryptedMessage
  ): Promise<DecryptedDidCommMessageContext> {
    if (!isDidCommV2EncryptedMessage(encryptedMessage)) {
      throw new CredoError('Message is not a DIDComm v2 encrypted envelope')
    }

    const resolved = await this.keyResolver.resolveRecipientKey(agentContext, encryptedMessage)
    if (!resolved) {
      throw new CredoError('No matching recipient key found for DIDComm v2 message')
    }
    const { recipientKey, matchedKid } = resolved

    const { plaintext, senderKey, senderKid } = await this.envelopeService.unpack(agentContext, encryptedMessage, {
      recipientKey,
      matchedKid,
      resolveSenderKey: (skid) => this.keyResolver.resolveSenderKey(agentContext, skid),
    })
    const senderDid = senderKid?.split('#')[0]

    // Sign-then-encrypt: the decrypted bytes are a JWS. Verify it and use the inner plaintext.
    let unwrapped: DidCommV2PlaintextMessage = plaintext
    if (isDidCommV2SignedMessage(plaintext as unknown)) {
      const verified = await this.verifySignedPlaintext(
        agentContext,
        plaintext as unknown as DidCommV2SignedMessageWire
      )
      unwrapped = verified.plaintext
      agentContext.config.logger.debug('Verified nested DIDComm v2 signed message', {
        type: unwrapped.type,
        from: unwrapped.from,
      })
      if (senderDid && !areEquivalentDidPeer4Forms(verified.signerDid, senderDid)) {
        throw new CredoError(
          `DIDComm v2 nested signer '${verified.signerDid}' does not match the authcrypt sender '${senderDid}'`
        )
      }
    }

    // Lenient on purpose: authcrypt without from falls back to the skid DID, though the spec requires from.
    // https://identity.foundation/didcomm-messaging/spec/v2.1/#message-headers
    const from = unwrapped.from
    if (senderDid && from !== undefined && (typeof from !== 'string' || !areEquivalentDidPeer4Forms(from, senderDid))) {
      throw new CredoError(`DIDComm v2 plaintext 'from' (${from}) does not match the authcrypt sender '${senderDid}'`)
    }

    this.warnIfNotAddressedToUs(agentContext, unwrapped.to, matchedKid)

    agentContext.config.logger.debug('Raw DIDComm v2 plaintext (on-wire format, before normalization)', {
      id: unwrapped.id,
      type: unwrapped.type,
      from: unwrapped.from,
      to: unwrapped.to,
      thid: unwrapped.thid,
      bodyKeys: unwrapped.body ? Object.keys(unwrapped.body) : undefined,
    })
    agentContext.config.logger.debug('Unpacked DIDComm v2 message', { type: unwrapped.type })

    return {
      plaintextMessage: normalizeV2PlaintextToV1(unwrapped),
      senderKey: senderKey ?? undefined,
      recipientKey,
      authenticatedSenderDid: senderDid ? (from ?? senderDid) : undefined,
      recipientDid: matchedKid.split('#')[0],
    }
  }

  private warnIfNotAddressedToUs(agentContext: AgentContext, to: unknown, matchedKid: string): void {
    if (to === undefined) return

    const ourDid = matchedKid.split('#')[0]
    if (
      Array.isArray(to) &&
      to.some((entry) => typeof entry === 'string' && areEquivalentDidPeer4Forms(entry, ourDid))
    ) {
      return
    }

    agentContext.config.logger.warn("DIDComm v2 plaintext 'to' does not contain the DID the message was encrypted to", {
      to,
      ourDid,
    })
  }

  /**
   * Verify a standalone DIDComm v2 signed message and return the payload in v1 shape.
   *
   * Signed envelopes exist only in v2, so this is not part of the shared envelope contract. The
   * message receiver resolves this class directly for that path.
   */
  public async unpackSigned(
    agentContext: AgentContext,
    signedMessage: DidCommV2SignedMessageWire
  ): Promise<DidCommPlaintextMessage> {
    const { plaintext } = await this.verifySignedPlaintext(agentContext, signedMessage)
    agentContext.config.logger.info(
      `Verified DIDComm v2 signed message of type '${plaintext.type}' from '${plaintext.from}'`
    )
    return normalizeV2PlaintextToV1(plaintext)
  }

  /**
   * Verify a v2 JWS and return its plaintext payload.
   *
   * The signer lookup enforces the DIDComm v2.1 rule that `kid` must resolve to an authentication
   * verification method in the signer's DID document.
   */
  private async verifySignedPlaintext(
    agentContext: AgentContext,
    signedMessage: DidCommV2SignedMessageWire
  ): Promise<{ plaintext: DidCommV2PlaintextMessage; signerDid: string }> {
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const { plaintext, signers } = await this.envelopeService.verifySignedMessage(agentContext, signedMessage, {
      resolveSignerJwk: async (kid) => {
        const signerDid = kid.split('#')[0]
        const didDocument = await dids.resolveDidDocument(signerDid)
        const verificationMethod = didDocument.dereferenceKey(kid, ['authentication'])
        return getPublicJwkFromVerificationMethod(verificationMethod)
      },
    })

    return { plaintext, signerDid: signers[0].kid.split('#')[0] }
  }

  // ── Return routing ────────────────────────────────────────────────────

  /**
   * A v2 envelope names its sender with a `skid` instead of embedding the key, so a reply over the
   * inbound session must carry a `skid` the peer can resolve.
   *
   * The lookup finds the verification method in our own DID document that holds the key the
   * message was addressed to. When our DID changed since, the reply uses a keyAgreement key of the
   * current DID instead, so the `skid` matches the plaintext `from`.
   */
  public async buildReturnRouteKeys(
    agentContext: AgentContext,
    options: DidCommReturnRouteOptions
  ): Promise<EnvelopeKeys> {
    const ourKey = await this.resolveReturnRouteSenderKey(agentContext, options)

    return {
      recipientKeys: [options.senderKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>],
      routingKeys: [],
      senderKey: ourKey.publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
      senderKeySkid: ourKey.skid,
    }
  }

  private async resolveReturnRouteSenderKey(
    agentContext: AgentContext,
    { senderKey, recipientKey, plaintextMessage, connection }: DidCommReturnRouteOptions
  ): Promise<{ publicJwk: DidCommEnvelopeKey; skid: string }> {
    const addressedKey = () => this.resolveAddressedKey(agentContext, recipientKey)
    if (!connection) return addressedKey()

    // The inbound `to` can still hold our prior DID mid-rotation, so it is only a fallback.
    const to = Array.isArray(plaintextMessage.to) ? (plaintextMessage.to as string[]) : undefined
    const ourDid = connection.did ?? to?.[0]
    if (!ourDid) return addressedKey()

    const dids = agentContext.resolve(DidsApi)
    const created = await dids.resolveCreatedDidDocumentWithKeys(ourDid).catch(() => undefined)
    if (!created) return addressedKey()
    const { didDocument, keys } = created

    const addressedInOurDid = this.findAddressedKey(didDocument, recipientKey)
    if (addressedInOurDid) return addressedInOurDid

    const currentKey = connection.did ? findOwnKeyAgreementKey(didDocument, keys, senderKey) : undefined
    return currentKey ? { publicJwk: currentKey.publicJwk, skid: currentKey.didUrl } : addressedKey()
  }

  private async resolveAddressedKey(
    agentContext: AgentContext,
    recipientKey: DidCommEnvelopeKey
  ): Promise<{ publicJwk: DidCommEnvelopeKey; skid: string }> {
    const created = await agentContext
      .resolve(DidCommDocumentService)
      .resolveCreatedDidDocumentWithKeysByRecipientKey(agentContext, recipientKey)
      .catch(() => undefined)

    return (
      (created && this.findAddressedKey(created.didDocument, recipientKey)) ?? {
        publicJwk: recipientKey,
        skid: toKeyAgreementDidUrl(recipientKey),
      }
    )
  }

  private findAddressedKey(
    didDocument: DidDocument,
    recipientKey: DidCommEnvelopeKey
  ): { publicJwk: DidCommEnvelopeKey; skid: string } | undefined {
    try {
      const { id } = didDocument.findVerificationMethodByPublicKey(recipientKey, ['keyAgreement'])
      return { publicJwk: recipientKey, skid: toAbsoluteDidUrl(didDocument.id, id) }
    } catch {
      return undefined
    }
  }
}

/**
 * Wrap the envelope in one anoncrypt Forward message for every routing key, outermost hop last.
 */
export async function wrapInV2Forward(
  agentContext: AgentContext,
  envelopeService: DidCommV2EnvelopeService,
  encryptedMessage: DidCommEncryptedMessage,
  options: {
    routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
    recipientKey: Kms.PublicJwk
    connection?: DidCommPackOptions['connection']
    contentEncryptionAlgorithm: DidCommV2AnoncryptContentEncryptionAlgorithm
  }
): Promise<DidCommEncryptedMessage> {
  let payload = encryptedMessage

  const recipientNext = resolveRecipientNextForMediationForward(options.connection, options.recipientKey)
  const routingKeysReversed = [...options.routingKeys].reverse()

  for (let i = 0; i < routingKeysReversed.length; i++) {
    const routingKey = routingKeysReversed[i]
    const next = i === 0 ? recipientNext : toKeyAgreementDidUrl(routingKeysReversed[i - 1]).split('#')[0]

    const attachment = {
      id: utils.uuid(),
      media_type: 'application/didcomm-encrypted+json',
      data: { json: payload },
    }
    const forwardPlaintext = DidCommForwardV2Message.createV2PlaintextMessage({
      to: [toKeyAgreementDidUrl(routingKey).split('#')[0]],
      next,
      attachments: [attachment],
    })

    payload = await envelopeService.packAnoncrypt(agentContext, forwardPlaintext, {
      recipients: [{ key: toKeyAgreement(routingKey), kid: toKeyAgreementDidUrl(routingKey) }],
      contentEncryptionAlgorithm: options.contentEncryptionAlgorithm,
    })
  }

  return payload
}

/**
 * Value for Forward `next` / mediator keylist lookup.
 *
 * routing/2.0 describes `next` as the identifier of the next hop (typically a DID) that
 * the mediator matches against what the recipient pre-registered (CM 2.0 keylist-update).
 * Credo's mediator compares by string equality, so this must emit the same canonical
 * form the recipient registers.
 */
function resolveRecipientNextForMediationForward(
  connection: DidCommPackOptions['connection'],
  recipientKey: Kms.PublicJwk
): string {
  // CM 2.0 recipients register their connection did:peer with the mediator, so prefer
  // that DID (short-form canonicalized like the mediator's keylist store and lookup).
  const theirDid = connection?.theirDid
  if (theirDid) return getDidPeer4ShortFormForEquivalence(theirDid) ?? theirDid

  // No recipient DID known: routing/2.0 allows a key for the last hop.
  return new DidKey(toKeyAgreement(recipientKey)).did
}
