import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { CashAcceptanceWitnessed } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @IsValidMessageType(CashAcceptedWitnessedMessage.type)
  public readonly type = CashAcceptedWitnessedMessage.type.messageTypeUri
  public static readonly type = parseMessageType(CashAcceptanceWitnessed.type)

  @IsString()
  public thid!: string
}
