import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type CashAcceptedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class CashAcceptedMessage extends DIDCommV2Message {
  public constructor(options?: CashAcceptedMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedMessage.type)
  public readonly type = CashAcceptedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/cash-accepted'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage

  @IsString()
  public thid!: string
}
