import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class OfferWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(OfferWitnessedMessage.type)
  public readonly type = OfferWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-7.1'

  @IsString()
  public thid!: string
}
