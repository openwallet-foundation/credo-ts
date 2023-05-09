import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../models/ProofFormatSpec'

export interface V2PresentationMessageOptions {
  id?: string
  goalCode?: string
  comment?: string
  lastPresentation?: boolean
  presentationAttachments: Attachment[]
  formats: ProofFormatSpec[]
}

export class V2PresentationMessage extends DidCommV1Message {
  public constructor(options: V2PresentationMessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.presentationAttachments = []
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.lastPresentation = options.lastPresentation ?? true

      this.formats = options.formats
      this.presentationAttachments = options.presentationAttachments
    }
  }

  @IsValidMessageType(V2PresentationMessage.type)
  public readonly type = V2PresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/presentation')

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
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(V1Attachment, { each: true })
  public presentationAttachments!: V1Attachment[]

  public getPresentationAttachmentById(id: string): V1Attachment | undefined {
    return this.presentationAttachments.find((attachment) => attachment.id === id)
  }
}
