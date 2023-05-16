import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V1Attachment } from '../../../../../decorators/attachment/V1Attachment'
import { DidCommV1Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'
import { ProofFormatSpec } from '../../../models/ProofFormatSpec'

export interface V2ProposePresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  proposalAttachments: V1Attachment[]
  formats: ProofFormatSpec[]
}

export class V2ProposePresentationMessage extends DidCommV1Message {
  public constructor(options: V2ProposePresentationMessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.proposalAttachments = []
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.formats = options.formats
      this.proposalAttachments = options.proposalAttachments
    }
  }

  @IsValidMessageType(V2ProposePresentationMessage.type)
  public readonly type = V2ProposePresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/propose-presentation')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @Type(() => ProofFormatSpec)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(ProofFormatSpec, { each: true })
  public formats!: ProofFormatSpec[]

  @Expose({ name: 'proposals~attach' })
  @Type(() => V1Attachment)
  @IsArray()
  @ValidateNested({ each: true })
  @IsInstance(V1Attachment, { each: true })
  public proposalAttachments!: V1Attachment[]

  public getProposalAttachmentById(id: string): V1Attachment | undefined {
    return this.proposalAttachments.find((attachment) => attachment.id === id)
  }
}
