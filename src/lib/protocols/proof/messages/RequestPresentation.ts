import { Equals, IsString } from 'class-validator';
import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './messages';
import { Attachment } from '../../../utils/Attachment';
import { Expose, Type } from 'class-transformer';

/**
 *  Interface for RequestPresentation
 */
export interface RequestPresentationData {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

/**
 * This class is used for RequestPresentation
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class RequestPresentationMessage extends AgentMessage {
  /**
   * Create new RequestPresentationMessage instance.
   * @param options
   */
  public constructor(options: RequestPresentationData) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(RequestPresentationMessage.type)
  public readonly type = RequestPresentationMessage.type;
  public static readonly type = MessageType.RequestPresentation;

  @IsString()
  public comment?: string;

  @Expose({ name: 'request_presentation~attach' })
  @Type(() => Attachment)
  public attachments!: Attachment[];
}
