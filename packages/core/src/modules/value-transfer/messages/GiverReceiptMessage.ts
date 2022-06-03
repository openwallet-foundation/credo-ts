import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class GiverReceiptMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(GiverReceiptMessage.type)
  public readonly type = GiverReceiptMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/giver-receipt'

  @IsString()
  public thid!: string
}
