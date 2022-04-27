import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { CredentialFormatSpec } from '../../../formats/models/CredentialFormatServiceOptions'

export interface V2RequestCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  requestsAttach: Attachment[]
  comment?: string
}

export class V2RequestCredentialMessage extends AgentMessage {
  public constructor(options: V2RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.messageAttachment = options.requestsAttach
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  // @IsInstance(CredentialFormatSpec, { each: true }) -> this causes message validation to fail
  public formats!: CredentialFormatSpec[]

  @Equals(V2RequestCredentialMessage.type)
  public readonly type = V2RequestCredentialMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/2.0/request-credential'

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public messageAttachment!: Attachment[]

  /**
   * Human readable information about this Credential Request,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string
}
