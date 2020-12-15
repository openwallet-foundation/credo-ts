import { Expose, Type } from 'class-transformer';
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator';
import { AgentMessage } from '../../../agent/AgentMessage';
import { Attachment } from '../../../decorators/attachment/Attachment';
import { MessageType } from './MessageType';

interface CredentialResponseMessageOptions {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

export class CredentialResponseMessage extends AgentMessage {
  public constructor(options: CredentialResponseMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(CredentialResponseMessage.type)
  public readonly type = CredentialResponseMessage.type;
  public static readonly type = MessageType.CredentialResponse;

  @IsString()
  public comment?: string;

  @Expose({ name: 'credentials~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[];
}
