import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

import { V3CredentialPreview } from './V3CredentialPreview'

export interface V3ProposeCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  proposalAttachments: V2Attachment[]
  comment?: string
  credentialPreview?: V3CredentialPreview
  attachments?: V2Attachment[]
}

export class V3ProposeCredentialMessage extends DidCommV2Message {
  public constructor(options: V3ProposeCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialPreview = options.credentialPreview
      this.formats = options.formats
      this.proposalAttachments = options.proposalAttachments
      this.attachments = options.attachments
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested({ each: true })
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V3ProposeCredentialMessage.type)
  public readonly type = V3ProposeCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/propose-credential')

  @Expose({ name: 'credential_preview' })
  @Type(() => V3CredentialPreview)
  @ValidateNested()
  @IsOptional()
  @IsInstance(V3CredentialPreview)
  public credentialPreview?: V3CredentialPreview

  @Expose({ name: 'filters~attach' })
  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public proposalAttachments!: V2Attachment[]

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  public getProposalAttachmentById(id: string): V2Attachment | undefined {
    return this.proposalAttachments.find((attachment) => attachment.id === id)
  }
}
