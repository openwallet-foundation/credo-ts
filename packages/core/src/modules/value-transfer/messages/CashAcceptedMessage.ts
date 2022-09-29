import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { CashAcceptance } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashAcceptedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedMessage.type)
  public readonly type = CashAcceptedMessage.type
  public static readonly type = CashAcceptance.type

  @IsString()
  public thid!: string
}
