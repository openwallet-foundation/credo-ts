import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestAcceptedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestAcceptedMessage extends DIDCommV2Message {
  public constructor(options?: RequestAcceptedMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedMessage.type)
  public readonly type = RequestAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/request-accepted'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage

  @IsString()
  public thid!: string
}
