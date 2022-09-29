import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInt, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export interface BatchPickupMessageOptions {
  id?: string
  batchSize: number
}

/**
 * A message to request to have multiple waiting messages sent inside a `batch` message.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch-pickup
 */
export class BatchPickupMessage extends DIDCommV1Message {
  /**
   * Create new BatchPickupMessage instance.
   *
   * @param options
   */
  public constructor(options: BatchPickupMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.batchSize = options.batchSize
    }
  }

  @Equals(BatchPickupMessage.type)
  public readonly type = BatchPickupMessage.type
  public static readonly type = 'https://didcomm.org/messagepickup/1.0/batch-pickup'

  @IsInt()
  @Expose({ name: 'batch_size' })
  public batchSize!: number
}

export class BatchPickupMessageV2Body {
  @IsInt()
  @Expose({ name: 'batch_size' })
  public batchSize!: number
}

export type BatchPickupMessageV2Options = {
  body: BatchPickupMessageV2Body
} & DIDCommV2MessageParams

/**
 * A message to request to have multiple waiting messages sent inside a `batch` message.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch-pickup
 */
export class BatchPickupMessageV2 extends DIDCommV2Message {
  /**
   * Create new BatchPickupMessage instance.
   *
   * @param options
   */
  public constructor(options: BatchPickupMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(BatchPickupMessageV2.type)
  public readonly type = BatchPickupMessageV2.type
  public static readonly type = 'https://didcomm.org/messagepickup/2.0/batch-pickup'

  @Type(() => BatchPickupMessageV2Body)
  @ValidateNested()
  public body!: BatchPickupMessageV2Body
}
