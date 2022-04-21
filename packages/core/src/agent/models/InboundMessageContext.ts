import type { ConnectionRecord } from '../../modules/connections'
import type { Key } from '../../modules/dids'
import type { AgentMessage } from '../AgentMessage'

import { AriesFrameworkError } from '../../error'

export interface MessageContextParams {
  connection?: ConnectionRecord
  senderKey?: Key
  recipientKey?: Key
}

export class InboundMessageContext<T extends AgentMessage = AgentMessage> {
  public message: T
  public connection?: ConnectionRecord
  public senderKey?: Key
  public recipientKey?: Key

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipientKey = context.recipientKey
    this.senderKey = context.senderKey
    this.connection = context.connection
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
