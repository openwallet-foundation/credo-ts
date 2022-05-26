import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestMessage extends DIDCommV2Message {
  public constructor(options?: RequestMessageParams) {
    super(options)
  }

  @Equals(RequestMessage.type)
  public readonly type = RequestMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/payment-request'

  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
