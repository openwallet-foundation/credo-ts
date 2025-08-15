import type { DidCommFeatureQueryOptions } from '../../../../../models'

import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsInstance } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommFeatureQuery } from '../../../../../models'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface V2DiscoverFeaturesQueriesMessageOptions {
  id?: string
  queries: DidCommFeatureQueryOptions[]
  comment?: string
}

export class V2QueriesMessage extends DidCommMessage {
  public constructor(options: V2DiscoverFeaturesQueriesMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.queries = options.queries.map((q) => new DidCommFeatureQuery(q))
    }
  }

  @IsValidMessageType(V2QueriesMessage.type)
  public readonly type = V2QueriesMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/queries')

  @IsInstance(DidCommFeatureQuery, { each: true })
  @Type(() => DidCommFeatureQuery)
  @ArrayNotEmpty()
  public queries!: DidCommFeatureQuery[]
}
