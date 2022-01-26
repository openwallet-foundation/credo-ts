import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type { Cred } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'

export interface V2IssueCredentialMessageProps {
  id?: string
  comment?: string
  formats: V2CredentialFormatSpec[]
  credentialsAttach: Attachment[]
  attachments: Attachment[]
}

export class V2IssueCredentialMessage extends AgentMessage {
  public formats!: V2CredentialFormatSpec[]

  public constructor(options: V2IssueCredentialMessageProps) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialsAttach = options.credentialsAttach
      this.attachments = options.attachments
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
  public credentialsAttach!: Attachment[]

  // this is needed for the CredentialResponseCoordinator (which needs reworking into V1 and V2 versions)
  // MJR-TODO rework CredentialResponseCoordinator for new V2 architecture
  public get indyCredentialOffer(): Cred | null {
    return null
  }
}
