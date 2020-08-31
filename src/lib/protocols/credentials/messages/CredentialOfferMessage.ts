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
  public constructor(options: CredentialPreviewOptions) {
    this.attributes = options.attributes;
  }

  @Equals(CredentialPreview.type)
  public readonly type = CredentialPreview.type;
  public static readonly type = MessageType.CredentialPreview;

  @Expose({ name: 'attributes' })
  public attributes: CredentialPreviewAttribute[];
}

export class CredentialPreviewAttribute {
  public constructor(options: CredentialPreviewAttribute) {
    this.name = options.name;
    this.mimeType = options.mimeType;
    this.value = options.value;
  }

  public name: string;

  @Expose({ name: 'mime-type' })
  public mimeType: string;

  public value: string;
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
  public constructor(options: CredentialOfferMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.comment = options.comment;
      this.credentialPreview = options.credentialPreview;
      this.offersAttachments = options.offersAttachments;
    }
  }

  @Equals(CredentialOfferMessage.type)
  public readonly type = CredentialOfferMessage.type;
  public static readonly type = MessageType.CredentialOffer;

  @IsString()
  public comment!: string;

  @IsString()
  @Expose({ name: 'credential_preview' })
  public credentialPreview!: CredentialPreview;

  // @Type(() => AttachmentDecorator)
  // @ValidateNested()
  @Expose({ name: 'offers~attach' })
  public offersAttachments!: Attachment[];
}

export class Attachment {
  public constructor(options: Attachment) {
    this.id = options.id;
    this.mimeType = options.mimeType;
    this.data = options.data;
  }

  @Expose({ name: '@id' })
  public id: string;

  @Expose({ name: 'mime-type' })
  public mimeType: string;

  @Expose({ name: 'data' })
  public data: {
    base64: string;
  };
}
