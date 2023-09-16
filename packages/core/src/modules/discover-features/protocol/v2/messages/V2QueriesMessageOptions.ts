import type { FeatureQueryOptions } from '../../../../../agent/models'

export interface V2QueriesMessageOptions {
  id?: string
  queries: FeatureQueryOptions[]
}
