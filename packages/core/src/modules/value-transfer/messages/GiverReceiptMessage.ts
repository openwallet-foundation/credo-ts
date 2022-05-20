import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type GiverReceiptMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class GiverReceiptMessage extends DIDCommV2Message {
  public constructor(options?: GiverReceiptMessageParams) {
    super(options)
  }

  @Equals(GiverReceiptMessage.type)
  public readonly type = GiverReceiptMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/giver-receipt'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
