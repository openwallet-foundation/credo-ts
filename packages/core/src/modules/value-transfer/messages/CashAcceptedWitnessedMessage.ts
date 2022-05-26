import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type CashAcceptedWitnessedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class CashAcceptedWitnessedMessage extends DIDCommV2Message {
  public constructor(options?: CashAcceptedWitnessedMessageParams) {
    super(options)
  }

  @Equals(CashAcceptedWitnessedMessage.type)
  public readonly type = CashAcceptedWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/cash-accepted-witnessed'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage

  @IsString()
  public thid!: string
}
