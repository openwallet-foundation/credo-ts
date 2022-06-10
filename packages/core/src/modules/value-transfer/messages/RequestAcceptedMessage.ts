import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestAcceptedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedMessage.type)
  public readonly type = RequestAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-5'

  @IsString()
  public thid!: string
}
