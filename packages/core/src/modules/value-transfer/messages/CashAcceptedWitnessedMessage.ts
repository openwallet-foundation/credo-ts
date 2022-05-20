import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

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
}
