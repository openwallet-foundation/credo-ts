import { utils } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommProofFormatSpec } from '../../../models/DidCommProofFormatSpec'

export interface DidCommProposePresentationV2MessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  goal?: string
  proposalAttachments: DidCommAttachment[]
  formats: DidCommProofFormatSpec[]
}

export class DidCommProposePresentationV2Message extends DidCommMessage {
  public constructor(options: DidCommProposePresentationV2MessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.proposalAttachments = []
      this.id = options.id ?? utils.uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.formats = options.formats
      this.proposalAttachments = options.proposalAttachments
    }
  }

  @IsValidMessageType(DidCommProposePresentationV2Message.type)
  public readonly type = DidCommProposePresentationV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/propose-presentation')

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

  @Type(() => DidCommProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommProofFormatSpec, { each: true })
  public formats!: DidCommProofFormatSpec[]

  @Expose({ name: 'proposals~attach' })
  @Type(() => DidCommAttachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(DidCommAttachment, { each: true })
  public proposalAttachments!: DidCommAttachment[]

  public getProposalAttachmentById(id: string): DidCommAttachment | undefined {
    return this.proposalAttachments.find((attachment) => attachment.id === id)
  }
}
