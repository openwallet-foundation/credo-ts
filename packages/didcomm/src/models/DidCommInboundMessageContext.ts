import type { AgentContext, Kms } from '@credo-ts/core'
import { CredoError } from '@credo-ts/core'
import type { DidCommMessage } from '../DidCommMessage'
import type { DidCommMessageHandler } from '../handlers'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommEncryptedMessage } from '../types'
import type { DidCommOutboundMessageContext } from './DidCommOutboundMessageContext'

export interface MessageContextParams {
  connection?: DidCommConnectionRecord
  sessionId?: string
  senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /** Sender DID from envelope (DIDComm v2 plaintext). Preserved before transformation. */
  senderDid?: string
  agentContext: AgentContext
  receivedAt?: Date
  encryptedMessage?: DidCommEncryptedMessage
}

export class DidCommInboundMessageContext<T extends DidCommMessage = DidCommMessage> {
  public connection?: DidCommConnectionRecord
  public sessionId?: string
  public senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  public recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  /** Sender DID from envelope (DIDComm v2 plaintext). Use when message.from may be lost in transformation. */
  public senderDid?: string
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
