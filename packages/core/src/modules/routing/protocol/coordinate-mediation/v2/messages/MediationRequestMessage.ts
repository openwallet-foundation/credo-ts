import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export class MediationRequestMessageBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'delivery_type' })
  public deliveryType?: string

  @IsString()
  @IsOptional()
  @Expose({ name: 'delivery_data' })
  public deliveryData?: string
}

export type MediationRequestMessageOptions = {
  body: MediationRequestMessageBody
} & DidCommV2MessageParams

/**
 * This message serves as a request from the recipient to the mediator, asking for the permission (and routing information) to publish the endpoint as a mediator.
 *`
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0#mediate-request
 */
export class MediationRequestMessage extends DidCommV2Message {
  public constructor(options: MediationRequestMessageOptions) {
    super(options)
  }

  @IsValidMessageType(MediationRequestMessage.type)
  public readonly type = MediationRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/mediate-request')

  @Type(() => MediationRequestMessageBody)
  @ValidateNested()
  public body!: MediationRequestMessageBody
}
