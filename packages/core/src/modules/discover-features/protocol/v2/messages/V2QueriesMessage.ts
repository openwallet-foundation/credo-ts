import type { V2QueriesMessageOptions } from './V2QueriesMessageOptions'

import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsInstance } from 'class-validator'

import { FeatureQuery } from '../../../../../agent/models'
import { DidCommV1Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export class V2QueriesMessage extends DidCommV1Message {
  public constructor(options: V2QueriesMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.queries = options.queries.map((q) => new FeatureQuery(q))
    }
  }

  @IsValidMessageType(V2QueriesMessage.type)
  public readonly type = V2QueriesMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/queries')

  @IsInstance(FeatureQuery, { each: true })
  @Type(() => FeatureQuery)
  @ArrayNotEmpty()
  public queries!: FeatureQuery[]
}
