import { Equals, IsArray, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { PresentProofMessageType } from './PresentProofMessageType';
import { AgentMessage } from '../../../agent/AgentMessage';
import { Attachment } from '../../../decorators/attachment/Attachment';

export interface RequestPresentationOptions {
  id?: string;
  comment?: string;
  attachments: Attachment[];
}

/**
 * Request Presentation Message part of Present Proof Protocol used to initiate request from verifier to prover.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#request-presentation
 */
export class RequestPresentationMessage extends AgentMessage {
  public constructor(options: RequestPresentationOptions) {
    super();

    if (options) {
      this.id = options.id ?? this.generateId();
      this.comment = options.comment;
      this.attachments = options.attachments;
    }
  }

  @Equals(RequestPresentationMessage.type)
  public readonly type = RequestPresentationMessage.type;
  public static readonly type = PresentProofMessageType.RequestPresentation;

  /**
   *  Provides some human readable information about this request for a presentation.
   */
  @IsOptional()
  @IsString()
  public comment?: string;

  /**
   * An array of attachments defining the acceptable formats for the presentation.
   */
  @Expose({ name: 'request-presentations~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[];
}
