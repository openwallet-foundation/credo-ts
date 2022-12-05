import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type StatusRequestMessageParams = {
  body: StatusRequestBody
} & DidCommV2MessageParams

class StatusRequestBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}

/**
 * A message to request a status message from mediator.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/pickup/3.0#status-request
 */
export class StatusRequestMessage extends DidCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => StatusRequestBody)
  public body!: StatusRequestBody

  @IsValidMessageType(StatusRequestMessage.type)
  public readonly type = StatusRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/status-request')

  public constructor(params?: StatusRequestMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
