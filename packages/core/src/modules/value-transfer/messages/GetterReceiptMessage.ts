import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { GetterReceipt } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class GetterReceiptMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(GetterReceiptMessage.type)
  public readonly type = GetterReceiptMessage.type
  public static readonly type = GetterReceipt.type

  @IsString()
  public thid!: string
}
