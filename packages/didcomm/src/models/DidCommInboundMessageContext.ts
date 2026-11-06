import type { AgentContext, Kms } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommMessageHandler } from '../handlers'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommEncryptedMessage } from '../types'
import type { DidCommV2KeyAgreementJwk } from '../v2/types'
import type { DidCommOutboundMessageContext } from './DidCommOutboundMessageContext'

export interface MessageContextParams {
  connection?: DidCommConnectionRecord
  sessionId?: string
  senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /** DIDComm v2 sender DID proven by the authcrypt envelope. Never set for anoncrypt. */
  senderDid?: string
  /** DIDComm v2: our DID the envelope was addressed to. */
  recipientDid?: string
  /** DIDComm v2: the key agreement key of the sender that encrypted the message. Never set for anoncrypt. */
  senderKeyAgreementKey?: DidCommV2KeyAgreementJwk
  /** DIDComm v2: the key agreement key of ours the message was encrypted to. */
  recipientKeyAgreementKey?: DidCommV2KeyAgreementJwk
  agentContext: AgentContext
  receivedAt?: Date
  encryptedMessage?: DidCommEncryptedMessage
}

export class DidCommInboundMessageContext<T extends DidCommMessage = DidCommMessage> {
  public connection?: DidCommConnectionRecord
  public sessionId?: string
  /** The Ed25519 key that authcrypted a DIDComm v1 message. Never set for v2 envelopes. */
  public senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /** The Ed25519 key of ours a DIDComm v1 message was encrypted to. Never set for v2 envelopes. */
  public recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /** DIDComm v2 sender DID proven by the authcrypt envelope. Never set for anoncrypt. */
  public senderDid?: string
  /** DIDComm v2: our DID the envelope was addressed to. */
  public recipientDid?: string
  /** DIDComm v2: the key agreement key of the sender that encrypted the message. Never set for anoncrypt. */
  public senderKeyAgreementKey?: DidCommV2KeyAgreementJwk
  /** DIDComm v2: the key agreement key of ours the message was encrypted to. */
  public recipientKeyAgreementKey?: DidCommV2KeyAgreementJwk
  public receivedAt: Date

  public readonly agentContext: AgentContext

  public message: T
  public messageHandler?: DidCommMessageHandler
  public responseMessage?: DidCommOutboundMessageContext
  public encryptedMessage?: DidCommEncryptedMessage

  public constructor(message: T, context: MessageContextParams) {
    this.message = message
    this.recipientKey = context.recipientKey
    this.senderKey = context.senderKey
    this.connection = context.connection
    this.sessionId = context.sessionId
    this.senderDid = context.senderDid
    this.recipientDid = context.recipientDid
    this.senderKeyAgreementKey = context.senderKeyAgreementKey
    this.recipientKeyAgreementKey = context.recipientKeyAgreementKey
    this.agentContext = context.agentContext
    this.receivedAt = context.receivedAt ?? new Date()
    this.encryptedMessage = context.encryptedMessage
  }

  public setMessageHandler(messageHandler: DidCommMessageHandler) {
    this.messageHandler = messageHandler
  }

  public setResponseMessage(outboundMessageContext: DidCommOutboundMessageContext) {
    this.responseMessage = outboundMessageContext
  }

  /**
   * Assert the inbound message has a ready connection associated with it.
   *
   * @throws {CredoError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): DidCommConnectionRecord {
    if (!this.connection) {
      throw new CredoError(`No connection associated with incoming message ${this.message.type}`)
    }

    // Make sure connection is ready
    this.connection.assertReady()

    return this.connection
  }

  public toJSON() {
    return {
      message: this.message,
      recipientKey: this.recipientKey?.fingerprint,
      senderKey: this.senderKey?.fingerprint,
      sessionId: this.sessionId,
      agentContext: this.agentContext.toJSON(),
    }
  }
}
