import { Type } from 'class-transformer'
import { IsString } from 'class-validator'

import { V1Attachment } from '../decorators/attachment/V1Attachment'

import { encodeAttachment } from './attachment'

export interface LinkedAttachmentOptions {
  name: string
  attachment: V1Attachment
}

export class LinkedAttachment {
  public constructor(options: LinkedAttachmentOptions) {
    this.attributeName = options.name
    this.attachment = options.attachment
    this.attachment.id = this.getId(options.attachment)
  }

  /**
   * The name that will be used to generate the linked credential
   */
  @IsString()
  public attributeName: string

  /**
   * The attachment that needs to be linked to the credential
   */
  @Type(() => V1Attachment)
  public attachment: V1Attachment

  /**
   * Generates an ID based on the data in the attachment
   *
   * @param attachment the attachment that requires a hashlink
   * @returns the id
   */
  private getId(attachment: V1Attachment): string {
    // Take the second element since the id property
    // of a decorator MUST not contain a colon and has a maximum size of 64 characters
    return encodeAttachment(attachment).split(':')[1].substring(0, 64)
  }
}
