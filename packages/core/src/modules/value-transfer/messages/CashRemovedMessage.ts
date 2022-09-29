import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { CashRemoval } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashRemovedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(CashRemovedMessage.type)
  public readonly type = CashRemovedMessage.type
  public static readonly type = CashRemoval.type

  @IsString()
  public thid!: string
}
