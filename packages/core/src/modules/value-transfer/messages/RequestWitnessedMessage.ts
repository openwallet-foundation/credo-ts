import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestWitnessedMessage.type)
  public readonly type = RequestWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-3'

  @IsString()
  public thid!: string
}
