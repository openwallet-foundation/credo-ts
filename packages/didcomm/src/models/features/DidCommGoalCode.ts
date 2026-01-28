import type { DidCommFeatureOptions } from './DidCommFeature'

import { DidCommFeature } from './DidCommFeature'

export type DidCommGoalCodeOptions = Omit<DidCommFeatureOptions, 'type'>

export class DidCommGoalCode extends DidCommFeature {
  public constructor(props: DidCommGoalCodeOptions) {
    super({ ...props, type: DidCommGoalCode.type })
  }

  public static readonly type = 'goal-code'
}
