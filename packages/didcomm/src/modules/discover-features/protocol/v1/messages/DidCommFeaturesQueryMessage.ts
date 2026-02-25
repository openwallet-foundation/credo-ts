import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommFeaturesQueryMessageOptions {
  id?: string
  query: string
  comment?: string
}

export class DidCommFeaturesQueryMessage extends DidCommMessage {
  public constructor(options: DidCommFeaturesQueryMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.query = options.query
      this.comment = options.comment
    }
  }

  @IsValidMessageType(DidCommFeaturesQueryMessage.type)
  public readonly type = DidCommFeaturesQueryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/1.0/query')

  @IsString()
  public query!: string

  @IsString()
  @IsOptional()
  public comment?: string
}
