import type { Verkey } from 'indy-sdk'
import { AgentMessage } from '../AgentMessage'
import { ConnectionRecord } from '../../modules/connections'

export interface MessageContextParams {
  connection?: ConnectionRecord
  senderVerkey?: Verkey
  recipientVerkey?: Verkey
}

export class InboundMessageContext<T extends AgentMessage = AgentMessage> {
  public message: T
  public connection?: ConnectionRecord
  public senderVerkey?: Verkey
  public recipientVerkey?: Verkey

  public constructor(message: T, context: MessageContextParams = {}) {
    this.message = message
    this.recipientVerkey = context.recipientVerkey

    if (context.connection) {
      this.connection = context.connection
      // TODO: which senderkey should we prioritize
      // Or should we throw an error when they don't match?
      this.senderVerkey = context.connection.theirKey || context.senderVerkey || undefined
    } else if (context.senderVerkey) {
      this.senderVerkey = context.senderVerkey
    }
  }
}
