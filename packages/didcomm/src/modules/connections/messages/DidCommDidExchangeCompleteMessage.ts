import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommDidExchangeCompleteMessageOptions {
  id?: string
  threadId: string
  parentThreadId: string
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#3-exchange-complete
 */
export class DidCommDidExchangeCompleteMessage extends DidCommMessage {
  public constructor(options: DidCommDidExchangeCompleteMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()

      this.setThread({
        threadId: options.threadId,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @IsValidMessageType(DidCommDidExchangeCompleteMessage.type)
  public readonly type = DidCommDidExchangeCompleteMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/didexchange/1.1/complete')
}
