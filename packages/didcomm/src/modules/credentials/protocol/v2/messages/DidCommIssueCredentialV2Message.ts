import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommCredentialFormatSpec } from '../../../models'

export interface DidCommIssueCredentialV2MessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  goal?: string
  formats: DidCommCredentialFormatSpec[]
  credentialAttachments: DidCommAttachment[]
}

export class DidCommIssueCredentialV2Message extends DidCommMessage {
  public constructor(options: DidCommIssueCredentialV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.formats = options.formats
      this.credentialAttachments = options.credentialAttachments
    }
  }
  @Type(() => DidCommCredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(DidCommCredentialFormatSpec, { each: true })
  public formats!: DidCommCredentialFormatSpec[]

  @IsValidMessageType(DidCommIssueCredentialV2Message.type)
  public readonly type = DidCommIssueCredentialV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public credentialAttachments!: DidCommAttachment[]

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @IsString()
  @IsOptional()
  public goal?: string

  public getCredentialAttachmentById(id: string): DidCommAttachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id === id)
  }
}
