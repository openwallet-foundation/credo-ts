import { Equals, IsArray, IsString, ValidateNested } from 'class-validator';
import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from '../../credentials/messages/MessageType';
import { Expose, Type } from 'class-transformer';
import { Attachment } from '../../../decorators/attachment/Attachment';

interface CredentialRequestMessageOptions {
  id?: string;
  comment?: string;
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
  public comment?: string;

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[];
}
