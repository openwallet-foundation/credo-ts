import type { ConnectionRecord } from '../../modules/connections'
import type { DIDCommV1Message } from '../didcomm/v1/DIDCommV1Message'

import { AriesFrameworkError } from '../../error'

export interface MessageContextParams {
  connection?: ConnectionRecord
  senderKid?: string
  recipientKid?: string
}

export class InboundMessageContext<T extends DIDCommV1Message = DIDCommV1Message> {
  public message: T
  public connection?: ConnectionRecord
  public senderKid?: string
  public recipientKid?: string

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipientKid = context.recipientKid
    this.senderKid = context.senderKid
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
