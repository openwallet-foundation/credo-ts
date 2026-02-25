import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, ValidateNested } from 'class-validator'
import type { BaseMessageConstructor } from '../../BaseDidCommMessage'

import { DidCommAttachment } from './DidCommAttachment'

export function AttachmentDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AttachmentDecoratorExtension extends Base {
    /**
     * The ~attach decorator is required for appending attachments to a message
     */
    @Expose({ name: '~attach' })
    @Type(() => DidCommAttachment)
    @ValidateNested()
    @IsInstance(DidCommAttachment, { each: true })
    @IsOptional()
    public appendedAttachments?: DidCommAttachment[]

    public getAppendedAttachmentById(id: string): DidCommAttachment | undefined {
      return this.appendedAttachments?.find((attachment) => attachment.id === id)
    }

    public addAppendedAttachment(attachment: DidCommAttachment): void {
      if (this.appendedAttachments) {
        this.appendedAttachments.push(attachment)
      } else {
        this.appendedAttachments = [attachment]
      }
    }
  }

  return AttachmentDecoratorExtension
}
