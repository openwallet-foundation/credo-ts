import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashAcceptedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedMessage.type)
  public readonly type = CashAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-9'

  @IsString()
  public thid!: string
}
