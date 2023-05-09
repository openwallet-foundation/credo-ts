import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

export interface V2IssueCredentialMessageOptions {
  id?: string
  comment?: string
  formats: CredentialFormatSpec[]
  credentialAttachments: V1Attachment[]
}

export class V2IssueCredentialMessage extends DidCommV1Message {
  public constructor(options: V2IssueCredentialMessageOptions) {
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

  @IsValidMessageType(V2IssueCredentialMessage.type)
  public readonly type = V2IssueCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V1Attachment, { each: true })
  public credentialAttachments!: V1Attachment[]

  public getCredentialAttachmentById(id: string): V1Attachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id === id)
  }
}
