import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../formats/models/ProofFormatSpec'

import { AgentMessage } from '@aries-framework/core'

export interface V2RequestPresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  willConfirm?: boolean
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2RequestPresentationMessage extends AgentMessage {
  public constructor(options: V2RequestPresentationMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? false

      for (const entry of options.attachmentInfo) {
        this.addRequestPresentationsAttachment(entry)
      }
    }
  }

  public addRequestPresentationsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.requestPresentationsAttach.push(attachment.attachment)
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

  @Expose({ name: 'request_presentations~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(Attachment, { each: true })
  public requestPresentationsAttach!: Attachment[]
}
