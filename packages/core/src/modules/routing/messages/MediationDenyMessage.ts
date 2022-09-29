import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export interface MediationDenyMessageOptions {
  id: string
}

/**
 * This message serves as notification of the mediator denying the recipient's request for mediation.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-deny
 */
export class MediationDenyMessage extends DIDCommV1Message {
  public constructor(options: MediationDenyMessageOptions) {
    super()

    if (options) {
      this.id = options.id
    }
  }

  @Equals(MediationDenyMessage.type)
  public readonly type = MediationDenyMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/1.0/mediate-deny'
}

export class MediationDenyMessageV2Body {}

export type MediationDenyMessageV2Options = {
  body: MediationDenyMessageV2Body
} & DIDCommV2MessageParams

/**
 * This message serves as notification of the mediator denying the recipient's request for mediation.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-deny
 */
export class MediationDenyMessageV2 extends DIDCommV2Message {
  public constructor(options: MediationDenyMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(MediationDenyMessageV2.type)
  public readonly type = MediationDenyMessageV2.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/mediate-deny'

  @Type(() => MediationDenyMessageV2Body)
  @ValidateNested()
  public body!: MediationDenyMessageV2Body
}
