import type { CredentialFormatSpec } from '../../../formats/CredentialFormatService'
import type { Cred } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'

export interface V2IssueCredentialMessageProps {
  id?: string
  comment?: string
  formats: CredentialFormatSpec[]
  credentialsAttach: Attachment[]
}

export class V2IssueCredentialMessage extends AgentMessage {
  public formats!: CredentialFormatSpec[]

  public constructor(options: V2IssueCredentialMessageProps) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.messageAttachment = options.credentialsAttach
    }
  }

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
