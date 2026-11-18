import type { DidCommFeatureOptions } from './DidCommFeature'

import { DidCommFeature } from './DidCommFeature'

export type DidCommHeaderOptions = Omit<DidCommFeatureOptions, 'type'>

/** A DIDComm v2 message header the agent understands: https://identity.foundation/didcomm-messaging/spec/v2.1/#discover-features-protocol-20 */
export class DidCommHeader extends DidCommFeature {
  public constructor(props: DidCommHeaderOptions) {
    super({ ...props, type: DidCommHeader.type })
  }

  public static readonly type = 'header'
}
