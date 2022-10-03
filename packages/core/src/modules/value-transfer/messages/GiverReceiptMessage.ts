import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { GiverReceipt } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class GiverReceiptMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @IsValidMessageType(GiverReceiptMessage.type)
  public readonly type = GiverReceiptMessage.type.messageTypeUri
  public static readonly type = parseMessageType(GiverReceipt.type)

  @IsString()
  public thid!: string
}
