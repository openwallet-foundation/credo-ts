import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type GetterReceiptMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class GetterReceiptMessage extends DIDCommV2Message {
  public constructor(options?: GetterReceiptMessageParams) {
    super(options)
  }

  @Equals(GetterReceiptMessage.type)
  public readonly type = GetterReceiptMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/getter-receipt'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
