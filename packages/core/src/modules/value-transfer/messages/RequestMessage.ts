import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals } from 'class-validator'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestMessage.type)
  public readonly type = RequestMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-1'
}
