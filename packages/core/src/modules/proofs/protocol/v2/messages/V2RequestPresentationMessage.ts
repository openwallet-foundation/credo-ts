import type { ProofAttachmentFormat } from '../../../formats/models/ProofAttachmentFormat'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { AriesFrameworkError } from '../../../../../error'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../models/ProofFormatSpec'

export interface V2RequestPresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  presentMultiple?: boolean
  willConfirm?: boolean
  parentThreadId?: string
  attachmentInfo: ProofAttachmentFormat[]
}

export class V2RequestPresentationMessage extends DidCommV1Message {
  public constructor(options: V2RequestPresentationMessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.requestPresentationsAttach = []
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? true
      this.presentMultiple = options.presentMultiple ?? false

      if (options.parentThreadId) {
        this.setThread({
          parentThreadId: options.parentThreadId,
        })
      }

      for (const entry of options.attachmentInfo) {
        this.addRequestPresentationsAttachment(entry)
      }
    }
  }

  public addRequestPresentationsAttachment(attachment: ProofAttachmentFormat) {
    this.formats.push(attachment.format)
    this.requestPresentationsAttach.push(attachment.attachment)
  }

  public getAttachmentByFormatIdentifier(formatIdentifier: string) {
    const format = this.formats.find((x) => x.format === formatIdentifier)
    if (!format) {
      throw new AriesFrameworkError(
        `Expected to find a format entry of type: ${formatIdentifier}, but none could be found.`
      )
    }

    const attachment = this.requestPresentationsAttach.find((x) => x.id === format.attachmentId)

    if (!attachment) {
      throw new AriesFrameworkError(
        `Expected to find an attachment entry with id: ${format.attachmentId}, but none could be found.`
      )
    }

    return attachment
  }

  /**
   * Every attachment has a corresponding entry in the formats array.
   * This method pairs those together in a {@link ProofAttachmentFormat} object.
   */
  public getAttachmentFormats(): ProofAttachmentFormat[] {
    const attachmentFormats: ProofAttachmentFormat[] = []

    this.formats.forEach((format) => {
      const attachment = this.requestPresentationsAttach.find((attachment) => attachment.id === format.attachmentId)

      if (!attachment) {
        throw new AriesFrameworkError(`Could not find a matching attachment with attachmentId: ${format.attachmentId}`)
      }

      attachmentFormats.push({ format, attachment })
    })
    return attachmentFormats
  }

  @IsValidMessageType(V2RequestPresentationMessage.type)
  public readonly type = V2RequestPresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/request-presentation')

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

  @Expose({ name: 'present_multiple' })
  @IsBoolean()
  public presentMultiple = false

  @Expose({ name: 'formats' })
  @Type(() => ProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(ProofFormatSpec, { each: true })
  public formats!: ProofFormatSpec[]

  @Expose({ name: 'request_presentations~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(V1Attachment, { each: true })
  public requestPresentationsAttach!: V1Attachment[]
}
