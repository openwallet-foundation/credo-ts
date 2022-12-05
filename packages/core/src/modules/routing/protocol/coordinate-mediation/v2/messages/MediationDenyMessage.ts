import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export class MediationDenyBody {}

export type MediationDenyMessageV2Options = {
  body: MediationDenyBody
} & DidCommV2MessageParams

/**
 * This message serves as notification of the mediator denying the recipient's request for mediation.
 *`
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0#mediate-deny
 */
export class MediationDenyMessage extends DidCommV2Message {
  public constructor(options: MediationDenyMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(MediationDenyMessage.type)
  public readonly type = MediationDenyMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-deny')

  @Type(() => MediationDenyBody)
  @ValidateNested()
  public body!: MediationDenyBody
}
