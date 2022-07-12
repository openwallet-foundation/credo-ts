import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class OfferAcceptedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(OfferAcceptedMessage.type)
  public readonly type = OfferAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-9.1'

  @IsString()
  public thid!: string
}
