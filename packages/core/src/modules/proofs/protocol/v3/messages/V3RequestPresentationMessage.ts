import { Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { V2Attachment } from '../../../../../decorators/attachment'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { uuid } from '../../../../../utils/uuid'

export interface V3RequestPresentationMessageOptions {
  id?: string
  comment?: string
  goalCode?: string
  willConfirm?: boolean
  attachments: V2Attachment[]
}

class V3RequestPresentationMessageBody {
  public constructor(options: { goalCode?: string; comment?: string; willConfirm?: boolean }) {
    if (options) {
      this.comment = options.comment
      this.goalCode = options.goalCode
      this.willConfirm = options.willConfirm ?? true
    }
  }

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'goal_code' })
  @IsString()
  @IsOptional()
  public goalCode?: string

  @Expose({ name: 'will_confirm' })
  @IsBoolean()
  public willConfirm!: boolean
}

export class V3RequestPresentationMessage extends DidCommV2Message {
  public constructor(options: V3RequestPresentationMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? uuid()
      this.body = new V3RequestPresentationMessageBody(options)
      this.attachments = options.attachments
    }
  }

  @IsValidMessageType(V3RequestPresentationMessage.type)
  public readonly type = V3RequestPresentationMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/3.0/request-presentation')

  @IsObject()
  @ValidateNested()
  @Type(() => V3RequestPresentationMessageBody)
  public body!: V3RequestPresentationMessageBody

  @Type(() => V2Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Array<V2Attachment>
}
