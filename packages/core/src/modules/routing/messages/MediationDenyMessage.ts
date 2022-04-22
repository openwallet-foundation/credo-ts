import { Equals } from 'class-validator'

import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'

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
