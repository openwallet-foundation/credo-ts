import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { GetterReceipt } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class GetterReceiptMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @IsValidMessageType(GetterReceiptMessage.type)
  public readonly type = GetterReceiptMessage.type.messageTypeUri
  public static readonly type = parseMessageType(GetterReceipt.type)

  @IsString()
  public thid!: string
}
