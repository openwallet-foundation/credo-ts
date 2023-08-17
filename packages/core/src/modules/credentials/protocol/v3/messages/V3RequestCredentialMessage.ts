import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

export interface V3RequestCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  requestAttachments: V2Attachment[]
  comment?: string
}

export class V3RequestCredentialMessage extends DidCommV2Message {
  public constructor(options: V3RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.requestAttachments = options.requestAttachments
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V3RequestCredentialMessage.type)
  public readonly type = V3RequestCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/request-credential')

  @Expose({ name: 'requests~attach' })
  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(V2Attachment, { each: true })
  public requestAttachments!: V2Attachment[]

  /**
   * Human readable information about this Credential Request,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  public getRequestAttachmentById(id: string): V2Attachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id === id)
  }
}
