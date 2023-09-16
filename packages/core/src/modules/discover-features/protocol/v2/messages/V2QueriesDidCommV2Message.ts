import type { V2QueriesMessageOptions } from './V2QueriesMessageOptions'

import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsInstance, IsObject, ValidateNested } from 'class-validator'

import { FeatureQuery } from '../../../../../agent/models'
import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

class V2QueriesMessageBody {
  public constructor(options: { queries: FeatureQuery[] }) {
    if (options) {
      this.queries = options.queries
    }
  }
  @IsInstance(FeatureQuery, { each: true })
  @Type(() => FeatureQuery)
  @ArrayNotEmpty()
  public queries!: FeatureQuery[]
}

export class V2QueriesDidCommV2Message extends DidCommV2Message {
  public readonly allowDidSovPrefix = false

  public constructor(options: V2QueriesMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.body = new V2QueriesMessageBody({ queries: options.queries.map((q) => new FeatureQuery(q)) })
    }
  }

  @IsValidMessageType(V2QueriesDidCommV2Message.type)
  public readonly type = V2QueriesDidCommV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/queries')

  @IsObject()
  @ValidateNested()
  @Type(() => V2QueriesMessageBody)
  public body!: V2QueriesMessageBody

  public get queries() {
    return this.body.queries
  }
}
