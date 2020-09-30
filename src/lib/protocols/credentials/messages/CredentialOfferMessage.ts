import { Equals, IsString } from 'class-validator';
import { classToPlain, Expose } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { MessageType } from './MessageType';
import { Attachment } from './Attachment';

interface CredentialPreviewOptions {
  attributes: CredentialPreviewAttribute[];
}

/**
 * This is not a message but an inner object for other messages in this protocol. It is used construct a preview of the data for the credential that is to be issued.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#preview-credential
 */
export class CredentialPreview {
  public constructor(options: CredentialPreviewOptions) {
    if (options) {
      this.attributes = options.attributes;
    }
  }

  @Expose({ name: '@type' })
  @Equals(CredentialPreview.type)
  public readonly type = CredentialPreview.type;
  public static readonly type = MessageType.CredentialPreview;

  @Expose({ name: 'attributes' })
  public attributes!: CredentialPreviewAttribute[];

  public toJSON(): Record<string, unknown> {
    return classToPlain(this);
  }
}

interface CredentialPreviewAttributeOptions {
  name: string;
  mimeType: string;
  value: string;
}

export class CredentialPreviewAttribute {
  public constructor(options: CredentialPreviewAttributeOptions) {
    if (options) {
      this.name = options.name;
      this.mimeType = options.mimeType;
      this.value = options.value;
    }
  }

  public name!: string;

  @Expose({ name: 'mime-type' })
  public mimeType!: string;

  public value!: string;

  public toJSON(): Record<string, unknown> {
    return classToPlain(this);
  }
}

export interface CredentialOfferMessageOptions {
  id?: string;
  comment: string;
  attachments: Attachment[];
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
      this.attachments = options.attachments;
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

  @Expose({ name: 'offers~attach' })
  public attachments!: Attachment[];
}
