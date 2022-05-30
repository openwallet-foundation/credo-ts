import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedWitnessedMessage.type)
  public readonly type = RequestAcceptedWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/request-accepted-witnessed'

  @IsString()
  public thid!: string
}
