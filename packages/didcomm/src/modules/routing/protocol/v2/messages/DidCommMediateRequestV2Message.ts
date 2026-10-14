import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommMediateRequestV2MessageOptions {
  id?: string
}

/**
 * Mediate Request 2.0 - request from recipient to mediator for permission and routing information.
 *
 * @see https://didcomm.org/coordinate-mediation/2.0/
 */
export class DidCommMediateRequestV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMediateRequestV2MessageOptions = {}) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommMediateRequestV2Message.type)
  public readonly type = DidCommMediateRequestV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-request')
}
