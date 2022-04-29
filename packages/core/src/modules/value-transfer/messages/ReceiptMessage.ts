import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose } from 'class-transformer'
import { Equals, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type ReceiptMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class ReceiptMessage extends DIDCommV2Message {
  public constructor(options: ReceiptMessageParams) {
    super(options)
    this.body = options.body
  }

  @Equals(ReceiptMessage.type)
  public readonly type = ReceiptMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/receipt'

  @Expose({ name: 'body' })
  @ValidateNested()
  public body!: ValueTransferMessage
}
