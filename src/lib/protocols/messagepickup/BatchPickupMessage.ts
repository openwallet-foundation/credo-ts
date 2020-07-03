import { Equals, IsNumber } from 'class-validator';
import { Expose } from 'class-transformer';

import { AgentMessage } from '../../agent/AgentMessage';
import { MessageType } from './messages';

export interface BatchPickupMessageOptions {
  id?: string;
  batchSize: number;
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
  constructor(options: BatchPickupMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.batchSize = options.batchSize;
    }
  }

  @Equals(BatchPickupMessage.type)
  readonly type = BatchPickupMessage.type;
  static readonly type = MessageType.BatchPickup;

  @IsNumber()
  @Expose({ name: 'batch_size' })
  batchSize!: number;
}
