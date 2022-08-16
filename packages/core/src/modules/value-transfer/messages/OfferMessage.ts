import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class OfferMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(OfferMessage.type)
  public readonly type = OfferMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-0.1'
}
