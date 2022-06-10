import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class GetterReceiptMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(GetterReceiptMessage.type)
  public readonly type = GetterReceiptMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-16'

  @IsString()
  public thid!: string
}
