import { Expose } from 'class-transformer'
import { IsInt } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommBatchPickupMessageOptions {
  id?: string
  batchSize: number
}

/**
 * A message to request to have multiple waiting messages sent inside a `batch` message.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch-pickup
 */
export class DidCommBatchPickupMessage extends DidCommMessage {
  public readonly allowQueueTransport = false

  /**
   * Create new BatchPickupMessage instance.
   *
   * @param options
   */
  public constructor(options: DidCommBatchPickupMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.batchSize = options.batchSize
    }
  }

  @IsValidMessageType(DidCommBatchPickupMessage.type)
  public readonly type = DidCommBatchPickupMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/1.0/batch-pickup')

  @IsInt()
  @Expose({ name: 'batch_size' })
  public batchSize!: number
}
