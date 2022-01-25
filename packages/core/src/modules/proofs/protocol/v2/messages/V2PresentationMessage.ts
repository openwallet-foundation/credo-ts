import type { ProofAttachmentFormat } from '../../../formats/ProofFormatService'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { ProofFormatSpec } from '../../../formats/models/ProofFormatServiceOptions'

import { AgentMessage } from '@aries-framework/core'
import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'
import { uuid } from 'packages/core/src/utils/uuid'

export interface V2PresentationMessageOptions {
  id?: string
  goalCode?: string
  comment?: string
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2PresentationMessage extends AgentMessage {
  public constructor(options: V2PresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode

      for (const entry of options.attachmentInfo) {
        this.addPresentationsAttachment(entry)
      }
    }
  }

  public addPresentationsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.presentationsAttach.push(attachment.attachment)
  }

  @Equals(V2PresentationMessage.type)
  public readonly type = V2PresentationMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/2.0/presentation'

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

  @Expose({ name: 'presentations~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(Attachment, { each: true })
  public presentationsAttach!: Attachment[]
}
