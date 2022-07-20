import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsArray, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

import { Keylist } from './KeylistMessage'

export class DidListMessageBody {
  @Type(() => Keylist)
  @IsArray()
  @ValidateNested()
  public updates!: Keylist[]
}

export type DidListMessageOptions = {
  body: DidListMessageBody
} & DIDCommV2MessageParams

export class DidListMessage extends DIDCommV2Message {
  public constructor(options: DidListMessageOptions) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @Equals(DidListMessage.type)
  public readonly type = DidListMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/didlist'

  @Type(() => DidListMessageBody)
  @ValidateNested()
  public body!: DidListMessageBody
}
