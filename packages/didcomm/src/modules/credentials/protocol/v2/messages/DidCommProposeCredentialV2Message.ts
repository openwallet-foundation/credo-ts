import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommCredentialFormatSpec } from '../../../models'

import { DidCommCredentialV2Preview } from './DidCommCredentialV2Preview'

export interface DidCommProposeCredentialV2MessageOptions {
  id?: string
  formats: DidCommCredentialFormatSpec[]
  proposalAttachments: DidCommAttachment[]
  comment?: string
  goalCode?: string
  goal?: string
  credentialPreview?: DidCommCredentialV2Preview
  attachments?: DidCommAttachment[]
}

export class DidCommProposeCredentialV2Message extends DidCommMessage {
  public constructor(options: DidCommProposeCredentialV2MessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.credentialPreview = options.credentialPreview
      this.formats = options.formats
      this.proposalAttachments = options.proposalAttachments
      this.appendedAttachments = options.attachments
    }
  }

  @Type(() => DidCommCredentialFormatSpec)
  @ValidateNested({ each: true })
  @IsArray()
  @IsInstance(DidCommCredentialFormatSpec, { each: true })
  public formats!: DidCommCredentialFormatSpec[]

  @IsValidMessageType(DidCommProposeCredentialV2Message.type)
  public readonly type = DidCommProposeCredentialV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/propose-credential')

  @Expose({ name: 'credential_preview' })
  @Type(() => DidCommCredentialV2Preview)
  @ValidateNested()
  @IsOptional()
  @IsInstance(DidCommCredentialV2Preview)
  public credentialPreview?: DidCommCredentialV2Preview

  @Expose({ name: 'filters~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(DidCommAttachment, { each: true })
  public proposalAttachments!: DidCommAttachment[]

  /**
   * Human readable information about this Credential Proposal,
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

  public getProposalAttachmentById(id: string): DidCommAttachment | undefined {
    return this.proposalAttachments.find((attachment) => attachment.id === id)
  }
}
