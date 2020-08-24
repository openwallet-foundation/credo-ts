import { Equals, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './MessageType';
// import { AttachmentDecorator } from '../../decorators/attachments/AttachmentDecorator';

export interface CredentialOfferMessageOptions {
  id?: string;
  comment: string;
  offersAttachments: [Attachment];
  credentialPreview: JsonLd;
}

/**
 * Message part of Issue Credential Protocol used to continue or initiate credential exchange by issuer.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#offer-credential
 */
export class CredentialOfferMessage extends AgentMessage {
  constructor(options: CredentialOfferMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.credentialPreview = options.credentialPreview;
      this.offersAttachments = options.offersAttachments;
    }
  }

  @Equals(CredentialOfferMessage.type)
  readonly type = CredentialOfferMessage.type;
  static readonly type = MessageType.CredentialOffer;

  @IsString()
  comment!: string;

  @IsString()
  @Expose({ name: 'credential_preview' })
  credentialPreview!: JsonLd;

  // @Type(() => AttachmentDecorator)
  // @ValidateNested()
  @Expose({ name: 'offers~attach' })
  offersAttachments!: [Attachment];
}

type JsonLd = Record<string, unknown>;

interface Attachment {
  id: string;
  mimeType: string;
  data: any;
}
