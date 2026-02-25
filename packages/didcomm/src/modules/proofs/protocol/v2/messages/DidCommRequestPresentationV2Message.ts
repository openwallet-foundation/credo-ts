import { utils } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommProofFormatSpec } from '../../../models/DidCommProofFormatSpec'

export interface DidCommRequestPresentationV2MessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  goal?: string
  presentMultiple?: boolean
  willConfirm?: boolean
  formats: DidCommProofFormatSpec[]
  requestAttachments: DidCommAttachment[]
}

export class DidCommRequestPresentationV2Message extends DidCommMessage {
  public constructor(options: DidCommRequestPresentationV2MessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.requestAttachments = []
      this.id = options.id ?? utils.uuid()
      this.comment = options.comment
      this.goal = options.goal
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? true
      this.presentMultiple = options.presentMultiple ?? false
      this.requestAttachments = options.requestAttachments
      this.formats = options.formats
    }
  }

  @IsValidMessageType(DidCommRequestPresentationV2Message.type)
  public readonly type = DidCommRequestPresentationV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/request-presentation')

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

  @Expose({ name: 'will_confirm' })
  @IsBoolean()
  public willConfirm = false

  @Expose({ name: 'present_multiple' })
  @IsBoolean()
  public presentMultiple = false

  @Expose({ name: 'formats' })
  @Type(() => DidCommProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommProofFormatSpec, { each: true })
  public formats!: DidCommProofFormatSpec[]

  @Expose({ name: 'request_presentations~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommAttachment, { each: true })
  public requestAttachments!: DidCommAttachment[]

  public getRequestAttachmentById(id: string): DidCommAttachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
