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
  formats: ProofFormatSpec[]
  requestAttachments: V1Attachment[]
}

export class V2RequestPresentationMessage extends DidCommV1Message {
  public constructor(options: V2RequestPresentationMessageOptions) {
    super()

    if (options) {
      this.formats = []
      this.requestAttachments = []
      this.id = options.id ?? uuid()
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? true
      this.presentMultiple = options.presentMultiple ?? false
      this.requestAttachments = options.requestAttachments
      this.formats = options.formats
    }
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
  public requestAttachments!: V1Attachment[]

  public getRequestAttachmentById(id: string): Attachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
