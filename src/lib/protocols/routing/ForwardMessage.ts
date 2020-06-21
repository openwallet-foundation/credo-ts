import { Equals, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

import { AgentMessage } from '../../agent/AgentMessage';
import { MessageType } from './messages';

export interface ForwardMessageOptions {
  id?: string;
  to: string;
  message: JsonWebKey;
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class ForwardMessage extends AgentMessage {
  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  constructor(options: ForwardMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.to = options.to;
      this.message = options.message;
    }
  }

  @Equals(ForwardMessage.type)
  readonly type = ForwardMessage.type;
  static readonly type = MessageType.ForwardMessage;

  @IsString()
  to!: string;

  @Expose({ name: 'msg' })
  message!: JsonWebKey;
}
