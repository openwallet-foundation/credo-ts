import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { RequestAcceptanceWitnessed } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @IsValidMessageType(RequestAcceptedWitnessedMessage.type)
  public readonly type = RequestAcceptedWitnessedMessage.type.messageTypeUri
  public static readonly type = parseMessageType(RequestAcceptanceWitnessed.type)

  @IsString()
  public thid!: string
}
