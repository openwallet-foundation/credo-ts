import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Type, Expose } from 'class-transformer'
import { ValidateNested, IsObject, IsOptional, IsString, IsInstance } from 'class-validator'

import { Attachment } from '../../../../../../decorators/attachment/v2/Attachment'
import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type DeliveryMessageParams = {
  body: DeliveryBody
  attachments: Attachment[]
} & DidCommV2MessageParams

class DeliveryBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}

/**
 * A message that contains multiple messages delivered to the receiver as attachments.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/pickup/3.0#message-delivery
 */
export class DeliveryMessage extends DidCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryBody)
  public body!: DeliveryBody

  @IsValidMessageType(DeliveryMessage.type)
  public readonly type = DeliveryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery')

  @Type(() => Attachment)
  @ValidateNested()
  @IsInstance(Attachment, { each: true })
  public attachments!: Array<Attachment>

  public constructor(params?: DeliveryMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
      this.attachments = params.attachments
      this.thid = params.thid
    }
  }
}
