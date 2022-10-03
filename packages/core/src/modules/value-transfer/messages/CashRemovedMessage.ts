import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { CashRemoval } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class CashRemovedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @IsValidMessageType(CashRemovedMessage.type)
  public readonly type = CashRemovedMessage.type.messageTypeUri
  public static readonly type = parseMessageType(CashRemoval.type)

  @IsString()
  public thid!: string
}
