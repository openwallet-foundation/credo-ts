import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export interface MediationGrantMessageOptions {
  id?: string
  endpoint: string
  routingKeys: string[]
  threadId: string
}

/**
 * A route grant message is a signal from the mediator to the recipient that permission is given to distribute the
 * included information as an inbound route.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-grant
 */
export class MediationGrantMessage extends DIDCommV1Message {
  public constructor(options: MediationGrantMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.endpoint = options.endpoint
      this.routingKeys = options.routingKeys
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @Equals(MediationGrantMessage.type)
  public readonly type = MediationGrantMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/1.0/mediate-grant'

  @IsNotEmpty()
  @IsArray()
  @Expose({ name: 'routing_keys' })
  public routingKeys!: string[]

  @IsNotEmpty()
  @IsString()
  public endpoint!: string
}

export class MediationGrantMessageV2Body {
  @IsNotEmpty()
  @IsArray()
  @Expose({ name: 'routing_keys' })
  public routingKeys!: string[]

  @IsNotEmpty()
  @IsString()
  public endpoint!: string
}

export type MediationGrantV2MessageOptions = {
  body: MediationGrantMessageV2Body
} & DIDCommV2MessageParams

/**
 * A route grant message is a signal from the mediator to the recipient that permission is given to distribute the
 * included information as an inbound route.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-grant
 */
export class MediationGrantMessageV2 extends DIDCommV2Message {
  public constructor(options: MediationGrantV2MessageOptions) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @Equals(MediationGrantMessageV2.type)
  public readonly type = MediationGrantMessageV2.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/mediate-grant'

  @Type(() => MediationGrantMessageV2Body)
  @ValidateNested()
  public body!: MediationGrantMessageV2Body
}
