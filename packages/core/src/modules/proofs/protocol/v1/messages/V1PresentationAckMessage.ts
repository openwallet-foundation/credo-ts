import type { AckMessageOptions } from '../../../../common'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { AckMessage } from '../../../../common'

export class V1PresentationAckMessage extends AckMessage {
  public constructor(options: AckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V1PresentationAckMessage.type)
  public readonly type = V1PresentationAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/ack')
}
