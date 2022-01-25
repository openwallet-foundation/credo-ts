import type { ProofAttachmentFormat } from '../../../formats/ProofFormatService'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { ProofFormatSpec } from '../../../formats/models/ProofFormatServiceOptions'

import { AgentMessage } from '@aries-framework/core'
import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'
import { uuid } from 'packages/core/src/utils/uuid'

export interface V2RequestPresentationMessageOptions {
  id?: string
  goalCode?: string
  comment?: string
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2RequestPresentationMessage extends AgentMessage {
  public constructor(options: V2RequestPresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode

      for (const entry of options.attachmentInfo) {
        this.addProposalsAttachment(entry)
      }
    }
  }

  public addProposalsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.proposalsAttach.push(attachment.attachment)
  }

  @Equals(V2RequestPresentationMessage.type)
  public readonly type = V2RequestPresentationMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/2.0/request-presentation'

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
