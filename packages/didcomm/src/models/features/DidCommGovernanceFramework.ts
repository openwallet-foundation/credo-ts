import type { DidCommFeatureOptions } from './DidCommFeature'

import { DidCommFeature } from './DidCommFeature'

export type DidCommGovernanceFrameworkOptions = Omit<DidCommFeatureOptions, 'type'>

export class DidCommGovernanceFramework extends DidCommFeature {
  public constructor(props: DidCommGovernanceFrameworkOptions) {
    super({ ...props, type: DidCommGovernanceFramework.type })
  }

  public static readonly type = 'gov-fw'
}
