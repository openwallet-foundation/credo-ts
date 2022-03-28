import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../formats/models/ProofFormatSpec'

export interface V2PresentationMessageOptions {
  id?: string
  goalCode?: string
  comment?: string
  lastPresentation?: boolean
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2PresentationMessage extends AgentMessage {
  public constructor(options: V2PresentationMessageOptions) {
    super()

    this.formats = []
    this.presentationsAttach = []

    if (options) {
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.lastPresentation = options.lastPresentation ?? true

      for (const entry of options.attachmentInfo) {
        this.addPresentationsAttachment(entry)
      }
    }
  }

  public addPresentationsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.presentationsAttach.push(attachment.attachment)
  }

  /**
   * Every attachment has a corresponding entry in the formats array.
   * This method pairs those together in a {@link ProofAttachmentFormat} object.
   */
  public getAttachmentFormats(): ProofAttachmentFormat[] {
    const attachmentFormats: ProofAttachmentFormat[] = []

    this.formats.forEach((format) => {
      const attachment = this.presentationsAttach.find((attachment) => attachment.id === format.attachmentId)

      if (!attachment) {
        throw new AriesFrameworkError(`Could not find a matching attachment with attachId: ${format.attachmentId}`)
      }

      attachmentFormats.push({ format, attachment })
    })
    return attachmentFormats
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

  @Expose({ name: 'last_presentation' })
  @IsBoolean()
  public lastPresentation = true

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
