import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommCredentialFormatSpec } from '../../../models'

export interface DidCommRequestCredentialV2MessageOptions {
  id?: string
  formats: DidCommCredentialFormatSpec[]
  goalCode?: string
  goal?: string
  requestAttachments: DidCommAttachment[]
  comment?: string
  attachments?: DidCommAttachment[]
}

export class DidCommRequestCredentialV2Message extends DidCommMessage {
  public constructor(options: DidCommRequestCredentialV2MessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.formats = options.formats
      this.requestAttachments = options.requestAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @Type(() => DidCommCredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(DidCommCredentialFormatSpec, { each: true })
  public formats!: DidCommCredentialFormatSpec[]

  @IsValidMessageType(DidCommRequestCredentialV2Message.type)
  public readonly type = DidCommRequestCredentialV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/request-credential')

  @Expose({ name: 'requests~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public requestAttachments!: DidCommAttachment[]

  /**
   * Human readable information about this Credential Request,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @IsString()
  @IsOptional()
  public goal?: string

  public getRequestAttachmentById(id: string): DidCommAttachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
