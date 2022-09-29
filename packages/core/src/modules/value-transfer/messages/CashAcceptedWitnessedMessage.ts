import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { CashAcceptanceWitnessed } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedWitnessedMessage.type)
  public readonly type = CashAcceptedWitnessedMessage.type
  public static readonly type = CashAcceptanceWitnessed.type

  @IsString()
  public thid!: string
}
