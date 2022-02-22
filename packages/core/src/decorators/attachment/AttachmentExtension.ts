import type { BaseMessageConstructor } from '../../agent/BaseMessage'
import type { CredentialFormatSpec } from '../../modules/credentials/formats/models/CredentialFormatServiceOptions'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { Attachment } from './Attachment'

export function AttachmentDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AttachmentDecoratorExtension extends Base {
    /**
     * The ~attach decorator is required for appending attachments to a preview
     */
    @Expose({ name: '~attach' })
    @Type(() => Attachment)
    @ValidateNested()
    @IsInstance(Attachment, { each: true })
    @IsOptional()
    public messageAttachment?: Attachment[]

    public formats!: CredentialFormatSpec[]

    public getAttachmentById(id: string): Attachment | undefined {
      return this.messageAttachment?.find((attachment) => attachment.id === id)
    }

    public getAttachmentIncludingFormatId(id: string): Attachment | undefined {
      if (!this.formats) {
        return this.messageAttachment?.find((attachment) => attachment.id.includes(id))
      }
      const format = this.formats.find((f) => f.format.includes(id))
      const attachment = this.messageAttachment?.find((attachment) => attachment.id === format?.attachId)
      return attachment
    }

    public addAttachment(attachment: Attachment): void {
      if (this.messageAttachment) {
        this.messageAttachment?.push(attachment)
      } else {
        this.messageAttachment = [attachment]
      }
    }
  }

  return AttachmentDecoratorExtension
}
