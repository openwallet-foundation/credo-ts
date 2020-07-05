import { Equals, Matches, IsArray, ValidateNested } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import uuid from 'uuid/v4';

import { MessageIdRegExp } from '../../agent/BaseMessage';
import { AgentMessage } from '../../agent/AgentMessage';
import { MessageType } from './messages';
import { WireMessage } from '../../types';

export interface BatchMessageOptions {
  id?: string;
  messages: BatchMessageMessage[];
}

/**
 * A message that contains multiple waiting messages.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch
 */
export class BatchMessage extends AgentMessage {
  constructor(options: BatchMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.messages = options.messages;
    }
  }

  @Equals(BatchMessage.type)
  readonly type = BatchMessage.type;
  static readonly type = MessageType.Batch;

  @Type(() => BatchMessageMessage)
  @IsArray()
  @ValidateNested()
  // TODO: Update to attachment decorator
  // However i think the usage of the attachment decorator
  // as specified in the Pickup Protocol is incorrect
  @Expose({ name: 'messages~attach' })
  messages!: BatchMessageMessage[];
}

export class BatchMessageMessage {
  constructor(options: { id?: string; message: WireMessage }) {
    if (options) {
      this.id = options.id || uuid();
      this.message = options.message;
    }
  }

  @Matches(MessageIdRegExp)
  id!: string;

  message!: WireMessage;
}
