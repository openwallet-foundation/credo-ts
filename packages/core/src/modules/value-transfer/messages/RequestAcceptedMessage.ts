import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestAcceptedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestAcceptedMessage extends DIDCommV2Message {
  public constructor(options?: RequestAcceptedMessageParams) {
    super(options)
    if (options) {
      this.body = options.body
    }
  }

  @Equals(RequestAcceptedMessage.type)
  public readonly type = RequestAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/accept-payment'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
