import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

export interface V3IssueCredentialMessageOptions {
  id?: string
  comment?: string
  formats: CredentialFormatSpec[]
  credentialAttachments: V2Attachment[]
}

export class V3IssueCredentialMessage extends DidCommV2Message {
  public constructor(options: V3IssueCredentialMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialAttachments = options.credentialAttachments
    }
  }
  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V3IssueCredentialMessage.type)
  public readonly type = V3IssueCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public credentialAttachments!: V2Attachment[]

  public getCredentialAttachmentById(id: string): V2Attachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id === id)
  }
}
