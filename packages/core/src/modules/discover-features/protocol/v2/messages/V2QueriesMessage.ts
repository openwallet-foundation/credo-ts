import type { FeatureQueryOptions } from '../../../../../agent/models'

import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsInstance } from 'class-validator'

import { DIDCommV1Message } from '../../../../../agent/didcomm'
import { FeatureQuery } from '../../../../../agent/models'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export interface V2DiscoverFeaturesQueriesMessageOptions {
  id?: string
  queries: FeatureQueryOptions[]
  comment?: string
}

export class V2QueriesMessage extends DIDCommV1Message {
  public constructor(options: V2DiscoverFeaturesQueriesMessageOptions) {
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
