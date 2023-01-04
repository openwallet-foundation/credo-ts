import type { DidComV1BaseMessageConstructor } from '../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'

import { V1Attachment } from './V1Attachment'

export function V1AttachmentDecorated<T extends DidComV1BaseMessageConstructor>(Base: T) {
  class V1AttachmentDecoratorExtension extends Base {
    /**
     * The ~attach decorator is required for appending attachments to a message
     */
    @Expose({ name: '~attach' })
    @Type(() => V1Attachment)
    @ValidateNested()
    @IsInstance(V1Attachment, { each: true })
    @IsOptional()
    public appendedAttachments?: V1Attachment[]

    public getAppendedAttachmentById(id: string): V1Attachment | undefined {
      return this.appendedAttachments?.find((attachment) => attachment.id === id)
    }

    public addAppendedAttachment(attachment: V1Attachment): void {
      if (this.appendedAttachments) {
        this.appendedAttachments.push(attachment)
      } else {
        this.appendedAttachments = [attachment]
      }
    }
  }

  return V1AttachmentDecoratorExtension
}
