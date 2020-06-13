import { Equals, IsString } from 'class-validator';

import { AgentMessage } from '../../agent/AgentMessage';
import { MessageType } from './messages';

export class TrustPingResponseMessage extends AgentMessage {
  /**
   * Create new TrustPingMessage instance.
   * responseRequested will be true if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  constructor(options: { comment?: string; id?: string; threadId: string }) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;

      this.setThread({
        threadId: options.threadId,
      });
    }
  }

  @Equals(TrustPingResponseMessage.type)
  static readonly type = MessageType.TrustPingResponseMessage;
  readonly type = TrustPingResponseMessage.type;

  @IsString()
  comment?: string;
}
