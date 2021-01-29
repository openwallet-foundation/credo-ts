import { Equals, IsArray, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { PresentProofMessageType } from './PresentProofMessageType';
import { AgentMessage } from '../../../agent/AgentMessage';
import { Attachment } from '../../../decorators/attachment/Attachment';

export interface PresentationOptions {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

/**
 * Presentation Message part of Present Proof Protocol used as a response to a {@link PresentationRequestMessage | Presentation Request Message} from prover to verifier.
 * Contains signed presentations.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#presentation
 */
export class PresentationMessage extends AgentMessage {
  public constructor(options: PresentationOptions) {
    super();

    if (options) {
      this.id = options.id ?? this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(PresentationMessage.type)
  public readonly type = PresentationMessage.type;
  public static readonly type = PresentProofMessageType.Presentation;

  /**
   *  Provides some human readable information about this request for a presentation.
   */
  @IsOptional()
  @IsString()
  public comment?: string;

  /**
   * An array of attachments containing the presentation in the requested format(s).
   */
  @Expose({ name: 'request-presentations~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[];
}
