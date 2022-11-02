import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'

import { IsArray, IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'
import { Expose } from 'class-transformer'

export class BatchAckMessageV2Body {}

export type BatchAckMessageV2Options = {
  ack: string[]
} & DIDCommV2MessageParams

export class BatchAckMessageV2 extends DIDCommV2Message {
  public constructor(options: BatchAckMessageV2Options) {
    super(options)

    if (options) {
      this.ack = options.ack
    }
  }
  @IsValidMessageType(BatchAckMessageV2.type)
  public readonly type = BatchAckMessageV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/ack')

  // custom_ack can be removed once didcomm-jvm will implement V2 spec
  // Related issue: https://github.com/sicpa-dlab/cbdc-projects/issues/1597
  @IsArray()
  @IsString({ each: true })
  @Expose({ name: 'custom_ack' })
  public ack!: string[]

  public body!: BatchAckMessageV2Body
}
