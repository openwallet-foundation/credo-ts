import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsInstance } from 'class-validator'
import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommFeatureQueryOptions } from '../../../../../models'
import { DidCommFeatureQuery } from '../../../../../models'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommFeaturesQueriesMessageOptions {
  id?: string
  queries: DidCommFeatureQueryOptions[]
  comment?: string
}

export class DidCommFeaturesQueriesMessage extends DidCommMessage {
  public constructor(options: DidCommFeaturesQueriesMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.queries = options.queries.map((q) => new DidCommFeatureQuery(q))
    }
  }

  @IsValidMessageType(DidCommFeaturesQueriesMessage.type)
  public readonly type = DidCommFeaturesQueriesMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/queries')

  @IsInstance(DidCommFeatureQuery, { each: true })
  @Type(() => DidCommFeatureQuery)
  @ArrayNotEmpty()
  public queries!: DidCommFeatureQuery[]
}
