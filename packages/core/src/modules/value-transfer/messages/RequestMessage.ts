import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose } from 'class-transformer'
import { Equals, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestMessage extends DIDCommV2Message {
  public constructor(options: RequestMessageParams) {
    super(options)
    this.body = options.body
  }

  @Equals(RequestMessage.type)
  public readonly type = RequestMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/request-payment'

  @Expose({ name: 'body' })
  @ValidateNested()
  public body!: ValueTransferMessage
}
