import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals, IsString } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class OfferAcceptedWitnessedMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(OfferAcceptedWitnessedMessage.type)
  public readonly type = OfferAcceptedWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-11.1'

  @IsString()
  public thid!: string
}
