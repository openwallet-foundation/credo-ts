import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { RequestAcceptanceWitnessed } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedWitnessedMessage.type)
  public readonly type = RequestAcceptedWitnessedMessage.type
  public static readonly type = RequestAcceptanceWitnessed.type

  @IsString()
  public thid!: string
}
