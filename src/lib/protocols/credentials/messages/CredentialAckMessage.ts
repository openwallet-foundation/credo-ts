import { Equals } from 'class-validator';
import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './MessageType';
import { Attachment } from './Attachment';

interface CredentialAckMessageOptions {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

export class CredentialAckMessage extends AgentMessage {
  public constructor(options: CredentialAckMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
    }
  }

  @Equals(CredentialAckMessage.type)
  public readonly type = CredentialAckMessage.type;
  public static readonly type = MessageType.CredentialResponse;
}
