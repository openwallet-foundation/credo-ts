import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { CredentialFormatSpec } from '../../../formats/models/CredentialFormatServiceOptions'

export interface V2IssueCredentialMessageProps {
  id?: string
  comment?: string
  formats: CredentialFormatSpec[]
  credentialsAttach: Attachment[]
}

export class V2IssueCredentialMessage extends AgentMessage {
  public constructor(options: V2IssueCredentialMessageProps) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.messageAttachment = options.credentialsAttach
    }
  }
  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  // @IsInstance(CredentialFormatSpec, { each: true }) -> this causes message validation to fail
  public formats!: CredentialFormatSpec[]

  @Equals(V2IssueCredentialMessage.type)
  public readonly type = V2IssueCredentialMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/2.0/issue-credential'

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public messageAttachment!: Attachment[]
}
