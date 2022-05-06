import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RejectMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage & {
    rejectionReason: string
  }
}

export class RejectMessage extends DIDCommV2Message {
  public constructor(options?: RejectMessageParams) {
    super(options)
    if (options) {
      this.body = options.body
    }
  }

  @Equals(RejectMessage.type)
  public readonly type = RejectMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/reject'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage
}
