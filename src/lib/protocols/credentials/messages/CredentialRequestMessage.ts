import { Equals, IsString } from 'class-validator';
import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from '../../credentials/messages/MessageType';
import { Expose } from 'class-transformer';
import { Attachment } from './Attachment';

interface CredentialRequestMessageOptions {
  id?: string;
  comment: string;
  attachments: Attachment[];
}

export class CredentialRequestMessage extends AgentMessage {
  public constructor(options: CredentialRequestMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(CredentialRequestMessage.type)
  public readonly type = CredentialRequestMessage.type;
  public static readonly type = MessageType.CredentialRequest;

  @IsString()
  public comment!: string;

  @Expose({ name: 'requests~attach' })
  public attachments!: Attachment[];
}
