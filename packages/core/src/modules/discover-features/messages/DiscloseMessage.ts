import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export interface DiscloseProtocolOptions {
  protocolId: string
  roles?: string[]
}

export class DiscloseProtocol {
  public constructor(options: DiscloseProtocolOptions) {
    if (options) {
      this.protocolId = options.protocolId
      this.roles = options.roles
    }
  }

  @Expose({ name: 'pid' })
  @IsString()
  public protocolId!: string

  @IsString({ each: true })
  @IsOptional()
  public roles?: string[]
}

export interface DiscoverFeaturesDiscloseMessageOptions {
  id?: string
  threadId: string
  protocols: DiscloseProtocolOptions[]
}

export class DiscloseMessage extends DIDCommV1Message {
  public constructor(options: DiscoverFeaturesDiscloseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.protocols = options.protocols.map((p) => new DiscloseProtocol(p))
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @Equals(DiscloseMessage.type)
  public readonly type = DiscloseMessage.type
  public static readonly type = 'https://didcomm.org/discover-features/1.0/disclose'

  @IsInstance(DiscloseProtocol, { each: true })
  @Type(() => DiscloseProtocol)
  public protocols!: DiscloseProtocol[]
}

export class DiscloseMessageV2Body {
  @IsInstance(DiscloseProtocol, { each: true })
  @Type(() => DiscloseProtocol)
  public protocols!: DiscloseProtocol[]
}

export type DiscloseMessageV2Options = {
  body: DiscloseMessageV2Body
} & DIDCommV2MessageParams

export class DiscloseMessageV2 extends DIDCommV2Message {
  public constructor(options: DiscloseMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(DiscloseMessageV2.type)
  public readonly type = DiscloseMessageV2.type
  public static readonly type = 'https://didcomm.org/discover-features/2.0/disclose'

  @Type(() => DiscloseMessageV2Body)
  @ValidateNested()
  public body!: DiscloseMessageV2Body
}
