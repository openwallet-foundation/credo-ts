import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose } from 'class-transformer'
import { Equals, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestAcceptedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestAcceptedMessage extends DIDCommV2Message {
  public constructor(options: RequestAcceptedMessageParams) {
    super(options)
    this.body = options.body
  }

  @Equals(RequestAcceptedMessage.type)
  public readonly type = RequestAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/accept-payment'

  @Expose({ name: 'body' })
  @ValidateNested()
  public body!: ValueTransferMessage
}
