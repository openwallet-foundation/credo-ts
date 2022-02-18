import type { CredentialFormatSpec } from '../../../formats/CredentialFormatService'
import type { CredReq } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'

export const CRED_20_REQUEST = 'https://didcomm.org/issue-credential/2.0/request-credential'

export interface V2RequestCredentialMessageOptions {
  id: string
  formats: CredentialFormatSpec[]
  requestsAttach: Attachment[]
  comment?: string
}

export class V2RequestCredentialMessage extends AgentMessage {
  public formats!: CredentialFormatSpec[]

  public constructor(options: V2RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.messageAttachment = options.requestsAttach
    }
  }

  @Equals(V2RequestCredentialMessage.type)
  public readonly type = V2RequestCredentialMessage.type
  public static readonly type = CRED_20_REQUEST

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public messageAttachment!: Attachment[]

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string
}
