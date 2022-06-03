import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashRemovedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashRemovedMessage.type)
  public readonly type = CashRemovedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/cash-removed'

  @IsString()
  public thid!: string
}
