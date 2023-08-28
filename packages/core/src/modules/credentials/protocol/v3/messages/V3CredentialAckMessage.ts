import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export type V3CredentialAckMessageOptions = {
  id?: string
  threadId: string
}

export class V3CredentialAckMessage extends DidCommV2Message {
  /**
   * Create new V3CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: V3CredentialAckMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.thid = options.threadId
    }
  }

  @IsValidMessageType(V3CredentialAckMessage.type)
  public readonly type = V3CredentialAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/ack')
}
