import { Expose } from 'class-transformer'
import { Equals, IsInt } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface BatchPickupMessageOptions {
  id?: string
  batchSize: number
}

/**
 * A message to request to have multiple waiting messages sent inside a `batch` message.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch-pickup
 */
export class BatchPickupMessage extends AgentMessage {
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
