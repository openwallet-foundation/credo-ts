import type { ConnectionRecord } from '../../modules/connections'
import type { AgentMessage } from '../AgentMessage'

import { AriesFrameworkError } from '../../error'

export interface MessageContextParams {
  connection?: ConnectionRecord
  senderVerkey?: string
  recipientVerkey?: string
  sessionId?: string
}

export class InboundMessageContext<T extends AgentMessage = AgentMessage> {
  public message: T
  public connection?: ConnectionRecord
  public senderVerkey?: string
  public recipientVerkey?: string
  public sessionId?: string

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipientVerkey = context.recipientVerkey
    this.senderVerkey = context.senderVerkey
    this.connection = context.connection
    this.sessionId = context.sessionId
  }

  /**
   * Assert the inbound message has a ready connection associated with it.
   *
   * @throws {AriesFrameworkError} if there is no connection or the connection is not ready
   */
  public assertReadyConnection(): ConnectionRecord {
    if (!this.connection) {
      throw new AriesFrameworkError(`No connection associated with incoming message ${this.message.type}`)
    }

    // Make sure connection is ready
    this.connection.assertReady()

    return this.connection
  }
}
