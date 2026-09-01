import type { AgentContext, Kms } from '@credo-ts/core'
import {
  CredoError,
  DidKey,
  DidsApi,
  getDidPeer4ShortFormForEquivalence,
  getPublicJwkFromVerificationMethod,
  injectable,
  JsonEncoder,
  utils,
} from '@credo-ts/core'
import type { DecryptedDidCommMessageContext, EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { DidCommConnectionMetadataKeys } from '../modules/connections/repository/DidCommConnectionMetadataTypes'
import { toKeyAgreement } from '../modules/connections/services/helpers'
import { DidCommForwardV2Message } from '../modules/routing/protocol/v2/messages'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from '../types'
import { isDidCommV2EncryptedMessage, isDidCommV2SignedMessage } from '../util/didcommVersion'
import type { DidCommV2KeyAgreementJwk, DidCommV2PlaintextMessage, DidCommV2SignedMessage } from '../v2'
import {
  buildV2PlaintextFromMessage,
  DidCommV2EnvelopeService,
  DidCommV2KeyResolver,
  normalizeV2PlaintextToV1,
} from '../v2'
import type { DidCommEnvelopeProtocol, DidCommPackOptions, DidCommReturnRouteOptions } from './DidCommEnvelopeProtocol'

/**
 * Key material for one DIDComm v2 envelope, in the curves the v2 specification allows.
 *
 * The framework carries {@link EnvelopeKeys} between the transport session, the service
 * parameters and the sender, because that type is part of the public transport interface. This
 * protocol converts that carrier into the honest v2 shape at the last moment, in one place.
 */
interface DidCommV2PackKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  senderKey: DidCommV2KeyAgreementJwk
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  senderKeySkid?: string
}

/**
 * DIDComm v2 envelope protocol.
 *
 * All of the cryptography stays in {@link DidCommV2EnvelopeService}, which is unchanged. This class
 * owns everything around it that is specific to v2: the plaintext shape, the key-agreement curves,
 * the Forward wrapping for mediated routes, and the signed-message handling.
 */
@injectable()
export class DidCommV2EnvelopeProtocol implements DidCommEnvelopeProtocol<'v2'> {
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

  /** Authcrypt needs a sender key. Without one, only the v1 protocol can build an envelope. */
  public supportsPacking(keys: EnvelopeKeys): boolean {
    return keys.recipientKeys.length >= 1 && keys.senderKey !== null && keys.senderKey !== undefined
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
    const plaintext = this.buildPlaintext(message, options?.connection)

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
      recipientKey: v2Keys.recipientKey,
      senderKey: v2Keys.senderKey,
      senderKeySkid: v2Keys.senderKeySkid,
      contentEncryptionAlgorithm: this.config.v2DefaultAuthcryptContentEncryption,
    })

    if (v2Keys.routingKeys.length === 0) return encryptedMessage

    return this.wrapInForward(agentContext, encryptedMessage, keys, v2Keys, options?.connection)
  }

  /**
   * Convert the transport-level key carrier into v2 key-agreement keys.
   *
   * Uses `did:key` as the `kid` when the key carries no explicit key id. The `did:key` form
   * includes the multicodec prefix, so the recipient can determine the key type without guessing.
   */
  private toV2EnvelopeKeys(keys: EnvelopeKeys): DidCommV2PackKeys {
    if (!keys.senderKey) {
      throw new CredoError('DIDComm v2 pack requires a sender key')
    }

    const recipientKey = toKeyAgreement(keys.recipientKeys[0])
    recipientKey.keyId = keys.recipientKeys[0].hasKeyId
      ? keys.recipientKeys[0].keyId
      : new DidKey(keys.recipientKeys[0]).did

    const senderKey = toKeyAgreement(keys.senderKey)
    senderKey.keyId = keys.senderKey.hasKeyId ? keys.senderKey.keyId : keys.senderKey.legacyKeyId

    return {
      recipientKey,
      senderKey,
      routingKeys: keys.routingKeys,
      senderKeySkid: keys.senderKeySkid,
    }
  }

  private buildPlaintext(
    message: DidCommMessage,
    connection?: DidCommPackOptions['connection']
  ): DidCommV2PlaintextMessage {
    // `theirDid` can be empty on the record but still present in the tags right after a rotation.
    const tagsTheirDid = connection?.getTags().theirDid
    const theirDid =
      (connection?.theirDid && connection.theirDid.length > 0 ? connection.theirDid : undefined) ??
      (typeof tagsTheirDid === 'string' && tagsTheirDid.length > 0 ? tagsTheirDid : undefined)

    return buildV2PlaintextFromMessage(message, {
      useDidSovPrefixWhereAllowed: this.config.useDidSovPrefixWhereAllowed,
      ...(connection?.did && theirDid ? { from: connection.did, to: [theirDid] } : undefined),
      fromPrior: connection?.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)?.fromPriorJwt,
    })
  }

  /**
   * Wrap the envelope in one anoncrypt Forward message for every routing key, outermost hop last.
   */
  private async wrapInForward(
    agentContext: AgentContext,
    encryptedMessage: DidCommEncryptedMessage,
    keys: EnvelopeKeys,
    v2Keys: DidCommV2PackKeys,
    connection?: DidCommPackOptions['connection']
  ): Promise<DidCommEncryptedMessage> {
    let payload = encryptedMessage

    const recipientNext = this.resolveRecipientNextForMediationForward(connection, keys)
    const routingKeysReversed = [...v2Keys.routingKeys].reverse()

    for (let i = 0; i < routingKeysReversed.length; i++) {
      const routingKey = routingKeysReversed[i]
      // next points at the enclosed hop (recipient at i === 0); single-routing-key tests cannot detect an inverted chain
      const next = i === 0 ? recipientNext : new DidKey(routingKeysReversed[i - 1]).did
      const routingKeyAgreement = toKeyAgreement(routingKey)
      routingKeyAgreement.keyId = new DidKey(routingKey).did

      const attachment = {
        id: utils.uuid(),
        media_type: 'application/didcomm-encrypted+json',
        data: { json: payload },
      }
      const forwardPlaintext = DidCommForwardV2Message.createV2PlaintextMessage({
        to: [new DidKey(routingKey).did],
        next,
        attachments: [attachment],
      })

      payload = await this.envelopeService.packAnoncrypt(agentContext, forwardPlaintext, {
        recipientKey: routingKeyAgreement,
        contentEncryptionAlgorithm: this.config.v2DefaultAnoncryptContentEncryption,
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
  private resolveRecipientNextForMediationForward(
    connection: DidCommPackOptions['connection'],
    keys: EnvelopeKeys
  ): string {
    // CM 2.0 recipients register their connection did:peer with the mediator, so prefer
    // that DID (short-form canonicalized like the mediator's keylist store and lookup).
    const theirDid = connection?.theirDid
    if (theirDid) return getDidPeer4ShortFormForEquivalence(theirDid) ?? theirDid

    // No recipient DID known: routing/2.0 allows a key for the last hop.
    return new DidKey(toKeyAgreement(keys.recipientKeys[0])).did
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

    const protectedJson = JsonEncoder.fromBase64Url(encryptedMessage.protected) as { skid?: string; alg?: string }
    const isAnoncrypt = protectedJson.alg === 'ECDH-ES+A256KW'
    if (!isAnoncrypt && !protectedJson.skid) {
      throw new CredoError('DIDComm v2 authcrypt requires skid in protected header')
    }

    const { plaintext, senderKey } = await this.envelopeService.unpack(agentContext, encryptedMessage, {
      recipientKey,
      matchedKid,
      resolveSenderKey: isAnoncrypt
        ? async () => null
        : (skid) => this.keyResolver.resolveSenderKey(agentContext, skid),
    })

    // Sign-then-encrypt: the decrypted bytes are a JWS. Verify it and use the inner plaintext.
    let unwrapped: DidCommV2PlaintextMessage = plaintext
    if (isDidCommV2SignedMessage(plaintext as unknown)) {
      unwrapped = await this.verifySignedPlaintext(agentContext, plaintext as unknown as DidCommV2SignedMessage)
      agentContext.config.logger.debug('Verified nested DIDComm v2 signed message', {
        type: unwrapped.type,
        from: unwrapped.from,
      })
    }

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
    }
  }

  /**
   * Verify a standalone DIDComm v2 signed message and return the payload in v1 shape.
   *
   * Signed envelopes exist only in v2, so this is not part of the shared protocol contract. The
   * message receiver resolves this class directly for that path.
   */
  public async unpackSigned(
    agentContext: AgentContext,
    signedMessage: DidCommV2SignedMessage
  ): Promise<DidCommPlaintextMessage> {
    const plaintext = await this.verifySignedPlaintext(agentContext, signedMessage)
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
    signedMessage: DidCommV2SignedMessage
  ): Promise<DidCommV2PlaintextMessage> {
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const { plaintext } = await this.envelopeService.verifySignedMessage(agentContext, signedMessage, {
      resolveSignerJwk: async (kid) => {
        const signerDid = kid.split('#')[0]
        const didDocument = await dids.resolveDidDocument(signerDid)
        const verificationMethod = didDocument.dereferenceKey(kid, ['authentication'])
        return getPublicJwkFromVerificationMethod(verificationMethod)
      },
    })

    return plaintext
  }

  // ── Return routing ────────────────────────────────────────────────────

  /**
   * A v2 envelope names its sender with a `skid` instead of embedding the key, so a reply over the
   * inbound session must carry a `skid` the peer can resolve.
   *
   * The lookup finds the verification method in our own DID document that holds the key the
   * message was addressed to, rather than assuming a peer DID fragment convention. When that fails,
   * `did:key` still lets the peer resolve the key directly from the identifier.
   */
  public async buildReturnRouteKeys(
    agentContext: AgentContext,
    { senderKey, recipientKey, plaintextMessage, connection }: DidCommReturnRouteOptions
  ): Promise<EnvelopeKeys> {
    return {
      recipientKeys: [senderKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>],
      routingKeys: [],
      senderKey: recipientKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
      senderKeySkid: await this.resolveReturnRouteSkid(agentContext, {
        recipientKey,
        plaintextMessage,
        connection,
      }),
    }
  }

  private async resolveReturnRouteSkid(
    agentContext: AgentContext,
    {
      recipientKey,
      plaintextMessage,
      connection,
    }: Pick<DidCommReturnRouteOptions, 'recipientKey' | 'plaintextMessage' | 'connection'>
  ): Promise<string | undefined> {
    // Connectionless: did:key lets the peer resolve the key through tryParseKidAsPublicJwk.
    if (!connection) return new DidKey(recipientKey).did

    // The outbound plaintext sets `from: connection.did`, and the spec requires the encryption
    // layer skid to match `from`. The inbound `to` can still hold our prior DID mid-rotation, so
    // it is only a fallback.
    const to = Array.isArray(plaintextMessage.to) ? (plaintextMessage.to as string[]) : undefined
    const ourDid = connection.did ?? to?.[0]
    // No DID yet: leave the skid unset so the pack falls back to the sender key's own kid.
    if (!ourDid) return undefined

    try {
      const dids = agentContext.resolve(DidsApi)
      const { didDocument } = await dids.resolveCreatedDidDocumentWithKeys(ourDid)
      const verificationMethod = didDocument.findVerificationMethodByPublicKey(recipientKey)
      if (!verificationMethod) return new DidKey(recipientKey).did

      const id = verificationMethod.id
      return id.startsWith('did:') ? id : `${didDocument.id}${id.startsWith('#') ? '' : '#'}${id}`
    } catch {
      return new DidKey(recipientKey).did
    }
  }
}
