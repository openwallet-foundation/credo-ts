import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type CashAcceptedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class CashAcceptedMessage extends DIDCommV2Message {
  public constructor(options?: CashAcceptedMessageParams) {
    super(options)
    if (options) {
      this.body = options.body
    }
  }

  @Equals(CashAcceptedMessage.type)
  public readonly type = CashAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/accept-cash'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
