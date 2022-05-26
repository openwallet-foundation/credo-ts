import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { ValueTransferMessage } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

type RequestAcceptedWitnessedMessageParams = DIDCommV2MessageParams & {
  body: ValueTransferMessage
}

export class RequestAcceptedWitnessedMessage extends DIDCommV2Message {
  public constructor(options?: RequestAcceptedWitnessedMessageParams) {
    super(options)
  }

  @Equals(RequestAcceptedWitnessedMessage.type)
  public readonly type = RequestAcceptedWitnessedMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/request-accepted-witnessed'

  @Expose({ name: 'body' })
  @Type(() => ValueTransferMessage)
  @ValidateNested()
  @IsInstance(ValueTransferMessage)
  public body!: ValueTransferMessage

  @IsString()
  public thid!: string
}
