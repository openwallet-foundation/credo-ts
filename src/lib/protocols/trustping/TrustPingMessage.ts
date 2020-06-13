import { Equals, IsString, IsBoolean } from 'class-validator';
import { Expose } from 'class-transformer';

import { AgentMessage } from '../../agent/AgentMessage';
import { MessageType } from './messages';
import { Default } from '../../utils/class-transformer/Default';

export class TrustPingMessage extends AgentMessage {
  /**
   * Create new TrustPingMessage instance.
   * responseRequested will be true if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  constructor(options: { comment?: string; id?: string; responseRequested?: boolean }) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.responseRequested = options.responseRequested !== undefined ? options.responseRequested : true;
    }
  }

  @Equals(TrustPingMessage.type)
  static readonly type = MessageType.TrustPingMessage;
  readonly type = TrustPingMessage.type;

  @IsString()
  comment?: string;

  @Default(true)
  @IsBoolean()
  @Expose({ name: 'response_requested' })
  responseRequested!: boolean;
}
