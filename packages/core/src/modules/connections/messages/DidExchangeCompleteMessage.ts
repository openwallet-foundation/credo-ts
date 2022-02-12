import { Equals } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface DidExchangeCompleteMessageOptions {
  id?: string
  threadId: string
  parentThreadId: string
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#3-exchange-complete
 */
export class DidExchangeCompleteMessage extends AgentMessage {
  public constructor(options: DidExchangeCompleteMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()

      this.setThread({
        threadId: options.threadId,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(DidExchangeCompleteMessage.type)
  public readonly type = DidExchangeCompleteMessage.type
  public static readonly type = 'https://didcomm.org/didexchange/1.0/complete'
}
