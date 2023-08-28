import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export type V3PresentationAckMessageOptions = {
  id?: string
  threadId: string
}

export class V3PresentationAckMessage extends DidCommV2Message {
  /**
   * Create new V3PresentationAckMessage instance.
   * @param options
   */
  public constructor(options: V3PresentationAckMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.thid = options.threadId
    }
  }

  @IsValidMessageType(V3PresentationAckMessage.type)
  public readonly type = V3PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/3.0/ack')
}
