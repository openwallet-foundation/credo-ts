import type { ConnectionRecord } from '../../modules/connections'
import type { Transport } from '../../modules/routing/types'
import type { DIDCommMessage } from '../didcomm'

import { AriesFrameworkError } from '../../error'

export interface MessageContextParams {
  connection?: ConnectionRecord
  sender?: string
  recipient?: string
  transport?: Transport
}

export class InboundMessageContext<T extends DIDCommMessage = DIDCommMessage> {
  public message: T
  public connection?: ConnectionRecord
  public sender?: string
  public recipient?: string
  public transport?: Transport

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipient = context.recipient
    this.sender = context.sender
    this.connection = context.connection
    this.transport = context.transport
  }

  /**
   * Assert the inbound record has a ready connection associated with it.
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
