import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommMediateDenyV2MessageOptions {
  id?: string
  threadId?: string
}

/**
 * Mediate Deny 2.0 - mediator denies the recipient's mediation request.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class DidCommMediateDenyV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMediateDenyV2MessageOptions = {}) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      if (options.threadId) {
        this.setThread({ threadId: options.threadId })
      }
    }
  }

  @IsValidMessageType(DidCommMediateDenyV2Message.type)
  public readonly type = DidCommMediateDenyV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-deny')
}
