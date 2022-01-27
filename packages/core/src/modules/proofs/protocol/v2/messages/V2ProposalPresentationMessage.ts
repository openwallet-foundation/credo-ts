import type { ProofAttachmentFormat } from '../../../formats/models/ProofFormatServiceOptions'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../formats/models/ProofFormatServiceOptions'

import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'

export interface V2ProposePresentationMessageOptions {
  id?: string
  formats: ProofFormatSpec
  filtersAttach: Attachment[]
  comment?: string
  goalCode?: string
  willConfirm?: boolean
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2ProposalPresentationMessage extends AgentMessage {
  public constructor(options: V2ProposePresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? false

      for (const entry of options.attachmentInfo) {
        this.addProposalsAttachment(entry)
      }
    }
  }

  public addProposalsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.proposalsAttach.push(attachment.attachment)
  }

  @Equals(V2ProposalPresentationMessage.type)
  public readonly type = V2ProposalPresentationMessage.type
  public static readonly type = `https://didcomm.org/present-proof/2.0/propose-presentation`

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @Expose({ name: 'will_confirm' })
  @IsBoolean()
  public willConfirm = false

  @Expose({ name: 'formats' })
  @Type(() => ProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(ProofFormatSpec, { each: true })
  public formats!: ProofFormatSpec[]

  @Expose({ name: 'proposals~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(Attachment, { each: true })
  public proposalsAttach!: Attachment[]
}
