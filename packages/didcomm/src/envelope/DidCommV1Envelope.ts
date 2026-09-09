import type { AgentContext, Kms } from '@credo-ts/core'
import { injectable } from '@credo-ts/core'
import type { DecryptedDidCommMessageContext, EnvelopeKeys } from '../DidCommEnvelopeService'
import { DidCommEnvelopeService } from '../DidCommEnvelopeService'
import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommEncryptedMessage } from '../types'
import { isDidCommV2EncryptedMessage, isDidCommV2SignedMessage } from '../util/didcommVersion'
import { isValidJweStructure } from '../util/JWE'
import type { DidCommEnvelope, DidCommPackOptions, DidCommReturnRouteOptions } from './DidCommEnvelope'

/**
 * DIDComm v1 envelope.
 *
 * All of the cryptography stays in {@link DidCommEnvelopeService}, which is unchanged and still
 * exported. This class only adapts it to the shared {@link DidCommEnvelope} contract.
 */
@injectable()
export class DidCommV1Envelope implements DidCommEnvelope<'v1'> {
  public readonly version = 'v1' as const

  private envelopeService: DidCommEnvelopeService

  public constructor(envelopeService: DidCommEnvelopeService) {
    this.envelopeService = envelopeService
  }

  /** V1 supports anoncrypt, so a sender key is not required. */
  public supportsPacking(keys: EnvelopeKeys): boolean {
    return keys.recipientKeys.length >= 1
  }

  /**
   * Any JWE that is not a v2 envelope. V1 does not always set `typ` in the protected header, so a
   * positive `JWM/1.0` test would reject messages the framework accepts today.
   */
  public supportsUnpacking(message: unknown): boolean {
    if (!isValidJweStructure(message)) return false
    return !isDidCommV2EncryptedMessage(message) && !isDidCommV2SignedMessage(message)
  }

  public async pack(
    agentContext: AgentContext,
    message: DidCommMessage,
    keys: EnvelopeKeys,
    // The v1 envelope carries no sender or recipient DID headers, so it needs no connection.
    _options?: DidCommPackOptions
  ): Promise<DidCommEncryptedMessage> {
    return this.envelopeService.packMessage(agentContext, message, keys)
  }

  public async unpack(
    agentContext: AgentContext,
    encryptedMessage: DidCommEncryptedMessage
  ): Promise<DecryptedDidCommMessageContext> {
    return this.envelopeService.unpackMessage(agentContext, encryptedMessage)
  }

  /**
   * V1 authcrypt embeds the sender key in the envelope, so the reply needs no key reference.
   */
  public async buildReturnRouteKeys(
    _agentContext: AgentContext,
    { senderKey, recipientKey }: DidCommReturnRouteOptions
  ): Promise<EnvelopeKeys> {
    return {
      recipientKeys: [senderKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>],
      routingKeys: [],
      senderKey: recipientKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
    }
  }
}
