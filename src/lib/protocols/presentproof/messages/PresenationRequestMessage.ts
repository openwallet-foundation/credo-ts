import { Equals, IsString } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './MessageType';
import { Attachment } from './Attachment';

export interface PresentationRequestMessageOptions {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

/**
 * Message part of Issue Credential Protocol used to continue or initiate credential exchange by issuer.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0037-present-proof#request-presentation
 */
export class PresentationRequestMessage extends AgentMessage {
  public constructor(options: PresentationRequestMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(PresentationRequestMessage.type)
  public readonly type = PresentationRequestMessage.type;
  public static readonly type = MessageType.PresentationRequest;

  @IsString()
  public comment?: string;

  @Expose({ name: 'request_presentations~attach' })
  @Type(() => Attachment)
  public attachments!: Attachment[];
}
