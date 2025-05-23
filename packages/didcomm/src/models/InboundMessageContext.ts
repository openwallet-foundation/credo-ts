import type { AgentContext, Kms } from '@credo-ts/core'
import type { AgentMessage } from '../AgentMessage'
import type { MessageHandler } from '../handlers'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { EncryptedMessage } from '../types'
import type { OutboundMessageContext } from './OutboundMessageContext'

import { CredoError } from '@credo-ts/core'

export interface MessageContextParams {
  connection?: ConnectionRecord
  sessionId?: string
  senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  agentContext: AgentContext
  receivedAt?: Date
  encryptedMessage?: EncryptedMessage
}

export class InboundMessageContext<T extends AgentMessage = AgentMessage> {
  public connection?: ConnectionRecord
  public sessionId?: string
  public senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  public recipientKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  public receivedAt: Date

  public readonly agentContext: AgentContext

  public message: T
  public messageHandler?: MessageHandler
  public responseMessage?: OutboundMessageContext
  public encryptedMessage?: EncryptedMessage

  public constructor(message: T, context: MessageContextParams) {
    this.message = message
    this.recipientKey = context.recipientKey
    this.senderKey = context.senderKey
    this.connection = context.connection
    this.sessionId = context.sessionId
    this.agentContext = context.agentContext
    this.receivedAt = context.receivedAt ?? new Date()
    this.encryptedMessage = context.encryptedMessage
  }

  public setMessageHandler(messageHandler: MessageHandler) {
    this.messageHandler = messageHandler
  }

  public setResponseMessage(outboundMessageContext: OutboundMessageContext) {
    this.responseMessage = outboundMessageContext
  }

  /**
   * Assert the inbound message has a ready connection associated with it.
   *
   * @throws {CredoError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): ConnectionRecord {
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
