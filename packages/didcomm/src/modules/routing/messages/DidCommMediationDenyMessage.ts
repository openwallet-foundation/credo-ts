import { DidCommMessage } from '../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export interface DidCommMediationDenyMessageOptions {
  id: string
}

/**
 * This message serves as notification of the mediator denying the recipient's request for mediation.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-deny
 */
export class DidCommMediationDenyMessage extends DidCommMessage {
  public constructor(options: DidCommMediationDenyMessageOptions) {
    super()

    if (options) {
      this.id = options.id
    }
  }

  @IsValidMessageType(DidCommMediationDenyMessage.type)
  public readonly type = DidCommMediationDenyMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/1.0/mediate-deny')
}
