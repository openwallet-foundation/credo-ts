import type { DependencyManager } from './DependencyManager'
import type { FeatureRegistry } from '../agent/FeatureRegistry'
import type { Constructor } from '../utils/mixins'

export interface Module {
  api?: Constructor<unknown>
  register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void
}

export interface ApiModule extends Module {
  api: Constructor<unknown>
}
