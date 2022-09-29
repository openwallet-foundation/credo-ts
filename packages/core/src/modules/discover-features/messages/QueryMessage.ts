import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message, DIDCommV1Message } from '../../../agent/didcomm'

export interface DiscoverFeaturesQueryMessageOptions {
  id?: string
  query: string
  comment?: string
}

export class QueryMessage extends DIDCommV1Message {
  public constructor(options: DiscoverFeaturesQueryMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.query = options.query
      this.comment = options.comment
    }
  }

  @Equals(QueryMessage.type)
  public readonly type = QueryMessage.type
  public static readonly type = 'https://didcomm.org/discover-features/1.0/query'

  @IsString()
  public query!: string

  @IsString()
  @IsOptional()
  public comment?: string
}

export class QueryMessageV2Body {
  @IsString()
  public query!: string

  @IsString()
  @IsOptional()
  public comment?: string
}

export type QueryMessageV2Options = {
  body: QueryMessageV2Body
} & DIDCommV2MessageParams

export class QueryMessageV2 extends DIDCommV2Message {
  public constructor(options: QueryMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(QueryMessageV2.type)
  public readonly type = QueryMessageV2.type
  public static readonly type = 'https://didcomm.org/discover-features/1.0/query'

  @Type(() => QueryMessageV2Body)
  @ValidateNested()
  public body!: QueryMessageV2Body
}
