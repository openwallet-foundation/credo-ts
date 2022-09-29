import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { RequestAcceptance } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestAcceptedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedMessage.type)
  public readonly type = RequestAcceptedMessage.type
  public static readonly type = RequestAcceptance.type

  @IsString()
  public thid!: string
}
