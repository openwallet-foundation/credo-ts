import { ReturnRouteTypes } from '../../../../decorators/transport/TransportDecorator'
import { DidCommMessage } from '../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../util/messageType'

export interface MediateRequestMessageOptions {
  id?: string
}

/**
 * Mediate Request 2.0 - request from recipient to mediator for permission and routing information.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class MediateRequestMessage extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: MediateRequestMessageOptions = {}) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(MediateRequestMessage.type)
  public readonly type = MediateRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-request')
}
