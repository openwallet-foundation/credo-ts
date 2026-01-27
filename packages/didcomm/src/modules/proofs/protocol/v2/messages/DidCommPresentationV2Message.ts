import { utils } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommProofFormatSpec } from '../../../models/DidCommProofFormatSpec'

export interface DidCommPresentationV2MessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  goal?: string
  lastPresentation?: boolean
  presentationAttachments: DidCommAttachment[]
  formats: DidCommProofFormatSpec[]
}

export class DidCommPresentationV2Message extends DidCommMessage {
  public constructor(options: DidCommPresentationV2MessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.presentationAttachments = []
      this.id = options.id ?? utils.uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.lastPresentation = options.lastPresentation ?? true

      this.formats = options.formats
      this.presentationAttachments = options.presentationAttachments
    }
  }

  @IsValidMessageType(DidCommPresentationV2Message.type)
  public readonly type = DidCommPresentationV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/presentation')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @IsString()
  @IsOptional()
  public goal?: string

  @Expose({ name: 'last_presentation' })
  @IsBoolean()
  public lastPresentation = true

  @Expose({ name: 'formats' })
  @Type(() => DidCommProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommProofFormatSpec, { each: true })
  public formats!: DidCommProofFormatSpec[]

  @Expose({ name: 'presentations~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommAttachment, { each: true })
  public presentationAttachments!: DidCommAttachment[]

  public getPresentationAttachmentById(id: string): DidCommAttachment | undefined {
    return this.presentationAttachments.find((attachment) => attachment.id === id)
  }
}
