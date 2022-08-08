import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../models/ProofFormatSpec'

export interface V2ProposePresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  willConfirm?: boolean
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2ProposalPresentationMessage extends AgentMessage {
  public constructor(options: V2ProposePresentationMessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.proposalsAttach = []
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

  /**
   * Every attachment has a corresponding entry in the formats array.
   * This method pairs those together in a {@link ProofAttachmentFormat} object.
   */
  public getAttachmentFormats(): ProofAttachmentFormat[] {
    const attachmentFormats: ProofAttachmentFormat[] = []

    this.formats.forEach((format) => {
      const attachment = this.proposalsAttach.find((attachment) => attachment.id === format.attachmentId)

      if (!attachment) {
        throw new AriesFrameworkError(`Could not find a matching attachment with attachmentId: ${format.attachmentId}`)
      }

      attachmentFormats.push({ format, attachment })
    })
    return attachmentFormats
  }

  @IsValidMessageType(V2ProposalPresentationMessage.type)
  public readonly type = V2ProposalPresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType(`https://didcomm.org/present-proof/2.0/propose-presentation`)

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
