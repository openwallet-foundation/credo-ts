import type { FeatureQueryOptions } from '../../../models'

import { Type } from 'class-transformer'
import { IsInstance } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { FeatureQuery } from '../../../models'

export interface V2DiscoverFeaturesQueriesMessageOptions {
  id?: string
  queries: FeatureQueryOptions[]
  comment?: string
}

export class V2QueriesMessage extends AgentMessage {
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
  public queries!: FeatureQuery[]
}
