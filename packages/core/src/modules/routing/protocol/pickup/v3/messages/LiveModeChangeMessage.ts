import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type LiveModeChangeMessageParams = {
  body: LiveModeChangeBody
} & DidCommV2MessageParams

class LiveModeChangeBody {
  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery!: boolean
}

/**
 * A message to change live mode.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/pickup/3.0#live-mode-change
 */
export class LiveModeChangeMessage extends DidCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => LiveModeChangeBody)
  public body!: LiveModeChangeBody

  @IsValidMessageType(LiveModeChangeMessage.type)
  public readonly type = LiveModeChangeMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/live-delivery-change')

  public constructor(params?: LiveModeChangeMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
