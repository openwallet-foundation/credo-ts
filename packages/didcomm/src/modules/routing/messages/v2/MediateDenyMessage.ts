import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

export interface MediateDenyMessageOptions {
  id?: string
  threadId?: string
}

/**
 * Mediate Deny 2.0 - mediator denies the recipient's mediation request.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class MediateDenyMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: MediateDenyMessageOptions = {}) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      if (options.threadId) {
        this.setThread({ threadId: options.threadId })
      }
    }
  }

  @IsValidMessageType(MediateDenyMessage.type)
  public readonly type = MediateDenyMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-deny')
}
