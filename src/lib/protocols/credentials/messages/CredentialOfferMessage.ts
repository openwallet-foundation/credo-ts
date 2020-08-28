import { Equals, IsString } from 'class-validator';
import { Expose, classToPlain } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './MessageType';
import { MessageTransformer } from '../../../agent/MessageTransformer';
// import { AttachmentDecorator } from '../../decorators/attachments/AttachmentDecorator';

interface CredentialPreviewOptions {
  attributes: CredentialPreviewAttribute[];
}

export class CredentialPreview {
  constructor(options: CredentialPreviewOptions) {
    this.attributes = options.attributes;
  }

  @Equals(CredentialPreview.type)
  readonly type = CredentialPreview.type;
  static readonly type = MessageType.CredentialPreview;

  @Expose({ name: 'attributes' })
  attributes: CredentialPreviewAttribute[];
}

export class CredentialPreviewAttribute {
  constructor(options: CredentialPreviewAttribute) {
    this.name = options.name;
    this.mimeType = options.mimeType;
    this.value = options.value;
  }

  name: string;

  @Expose({ name: 'mime-type' })
  mimeType: string;

  value: string;
}

export interface CredentialOfferMessageOptions {
  id?: string;
  comment: string;
  offersAttachments: Attachment[];
  credentialPreview: CredentialPreview;
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
  credentialPreview!: CredentialPreview;

  // @Type(() => AttachmentDecorator)
  // @ValidateNested()
  @Expose({ name: 'offers~attach' })
  offersAttachments!: Attachment[];
}

export class Attachment {
  constructor(options: Attachment) {
    this.id = options.id;
    this.mimeType = options.mimeType;
    this.data = options.data;
  }

  @Expose({ name: '@id' })
  id: string;

  @Expose({ name: 'mime-type' })
  mimeType: string;

  @Expose({ name: 'data' })
  data: {
    base64: string;
  };
}
