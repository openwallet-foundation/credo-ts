import { Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, ValidateNested } from 'class-validator'

import { BaseMessageConstructor } from '../../agent/BaseMessage'
import { Attachment } from './Attachment'

export function AttachmentDecorated<T extends BaseMessageConstructor>(Base: T) {
  class AttachmentDecoratorExtension extends Base {
    /**
     * The ~attach decorator is required for appending attachments to a credential
     */
    @Expose({ name: '~attach' })
    @Type(() => Attachment)
    @ValidateNested()
    @IsArray()
    @IsOptional()
    public attachments?: Attachment[]

    public getAttachmentById(id: string): Attachment | undefined {
      return this.attachments?.find((attachment) => attachment.id === id)
    }

    public addAttachment(attachment: Attachment): void {
      if (this.attachments) {
        this.attachments?.push(attachment)
      } else {
        this.attachments = [attachment]
      }
    }
  }

  return AttachmentDecoratorExtension
}
