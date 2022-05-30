import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedWitnessedMessage.type)
  public readonly type = CashAcceptedWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/cash-accepted-witnessed'

  @IsString()
  public thid!: string
}
